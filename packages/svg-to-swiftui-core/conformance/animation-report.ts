import { ANIMATION_ATTRIBUTE_REGISTRY } from "../src/renderTree/animationValues";

const labels = {
  "render-node": "implemented",
  "gradient-stop": "implemented",
  resource: "implemented",
  "pending-resource": "pending resource wiring",
  "pending-follow-up": "pending follow-up",
} as const;

export function renderAnimationReport(): string {
  const counts = new Map<string, number>();
  for (const entry of ANIMATION_ATTRIBUTE_REGISTRY)
    counts.set(labels[entry.runtimeBinding], (counts.get(labels[entry.runtimeBinding]) ?? 0) + 1);
  const lines = [
    "# Declarative animation attribute report",
    "",
    "Generated from `ANIMATION_ATTRIBUTE_REGISTRY`. Do not edit by hand.",
    "",
    "This report describes declarative animation wiring. Attribute rows cover `<animate>`, `<set>`, and CSS `@keyframes`; specialized animation systems are listed separately.",
    "",
    "## Summary",
    "",
    "| Status | Attributes |",
    "| --- | ---: |",
    ...[...counts].map(([status, count]) => `| ${status} | ${count} |`),
    "",
    "## Registry",
    "",
    "| Attribute | Value family | Namespace | Invalidation | Target | Runtime |",
    "| --- | --- | --- | --- | --- | --- |",
    ...ANIMATION_ATTRIBUTE_REGISTRY.map((entry) => {
      const target = Array.isArray(entry.targetElements) ? entry.targetElements.join(", ") : entry.targetElements;
      return `| \`${entry.canonicalName}\` | ${entry.family} | ${entry.namespaces.join(", ")} | ${entry.invalidates.join(", ")} | ${target} | ${labels[entry.runtimeBinding]} |`;
    }),
    "",
    "## Specialized animation elements",
    "",
    "| Element | Status | Evidence |",
    "| --- | --- | --- |",
    "| `<animateTransform>` | implemented | typed parser/sampler/composition tests; 18-frame `benchmark-06-animate-transform` |",
    "| `<animateMotion>` / `<mpath>` | implemented | metric/parser/composition tests; 18-frame `benchmark-07-animate-motion` |",
    "| CSS `@keyframes` | implemented | cascade/timing/value tests; 18-frame `benchmark-08-css-keyframes` |",
    "| Animated resources, filters, and nested text | implemented | resource/filter/text unit evidence; 9-frame `benchmark-09-animated-resources` |",
    "",
  ];
  return lines.join("\n");
}
