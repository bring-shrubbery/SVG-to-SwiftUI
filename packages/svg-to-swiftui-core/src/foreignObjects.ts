import type { ElementNode, Node } from "svg-parser";
import type { RenderDocument, RenderForeignObject, RenderNode } from "./renderTree/types";
import { type InternalGeneratorConfig, resolveResourceAsync, resourceLimits, resourceState } from "./resources";
import type {
  ConversionArtifact,
  ForeignObjectResolvedResource,
  ForeignObjectSnapshotRequest,
  ViewBoxData,
} from "./types";

export interface PreparedForeignObjectSnapshot {
  resource?: RenderForeignObject["resource"];
  scale: number;
  diagnostics: Array<{ code: string; message: string }>;
}

const ACTIVE_ELEMENTS = new Set(["script", "iframe", "object", "embed", "audio", "video", "canvas"]);
const INHERITED_CSS = new Set([
  "color",
  "direction",
  "font-family",
  "font-size",
  "font-stretch",
  "font-style",
  "font-variant",
  "font-weight",
  "letter-spacing",
  "line-height",
  "text-align",
  "text-decoration",
  "text-orientation",
  "visibility",
  "white-space",
  "word-spacing",
  "writing-mode",
]);

function childElements(element: ElementNode): ElementNode[] {
  return element.children.filter(
    (child): child is ElementNode => typeof child !== "string" && child.type === "element",
  );
}

export function foreignObjectKey(element: ElementNode, parents: Map<ElementNode, ElementNode>): string {
  const parts: string[] = [];
  let current: ElementNode | undefined = element;
  while (current) {
    const parent = parents.get(current);
    const index = parent ? childElements(parent).indexOf(current) : 0;
    parts.push(`${current.tagName ?? "unknown"}[${Math.max(0, index)}]`);
    current = parent;
  }
  return parts.reverse().join("/");
}

function rootElement(element: ElementNode, parents: Map<ElementNode, ElementNode>): ElementNode {
  let root = element;
  while (parents.get(root)) root = parents.get(root)!;
  return root;
}

function textValue(node: Node | string): string {
  if (typeof node === "string") return node;
  if (node.type === "text") return String(node.value ?? "");
  if (node.type !== "element" || ACTIVE_ELEMENTS.has((node.tagName ?? "").toLowerCase())) return "";
  return node.children.map(textValue).join("");
}

