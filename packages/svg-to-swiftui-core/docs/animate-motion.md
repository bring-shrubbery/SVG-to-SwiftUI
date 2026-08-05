# `<animateMotion>` and `<mpath>` contract

The compiler implements SVG motion as a deterministic supplemental transform sampled from `documentTime`. Motion sources follow SVG precedence: a child `<mpath>` overrides `path`, which overrides `values`, which overrides `from`/`to`/`by`. Local `href` and `xlink:href` references can target paths and SVG basic shapes. Missing, external, duplicate, wrong-type, empty, invalid, and cyclic references produce stable diagnostics with the complete reference chain.

Paths are converted to bounded, adaptive, immutable distance metrics. Lines, quadratic/cubic curves, arcs, closed paths, multiple subpaths, discontinuities, coincident points, and degenerate segments have stable random-access sampling. `pathLength` calibration is retained. The implementation caps subdivision depth and flattened point count, so adversarial paths cannot create unbounded work.

The default `calcMode` is paced. Discrete, linear, paced, and spline timing are supported, including validated `keyPoints`/`keyTimes` and `keySplines`. Point-pair sources accept SVG length units and resolve percentages in the target viewport. `rotate="auto"`, `auto-reverse`, and explicit angles (`deg`, `rad`, `grad`, and `turn`) are supported. A zero-length tangent neighborhood searches forward and then backward; a fully degenerate path has no effect.

Motion is supplemental to the target's static transform and all `<animateTransform>` effects. The compiler applies translation followed by motion rotation, then preserves structural transforms used by `<use>` and nested viewports. Multiple motion animations use the SMIL replace/additive sandwich in document order; cumulative repeats concatenate the endpoint effect. The correction wraps the complete rendered subtree, so clips, masks, filters, gradients, patterns, markers, text, and descendants move with their target.

SVG defines only `origin="default"`, which has no effect. Other host/CSS interpretations emit `unsupported-animation-motion-origin` and are ignored. Invalid motion keeps the static target in permissive mode and fails strict conversion through the normal diagnostic policy.

Evidence includes path-metric golden tests, parser/reference/rotation/composition tests, generated Swift inspection, and the 18-frame `benchmark-07-animate-motion` WebKit-versus-SwiftUI comparison. The benchmark covers mpath, pathLength, auto orientation, auto-reverse, explicit rotation, keyPoints spline timing, nested/static/animated transforms, additive motion, accumulation, point pairs, and a full closed loop.
