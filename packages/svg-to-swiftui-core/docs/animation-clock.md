# Animation clock contract

Animated generated declarations are SwiftUI `View` values with two clock paths:

- `View()` uses one production `TimelineView(.animation)` clock. Time starts at zero when that view identity first samples, pauses while the scene is inactive, and resumes without a jump. Recreating the view with a new identity restarts it.
- `View(documentTime: seconds)` bypasses the production clock and samples the complete SVG document at exactly that time. The temporal test harness uses this initializer for every frame.

One timestamp is passed through the entire generated document. Animation evaluation never reads wall-clock time.

Finite negative values are preserved for pre-begin sampling, large finite values are allowed, and non-finite values become zero. Reduced Motion does not change SVG semantics by default. Call `View(respectsReducedMotion: true)` to freeze production playback at time zero when the system setting is active; explicit document-time sampling remains exact.

Static SVGs keep their existing generated `Shape` or `View` output and contain no animation clock code.
