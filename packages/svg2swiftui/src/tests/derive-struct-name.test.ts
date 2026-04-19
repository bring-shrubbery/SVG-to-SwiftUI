import { deriveStructName } from "../derive-struct-name";

describe("deriveStructName", () => {
  it("PascalCases a simple lowercase basename", () => {
    expect(deriveStructName("icon.swift")).toBe("Icon");
  });

  it("joins hyphenated segments into PascalCase", () => {
    expect(deriveStructName("bar-baz.swift")).toBe("BarBaz");
  });

  it("joins underscored segments into PascalCase", () => {
    expect(deriveStructName("my_icon.swift")).toBe("MyIcon");
  });

  it("handles digits mid-name", () => {
    expect(deriveStructName("icon_v2.swift")).toBe("IconV2");
  });

  it("ignores directory prefixes", () => {
    expect(deriveStructName("./path/nested/icon.swift")).toBe("Icon");
  });

  it("collapses double dot extensions", () => {
    expect(deriveStructName("icon.view.swift")).toBe("IconView");
  });

  it("falls back to SVGShape when basename has no alphanumeric segments", () => {
    expect(deriveStructName("---.swift")).toBe("SVGShape");
  });

  it("falls back to SVGShape when name starts with a digit", () => {
    expect(deriveStructName("123icon.swift")).toBe("SVGShape");
  });

  it("handles mixed separators", () => {
    expect(deriveStructName("foo bar-baz_qux.swift")).toBe("FooBarBazQux");
  });
});
