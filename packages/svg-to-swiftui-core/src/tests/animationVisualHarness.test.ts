import {
  animationFrameStem,
  loadAnimationFixtures,
  timelineFrames,
  validateAnimationManifest,
} from "../../animation-tests/manifest";

describe("deterministic animation visual harness", () => {
  test("derives frame times from integer frame indices without accumulated drift", () => {
    const frames = timelineFrames({
      durationMicroseconds: 1_000_000,
      framesPerSecond: 30,
    });
    expect(frames).toHaveLength(30);
    expect(frames[0]).toEqual({ index: 0, timeMicroseconds: 0, stem: "000000-000000000000000" });
    expect(frames[1]?.timeMicroseconds).toBe(33_333);
    expect(frames[29]?.timeMicroseconds).toBe(966_666);
  });

  test("includes the exact loop endpoint only when requested", () => {
    const frames = timelineFrames({
      durationMicroseconds: 1_000_000,
      framesPerSecond: 10,
      includeEndFrame: true,
    });
    expect(frames).toHaveLength(11);
    expect(frames[frames.length - 1]?.timeMicroseconds).toBe(1_000_000);
  });

  test("uses explicit microsecond schedules and lexically sortable names", () => {
    const frames = timelineFrames({
      durationMicroseconds: 1_000_000,
      framesPerSecond: 30,
      sampleTimesMicroseconds: [0, 333_333, 1_000_000],
    });
    expect(frames.map((frame) => frame.stem)).toEqual([
      "000000-000000000000000",
      "000001-000000000333333",
      "000002-000000001000000",
    ]);
    expect(animationFrameStem(12, 42)).toBe("000012-000000000000042");
  });

  test("ships valid comparison and independent reference probe fixtures", () => {
    expect(validateAnimationManifest()).toEqual([]);
    const fixtures = loadAnimationFixtures();
    expect(fixtures.some((fixture) => fixture.mode === "comparison")).toBe(true);
    expect(fixtures.some((fixture) => fixture.tags.includes("smil"))).toBe(true);
    expect(fixtures.some((fixture) => fixture.tags.includes("css-animation"))).toBe(true);
  });
});
