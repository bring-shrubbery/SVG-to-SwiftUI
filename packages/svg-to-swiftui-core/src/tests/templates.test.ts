import * as TemplateFunctions from "../templates";

describe("Templates", () => {
  test("function template", () => {
    const result = TemplateFunctions.createFunctionTemplate({
      name: "testFunction",
      parameters: [["testParameter", "String"]],
      returnType: "String",
      indent: 2,
      body: ['return "test"'],
    });

    expect(result.join("\n")).toBe(
      [
        "func testFunction(testParameter: String) -> String {",
        '  return "test"',
        "}",
      ].join("\n"),
    );
  });

  test("struct template", () => {
    const result = TemplateFunctions.createStructTemplate({
      name: "testStruct",
      returnType: "String",
      indent: 2,
      body: ['return "test"'],
    });

    expect(result.join("\n")).toBe(
      ["struct testStruct: String {", '  return "test"', "}"].join("\n"),
    );
  });
});
