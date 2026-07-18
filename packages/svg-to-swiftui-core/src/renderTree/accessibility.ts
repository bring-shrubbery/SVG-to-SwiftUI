import type { ElementNode, Node } from "svg-parser";
import type { ResolvedStaticEnvironment } from "./conditionalProcessing";
import { languagePreferenceMatches } from "./conditionalProcessing";
import type { AccessibilityMetadata, RenderDiagnostic, SourceLocation } from "./types";

interface AccessibilityResources {
  definitions: Map<string, ElementNode>;
  parents: Map<ElementNode, ElementNode>;
}

function sourceLocation(element: ElementNode): SourceLocation {
  const id = element.properties?.id;
  return { element: element.tagName ?? "unknown", ...(id === undefined ? {} : { id: String(id) }) };
}

function attribute(element: ElementNode, name: string): { present: boolean; value: string } {
  const entry = Object.entries(element.properties ?? {}).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return entry ? { present: true, value: String(entry[1] ?? "") } : { present: false, value: "" };
}

function childElements(element: ElementNode): ElementNode[] {
  return element.children.filter(
    (child): child is ElementNode => typeof child !== "string" && child.type === "element",
  );
}

function decoded(value: string): string {
  const named: Record<string, string> = { amp: "&", apos: "'", gt: ">", lt: "<", quot: '"', nbsp: " " };
  return value
    .replace(/&#x([\da-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&([a-z]+);/gi, (match, name: string) => named[name.toLowerCase()] ?? match);
}

function normalizedText(value: string): string {
  return decoded(value).replace(/\s+/g, " ").trim();
}

function nodeText(node: Node | string): string {
  if (typeof node === "string") return node;
  if (node.type === "text") return String(node.value ?? "");
  if (node.type !== "element") return "";
  const tag = (node.tagName ?? "").toLowerCase();
  if (["title", "desc", "script", "style", "metadata"].includes(tag)) return "";
  return node.children.map(nodeText).join(" ");
}

function subtreeText(element: ElementNode): string {
  return normalizedText(element.children.map(nodeText).join(" "));
}

/** Computes SVG-AAM name/description metadata once for every renderable source element. */
export class SVGAccessibilityResolver {
  private readonly cache = new Map<ElementNode, AccessibilityMetadata | undefined>();
  private readonly diagnosed = new Set<string>();
  private readonly languagePreferences: readonly string[];

  constructor(
    private readonly resources: AccessibilityResources,
    environment: ResolvedStaticEnvironment,
    private readonly diagnostics: RenderDiagnostic[],
  ) {
    this.languagePreferences = [
      ...(environment.accessibilityLocale ? [environment.accessibilityLocale] : []),
      ...environment.preferredLanguages.filter(
        (language) => language.toLowerCase() !== environment.accessibilityLocale?.toLowerCase(),
      ),
    ];
  }

  private diagnose(element: ElementNode, code: string, message: string): void {
    const source = sourceLocation(element);
    const key = `${code}:${source.element}:${source.id ?? ""}:${message}`;
    if (this.diagnosed.has(key)) return;
    this.diagnosed.add(key);
    this.diagnostics.push({ code, message, severity: "warning", source });
  }

  private effectiveLanguage(element: ElementNode): string {
    let current: ElementNode | undefined = element;
    while (current) {
      const xml = attribute(current, "xml:lang");
      if (xml.present) return xml.value.trim();
      const plain = attribute(current, "lang");
      if (plain.present) return plain.value.trim();
      current = this.resources.parents.get(current);
    }
    return "";
  }

  private selectedDescription(element: ElementNode, tag: "title" | "desc"): ElementNode | undefined {
    const candidates = childElements(element).filter((child) => child.tagName?.toLowerCase() === tag);
    if (this.languagePreferences.length === 0) return candidates[0];
    for (const preference of this.languagePreferences) {
      const exact = candidates.find(
        (candidate) => this.effectiveLanguage(candidate).toLowerCase() === preference.trim().toLowerCase(),
      );
      if (exact) return exact;
      const regional = candidates.find((candidate) =>
        languagePreferenceMatches(preference, this.effectiveLanguage(candidate)),
      );
      if (regional) return regional;
      const generic = candidates.find((candidate) =>
        languagePreferenceMatches(this.effectiveLanguage(candidate), preference),
      );
      if (generic) return generic;
    }
    return candidates.find((candidate) => this.effectiveLanguage(candidate) === "") ?? candidates[0];
  }

  private hidden(element: ElementNode): boolean {
    let current: ElementNode | undefined = element;
    while (current) {
      if (attribute(current, "aria-hidden").value.trim().toLowerCase() === "true") return true;
      current = this.resources.parents.get(current);
    }
    return false;
  }

  private fallbackName(element: ElementNode): string {
    const ariaLabel = normalizedText(attribute(element, "aria-label").value);
    if (ariaLabel) return ariaLabel;
    const title = this.selectedDescription(element, "title");
    const titleText = title ? subtreeText(title) : "";
    return titleText || subtreeText(element);
  }

  private referencedName(element: ElementNode, owner: ElementNode, stack: ElementNode[]): string {
    if (stack.includes(element)) {
      this.diagnose(owner, "cyclic-accessibility-reference", "A cyclic ARIA ID reference was ignored.");
      return "";
    }
    const labelledBy = attribute(element, "aria-labelledby");
    if (labelledBy.present && labelledBy.value.trim()) {
      const nested = this.referenceText(element, "aria-labelledby", owner, [...stack, element]);
      if (nested) return nested;
    }
    return this.fallbackName(element);
  }

  private referenceText(
    element: ElementNode,
    attributeName: "aria-labelledby" | "aria-describedby",
    owner = element,
    stack: ElementNode[] = [element],
  ): string {
    const raw = attribute(element, attributeName).value;
    const values: string[] = [];
    for (const id of raw.trim().split(/\s+/).filter(Boolean)) {
      const target = this.resources.definitions.get(id);
      if (!target) {
        this.diagnose(element, "broken-accessibility-reference", `${attributeName} references missing element #${id}.`);
        continue;
      }
      if (target === element) {
        const fallback = this.fallbackName(target);
        if (fallback) values.push(fallback);
        continue;
      }
      const value = this.referencedName(target, owner, stack);
      if (value) values.push(value);
    }
    return normalizedText(values.join(" "));
  }

  resolve(element: ElementNode): AccessibilityMetadata | undefined {
    if (this.cache.has(element)) return this.cache.get(element);

    const hidden = this.hidden(element);
    const roleValue = attribute(element, "role").value.trim().split(/\s+/)[0]?.toLowerCase();
    const labelledBy = attribute(element, "aria-labelledby");
    const ariaLabel = normalizedText(attribute(element, "aria-label").value);
    const title = this.selectedDescription(element, "title");
    const titleText = title ? subtreeText(title) : "";
    const tag = (element.tagName ?? "").toLowerCase();
    const meaningfulText = tag === "text" ? subtreeText(element) : "";

    let label = labelledBy.present ? this.referenceText(element, "aria-labelledby") : "";
    let labelSource: "labelledby" | "label" | "title" | "text" | undefined = label ? "labelledby" : undefined;
    if (!label && ariaLabel) {
      label = ariaLabel;
      labelSource = "label";
    }
    if (!label && titleText) {
      label = titleText;
      labelSource = "title";
    }
    if (!label && meaningfulText) {
      label = meaningfulText;
      labelSource = "text";
    }

    const describedBy = attribute(element, "aria-describedby");
    let description = describedBy.present ? this.referenceText(element, "aria-describedby") : "";
    if (!description) {
      const desc = this.selectedDescription(element, "desc");
      description = desc ? subtreeText(desc) : "";
    }
    if (!description && meaningfulText && labelSource !== "text") description = meaningfulText;
    if (!description && titleText && (labelSource === "labelledby" || labelSource === "label")) description = titleText;

    let role = roleValue;
    if (!role && tag === "a" && (attribute(element, "href").present || attribute(element, "xlink:href").present))
      role = "link";
    if (!role && (label || description)) {
      if (tag === "svg") role = "graphics-document";
      else if (tag === "g" || tag === "switch" || tag === "use") role = "graphics-object";
      else if (
        ["path", "circle", "ellipse", "rect", "line", "polyline", "polygon", "image", "foreignobject"].includes(tag)
      )
        role = "graphics-symbol";
      else if (tag === "text") role = "text";
    }

    const selectedLanguage =
      label || description ? (title ? this.effectiveLanguage(title) : this.effectiveLanguage(element)) : "";
    const metadata: AccessibilityMetadata = {
      ...(label ? { label } : {}),
      ...(description ? { description } : {}),
      ...(hidden ? { hidden: true } : {}),
      ...(role ? { role } : {}),
      ...(selectedLanguage ? { language: selectedLanguage } : {}),
    };
    const result = Object.keys(metadata).length > 0 ? metadata : undefined;
    this.cache.set(element, result);
    return result;
  }
}