function decodedText(value: string): string {
  const named: Record<string, string> = { amp: "&", apos: "'", gt: ">", lt: "<", quot: '"', nbsp: " " };
  return value
    .replace(/&#x([\da-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&([a-z]+);/gi, (match, name: string) => named[name.toLowerCase()] ?? match)
    .replace(/\s+/g, " ")
    .trim();
}

function accessibilityLabel(element: ElementNode): string | undefined {
  const visit = (node: ElementNode): string | undefined => {
    const label = node.properties?.["aria-label"];
    if (label !== undefined && String(label).trim()) return decodedText(String(label));
    for (const child of childElements(node)) {
      const nested = visit(child);
      if (nested) return nested;
    }
    return undefined;
  };
  return visit(element) ?? (decodedText(element.children.map(textValue).join("")) || undefined);
}

function escapedAttribute(value: string): string {
  return value
    .replace(/&(?!#\d+;|#x[\da-f]+;|[a-z][\w:-]*;)/gi, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function sanitizeCSS(value: string): string {
  return value
    .replace(/@import\s+[^;]+;/gi, "")
    .replace(/@(?:-\w+-)?keyframes\s+[^{]+\{(?:[^{}]|\{[^{}]*\})*\}/gi, "")
    .replace(/expression\s*\([^)]*\)/gi, "")
    .replace(/url\(\s*(["']?)\s*(?:javascript|vbscript):[^)]*\1\s*\)/gi, "none");
}

function serializedProperty(name: string, value: unknown): string | undefined {
  const normalized = name.toLowerCase();
  if (/^on/.test(normalized) || ["srcdoc", "action", "formaction"].includes(normalized)) return undefined;
  const stringValue = Array.isArray(value) ? value.join(" ") : String(value);
  if (
    ["href", "xlink:href", "src"].includes(normalized) &&
    /^\s*(?:javascript|vbscript|data\s*:\s*text\/html)/i.test(stringValue)
  )
    return undefined;
  if (normalized === "style") return `style="${escapedAttribute(sanitizeCSS(stringValue))}"`;
  if (value === true) return normalized;
  if (value === false || value === undefined || value === null) return undefined;
  return `${normalized}="${escapedAttribute(stringValue)}"`;
}

function serializeNode(node: Node | string): string {
  if (typeof node === "string") return node;
  if (node.type === "text") return String(node.value ?? "");
  if (node.type !== "element") return "";
  const tag = (node.tagName ?? "div").toLowerCase();
  if (ACTIVE_ELEMENTS.has(tag)) return "";
  const properties = Object.entries(node.properties ?? {})
    .filter(([name]) => !(tag === "a" && ["href", "xlink:href"].includes(name.toLowerCase())))
    .map(([name, value]) => serializedProperty(name, value))
    .filter((value): value is string => !!value)
    .join(" ");
  const children =
    tag === "style" ? sanitizeCSS(node.children.map(textValue).join("")) : node.children.map(serializeNode).join("");
  return `<${tag}${properties ? ` ${properties}` : ""}>${children}</${tag}>`;
}

function globalStyles(root: ElementNode): string {
  const styles: string[] = [];
  const visit = (element: ElementNode): void => {
    if ((element.tagName ?? "").toLowerCase() === "style")
      styles.push(sanitizeCSS(element.children.map(textValue).join("")));
    for (const child of childElements(element)) visit(child);
  };
  visit(root);
  return styles.join("\n");
}

function inheritedStyle(presentation: Readonly<Record<string, string | number>>): string {
  return Object.entries(presentation)
    .filter(([name]) => INHERITED_CSS.has(name))
    .map(
      ([name, value]) =>
        `${name}:${typeof value === "number" && ["font-size", "letter-spacing", "word-spacing"].includes(name) ? `${value}px` : value}`,
    )
    .join(";");
}

export function foreignObjectSnapshotDocument(
  element: ElementNode,
  parents: Map<ElementNode, ElementNode>,
  viewport: ViewBoxData,
  presentation: Readonly<Record<string, string | number>>,
): { document: string; accessibilityLabel?: string } {
  const styles = globalStyles(rootElement(element, parents));
  const content = element.children.map(serializeNode).join("");
  const label = accessibilityLabel(element);
  const reset =
    "html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent}svg{display:block;overflow:hidden}*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";
  const document = [
    "<!doctype html>",
    '<html><head><meta charset="utf-8">',
    "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; img-src data: blob: https: http:; style-src 'unsafe-inline' data: https: http:; font-src data: blob: https: http:; media-src 'none'; connect-src 'none'; script-src 'none'; frame-src 'none'; object-src 'none'; base-uri https: http:; form-action 'none'\">",
    `<style>${reset}\n${styles}</style></head><body>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${viewport.width}" height="${viewport.height}" viewBox="0 0 ${viewport.width} ${viewport.height}">`,
    `<foreignObject x="0" y="0" width="${viewport.width}" height="${viewport.height}" overflow="hidden" style="${escapedAttribute(inheritedStyle(presentation))}">${content}</foreignObject>`,
    "</svg></body></html>",
  ].join("");
  return { document, ...(label ? { accessibilityLabel: label } : {}) };
}

function u32(value: number): Uint8Array {
  return Uint8Array.from([(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const name = Uint8Array.from(type.split("").map((character) => character.charCodeAt(0)));
  return concat([u32(data.length), name, data, u32(crc32(concat([name, data])))]);
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

/** Deterministic PNG encoder using uncompressed DEFLATE blocks. */
export function encodeRGBAAsPNG(rgba: Uint8Array, width: number, height: number): Uint8Array {
  const scanlines = new Uint8Array(height * (1 + width * 4));
  for (let row = 0; row < height; row++)
    scanlines.set(rgba.subarray(row * width * 4, (row + 1) * width * 4), row * (1 + width * 4) + 1);
  const blocks: Uint8Array[] = [Uint8Array.from([0x78, 0x01])];
  for (let offset = 0; offset < scanlines.length; offset += 65535) {
    const length = Math.min(65535, scanlines.length - offset);
    const final = offset + length === scanlines.length ? 1 : 0;
    blocks.push(Uint8Array.from([final, length & 255, (length >>> 8) & 255, ~length & 255, (~length >>> 8) & 255]));
    blocks.push(scanlines.subarray(offset, offset + length));
  }
  blocks.push(u32(adler32(scanlines)));
  const header = new Uint8Array(13);
  header.set(u32(width), 0);
  header.set(u32(height), 4);
  header.set([8, 6, 0, 0, 0], 8);
  return concat([
    Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", concat(blocks)),
    chunk("IEND", new Uint8Array()),
  ]);
}

function contentHash(bytes: Uint8Array): string {
  let left = 2166136261;
  let right = 2246822519;
  for (const byte of bytes) {
    left = Math.imul(left ^ byte, 16777619) >>> 0;
    right = Math.imul(right ^ byte, 3266489917) >>> 0;
  }
  return `${left.toString(16).padStart(8, "0")}${right.toString(16).padStart(8, "0")}`;
}

function foreignNodes(nodes: RenderNode[], result: RenderForeignObject[] = []): RenderForeignObject[] {
  for (const node of nodes) {
    if (node.type === "foreignObject") result.push(node);
    else if (node.type === "group") foreignNodes(node.children, result);
  }
  return result;
}

function elementIndex(root: ElementNode, parents: Map<ElementNode, ElementNode>): Map<string, ElementNode> {
  const result = new Map<string, ElementNode>();
  const visit = (element: ElementNode): void => {
    result.set(foreignObjectKey(element, parents), element);
    for (const child of childElements(element)) visit(child);
  };
  visit(root);
  return result;
}

const SYNTHETIC_BASE = "https://svg-to-swiftui.invalid/";

function browserBaseURL(config: InternalGeneratorConfig): string {
  const original = config.__resourceBaseURL ?? config.resources?.baseURL;
  if (original && /^https?:/i.test(original)) return original;
  if (config.resources?.policy === "local" && config.resources.baseDirectory && original) {
    const root = config.resources.baseDirectory.replace(/\\/g, "/").replace(/\/+$/, "");
    const relative = original.replace(/\\/g, "/").startsWith(`${root}/`) ? original.slice(root.length + 1) : "root.svg";
    return new URL(relative, SYNTHETIC_BASE).href;
  }
  if (original) {
    try {
      const parsed = new URL(original);
      return new URL(parsed.pathname.replace(/^\/+/, "") || "root.svg", SYNTHETIC_BASE).href;
    } catch {}
  }
  return `${SYNTHETIC_BASE}root.svg`;
}

function relativeSyntheticURL(url: string, baseURL: string): string {
  if (!url.startsWith(SYNTHETIC_BASE)) return url;
  const target = new URL(url).pathname.split("/").filter(Boolean);
  const parent = new URL(baseURL).pathname.split("/").filter(Boolean);
  parent.pop();
  while (target.length > 0 && parent.length > 0 && target[0] === parent[0]) {
    target.shift();
    parent.shift();
  }
  return `${parent.map(() => "..").join("/")}${parent.length && target.length ? "/" : ""}${target.join("/")}` || ".";
}

export async function prepareForeignObjectSnapshots(
  document: RenderDocument,
  root: ElementNode,
  config: InternalGeneratorConfig,
): Promise<void> {
  const prepared = (config.__foreignObjectSnapshots ??= new Map());
  const artifacts = (config.__conversionArtifacts ??= new Map());
  const elements = elementIndex(root, document.resources.parents);
  const limits = resourceLimits(config);
  const configuredMax = config.foreignObjects?.maxScale ?? 4;
  const maxScale = Number.isFinite(configuredMax) ? Math.max(0.25, Math.min(8, configuredMax)) : 4;
  const configuredScale = config.foreignObjects?.scale ?? 1;
  const scale = Number.isFinite(configuredScale) ? Math.max(0.25, Math.min(maxScale, configuredScale)) : 1;

  for (const node of foreignNodes(document.children)) {
    if (prepared.has(node.key) || node.viewport.width <= 0 || node.viewport.height <= 0) continue;
    const diagnostics: PreparedForeignObjectSnapshot["diagnostics"] = [];
    if (configuredScale !== scale)
      diagnostics.push({
        code: "foreign-object-scale-clamped",
        message: `foreignObject snapshot scale ${configuredScale} was clamped to the supported value ${scale}.`,
      });
    const element = elements.get(node.key);
    if (!element) {
      prepared.set(node.key, {
        scale,
        diagnostics: [
          { code: "foreign-object-internal-error", message: "Could not locate the foreignObject source element." },
        ],
      });
      continue;
    }
    if (!config.foreignObjectRenderer) {
      prepared.set(node.key, {
        scale,
        diagnostics: [
          ...diagnostics,
          {
            code: "missing-foreign-object-renderer",
            message:
              "Static foreignObject content requires convertAsync() with a foreignObjectRenderer adapter; the content was omitted.",
          },
        ],
      });
      continue;
    }
    const pixelWidth = Math.max(1, Math.round(node.viewport.width * scale));
    const pixelHeight = Math.max(1, Math.round(node.viewport.height * scale));
    if (pixelWidth * pixelHeight > limits.maxImagePixels) {
      prepared.set(node.key, {
        scale,
        diagnostics: [
          ...diagnostics,
          {
            code: "foreign-object-pixel-limit",
            message: `foreignObject snapshot ${pixelWidth}×${pixelHeight} exceeds the ${limits.maxImagePixels}-pixel limit.`,
          },
        ],
      });
      continue;
    }
    const baseURL = browserBaseURL(config);
    const resolveResource = async (url: string): Promise<ForeignObjectResolvedResource | undefined> => {
      const resolved = await resolveResourceAsync(
        relativeSyntheticURL(url, baseURL),
        "foreign-object",
        element,
        config,
      );
      if ("failure" in resolved || !resolved.resource.bytes) return undefined;
      return {
        bytes: resolved.resource.bytes,
        mimeType: resolved.resource.mimeType,
        canonicalURL: resolved.resource.canonicalURL,
      };
    };
    const request: ForeignObjectSnapshotRequest = {
      document: node.snapshotDocument,
      viewport: node.viewport,
      pixelWidth,
      pixelHeight,
      scale,
      source: { element: "foreignObject", ...(node.source.id ? { id: node.source.id } : {}) },
      baseURL,
      ...(node.accessibilityLabel ? { accessibilityLabel: node.accessibilityLabel } : {}),
      resolveResource,
    };
    try {
      const snapshot = await config.foreignObjectRenderer(request);
      if (
        snapshot.width !== pixelWidth ||
        snapshot.height !== pixelHeight ||
        snapshot.scale !== scale ||
        snapshot.rgba.byteLength !== pixelWidth * pixelHeight * 4
      ) {
        throw new Error(
          `renderer returned ${snapshot.width}×${snapshot.height} at scale ${snapshot.scale} with ${snapshot.rgba.byteLength} RGBA bytes; expected ${pixelWidth}×${pixelHeight} at scale ${scale} with ${pixelWidth * pixelHeight * 4} bytes`,
        );
      }
      const png = encodeRGBAAsPNG(snapshot.rgba, pixelWidth, pixelHeight);
      if (png.byteLength > limits.maxResourceBytes)
        throw new Error(`encoded PNG is ${png.byteLength} bytes, exceeding the ${limits.maxResourceBytes}-byte limit`);
      const state = resourceState(config);
      if (state.totalBytes + png.byteLength > limits.maxTotalBytes)
        throw new Error(`encoded PNG would exceed the ${limits.maxTotalBytes}-byte aggregate limit`);
      if (state.count + 1 > limits.maxResources)
        throw new Error(`snapshot would exceed the ${limits.maxResources}-resource limit`);
      state.totalBytes += png.byteLength;
      state.count++;
      const hash = contentHash(png);
      const canonicalURL = `foreign-object://fnv1a-${hash}.png`;
      const threshold = Math.max(0, config.foreignObjects?.inlineByteLimit ?? 256 * 1024);
      const external = config.__extractForeignObjectArtifacts === true && png.byteLength > threshold;
      const assetName = `ForeignObject_${hash}`;
      if (external) {
        const artifact: ConversionArtifact = {
          name: `${assetName}.png`,
          mimeType: "image/png",
          bytes: png,
          width: pixelWidth,
          height: pixelHeight,
          scale,
        };
        artifacts.set(artifact.name, artifact);
      }
      prepared.set(node.key, {
        scale,
        diagnostics,
        resource: {
          type: "raster",
          ...(external ? { assetName } : { bytes: png }),
          mimeType: "image/png",
          canonicalURL,
          intrinsicSize: { width: pixelWidth, height: pixelHeight },
        },
      });
    } catch (error) {
      prepared.set(node.key, {
        scale,
        diagnostics: [
          ...diagnostics,
          {
            code: "foreign-object-renderer-error",
            message: `foreignObject snapshot renderer failed: ${error instanceof Error ? error.message : String(error)}. The content was omitted.`,
          },
        ],
      });
    }
  }
}
