import type { ElementNode } from "svg-parser";
import type { StaticEnvironment } from "../types";
import type { RenderDiagnostic, SourceLocation } from "./types";

export interface ResolvedStaticEnvironment {
  preferredLanguages: readonly string[];
  supportedExtensions: ReadonlySet<string>;
  svgVersion: "1.1" | "2";
  supportedFeatures: ReadonlySet<string>;
  accessibilityLocale?: string;
}

function normalizedLanguage(value: string): string {
  return value.trim().replace(/_/g, "-").toLowerCase();
}

/** SVG systemLanguage uses a preference-as-prefix comparison, not the host locale. */
export function languagePreferenceMatches(preference: string, authoredLanguage: string): boolean {
  const preferred = normalizedLanguage(preference);
  const authored = normalizedLanguage(authoredLanguage);
  return preferred !== "" && (authored === preferred || authored.startsWith(`${preferred}-`));
}

export function resolveStaticEnvironment(environment: StaticEnvironment = {}): ResolvedStaticEnvironment {
  const accessibilityLocale = environment.accessibilityLocale?.trim();
  return {
    preferredLanguages: (environment.preferredLanguages ?? [])
      .map(String)
      .map((value) => value.trim())
      .filter(Boolean),
    supportedExtensions: new Set((environment.supportedExtensions ?? []).map(String)),
    svgVersion: environment.svgVersion ?? "2",
    supportedFeatures: new Set((environment.supportedFeatures ?? []).map(String)),
    ...(accessibilityLocale ? { accessibilityLocale } : {}),
  };
}

function sourceLocation(element: ElementNode): SourceLocation {
  const id = element.properties?.id;
  return { element: element.tagName ?? "unknown", ...(id === undefined ? {} : { id: String(id) }) };
}

function attribute(element: ElementNode, name: string): { present: boolean; value: string } {
  const entry = Object.entries(element.properties ?? {}).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return entry ? { present: true, value: String(entry[1] ?? "") } : { present: false, value: "" };
}

/** Evaluates static conditional attributes without consulting the developer machine. */
export class SVGConditionalProcessor {
  readonly environment: ResolvedStaticEnvironment;
  private readonly diagnosed = new WeakMap<ElementNode, Set<string>>();

  constructor(
    environment: StaticEnvironment | undefined,
    private readonly diagnostics: RenderDiagnostic[],
  ) {
    this.environment = resolveStaticEnvironment(environment);
  }

  private diagnose(element: ElementNode, code: string, message: string): void {
    const codes = this.diagnosed.get(element) ?? new Set<string>();
    if (codes.has(code)) return;
    codes.add(code);
    this.diagnosed.set(element, codes);
    this.diagnostics.push({ code, message, severity: "warning", source: sourceLocation(element) });
  }

  matches(element: ElementNode): boolean {
    const extensions = attribute(element, "requiredExtensions");
    if (extensions.present) {
      const tokens = extensions.value.trim().split(/\s+/).filter(Boolean);
      if (tokens.length === 0 || !tokens.every((token) => this.environment.supportedExtensions.has(token)))
        return false;
    }

    const language = attribute(element, "systemLanguage");
    if (language.present) {
      const authored = language.value
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      if (
        authored.length === 0 ||
        !this.environment.preferredLanguages.some((preference) =>
          authored.some((candidate) => languagePreferenceMatches(preference, candidate)),
        )
      )
        return false;
    }

    const features = attribute(element, "requiredFeatures");
    if (features.present) {
      if (this.environment.svgVersion === "2") {
        this.diagnose(
          element,
          "obsolete-required-features",
          "requiredFeatures was removed from SVG 2 and is ignored; use requiredExtensions or configure SVG 1.1 compatibility.",
        );
      } else {
        const tokens = features.value.trim().split(/\s+/).filter(Boolean);
        if (tokens.length === 0 || !tokens.every((token) => this.environment.supportedFeatures.has(token)))
          return false;
      }
    }

    return true;
  }
}
