---
"svg-to-swiftui-core": minor
---

Add exact static SVG filter color and compositing support for all `feBlend` modes, every `feColorMatrix` form, all `feComponentTransfer` functions, and Porter-Duff plus arithmetic `feComposite` operators. Generated SwiftUI uses deterministic premultiplied CPU RGBA math with sRGB/linearRGB processing, structured malformed-value diagnostics, numeric reference tests, and full-RGBA visual grids.
