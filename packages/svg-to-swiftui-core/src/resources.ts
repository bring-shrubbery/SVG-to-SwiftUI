import { type ElementNode, parse } from "svg-parser";
import type {
  ResolvedResource,
  ResourceConfiguration,
  ResourceKind,
  ResourceLimits,
  ResourceRequest,
  SwiftUIGeneratorConfig,
} from "./types";

export const DEFAULT_RESOURCE_LIMITS: Required<ResourceLimits> = {
  maxResourceBytes: 5 * 1024 * 1024,
  maxImagePixels: 16_000_000,
  maxTotalBytes: 20 * 1024 * 1024,
  maxResources: 128,
  maxNestingDepth: 8,
};

export interface PreparedResource {
  bytes?: Uint8Array;
  mimeType: string;
  canonicalURL: string;
  assetName?: string;
  intrinsicSize?: { width: number; height: number };
  metadata?: Readonly<Record<string, string | number | boolean>>;
}

export interface ResourceFailure {
  code: string;
  message: string;
}

export type ResourceResolution = { resource: PreparedResource } | { failure: ResourceFailure };

export interface ResourceState {
  cache: Map<string, ResourceResolution>;
  canonicalCache: Map<string, ResourceResolution>;
  totalBytes: number;
  count: number;
  activeCanonicalURLs: string[];
  depth: number;
}

export interface InternalGeneratorConfig extends SwiftUIGeneratorConfig {
  __resourceState?: ResourceState;
  __resourceBaseURL?: string;
}

export function resourceState(config: InternalGeneratorConfig): ResourceState {
  if (config.__resourceState) return config.__resourceState;
  const state: ResourceState = {
    cache: new Map(),
    canonicalCache: new Map(),
    totalBytes: 0,
    count: 0,
    activeCanonicalURLs: [],
    depth: 0,
  };
  config.__resourceState = state;
  return state;
}

export function resourceLimits(config: SwiftUIGeneratorConfig): Required<ResourceLimits> {
  return { ...DEFAULT_RESOURCE_LIMITS, ...(config.resources?.limits ?? {}) };
}

function normalizedMime(value: string | undefined): string | undefined {
  return value?.split(";", 1)[0]?.trim().toLowerCase() || undefined;
}

function utf8(value: string): Uint8Array {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(value);
  const encoded = unescape(encodeURIComponent(value));
  const bytes = new Uint8Array(encoded.length);
  for (let index = 0; index < encoded.length; index++) bytes[index] = encoded.charCodeAt(index);
  return bytes;
}

export function decodeUTF8(bytes: Uint8Array): string {
  if (typeof TextDecoder !== "undefined") return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return decodeURIComponent(escape(binary));
}

function decodeBase64(value: string): Uint8Array | undefined {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const clean = value.replace(/[\t\n\r ]+/g, "");
  if (clean.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(clean) || !/^[^=]*(?:={0,2})$/.test(clean)) return undefined;
  const bytes: number[] = [];
  for (let index = 0; index < clean.length; index += 4) {
    const a = alphabet.indexOf(clean[index]!);
    const b = alphabet.indexOf(clean[index + 1]!);
    const c = clean[index + 2] === "=" ? 0 : alphabet.indexOf(clean[index + 2]!);
    const d = clean[index + 3] === "=" ? 0 : alphabet.indexOf(clean[index + 3]!);
    if (a < 0 || b < 0 || c < 0 || d < 0) return undefined;
    const value24 = (a << 18) | (b << 12) | (c << 6) | d;
    bytes.push((value24 >> 16) & 255);
    if (clean[index + 2] !== "=") bytes.push((value24 >> 8) & 255);
    if (clean[index + 3] !== "=") bytes.push(value24 & 255);
  }
  return Uint8Array.from(bytes);
}

function decodePercentBytes(value: string): Uint8Array | undefined {
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index++) {
    if (value[index] === "%") {
      const token = value.slice(index + 1, index + 3);
      if (!/^[\da-f]{2}$/i.test(token)) return undefined;
      bytes.push(Number.parseInt(token, 16));
      index += 2;
    } else {
      const code = value.charCodeAt(index);
      if (code > 127) bytes.push(...utf8(value[index] ?? ""));
      else bytes.push(code);
    }
  }
  return Uint8Array.from(bytes);
}

