# Declarative SVG animation conformance

Generated from the versioned machine-readable dynamic profile. Do not edit by hand.

The supported profile is deterministic declarative SVG/SMIL and CSS animation compiled to native SwiftUI. A browser DOM, script runtime, navigation, media playback, and live network access are outside the security boundary.

## Summary

| Status | Entries |
| --- | ---: |
| intentionally-snapshotted | 50 |
| supported | 162 |
| partially-supported | 6 |
| browser-runtime-out-of-scope | 15 |
| obsolete | 1 |

## Known-good benchmark ladder

Every comparison compiles generated Swift, renders exact document times, and compares lossless premultiplied-sRGB RGBA pixels against WebKit.

| Rank | Fixture | Capability |
| ---: | --- | --- |
| 1 | `benchmark-01-numeric-cx` | one numeric geometry property |
| 2 | `benchmark-color-opacity` | color and opacity |
| 3 | `benchmark-02-smil-timing` | repeat, fill, and exact boundaries |
| 4 | `benchmark-06-animate-transform` | transform animation |
| 5 | `benchmark-07-animate-motion` | motion path and orientation |
| 6 | `benchmark-05-animate-set-properties` | simultaneous geometry, paint, and presentation |
| 7 | `benchmark-09-animated-resources` | gradient, pattern, and marker resources |
| 8 | `benchmark-compositing-text` | clip, mask, filter, and text composition |
| 9 | `benchmark-08-css-keyframes` | CSS keyframes mixed with SVG presentation |
| 10 | `benchmark-10-complex-scene` | combined real-world declarative scene |

## Complete inventory

