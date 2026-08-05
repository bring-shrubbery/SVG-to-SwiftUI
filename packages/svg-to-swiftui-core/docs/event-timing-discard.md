# Event timing and discard contract

Event-driven SVG animation is compiled into deterministic SwiftUI. It does not execute JavaScript, SVG event-handler attributes, or arbitrary DOM mutation.

## Deterministic input

Generated event-driven views add this initializer:

```swift
View(
    documentTime: seconds,
    animationEvents: [
        .init(time: 0.3, name: "click", targetID: "button", order: 0)
    ]
)
```

Each event contains document time, a lowercase event name, optional target ID, optional repeat iteration, stable equal-time order, and an optional serializable payload (`x`, `y`, `button`, and `key`). The compiler treats the supplied array as immutable input. Invalid non-finite times are ignored. Events are ordered by time, explicit order, then input order, so the same time and trace always produce the same RGBA result.

Supported eventbase names are `activate`, `blur`, `click`, `focus`, `focusin`, `focusout`, `mousedown`, `mouseenter`, `mouseleave`, `mouseout`, `mouseover`, `mouseup`, `pointerdown`, and `pointerup`. Unqualified eventbase references target the animation target. `id.beginEvent`, `id.endEvent`, and `id.repeatEvent` are deterministic lifecycle aliases. Unknown events and missing or duplicate target IDs produce structured diagnostics; strict conversion rejects them.

## Production interaction adapters

Generated views map authored event dependencies onto native SwiftUI gestures, hover, focus, and accessibility default actions. Adapters are attached to the resolved SVG target after group, transform, clip, and `<use>` expansion. `pointer-events="none"` disables hit testing. Eventless documents do not gain gesture state or hit-testing modifiers.

The exact-time initializer is the test and replay API. `View()` uses the normal document clock and records native interactions at the sampled document time. Scene deactivation pauses that clock and resume does not jump. Recreating the view resets its clock and interaction trace; callers can force a reset with normal SwiftUI identity, such as `.id(resetToken)`. A supplied trace remains caller-owned and unchanged.

Reduced Motion preserves authored timing by default. `respectsReducedMotion: true` opts into the existing time-zero production rendering; explicit document-time and event-trace evaluation stays exact.

## `<discard>`

`<discard>` is a timed, permanent removal of its resolved render target. Before the selected begin instant the target renders normally. At and after the instant it is absent from painting, resource consumers, accessibility, and later native event targeting. Begin lists, eventbase timing, syncbase dependencies, repeat/restart interval construction, transforms, clips, groups, and `<use>` targets share the same pure timing evaluator.

The macOS comparison fixture supplies the same serialized click trace to WebKit and generated Swift, then compares lossless frames before and after removal. WebKit does not implement SVG2 `<discard>`, so that fixture includes an equivalent SMIL `display="none"` assertion solely to keep WebKit a visual oracle; independent pure tests assert the exact `<discard>` boundary.

Nested external SVG documents own separate clocks and traces. Browser scripting and payload-dependent DOM behavior remain outside the native SwiftUI profile.