export function parseDataURL(rawURL: string): ResourceResolution | undefined {
  if (!/^data:/i.test(rawURL)) return undefined;
  const comma = rawURL.indexOf(",");
  if (comma < 0)
    return { failure: { code: "malformed-data-url", message: "Data URL is missing its comma separator." } };
  const header = rawURL.slice(5, comma);
  const segments = header.split(";");
  const mimeType = normalizedMime(segments.shift()) ?? "text/plain";
  const charset = segments
    .map((segment) =>
      /^charset\s*=\s*(.+)$/i
        .exec(segment.trim())?.[1]
        ?.replace(/^["']|["']$/g, "")
        .toLowerCase(),
    )
    .find(Boolean);
  if (charset && !["utf-8", "utf8", "us-ascii"].includes(charset))
    return {
      failure: {
        code: "unsupported-data-url-charset",
        message: `Data URL charset '${charset}' is unsupported; use UTF-8 or US-ASCII bytes.`,
      },
    };
  const base64 = segments.some((segment) => segment.trim().toLowerCase() === "base64");
  const bytes = base64 ? decodeBase64(rawURL.slice(comma + 1)) : decodePercentBytes(rawURL.slice(comma + 1));
  if (!bytes)
    return {
      failure: {
        code: base64 ? "malformed-base64-data-url" : "malformed-percent-data-url",
        message: `Data URL contains invalid ${base64 ? "base64" : "percent-encoded"} content.`,
      },
    };
  let hash = 2166136261;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  return { resource: { bytes, mimeType, canonicalURL: `data:${mimeType};fnv1a=${hash.toString(16)}` } };
}

function canonicalURL(rawURL: string, config: InternalGeneratorConfig): string | ResourceFailure {
  const resources = config.resources;
  const policy = resources?.policy ?? "embeddedOnly";
  const baseURL = config.__resourceBaseURL ?? resources?.baseURL;
  if (policy === "local") {
    const root = resources?.baseDirectory?.replace(/\\/g, "/").replace(/\/+$/, "");
    if (!root)
      return {
        code: "missing-local-base-directory",
        message: "The local resource policy requires a non-empty baseDirectory.",
      };
    let decoded = rawURL.split(/[?#]/, 1)[0]!.replace(/\\/g, "/");
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      decoded = "";
    }
    if (!decoded || /^[a-z][a-z\d+.-]*:/i.test(decoded) || decoded.startsWith("/") || /^[a-z]:\//i.test(decoded))
      return {
        code: "resource-path-traversal",
        message: `Local resource '${rawURL}' is absolute, malformed, or escapes the approved base directory.`,
      };
    const parent = config.__resourceBaseURL?.startsWith(`${root}/`)
      ? config.__resourceBaseURL.slice(root.length + 1).replace(/\/[^/]*$/, "")
      : "";
    const segments = parent ? parent.split("/").filter(Boolean) : [];
    for (const segment of decoded.split("/")) {
      if (!segment || segment === ".") continue;
      if (segment === "..") {
        if (segments.length === 0)
          return {
            code: "resource-path-traversal",
            message: `Local resource '${rawURL}' escapes the approved base directory '${root}'.`,
          };
        segments.pop();
      } else segments.push(segment);
    }
    return `${root}/${segments.join("/")}`;
  }
  if (!baseURL) return rawURL;
  try {
    return new URL(rawURL, baseURL).href;
  } catch {
    if (/^[a-z][a-z\d+.-]*:/i.test(baseURL))
      return {
        code: "invalid-resource-url",
        message: `Resource URL '${rawURL}' cannot be resolved against '${baseURL}'.`,
      };
    const baseSegments = baseURL.split(/[?#]/, 1)[0]!.replace(/\\/g, "/").split("/");
    baseSegments.pop();
    for (const segment of rawURL.split(/[?#]/, 1)[0]!.replace(/\\/g, "/").split("/")) {
      if (!segment || segment === ".") continue;
      if (segment === "..") baseSegments.pop();
      else baseSegments.push(segment);
    }
    return baseSegments.join("/");
  }
}

function cacheKey(rawURL: string, config: InternalGeneratorConfig): string {
  return `${config.__resourceBaseURL ?? config.resources?.baseURL ?? ""}\u0000${rawURL}`;
}

function sniffMime(bytes: Uint8Array): string | undefined {
  if (
    bytes.length >= 8 &&
    bytes.slice(0, 8).every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index])
  )
    return "image/png";
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (bytes.length >= 6 && (decodeUTF8(bytes.slice(0, 6)) === "GIF87a" || decodeUTF8(bytes.slice(0, 6)) === "GIF89a"))
    return "image/gif";
  if (bytes.length >= 12 && decodeUTF8(bytes.slice(0, 4)) === "RIFF" && decodeUTF8(bytes.slice(8, 12)) === "WEBP")
    return "image/webp";
  const prefix = decodeUTF8(bytes.slice(0, Math.min(bytes.length, 512)))
    .replace(/^\uFEFF/, "")
    .trimStart();
  if (/^(?:<\?xml[\s\S]*?\?>\s*)?<svg(?:\s|>)/i.test(prefix)) return "image/svg+xml";
  return undefined;
}

export function rasterIntrinsicSize(
  bytes: Uint8Array,
  mimeType: string,
): { width: number; height: number } | undefined {
  if (mimeType === "image/png" && bytes.length >= 24) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (mimeType === "image/gif" && bytes.length >= 10) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
  }
  if (mimeType === "image/jpeg") {
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 255) {
        offset++;
        continue;
      }
      const marker = bytes[offset + 1]!;
      const length = (bytes[offset + 2]! << 8) | bytes[offset + 3]!;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker))
        return {
          width: (bytes[offset + 7]! << 8) | bytes[offset + 8]!,
          height: (bytes[offset + 5]! << 8) | bytes[offset + 6]!,
        };
      if (length < 2) break;
      offset += length + 2;
    }
  }
  if (mimeType === "image/webp" && bytes.length >= 30) {
    const kind = decodeUTF8(bytes.slice(12, 16));
    if (kind === "VP8X")
      return {
        width: 1 + bytes[24]! + (bytes[25]! << 8) + (bytes[26]! << 16),
        height: 1 + bytes[27]! + (bytes[28]! << 8) + (bytes[29]! << 16),
      };
    if (kind === "VP8 " && bytes.length >= 30)
      return { width: (bytes[26]! | (bytes[27]! << 8)) & 0x3fff, height: (bytes[28]! | (bytes[29]! << 8)) & 0x3fff };
    if (kind === "VP8L" && bytes.length >= 25) {
      const bits = bytes[21]! | (bytes[22]! << 8) | (bytes[23]! << 16) | (bytes[24]! << 24);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  return undefined;
}

const IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]);

function validateResolved(
  rawURL: string,
  canonical: string,
  input: ResolvedResource,
  config: InternalGeneratorConfig,
  state: ResourceState,
): ResourceResolution {
  const limits = resourceLimits(config);
  const bytes = input.bytes;
  if (!bytes && !input.assetName)
    return {
      failure: { code: "empty-resource", message: `Resource '${rawURL}' returned neither bytes nor an asset name.` },
    };
  if (bytes && bytes.byteLength > limits.maxResourceBytes)
    return {
      failure: {
        code: "resource-byte-limit",
        message: `Resource '${rawURL}' is ${bytes.byteLength} bytes, exceeding the ${limits.maxResourceBytes}-byte limit.`,
      },
    };
  const declared = normalizedMime(input.mimeType);
  const sniffed = bytes ? sniffMime(bytes) : declared;
  if (!sniffed || !IMAGE_MIMES.has(sniffed))
    return {
      failure: { code: "unsupported-image-mime", message: `Resource '${rawURL}' is not a supported static image.` },
    };
  if (declared && declared !== sniffed && !(declared === "image/jpg" && sniffed === "image/jpeg"))
    return {
      failure: {
        code: "resource-mime-mismatch",
        message: `Resource '${rawURL}' declares '${declared}' but its bytes are '${sniffed}'.`,
      },
    };
  const decodedSize = bytes && sniffed !== "image/svg+xml" ? rasterIntrinsicSize(bytes, sniffed) : undefined;
  const intrinsicSize = bytes && sniffed !== "image/svg+xml" ? decodedSize : input.intrinsicSize;
  if (
    intrinsicSize &&
    (!Number.isFinite(intrinsicSize.width) ||
      !Number.isFinite(intrinsicSize.height) ||
      intrinsicSize.width <= 0 ||
      intrinsicSize.height <= 0)
  )
    return {
      failure: {
        code: "invalid-resource-dimensions",
        message: `Resource '${rawURL}' has invalid intrinsic dimensions ${intrinsicSize.width}×${intrinsicSize.height}.`,
      },
    };
  if (bytes && sniffed !== "image/svg+xml" && !intrinsicSize)
    return {
      failure: {
        code: "invalid-image-header",
        message: `Resource '${rawURL}' has a supported signature but no readable intrinsic dimensions.`,
      },
    };
  if (intrinsicSize && intrinsicSize.width * intrinsicSize.height > limits.maxImagePixels)
    return {
      failure: {
        code: "resource-pixel-limit",
        message: `Resource '${rawURL}' has ${intrinsicSize.width * intrinsicSize.height} pixels, exceeding the ${limits.maxImagePixels}-pixel limit.`,
      },
    };
  const byteCount = bytes?.byteLength ?? 0;
  if (state.totalBytes + byteCount > limits.maxTotalBytes)
    return {
      failure: {
        code: "resource-total-byte-limit",
        message: `Resolving '${rawURL}' would exceed the ${limits.maxTotalBytes}-byte aggregate limit.`,
      },
    };
  if (state.count + 1 > limits.maxResources)
    return {
      failure: {
        code: "resource-count-limit",
        message: `Resolving '${rawURL}' would exceed the ${limits.maxResources}-resource limit.`,
      },
    };
  state.totalBytes += byteCount;
  state.count++;
  return {
    resource: {
      ...(bytes ? { bytes } : {}),
      mimeType: sniffed,
      canonicalURL: input.canonicalURL ?? canonical,
      ...(input.assetName ? { assetName: input.assetName } : {}),
      ...(intrinsicSize ? { intrinsicSize } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    },
  };
}

function requestFor(
  rawURL: string,
  canonical: string,
  kind: ResourceKind,
  element: ElementNode,
  config: InternalGeneratorConfig,
): ResourceRequest {
  const id = element.properties?.id;
  return {
    rawURL,
    canonicalURL: canonical,
    ...((config.__resourceBaseURL ?? config.resources?.baseURL)
      ? { baseURL: config.__resourceBaseURL ?? config.resources?.baseURL }
      : {}),
    kind,
    source: { element: element.tagName ?? "unknown", ...(id === undefined ? {} : { id: String(id) }) },
    limits: resourceLimits(config),
  };
}

function suppliedResource(rawURL: string, canonical: string, resources: ResourceConfiguration | undefined) {
  return resources?.supplied?.[rawURL] ?? resources?.supplied?.[canonical];
}

function remember(state: ResourceState, key: string, result: ResourceResolution): ResourceResolution {
  state.cache.set(key, result);
  if ("resource" in result) state.canonicalCache.set(result.resource.canonicalURL, result);
  return result;
}

export function resolveResourceSync(
  rawURL: string,
  kind: ResourceKind,
  element: ElementNode,
  config: InternalGeneratorConfig,
): ResourceResolution {
  const state = resourceState(config);
  const key = cacheKey(rawURL, config);
  const cached = state.cache.get(key);
  if (cached) return cached;
  const data = parseDataURL(rawURL);
  if (data) {
    const result =
      "failure" in data ? data : validateResolved(rawURL, data.resource.canonicalURL, data.resource, config, state);
    return remember(state, key, result);
  }
  const canonical = canonicalURL(rawURL, config);
  if (typeof canonical !== "string") {
    const result = { failure: canonical } as ResourceResolution;
    state.cache.set(key, result);
    return result;
  }
  const canonicalCached = state.canonicalCache.get(canonical);
  if (canonicalCached) return remember(state, key, canonicalCached);
  const supplied = suppliedResource(rawURL, canonical, config.resources);
  if (supplied) {
    const result = validateResolved(rawURL, canonical, supplied, config, state);
    return remember(state, key, result);
  }
  const policy = config.resources?.policy ?? "embeddedOnly";
  if (policy === "embeddedOnly") {
    const result: ResourceResolution = {
      failure: {
        code: "external-resource-denied",
        message: `Default embeddedOnly policy denied image resource '${rawURL}'.`,
      },
    };
    return remember(state, key, result);
  }
  if (!config.resources?.resolver) {
    const result: ResourceResolution = {
      failure: {
        code: "missing-resource-resolver",
        message: `${policy} resource policy requires a resolver callback for '${rawURL}'.`,
      },
    };
    return remember(state, key, result);
  }
  try {
    const value = config.resources.resolver(requestFor(rawURL, canonical, kind, element, config));
    if (value && typeof (value as Promise<ResolvedResource>).then === "function") {
      const result: ResourceResolution = {
        failure: {
          code: "async-resource-in-sync-convert",
          message: `Resource '${rawURL}' requires asynchronous resolution; use convertAsync().`,
        },
      };
      return remember(state, key, result);
    }
    const result = value
      ? validateResolved(rawURL, canonical, value as ResolvedResource, config, state)
      : ({
          failure: { code: "resource-not-found", message: `Resolver returned no content for '${rawURL}'.` },
        } as ResourceResolution);
    return remember(state, key, result);
  } catch (error) {
    const result: ResourceResolution = {
      failure: {
        code: "resource-resolver-error",
        message: `Resolver failed for '${rawURL}': ${error instanceof Error ? error.message : String(error)}`,
      },
    };
    return remember(state, key, result);
  }
}

export async function resolveResourceAsync(
  rawURL: string,
  kind: ResourceKind,
  element: ElementNode,
  config: InternalGeneratorConfig,
): Promise<ResourceResolution> {
  const immediate = resolveResourceSync(rawURL, kind, element, {
    ...config,
    resources: config.resources?.resolver ? { ...config.resources, resolver: undefined } : config.resources,
    __resourceState: resourceState(config),
  });
  if (!("failure" in immediate) || immediate.failure.code !== "missing-resource-resolver") return immediate;
  const canonical = canonicalURL(rawURL, config);
  if (typeof canonical !== "string") return { failure: canonical };
  const key = cacheKey(rawURL, config);
  try {
    const value = await config.resources?.resolver?.(requestFor(rawURL, canonical, kind, element, config));
    const result = value
      ? validateResolved(rawURL, canonical, value, config, resourceState(config))
      : ({
          failure: { code: "resource-not-found", message: `Resolver returned no content for '${rawURL}'.` },
        } as ResourceResolution);
    return remember(resourceState(config), key, result);
  } catch (error) {
    const result: ResourceResolution = {
      failure: {
        code: "resource-resolver-error",
        message: `Resolver failed for '${rawURL}': ${error instanceof Error ? error.message : String(error)}`,
      },
    };
    return remember(resourceState(config), key, result);
  }
}

export async function prepareImageResources(root: ElementNode, config: InternalGeneratorConfig): Promise<void> {
  const visit = async (
    element: ElementNode,
    currentConfig: InternalGeneratorConfig,
    active: string[],
  ): Promise<void> => {
    if (element.tagName === "image") {
      const raw = String(element.properties?.href ?? element.properties?.["xlink:href"] ?? "").trim();
      if (raw) {
        const resolved = await resolveResourceAsync(raw, "image", element, currentConfig);
        if (
          "resource" in resolved &&
          resolved.resource.mimeType === "image/svg+xml" &&
          resolved.resource.bytes &&
          !active.includes(resolved.resource.canonicalURL) &&
          active.length < resourceLimits(currentConfig).maxNestingDepth
        ) {
          try {
            const ast = parse(decodeUTF8(resolved.resource.bytes));
            const svg = ast.children.find(
              (child): child is ElementNode =>
                typeof child !== "string" && child.type === "element" && child.tagName === "svg",
            );
            if (svg)
              await visit(
                svg,
                {
                  ...currentConfig,
                  __resourceBaseURL: resolved.resource.canonicalURL,
                  __resourceState: resourceState(currentConfig),
                },
                [...active, resolved.resource.canonicalURL],
              );
          } catch {}
        }
      }
    }
    for (const child of element.children) {
      if (typeof child !== "string" && child.type === "element") await visit(child, currentConfig, active);
    }
  };
  await visit(root, config, []);
}
