import { ANIMATION_ATTRIBUTE_REGISTRY } from "../src/renderTree/animationValues";

export const ANIMATION_PROFILE_VERSION = 1;

export type AnimationProfileStatus =
  | "supported"
  | "partially-supported"
  | "intentionally-snapshotted"
  | "browser-runtime-out-of-scope"
  | "obsolete"
  | "unsupported-blocker";

interface Seed {
  category: string;
  names: string[];
  status: AnimationProfileStatus;
  evidence: string;
  tag: string;
  limitation?: string;
}

const seeds: Seed[] = [
  {
    category: "element",
    names: ["animate", "set"],
    status: "supported",
    evidence: "src/tests/animation.test.ts",
    tag: "animate",
  },
  {
    category: "element",
    names: ["animateTransform"],
    status: "supported",
    evidence: "src/tests/animation.test.ts",
    tag: "animate-transform",
  },
  {
    category: "element",
    names: ["animateMotion", "mpath"],
    status: "supported",
    evidence: "src/tests/animation.test.ts",
    tag: "animate-motion",
  },
  {
    category: "element",
    names: ["discard"],
    status: "supported",
    evidence: "src/tests/animation.test.ts",
    tag: "discard",
  },
  {
    category: "element",
    names: ["script", "audio", "video", "iframe"],
    status: "browser-runtime-out-of-scope",
    evidence: "src/tests/animationTargets.test.ts",
    tag: "static-control",
    limitation: "Executable or media browser runtimes are never emitted.",
  },
  {
    category: "css",
    names: [
      "@keyframes",
      "animation",
      "animation-name",
      "animation-duration",
      "animation-delay",
      "animation-iteration-count",
      "animation-direction",
      "animation-fill-mode",
      "animation-play-state",
      "animation-timing-function",
    ],
    status: "supported",
    evidence: "src/tests/cssAnimations.test.ts",
    tag: "css-keyframes",
  },
  {
    category: "css",
    names: ["transform-origin"],
    status: "supported",
    evidence: "src/tests/cssAnimations.test.ts",
    tag: "vendor",
  },
  {
    category: "css",
    names: [
      "transition",
      "transition-property",
      "transition-duration",
      "transition-delay",
      "transition-timing-function",
    ],
    status: "browser-runtime-out-of-scope",
    evidence: "src/tests/cssAnimations.test.ts",
    tag: "static-control",
    limitation: "Transitions require browser style mutation; the computed initial state is snapshotted.",
  },
  {
    category: "timing",
    names: ["begin", "end", "dur", "min", "max", "restart", "repeatCount", "repeatDur", "fill"],
    status: "supported",
    evidence: "src/tests/animation.test.ts",
    tag: "smil-timing",
  },
  {
    category: "timing",
    names: ["clock-value", "indefinite", "syncbase", "repeat-value", "eventbase", "accessKey", "wallclock"],
    status: "supported",
    evidence: "src/tests/animation.test.ts",
    tag: "instance-time-list",
  },
  {
    category: "calculation",
    names: ["values", "from", "to", "by", "calcMode", "keyTimes", "keySplines", "additive", "accumulate"],
    status: "supported",
    evidence: "src/tests/animation.test.ts",
    tag: "smil-values",
  },
  {
    category: "motion",
    names: ["path", "keyPoints", "rotate", "origin"],
    status: "supported",
    evidence: "src/tests/animation.test.ts",
    tag: "animate-motion",
  },
  {
    category: "value-family",
    names: [
      "number",
      "integer",
      "length",
      "percentage",
      "color",
      "paint",
      "opacity",
      "transform",
      "path",
      "points",
      "length-list",
      "viewBox",
      "discrete",
    ],
    status: "supported",
    evidence: "src/tests/animationValues.test.ts",
    tag: "smil-values",
  },
  {
    category: "event",
    names: [
      "click",
      "mousedown",
      "mouseup",
      "mouseover",
      "mouseout",
      "mousemove",
      "keydown",
      "keyup",
      "focus",
      "blur",
      "beginEvent",
      "endEvent",
      "repeatEvent",
    ],
    status: "supported",
    evidence: "src/tests/animation.test.ts",
    tag: "deterministic-events",
  },
  {
    category: "interaction",
    names: ["SVGAnimationEvent trace", "documentTime injection", "scene pause", "reduced motion"],
    status: "supported",
    evidence: "src/tests/animation.test.ts",
    tag: "deterministic-events",
  },
  {
    category: "interaction",
    names: ["live DOM mutation", "JavaScript dispatch", "network fetch", "navigation", "hover state", "media clock"],
    status: "browser-runtime-out-of-scope",
    evidence: "src/tests/animationTargets.test.ts",
    tag: "static-control",
    limitation: "The generated view is deterministic and has no embedded browser runtime.",
  },
  {
    category: "obsolete",
    names: ["animateColor"],
    status: "obsolete",
    evidence: "src/tests/animation.test.ts",
    tag: "color",
    limitation: "Accepted through generic animate semantics; authors should use animate.",
  },
];

const fallback = (status: AnimationProfileStatus) => ({
  permissiveFallback:
    status === "supported"
      ? "compile"
      : status === "obsolete"
        ? "compile equivalent or snapshot"
        : "snapshot base value and diagnose",
  strictFallback:
    status === "supported"
      ? "compile"
      : status === "obsolete"
        ? "diagnose obsolete syntax"
        : "reject when dynamic behavior affects output",
});

export function buildAnimationProfile() {
  const entries = [
    ...seeds.flatMap((seed) =>
      seed.names.map((name) => ({
        id: `${seed.category}:${name}`,
        category: seed.category,
        name,
        status: seed.status,
        issue: "https://github.com/bring-shrubbery/SVG-to-SwiftUI/issues/94",
        unitEvidence: [seed.evidence],
        temporalTags: [seed.tag],
        limitations: seed.limitation ? [seed.limitation] : [],
        ...fallback(seed.status),
      })),
    ),
    ...ANIMATION_ATTRIBUTE_REGISTRY.map((entry) => {
      const status: AnimationProfileStatus =
        entry.runtimeBinding === "pending-resource"
          ? "partially-supported"
          : entry.runtimeBinding === "pending-follow-up"
            ? "intentionally-snapshotted"
            : "supported";
      return {
        id: `attribute:${entry.canonicalName}`,
        category: "attribute",
        name: entry.canonicalName,
        status,
        issue: "https://github.com/bring-shrubbery/SVG-to-SwiftUI/issues/105",
        unitEvidence: ["src/tests/animationValues.test.ts"],
        temporalTags: status === "supported" ? ["benchmark-ladder"] : ["static-control"],
        limitations:
          status === "supported"
            ? []
            : [`Runtime binding is ${entry.runtimeBinding}; the deterministic base value remains available.`],
        ...fallback(status),
      };
    }),
  ].sort((a, b) => a.id.localeCompare(b.id));
  return {
    version: ANIMATION_PROFILE_VERSION,
    profile: "SVG 2 declarative animation compiled to deterministic SwiftUI",
    specifications: [
      "https://www.w3.org/TR/SVG2/",
      "https://www.w3.org/TR/2001/REC-smil-animation-20010904/",
      "https://www.w3.org/TR/css-animations-1/",
    ],
    statuses: [
      "supported",
      "partially-supported",
      "intentionally-snapshotted",
      "browser-runtime-out-of-scope",
      "obsolete",
      "unsupported-blocker",
    ],
    entries,
  };
}
