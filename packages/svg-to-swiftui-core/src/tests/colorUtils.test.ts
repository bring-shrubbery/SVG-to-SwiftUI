import { parseOpacity, swiftUIColor } from "../colorUtils";

test("convert SVG colors to SwiftUI colors", () => {
  expect(swiftUIColor("#f80")).toBe("Color(red: 1, green: 0.5333, blue: 0)");
  expect(swiftUIColor("rgba(255, 0, 128, 0.5)")).toBe("Color(red: 1, green: 0, blue: 0.502, opacity: 0.5)");
  expect(swiftUIColor("rebeccapurple")).toBe("Color(red: 0.4, green: 0.2, blue: 0.6)");
  expect(swiftUIColor("hsl(120 100% 50% / 25%)")).toBe("Color(red: 0, green: 1, blue: 0, opacity: 0.25)");
  expect(swiftUIColor("currentColor", 0.25)).toBe("Color.primary.opacity(0.25)");
});

test("parse SVG opacity values", () => {
  expect(parseOpacity("50%")).toBe(0.5);
  expect(parseOpacity("2")).toBe(1);
  expect(parseOpacity("invalid")).toBe(1);
});

test("leave unsupported paints for legacy conversion", () => {
  expect(swiftUIColor("url(#gradient)")).toBeUndefined();
});
