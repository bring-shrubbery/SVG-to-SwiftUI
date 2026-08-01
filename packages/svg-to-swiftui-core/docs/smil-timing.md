# SMIL timing contract

The compiler models SVG animation timing independently from interpolation and drawing. A timing sample is a pure function of the immutable animation program, document time, and an ordered deterministic event trace.

The implementation follows the W3C [SMIL timing model](https://www.w3.org/TR/SMIL3/smil-timing.html) for clock values, instance-time lists, active-duration arithmetic, repeats, `min`, `max`, `restart`, and timing `fill`.

## Supported timing input

- offset, full-clock, and partial-clock values, including negative begin offsets
- semicolon-separated `begin` and `end` lists
- syncbase `id.begin` and `id.end` references with offsets
- `id.repeat(n)` references
- deterministic eventbase references supplied as `{ time, targetId, name, order }`
- finite or indefinite `dur`, `repeatCount`, and `repeatDur`
- `min`, `max`, `restart="always|whenNotActive|never"`, and `fill="remove|freeze"`

The sample reports inactive, active, frozen, or completed state; simple time and progress; active/simple duration; repeat iteration; exact begin/end/repeat boundaries; selected begin; and the effective interval. Equal timestamps use dependency order, document order, then event input order.

Dependency cycles and missing references remain unresolved and produce source-located diagnostics. They never recurse at runtime.

## Deterministic fallbacks

`wallclock(...)` and `accessKey(...)` are parsed into explicit typed values but are not reinterpreted. Their instance times stay unresolved. Permissive conversion emits a diagnostic and keeps the animation inactive; strict conversion fails.

Invalid `min`/`max` values are ignored as the specification requires. When numeric `max` is less than `min`, both bounds are ignored. Invalid timing still produces a diagnostic so strict builds can enforce clean source.

The temporal test manifest stores exact microsecond boundary frames. Shared serialized expectations drive the TypeScript sampler, generated Swift timing helper, WebKit reference seek, and SwiftUI frame comparison.
