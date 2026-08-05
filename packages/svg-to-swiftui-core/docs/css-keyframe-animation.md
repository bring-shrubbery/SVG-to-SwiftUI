# CSS keyframe animation

The compiler resolves static author CSS and emits a pure-time Swift runtime for SVG `@keyframes` animations. The same injected `documentTime` used by SMIL drives CSS effects, so tests can seek both engines to exact frames.

## Supported syntax

- `@keyframes` and `@-webkit-keyframes`, including `from`, `to`, percentage lists, duplicate offsets, and last-rule-wins names
- `animation` shorthand plus all eight animation longhands and CSS list matching
- durations, negative delays, finite/fractional/infinite iterations, all directions, fill modes, and play states
- `linear`, easing keywords, `cubic-bezier()`, `step-start`, `step-end`, and all `steps()` positions
- per-keyframe timing functions, implicit endpoints, multiple animation names, and target custom properties through `var()`
- typed SVG geometry, paint, opacity, stroke, text, discrete, and transform values already present in the animation registry

CSS animations replace the underlying presentation value. Later animation names win when effects target the same property. CSS effects are emitted after SMIL effects, while an author `!important` declaration remains above both animation systems. `!important` declarations inside keyframes are ignored with a diagnostic.

Dynamic pseudo-classes, dynamic media queries, CSS transitions, script-created Web Animations, additive `animation-composition`, and animated custom-property registration are outside this compiler slice and remain explicit diagnostics or follow-up work.

## Verification

`benchmark-08-css-keyframes.svg` is rendered by WebKit and by generated SwiftUI at 18 exact timestamps. The lossless RGBA frames are compared directly; review videos are secondary artifacts. The benchmark covers negative delay, alternate/reverse directions, fill, steps and Bézier easing, custom properties, implicit endpoints, transform animation, list matching, multiple names, `!important`, and mixed CSS/SMIL composition.
