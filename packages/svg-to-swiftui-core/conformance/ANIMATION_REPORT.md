# Declarative animation attribute report

Generated from `ANIMATION_ATTRIBUTE_REGISTRY`. Do not edit by hand.

This report describes declarative animation wiring. Attribute rows cover `<animate>`, `<set>`, and CSS `@keyframes`; specialized animation systems are listed separately.

## Summary

| Status | Attributes |
| --- | ---: |
| pending follow-up | 50 |
| implemented | 86 |
| pending resource wiring | 6 |

## Registry

| Attribute | Value family | Namespace | Invalidation | Target | Runtime |
| --- | --- | --- | --- | --- | --- |
| `alignment-baseline` | discrete | XML, CSS | text-layout, bounds | any | pending follow-up |
| `amplitude` | number | XML, CSS | filter-buffer | filter-primitives | implemented |
| `azimuth` | number | XML, CSS | filter-buffer | filter-primitives | implemented |
| `baseFrequency` | number-list | XML, CSS | filter-buffer | filter-primitives | implemented |
| `bias` | number | XML, CSS | filter-buffer | filter-primitives | implemented |
| `clip-path` | discrete | XML, CSS | resource | any | pending resource wiring |
| `clip-rule` | discrete | XML, CSS | paint | any | pending follow-up |
| `clipPathUnits` | discrete | XML, CSS | paint | any | pending follow-up |
| `color` | color | XML, CSS | paint | any | implemented |
| `color-interpolation` | discrete | XML, CSS | paint | any | implemented |
| `color-interpolation-filters` | discrete | XML, CSS | paint | any | pending follow-up |
| `cx` | length | XML, CSS | geometry, bounds | any | implemented |
| `cy` | length | XML, CSS | geometry, bounds | any | implemented |
| `d` | path | XML, CSS | geometry, bounds | any | implemented |
| `diffuseConstant` | number | XML, CSS | filter-buffer | filter-primitives | implemented |
| `display` | discrete | XML, CSS | visibility | any | implemented |
| `divisor` | number | XML, CSS | filter-buffer | filter-primitives | implemented |
| `dominant-baseline` | discrete | XML, CSS | text-layout, bounds | any | pending follow-up |
| `dx` | length | XML, CSS | text-layout, bounds | any | implemented |
| `dy` | length | XML, CSS | text-layout, bounds | any | implemented |
| `edgeMode` | discrete | XML, CSS | paint | any | pending follow-up |
| `elevation` | number | XML, CSS | filter-buffer | filter-primitives | implemented |
| `exponent` | number | XML, CSS | filter-buffer | filter-primitives | implemented |
| `fill` | paint | XML, CSS | paint | any | implemented |
| `fill-opacity` | opacity | XML, CSS | paint | any | implemented |
| `fill-rule` | discrete | XML, CSS | paint | any | pending follow-up |
| `filter` | discrete | XML, CSS | resource, filter-buffer | any | pending resource wiring |
| `filterUnits` | discrete | XML, CSS | paint | any | pending follow-up |
| `flood-color` | color | XML, CSS | paint, filter-buffer | filter-primitives | implemented |
| `flood-opacity` | opacity | XML, CSS | paint, filter-buffer | filter-primitives | implemented |
| `font-family` | discrete | XML, CSS | text-layout, bounds | any | pending follow-up |
| `font-size` | length | XML, CSS | text-layout, bounds | any | implemented |
| `font-style` | discrete | XML, CSS | text-layout, bounds | any | pending follow-up |
| `font-weight` | discrete | XML, CSS | text-layout, bounds | any | pending follow-up |
| `fr` | length | XML, CSS | paint | any | implemented |
| `fx` | length | XML, CSS | paint | any | implemented |
| `fy` | length | XML, CSS | paint | any | implemented |
| `glyph-orientation-horizontal` | angle | XML, CSS | text-layout, bounds | any | pending follow-up |
| `glyph-orientation-vertical` | angle | XML, CSS | text-layout, bounds | any | pending follow-up |
| `gradientTransform` | transform | XML, CSS | paint | any | implemented |
| `gradientUnits` | discrete | XML, CSS | paint | any | implemented |
| `height` | length | XML, CSS | geometry, bounds | any | implemented |
| `href` | discrete | XML, CSS | paint | any | pending follow-up |
| `in` | discrete | XML, CSS | paint | any | pending follow-up |
| `in2` | discrete | XML, CSS | paint | any | pending follow-up |
| `intercept` | number | XML, CSS | filter-buffer | filter-primitives | implemented |
| `k` | number | XML, CSS | filter-buffer | filter-primitives | implemented |
| `k1` | number | XML, CSS | filter-buffer | filter-primitives | implemented |
| `k2` | number | XML, CSS | filter-buffer | filter-primitives | implemented |
| `k3` | number | XML, CSS | filter-buffer | filter-primitives | implemented |
| `k4` | number | XML, CSS | filter-buffer | filter-primitives | implemented |
| `kernelMatrix` | number-list | XML, CSS | filter-buffer | filter-primitives | implemented |
| `kernelUnitLength` | number-list | XML, CSS | filter-buffer | filter-primitives | implemented |
| `keyPoints` | number-list | XML, CSS | paint | any | pending follow-up |
| `lengthAdjust` | discrete | XML, CSS | paint | any | pending follow-up |
| `letter-spacing` | length | XML, CSS | text-layout, bounds | any | implemented |
| `lighting-color` | color | XML, CSS | paint, filter-buffer | filter-primitives | implemented |
| `limitingConeAngle` | number | XML, CSS | filter-buffer | filter-primitives | implemented |
| `marker-end` | discrete | XML, CSS | resource | any | pending resource wiring |
| `marker-mid` | discrete | XML, CSS | resource | any | pending resource wiring |
| `marker-start` | discrete | XML, CSS | resource | any | pending resource wiring |
| `markerHeight` | length | XML, CSS | paint | any | pending follow-up |
| `markerUnits` | discrete | XML, CSS | paint | any | pending follow-up |
| `markerWidth` | length | XML, CSS | paint | any | pending follow-up |
| `mask` | discrete | XML, CSS | resource | any | pending resource wiring |
| `mask-type` | discrete | XML, CSS | paint | any | pending follow-up |
| `maskContentUnits` | discrete | XML, CSS | paint | any | pending follow-up |
| `maskUnits` | discrete | XML, CSS | paint | any | pending follow-up |
| `method` | discrete | XML, CSS | paint | any | pending follow-up |
| `mode` | discrete | XML, CSS | paint | any | pending follow-up |
| `numOctaves` | integer | XML, CSS | filter-buffer | filter-primitives | implemented |
| `offset` | opacity | XML, CSS | paint | stop | implemented |
| `opacity` | opacity | XML, CSS | paint | any | implemented |
| `operator` | discrete | XML, CSS | paint | any | pending follow-up |
| `order` | integer | XML, CSS | filter-buffer | filter-primitives | implemented |
| `orient` | angle | XML, CSS | paint | any | pending follow-up |
| `overflow` | discrete | XML, CSS | paint | any | pending follow-up |
| `pathLength` | number | XML, CSS | geometry, bounds, filter-buffer | filter-primitives | implemented |
| `patternContentUnits` | discrete | XML, CSS | paint | any | pending follow-up |
| `patternTransform` | transform | XML, CSS | paint | any | pending follow-up |
| `patternUnits` | discrete | XML, CSS | paint | any | pending follow-up |
| `pointer-events` | discrete | XML, CSS | paint | any | pending follow-up |
| `points` | points | XML, CSS | geometry, bounds | any | implemented |
| `pointsAtX` | number | XML, CSS | filter-buffer | filter-primitives | implemented |
| `pointsAtY` | number | XML, CSS | filter-buffer | filter-primitives | implemented |
| `pointsAtZ` | number | XML, CSS | filter-buffer | filter-primitives | implemented |
| `preserveAlpha` | discrete | XML, CSS | paint | any | pending follow-up |
| `preserveAspectRatio` | discrete | XML | viewport, geometry, bounds | svg, symbol, view, marker, pattern, image | implemented |
| `primitiveUnits` | discrete | XML, CSS | paint | any | pending follow-up |
| `r` | length | XML, CSS | geometry, bounds | any | implemented |
| `radius` | number-list | XML, CSS | filter-buffer | filter-primitives | implemented |
| `refX` | length | XML, CSS | paint | any | pending follow-up |
| `refY` | length | XML, CSS | paint | any | pending follow-up |
| `result` | discrete | XML, CSS | paint | any | pending follow-up |
| `rotate` | number-list | XML, CSS | text-layout, bounds | any | pending follow-up |
| `rx` | length | XML, CSS | geometry, bounds | any | implemented |
| `ry` | length | XML, CSS | geometry, bounds | any | implemented |
| `scale` | number | XML, CSS | filter-buffer | filter-primitives | implemented |
| `seed` | number | XML, CSS | filter-buffer | filter-primitives | implemented |
| `shape-rendering` | discrete | XML, CSS | paint | any | pending follow-up |
| `side` | discrete | XML, CSS | paint | any | pending follow-up |
| `slope` | number | XML, CSS | filter-buffer | filter-primitives | implemented |
| `spacing` | discrete | XML, CSS | paint | any | pending follow-up |
| `specularConstant` | number | XML, CSS | filter-buffer | filter-primitives | implemented |
| `specularExponent` | number | XML, CSS | filter-buffer | filter-primitives | implemented |
| `spreadMethod` | discrete | XML, CSS | paint | any | implemented |
| `startOffset` | length | XML, CSS | text-layout, bounds | any | implemented |
| `stdDeviation` | number-list | XML, CSS | filter-buffer | filter-primitives | implemented |
| `stitchTiles` | discrete | XML, CSS | paint | any | pending follow-up |
| `stop-color` | color | XML, CSS | paint | stop | implemented |
| `stop-opacity` | opacity | XML, CSS | paint | stop | implemented |
| `stroke` | paint | XML, CSS | paint | any | implemented |
| `stroke-dasharray` | length-list | XML, CSS | paint | any | implemented |
| `stroke-dashoffset` | length | XML, CSS | paint | any | implemented |
| `stroke-linecap` | discrete | XML, CSS | paint | any | implemented |
| `stroke-linejoin` | discrete | XML, CSS | paint | any | implemented |
| `stroke-miterlimit` | number | XML, CSS | paint | any | implemented |
| `stroke-opacity` | opacity | XML, CSS | paint | any | implemented |
| `stroke-width` | length | XML, CSS | paint | any | implemented |
| `surfaceScale` | number | XML, CSS | filter-buffer | filter-primitives | implemented |
| `tableValues` | number-list | XML, CSS | filter-buffer | filter-primitives | implemented |
| `targetX` | integer | XML, CSS | filter-buffer | filter-primitives | implemented |
| `targetY` | integer | XML, CSS | filter-buffer | filter-primitives | implemented |
| `text-anchor` | discrete | XML, CSS | text-layout, bounds | any | pending follow-up |
| `text-decoration` | discrete | XML, CSS | text-layout, bounds | any | pending follow-up |
| `textLength` | length | XML, CSS | text-layout, bounds | any | implemented |
| `transform` | transform | XML, CSS | paint | any | pending follow-up |
| `type` | discrete | XML, CSS | paint | any | pending follow-up |
| `values` | number-list | XML, CSS | filter-buffer | filter-primitives | implemented |
| `vector-effect` | discrete | XML, CSS | paint | any | pending follow-up |
| `viewBox` | viewBox | XML | viewport, geometry, bounds | svg, symbol, view, marker, pattern, image | implemented |
| `visibility` | discrete | XML, CSS | visibility | any | implemented |
| `width` | length | XML, CSS | geometry, bounds | any | implemented |
| `word-spacing` | length | XML, CSS | text-layout, bounds | any | implemented |
| `x` | length | XML, CSS | geometry, bounds, text-layout | any | implemented |
| `x1` | length | XML, CSS | geometry, bounds | any | implemented |
| `x2` | length | XML, CSS | geometry, bounds | any | implemented |
| `xChannelSelector` | discrete | XML, CSS | paint | any | pending follow-up |
| `y` | length | XML, CSS | geometry, bounds, text-layout | any | implemented |
| `y1` | length | XML, CSS | geometry, bounds | any | implemented |
| `y2` | length | XML, CSS | geometry, bounds | any | implemented |
| `yChannelSelector` | discrete | XML, CSS | paint | any | pending follow-up |

## Specialized animation elements

| Element | Status | Evidence |
| --- | --- | --- |
| `<animateTransform>` | implemented | typed parser/sampler/composition tests; 18-frame `benchmark-06-animate-transform` |
| `<animateMotion>` / `<mpath>` | implemented | metric/parser/composition tests; 18-frame `benchmark-07-animate-motion` |
| CSS `@keyframes` | implemented | cascade/timing/value tests; 18-frame `benchmark-08-css-keyframes` |
| Animated resources, filters, and nested text | implemented | resource/filter/text unit evidence; 9-frame `benchmark-09-animated-resources` |
