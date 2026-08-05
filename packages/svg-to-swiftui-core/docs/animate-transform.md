# `<animateTransform>` contract

The compiler implements SVG `translate`, `scale`, `rotate`, `skewX`, and `skewY` animation as a pure function of `documentTime`. One- and two-argument translate/scale values and one- and three-argument rotate values are canonicalized before interpolation. Number, supported length, percentage, and angle units resolve in the target element's coordinate context.

`values`, `from/to`, `from/by`, `by`, and `to` forms support discrete, linear, paced, and spline calculation. Transform parameters interpolate and accumulate component-by-component. Additive animation post-multiplies its sampled transform onto the presentation value below it, and simultaneous animations compose in document order. Arbitrary static transform lists stay as ordered lists/matrices; the compiler does not decompose them.

Generated SwiftUI applies an output-space correction matrix around the target's complete rendered subtree. This preserves ancestor transforms and structural transforms from `<use>`, symbol/nested viewports, markers, patterns, gradients, clips, masks, filters, text, and geometry-derived effects. Static documents remain on the existing fast path.

Stable diagnostics include `invalid-animation-transform-type`, `invalid-animation-transform-attribute`, and `invalid-animation-transform-value`, alongside the shared target, timing, value-form, and keyframe diagnostics. Permissive mode keeps the static presentation for an invalid animation; strict mode rejects warnings.

Evidence includes typed parser/sampler/composition tests and `benchmark-06-animate-transform`: 18 exact WebKit-versus-SwiftUI frames around interpolation and repeat boundaries. The WebKit oracle explicitly seeks every nested SVG time container before each lossless frame snapshot.
