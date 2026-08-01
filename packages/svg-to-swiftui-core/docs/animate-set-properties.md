# `<animate>` and `<set>` property contract

The compiler resolves each animation to a stable source target, samples it from the immutable computed presentation value, and emits a pure SwiftUI view of `documentTime`. Parent targets, `href`, and `xlink:href` use the same identity model, including anonymous elements and `<use>` instances.

Implemented render wiring covers shape geometry (`x`, `y`, sizes, radii, line endpoints, `points`, and `d`), display and visibility, solid fill/stroke/color, opacity, stroke geometry, group opacity and inherited presentation, text position/size/spacing/paint, root viewport mapping, and gradient stop offset/color/opacity. `<set>` uses the same presentation sandwich with discrete begin/end behavior.

The cascade is resolved before animation parsing. CSS winners, inheritance, explicit `inherit`, and `currentColor` establish the base value; animation never mutates that base. Multiple animations compose in document order and every timestamp is sampled without retained frame state.

`ANIMATION_ATTRIBUTE_REGISTRY` is the source of truth for exact names, XML/CSS namespaces, typed value families, target kinds, invalidation categories, and runtime binding. The generated [animation report](../conformance/ANIMATION_REPORT.md) exposes implemented and pending entries without guessing support.

Resource values that require rebuilding a filter, marker, mask, clip, or paint-server graph remain explicitly `pending-resource` and emit `unsupported-animation-semantics`. Transform lists, motion paths, and CSS keyframes are intentionally handled by the following roadmap tickets.

Diagnostics use stable codes for missing/wrong targets, incompatible `attributeType`, non-applicable properties, malformed values/calculation metadata, unresolved resource URLs, and parsed-but-unwired semantics. Permissive mode keeps the immutable base; strict mode rejects warnings.

Evidence is split between typed unit tests and exact-time video comparison. `benchmark-05-animate-set-properties` compares WebKit SVG frames with generated SwiftUI across interpolation and exact `<set>` boundaries, including inheritance, href targets, `<use>`, nested viewports, text, and animated gradient stops.
