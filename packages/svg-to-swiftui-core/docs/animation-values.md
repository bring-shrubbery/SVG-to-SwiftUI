# SVG animation value engine

The compiler parses animation values before timing or rendering. The same pure evaluator is used by SMIL today and by the planned CSS animation frontend. Its calculation model follows [W3C SMIL Animation](https://www.w3.org/TR/2001/REC-smil-animation-20010904/); path compatibility follows the [SVG path animation rules](https://www.w3.org/TR/SVG/paths.html).

## Supported families

- numbers, integers, opacity, unit-aware lengths and percentages, and angles
- sRGB or linearRGB colors with independently interpolated alpha
- number lists, length lists, and point lists
- solid paint colors; `none`, `currentColor`, and `url(...)` paints change discretely
- normalized path data (`M`, `L`, `Q`, `C`, `Z`); incompatible command structures change discretely in permissive mode
- viewBox rectangles
- parsed transform components retained for the transform animation stage
- enumerations, strings, URLs, and other discrete-only values

The attribute registry defines the family, length axis, additive support, and final-value clamp. Unknown properties produce a diagnostic; the compiler does not infer a family from the authored text.

Lengths are resolved in the target's viewport, root viewport, font, and percentage-axis context before arithmetic. Interpolation itself is never clamped. Integer rounding, nonnegative constraints, opacity limits, and color channel limits apply only to the final target value.

## Calculation

The evaluator supports `from`/`to`, `from`/`by`, `by`, `to`, and `values`, plus:

- discrete, linear, paced, and spline calculation modes
- validated `keyTimes` and `keySplines`; `keyPoints` is retained for motion animation
- bounded Newton iteration followed by 32 deterministic bisection steps for cubic Bézier inversion
- family-specific Euclidean distance for paced animation, with a stable linear fallback when distance is undefined
- additive replacement/sum, repeat accumulation, and document-order sandwich composition
- exact values at progress 0 and 1 and deterministic keyframe-boundary selection

A `to` animation interpolates from its current underlying sandwich value and remains replacement-only. A `by` animation is additive. Accumulation adds the animation function's final value once for each completed repeat.

## Unsupported and invalid input

Malformed key times or splines make the animation unavailable to runtime wiring and emit stable diagnostics. Structurally incompatible paths and lists emit diagnostics and use discrete changes in permissive mode. Addition requests on discrete-only families are ignored with a diagnostic.

## Verification

`animation-tests/animation-value-goldens.json` is sampled by TypeScript unit tests and by a Swift executable compiled from the actual generated runtime. Temporal WebKit probes cover every value/calculation family, while benchmark 04 compares generated SwiftUI with the reference SVG at exact microsecond boundaries.
