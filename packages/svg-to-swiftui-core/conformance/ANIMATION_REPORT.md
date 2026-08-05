# Declarative animation attribute report

Generated from `ANIMATION_ATTRIBUTE_REGISTRY`. Do not edit by hand.

This report describes declarative animation wiring. Attribute rows cover `<animate>`, `<set>`, and CSS `@keyframes`; specialized animation systems are listed separately.

## Summary

| Status | Attributes |
| --- | ---: |
| pending follow-up | 29 |
| pending resource wiring | 35 |
| implemented | 39 |

## Registry

| Attribute | Value family | Namespace | Invalidation | Target | Runtime |
| --- | --- | --- | --- | --- | --- |
| `alignment-baseline` | discrete | XML, CSS | text-layout, bounds | any | pending follow-up |
| `amplitude` | number | XML, CSS | filter-buffer | filter-primitives | pending resource wiring |
| `azimuth` | number | XML, CSS | filter-buffer | filter-primitives | pending resource wiring |
| `baseFrequency` | number | XML, CSS | filter-buffer | filter-primitives | pending resource wiring |
| `bias` | number | XML, CSS | filter-buffer | filter-primitives | pending resource wiring |
| `clip-path` | discrete | XML, CSS | resource | any | pending resource wiring |
| `clip-rule` | discrete | XML, CSS | paint | any | pending follow-up |
| `color` | color | XML, CSS | paint | any | implemented |
| `color-interpolation` | discrete | XML, CSS | paint | any | pending follow-up |
| `color-interpolation-filters` | discrete | XML, CSS | paint | any | pending follow-up |
| `cx` | length | XML, CSS | geometry, bounds | any | implemented |
| `cy` | length | XML, CSS | geometry, bounds | any | implemented |
| `d` | path | XML, CSS | geometry, bounds | any | implemented |
| `diffuseConstant` | number | XML, CSS | filter-buffer | filter-primitives | pending resource wiring |
| `display` | discrete | XML, CSS | visibility | any | implemented |
| `divisor` | number | XML, CSS | filter-buffer | filter-primitives | pending resource wiring |
| `dominant-baseline` | discrete | XML, CSS | text-layout, bounds | any | pending follow-up |
| `dx` | length | XML, CSS | text-layout, bounds | any | implemented |
| `dy` | length | XML, CSS | text-layout, bounds | any | implemented |
| `elevation` | number | XML, CSS | filter-buffer | filter-primitives | pending resource wiring |
| `exponent` | number | XML, CSS | filter-buffer | filter-primitives | pending resource wiring |
| `fill` | paint | XML, CSS | paint | any | implemented |
| `fill-opacity` | opacity | XML, CSS | paint | any | implemented |
| `fill-rule` | discrete | XML, CSS | paint | any | pending follow-up |
| `filter` | discrete | XML, CSS | resource, filter-buffer | any | pending resource wiring |
| `flood-color` | color | XML, CSS | paint, filter-buffer | filter-primitives | pending resource wiring |
| `flood-opacity` | opacity | XML, CSS | paint, filter-buffer | filter-primitives | pending resource wiring |
| `font-family` | discrete | XML, CSS | text-layout, bounds | any | pending follow-up |
| `font-size` | length | XML, CSS | text-layout, bounds | any | implemented |
| `font-style` | discrete | XML, CSS | text-layout, bounds | any | pending follow-up |
| `font-weight` | discrete | XML, CSS | text-layout, bounds | any | pending follow-up |
| `fx` | length | XML, CSS | paint | any | pending follow-up |
| `fy` | length | XML, CSS | paint | any | pending follow-up |
| `glyph-orientation-horizontal` | angle | XML, CSS | text-layout, bounds | any | pending follow-up |
| `glyph-orientation-vertical` | angle | XML, CSS | text-layout, bounds | any | pending follow-up |
| `height` | length | XML, CSS | geometry, bounds | any | implemented |
| `intercept` | number | XML, CSS | filter-buffer | filter-primitives | pending resource wiring |
| `k` | number | XML, CSS | filter-buffer | filter-primitives | pending resource wiring |
| `k1` | number | XML, CSS | filter-buffer | filter-primitives | pending resource wiring |
| `k2` | number | XML, CSS | filter-buffer | filter-primitives | pending resource wiring |
| `k3` | number | XML, CSS | filter-buffer | filter-primitives | pending resource wiring |
| `k4` | number | XML, CSS | filter-buffer | filter-primitives | pending resource wiring |
| `keyPoints` | number-list | XML, CSS | paint | any | pending follow-up |
| `letter-spacing` | length | XML, CSS | text-layout, bounds | any | implemented |
| `lighting-color` | color | XML, CSS | paint, filter-buffer | filter-primitives | pending resource wiring |
| `limitingConeAngle` | number | XML, CSS | filter-buffer | filter-primitives | pending resource wiring |
| `marker-end` | discrete | XML, CSS | resource | any | pending resource wiring |
| `marker-mid` | discrete | XML, CSS | resource | any | pending resource wiring |
| `marker-start` | discrete | XML, CSS | resource | any | pending resource wiring |
| `markerHeight` | length | XML, CSS | paint | any | pending follow-up |
| `markerWidth` | length | XML, CSS | paint | any | pending follow-up |
| `mask` | discrete | XML, CSS | resource | any | pending resource wiring |
| `numOctaves` | integer | XML, CSS | filter-buffer | filter-primitives | pending resource wiring |
| `offset` | opacity | XML, CSS | paint | stop | implemented |
| `opacity` | opacity | XML, CSS | paint | any | implemented |
| `order` | integer | XML, CSS | filter-buffer | filter-primitives | pending resource wiring |
| `orient` | angle | XML, CSS | paint | any | pending follow-up |
| `overflow` | discrete | XML, CSS | paint | any | pending follow-up |
| `pathLength` | number | XML, CSS | geometry, bounds, filter-buffer | filter-primitives | pending resource wiring |
| `pointer-events` | discrete | XML, CSS | paint | any | pending follow-up |
| `points` | points | XML, CSS | geometry, bounds | any | implemented |
| `preserveAspectRatio` | discrete | XML | viewport, geometry, bounds | svg, symbol, view, marker, pattern | implemented |
| `r` | length | XML, CSS | geometry, bounds | any | implemented |
| `refX` | length | XML, CSS | paint | any | pending follow-up |
| `refY` | length | XML, CSS | paint | any | pending follow-up |
| `rotate` | number-list | XML, CSS | text-layout, bounds | any | pending follow-up |
| `rx` | length | XML, CSS | geometry, bounds | any | implemented |
| `ry` | length | XML, CSS | geometry, bounds | any | implemented |
| `scale` | number | XML, CSS | filter-buffer | filter-primitives | pending resource wiring |
| `shape-rendering` | discrete | XML, CSS | paint | any | pending follow-up |
| `slope` | number | XML, CSS | filter-buffer | filter-primitives | pending resource wiring |
| `specularConstant` | number | XML, CSS | filter-buffer | filter-primitives | pending resource wiring |
| `specularExponent` | number | XML, CSS | filter-buffer | filter-primitives | pending resource wiring |
| `startOffset` | length | XML, CSS | text-layout, bounds | any | pending follow-up |
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
| `surfaceScale` | number | XML, CSS | filter-buffer | filter-primitives | pending resource wiring |
| `targetX` | integer | XML, CSS | filter-buffer | filter-primitives | pending resource wiring |
| `targetY` | integer | XML, CSS | filter-buffer | filter-primitives | pending resource wiring |
| `text-anchor` | discrete | XML, CSS | text-layout, bounds | any | pending follow-up |
| `text-decoration` | discrete | XML, CSS | text-layout, bounds | any | pending follow-up |
| `textLength` | length | XML, CSS | text-layout, bounds | any | pending follow-up |
| `transform` | transform | XML, CSS | paint | any | pending follow-up |
| `values` | number-list | XML, CSS | filter-buffer | filter-primitives | pending resource wiring |
| `vector-effect` | discrete | XML, CSS | paint | any | pending follow-up |
| `viewBox` | viewBox | XML | viewport, geometry, bounds | svg, symbol, view, marker, pattern | implemented |
| `visibility` | discrete | XML, CSS | visibility | any | implemented |
| `width` | length | XML, CSS | geometry, bounds | any | implemented |
| `word-spacing` | length | XML, CSS | text-layout, bounds | any | implemented |
| `x` | length | XML, CSS | geometry, bounds, text-layout | any | implemented |
| `x1` | length | XML, CSS | geometry, bounds | any | implemented |
| `x2` | length | XML, CSS | geometry, bounds | any | implemented |
| `y` | length | XML, CSS | geometry, bounds, text-layout | any | implemented |
| `y1` | length | XML, CSS | geometry, bounds | any | implemented |
| `y2` | length | XML, CSS | geometry, bounds | any | implemented |

## Specialized animation elements

| Element | Status | Evidence |
| --- | --- | --- |
| `<animateTransform>` | implemented | typed parser/sampler/composition tests; 18-frame `benchmark-06-animate-transform` |
| `<animateMotion>` / `<mpath>` | implemented | metric/parser/composition tests; 18-frame `benchmark-07-animate-motion` |
| CSS `@keyframes` | implemented | cascade/timing/value tests; 18-frame `benchmark-08-css-keyframes` |
