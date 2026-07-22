import type { RenderDiagnostic } from "./renderTree/types";

export const STATIC_SVG_CONFORMANCE_VERSION = "1.0.0";
export const STATIC_SVG_PROFILE = "svg2-static-swiftui";

export type ConformanceStatus =
  | "supported"
  | "partially-supported"
  | "intentionally-static-snapshot"
  | "dynamic-out-of-scope"
  | "obsolete"
  | "unsupported-blocker";

export interface ExercisedConformanceFeature {
  kind: "element" | "attribute" | "property";
  name: string;
  status: ConformanceStatus;
}

export interface ConversionConformance {
  manifestVersion: string;
  profile: string;
  exercised: readonly ExercisedConformanceFeature[];
  warningCount: number;
  errorCount: number;
}

const DYNAMIC_ELEMENTS = new Set([
  "animate",
  "animatemotion",
  "animatetransform",
  "audio",
  "canvas",
  "discard",
  "iframe",
  "mpath",
  "script",
  "set",
  "video",
]);
const SNAPSHOT_ELEMENTS = new Set(["foreignobject"]);
const PARTIAL_ELEMENTS = new Set(["a", "unknown"]);
const DYNAMIC_ATTRIBUTES = new Set([
  "accumulate",
  "additive",
  "attributename",
  "begin",
  "by",
  "calcmode",
  "dur",
  "end",
  "from",
  "keypoints",
  "keysplines",
  "keytimes",
  "max",
  "min",
  "origin",
  "repeatcount",
  "repeatdur",
  "restart",
  "to",
]);

function elementStatus(name: string): ConformanceStatus {
  const normalized = name.toLowerCase();
  if (DYNAMIC_ELEMENTS.has(normalized)) return "dynamic-out-of-scope";
  if (SNAPSHOT_ELEMENTS.has(normalized)) return "intentionally-static-snapshot";
  if (PARTIAL_ELEMENTS.has(normalized)) return "partially-supported";
  return "supported";
}

/** Summarize the exact SVG vocabulary exercised by one conversion. */
export function conversionConformance(rawSVG: string, diagnostics: readonly RenderDiagnostic[]): ConversionConformance {
  const features = new Map<string, ExercisedConformanceFeature>();
  const add = (feature: ExercisedConformanceFeature) => features.set(`${feature.kind}:${feature.name}`, feature);
  for (const match of rawSVG.matchAll(/<\s*([A-Za-z][\w:.-]*)\b([^>]*)>/g)) {
    if (match[0].startsWith("</")) continue;
    const name = match[1]!.replace(/^svg:/i, "");
    add({ kind: "element", name, status: elementStatus(name) });
    for (const attribute of match[2]!.matchAll(/\s([:\w.-]+)\s*=/g)) {
      const attributeName = attribute[1]!;
      add({
        kind: "attribute",
        name: attributeName,
        status:
          /^on/i.test(attributeName) || DYNAMIC_ATTRIBUTES.has(attributeName.toLowerCase())
            ? "dynamic-out-of-scope"
            : "supported",
      });
    }
    for (const style of match[2]!.matchAll(/\bstyle\s*=\s*["']([^"']*)["']/gi)) {
      for (const declaration of style[1]!.matchAll(/(?:^|;)\s*([\w-]+)\s*:/g)) {
        add({ kind: "property", name: declaration[1]!, status: "supported" });
      }
    }
  }
  return {
    manifestVersion: STATIC_SVG_CONFORMANCE_VERSION,
    profile: STATIC_SVG_PROFILE,
    exercised: [...features.values()].sort(
      (left, right) => left.kind.localeCompare(right.kind) || left.name.localeCompare(right.name),
    ),
    warningCount: diagnostics.filter((item) => item.severity === "warning").length,
    errorCount: diagnostics.filter((item) => item.severity === "error").length,
  };
}