| Feature | Status | Unit evidence | Temporal tag | Limitation |
| --- | --- | --- | --- | --- |
| `attribute:alignment-baseline` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:amplitude` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:azimuth` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:baseFrequency` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:bias` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:clip-path` | partially-supported | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-resource; the deterministic base value remains available. |
| `attribute:clip-rule` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:clipPathUnits` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:color` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:color-interpolation` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:color-interpolation-filters` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:cx` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:cy` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:d` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:diffuseConstant` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:display` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:divisor` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:dominant-baseline` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:dx` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:dy` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:edgeMode` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:elevation` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:exponent` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:fill` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:fill-opacity` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:fill-rule` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:filter` | partially-supported | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-resource; the deterministic base value remains available. |
| `attribute:filterUnits` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:flood-color` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:flood-opacity` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:font-family` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:font-size` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:font-style` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:font-weight` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:fr` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:fx` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:fy` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:glyph-orientation-horizontal` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:glyph-orientation-vertical` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:gradientTransform` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:gradientUnits` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:height` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:href` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:in` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:in2` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:intercept` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:k` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:k1` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:k2` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:k3` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:k4` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:kernelMatrix` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:kernelUnitLength` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:keyPoints` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:lengthAdjust` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:letter-spacing` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:lighting-color` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:limitingConeAngle` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:marker-end` | partially-supported | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-resource; the deterministic base value remains available. |
| `attribute:marker-mid` | partially-supported | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-resource; the deterministic base value remains available. |
| `attribute:marker-start` | partially-supported | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-resource; the deterministic base value remains available. |
| `attribute:markerHeight` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:markerUnits` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:markerWidth` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:mask` | partially-supported | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-resource; the deterministic base value remains available. |
| `attribute:mask-type` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:maskContentUnits` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:maskUnits` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:method` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:mode` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:numOctaves` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:offset` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:opacity` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:operator` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:order` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:orient` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:overflow` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:pathLength` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:patternContentUnits` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:patternTransform` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:patternUnits` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:pointer-events` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:points` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:pointsAtX` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:pointsAtY` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:pointsAtZ` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:preserveAlpha` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:preserveAspectRatio` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:primitiveUnits` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:r` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:radius` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:refX` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:refY` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:result` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:rotate` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:rx` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:ry` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:scale` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:seed` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:shape-rendering` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:side` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:slope` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:spacing` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:specularConstant` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:specularExponent` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:spreadMethod` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:startOffset` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:stdDeviation` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:stitchTiles` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:stop-color` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:stop-opacity` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:stroke` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:stroke-dasharray` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:stroke-dashoffset` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:stroke-linecap` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:stroke-linejoin` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:stroke-miterlimit` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:stroke-opacity` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:stroke-width` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:surfaceScale` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:tableValues` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:targetX` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:targetY` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:text-anchor` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:text-decoration` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:textLength` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:transform` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:type` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:values` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:vector-effect` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:viewBox` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:visibility` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:width` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:word-spacing` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:x` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:x1` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:x2` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:xChannelSelector` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `attribute:y` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:y1` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:y2` | supported | src/tests/animationValues.test.ts | benchmark-ladder | — |
| `attribute:yChannelSelector` | intentionally-snapshotted | src/tests/animationValues.test.ts | static-control | Runtime binding is pending-follow-up; the deterministic base value remains available. |
| `calculation:accumulate` | supported | src/tests/animation.test.ts | smil-values | — |
| `calculation:additive` | supported | src/tests/animation.test.ts | smil-values | — |
| `calculation:by` | supported | src/tests/animation.test.ts | smil-values | — |
| `calculation:calcMode` | supported | src/tests/animation.test.ts | smil-values | — |
| `calculation:from` | supported | src/tests/animation.test.ts | smil-values | — |
| `calculation:keySplines` | supported | src/tests/animation.test.ts | smil-values | — |
| `calculation:keyTimes` | supported | src/tests/animation.test.ts | smil-values | — |
| `calculation:to` | supported | src/tests/animation.test.ts | smil-values | — |
| `calculation:values` | supported | src/tests/animation.test.ts | smil-values | — |
| `css:@keyframes` | supported | src/tests/cssAnimations.test.ts | css-keyframes | — |
| `css:animation` | supported | src/tests/cssAnimations.test.ts | css-keyframes | — |
| `css:animation-delay` | supported | src/tests/cssAnimations.test.ts | css-keyframes | — |
| `css:animation-direction` | supported | src/tests/cssAnimations.test.ts | css-keyframes | — |
| `css:animation-duration` | supported | src/tests/cssAnimations.test.ts | css-keyframes | — |
| `css:animation-fill-mode` | supported | src/tests/cssAnimations.test.ts | css-keyframes | — |
| `css:animation-iteration-count` | supported | src/tests/cssAnimations.test.ts | css-keyframes | — |
| `css:animation-name` | supported | src/tests/cssAnimations.test.ts | css-keyframes | — |
| `css:animation-play-state` | supported | src/tests/cssAnimations.test.ts | css-keyframes | — |
| `css:animation-timing-function` | supported | src/tests/cssAnimations.test.ts | css-keyframes | — |
| `css:transform-origin` | supported | src/tests/cssAnimations.test.ts | vendor | — |
| `css:transition` | browser-runtime-out-of-scope | src/tests/cssAnimations.test.ts | static-control | Transitions require browser style mutation; the computed initial state is snapshotted. |
| `css:transition-delay` | browser-runtime-out-of-scope | src/tests/cssAnimations.test.ts | static-control | Transitions require browser style mutation; the computed initial state is snapshotted. |
| `css:transition-duration` | browser-runtime-out-of-scope | src/tests/cssAnimations.test.ts | static-control | Transitions require browser style mutation; the computed initial state is snapshotted. |
| `css:transition-property` | browser-runtime-out-of-scope | src/tests/cssAnimations.test.ts | static-control | Transitions require browser style mutation; the computed initial state is snapshotted. |
| `css:transition-timing-function` | browser-runtime-out-of-scope | src/tests/cssAnimations.test.ts | static-control | Transitions require browser style mutation; the computed initial state is snapshotted. |
| `element:animate` | supported | src/tests/animation.test.ts | animate | — |
| `element:animateMotion` | supported | src/tests/animation.test.ts | animate-motion | — |
| `element:animateTransform` | supported | src/tests/animation.test.ts | animate-transform | — |
| `element:audio` | browser-runtime-out-of-scope | src/tests/animationTargets.test.ts | static-control | Executable or media browser runtimes are never emitted. |
| `element:discard` | supported | src/tests/animation.test.ts | discard | — |
| `element:iframe` | browser-runtime-out-of-scope | src/tests/animationTargets.test.ts | static-control | Executable or media browser runtimes are never emitted. |
| `element:mpath` | supported | src/tests/animation.test.ts | animate-motion | — |
| `element:script` | browser-runtime-out-of-scope | src/tests/animationTargets.test.ts | static-control | Executable or media browser runtimes are never emitted. |
| `element:set` | supported | src/tests/animation.test.ts | animate | — |
| `element:video` | browser-runtime-out-of-scope | src/tests/animationTargets.test.ts | static-control | Executable or media browser runtimes are never emitted. |
| `event:beginEvent` | supported | src/tests/animation.test.ts | deterministic-events | — |
| `event:blur` | supported | src/tests/animation.test.ts | deterministic-events | — |
| `event:click` | supported | src/tests/animation.test.ts | deterministic-events | — |
| `event:endEvent` | supported | src/tests/animation.test.ts | deterministic-events | — |
| `event:focus` | supported | src/tests/animation.test.ts | deterministic-events | — |
| `event:keydown` | supported | src/tests/animation.test.ts | deterministic-events | — |
| `event:keyup` | supported | src/tests/animation.test.ts | deterministic-events | — |
| `event:mousedown` | supported | src/tests/animation.test.ts | deterministic-events | — |
| `event:mousemove` | supported | src/tests/animation.test.ts | deterministic-events | — |
| `event:mouseout` | supported | src/tests/animation.test.ts | deterministic-events | — |
| `event:mouseover` | supported | src/tests/animation.test.ts | deterministic-events | — |
| `event:mouseup` | supported | src/tests/animation.test.ts | deterministic-events | — |
| `event:repeatEvent` | supported | src/tests/animation.test.ts | deterministic-events | — |
| `interaction:documentTime injection` | supported | src/tests/animation.test.ts | deterministic-events | — |
| `interaction:hover state` | browser-runtime-out-of-scope | src/tests/animationTargets.test.ts | static-control | The generated view is deterministic and has no embedded browser runtime. |
| `interaction:JavaScript dispatch` | browser-runtime-out-of-scope | src/tests/animationTargets.test.ts | static-control | The generated view is deterministic and has no embedded browser runtime. |
| `interaction:live DOM mutation` | browser-runtime-out-of-scope | src/tests/animationTargets.test.ts | static-control | The generated view is deterministic and has no embedded browser runtime. |
| `interaction:media clock` | browser-runtime-out-of-scope | src/tests/animationTargets.test.ts | static-control | The generated view is deterministic and has no embedded browser runtime. |
| `interaction:navigation` | browser-runtime-out-of-scope | src/tests/animationTargets.test.ts | static-control | The generated view is deterministic and has no embedded browser runtime. |
| `interaction:network fetch` | browser-runtime-out-of-scope | src/tests/animationTargets.test.ts | static-control | The generated view is deterministic and has no embedded browser runtime. |
| `interaction:reduced motion` | supported | src/tests/animation.test.ts | deterministic-events | — |
| `interaction:scene pause` | supported | src/tests/animation.test.ts | deterministic-events | — |
| `interaction:SVGAnimationEvent trace` | supported | src/tests/animation.test.ts | deterministic-events | — |
| `motion:keyPoints` | supported | src/tests/animation.test.ts | animate-motion | — |
| `motion:origin` | supported | src/tests/animation.test.ts | animate-motion | — |
| `motion:path` | supported | src/tests/animation.test.ts | animate-motion | — |
| `motion:rotate` | supported | src/tests/animation.test.ts | animate-motion | — |
| `obsolete:animateColor` | obsolete | src/tests/animation.test.ts | color | Accepted through generic animate semantics; authors should use animate. |
| `timing:accessKey` | supported | src/tests/animation.test.ts | instance-time-list | — |
| `timing:begin` | supported | src/tests/animation.test.ts | smil-timing | — |
| `timing:clock-value` | supported | src/tests/animation.test.ts | instance-time-list | — |
| `timing:dur` | supported | src/tests/animation.test.ts | smil-timing | — |
| `timing:end` | supported | src/tests/animation.test.ts | smil-timing | — |
| `timing:eventbase` | supported | src/tests/animation.test.ts | instance-time-list | — |
| `timing:fill` | supported | src/tests/animation.test.ts | smil-timing | — |
| `timing:indefinite` | supported | src/tests/animation.test.ts | instance-time-list | — |
| `timing:max` | supported | src/tests/animation.test.ts | smil-timing | — |
| `timing:min` | supported | src/tests/animation.test.ts | smil-timing | — |
| `timing:repeat-value` | supported | src/tests/animation.test.ts | instance-time-list | — |
| `timing:repeatCount` | supported | src/tests/animation.test.ts | smil-timing | — |
| `timing:repeatDur` | supported | src/tests/animation.test.ts | smil-timing | — |
| `timing:restart` | supported | src/tests/animation.test.ts | smil-timing | — |
| `timing:syncbase` | supported | src/tests/animation.test.ts | instance-time-list | — |
| `timing:wallclock` | supported | src/tests/animation.test.ts | instance-time-list | — |
| `value-family:color` | supported | src/tests/animationValues.test.ts | smil-values | — |
| `value-family:discrete` | supported | src/tests/animationValues.test.ts | smil-values | — |
| `value-family:integer` | supported | src/tests/animationValues.test.ts | smil-values | — |
| `value-family:length` | supported | src/tests/animationValues.test.ts | smil-values | — |
| `value-family:length-list` | supported | src/tests/animationValues.test.ts | smil-values | — |
| `value-family:number` | supported | src/tests/animationValues.test.ts | smil-values | — |
| `value-family:opacity` | supported | src/tests/animationValues.test.ts | smil-values | — |
| `value-family:paint` | supported | src/tests/animationValues.test.ts | smil-values | — |
| `value-family:path` | supported | src/tests/animationValues.test.ts | smil-values | — |
| `value-family:percentage` | supported | src/tests/animationValues.test.ts | smil-values | — |
| `value-family:points` | supported | src/tests/animationValues.test.ts | smil-values | — |
| `value-family:transform` | supported | src/tests/animationValues.test.ts | smil-values | — |
| `value-family:viewBox` | supported | src/tests/animationValues.test.ts | smil-values | — |
