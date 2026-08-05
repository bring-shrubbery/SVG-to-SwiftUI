# Animated resources, filters, text, and nested documents

Resource animation is compiled into pure functions of the SVG document time. Generated SwiftUI does not retain a previous frame, mutate a shared definition, or fetch a resource while rendering. The same timestamp therefore produces the same result even when frames are requested out of order.

## Instance model

Gradients, patterns, clips, masks, markers, and filters retain immutable parsed definitions. Each reference produces a consumer-specific instance with its own viewport, object bounding box, transform, font context, and filter-unit scale. Animated values are sampled at the consuming view's `documentTime`; one consumer cannot cache coordinates or filter parameters for another.

The generated code currently samples:

- linear and radial coordinates, focal values, transforms, spread modes, color interpolation, and stop offset/color/opacity;
- pattern origin, size, transform, and complete animated vector content;
- clip and mask content, clip transforms, and mask regions;
- marker content, orientation, and marker-unit scaling;
- filter regions, primitive subregions and inputs, spatial parameters, matrices, transfer tables/functions, convolution, deterministic turbulence, colors, compositing modes, and light sources;
- text/tspan/textPath position, character `dx`/`dy`/`rotate`, text length, typography, paint, and path offset;
- image placement through animated `preserveAspectRatio`, ordinary opacity/transforms, and nested SVG document time;
- nested SVG viewport/viewBox animation and inherited presentation animation.

`benchmark-09-animated-resources` is the independent WebKit comparison scene for these integrations. It renders exact microsecond timestamps through both engines and compares lossless premultiplied-sRGB RGBA frames. The generated MP4 is review-only.

## Bounds and filters

Animated filter regions and primitive subregions are rebuilt for each frame. Object-bounding-box numeric parameters are scaled independently for every consumer. Filter pixels stay premultiplied through the graph, with temporary unpremultiplication only where the Filter Effects formulas require it. Turbulence output is deterministic for the same sampled seed and parameters.

Immutable parse data is shared. Generated playback has no monotonic-time cache and no unbounded frame cache. Conversion tests also cap generated source size and conversion time for a representative many-consumer resource graph; runtime filter pixel limits remain unchanged.

## Nested time and resource safety

Embedded SVG `<image>` and SVG-backed `<feImage>` documents receive the parent's canonical document time. Rendering never introduces network or filesystem access. Existing cycle, nesting, byte, decoded-pixel, filter-pixel, kernel, and octave limits apply before animation frames are produced.

## Accessibility and conditional processing

`<title>` and `<desc>` text, ARIA metadata, and conditional-processing selection are compiled as document semantics, not per-frame paint values. They are not accepted as SMIL/CSS interpolation targets in the native profile. This keeps the accessibility tree stable while visual attributes animate. Ordinary animated visibility continues to affect whether a rendered semantic element is exposed.

Scripts, live HTML mutation in `foreignObject`, external audio/video playback, and runtime DOM mutation remain outside the native declarative renderer.
