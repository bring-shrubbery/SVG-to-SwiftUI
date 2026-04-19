import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { convertFile } from "../convert-file";

const FIXTURE = path.join(__dirname, "fixtures", "icon.svg");

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "svg2swiftui-"));
}

describe("convertFile", () => {
  it("writes a Swift file with a struct derived from the output filename", () => {
    const tmp = makeTmpDir();
    const out = path.join(tmp, "myIcon.swift");

    convertFile({ input: FIXTURE, output: out });

    const written = fs.readFileSync(out, "utf8");
    expect(written).toContain("struct MyIcon: Shape");
  });

  it("honors the structName override", () => {
    const tmp = makeTmpDir();
    const out = path.join(tmp, "icon.swift");

    convertFile({ input: FIXTURE, output: out, structName: "CustomName" });

    const written = fs.readFileSync(out, "utf8");
    expect(written).toContain("struct CustomName: Shape");
  });

  it("creates missing parent directories", () => {
    const tmp = makeTmpDir();
    const out = path.join(tmp, "deeply", "nested", "Icon.swift");

    convertFile({ input: FIXTURE, output: out });

    expect(fs.existsSync(out)).toBe(true);
  });

  it("overwrites an existing output file silently", () => {
    const tmp = makeTmpDir();
    const out = path.join(tmp, "icon.swift");
    fs.writeFileSync(out, "PREVIOUS CONTENT");

    convertFile({ input: FIXTURE, output: out });

    const written = fs.readFileSync(out, "utf8");
    expect(written).not.toContain("PREVIOUS CONTENT");
    expect(written).toContain("struct Icon: Shape");
  });

  it("throws a clear error when input file does not exist", () => {
    const tmp = makeTmpDir();
    const missing = path.join(tmp, "nope.svg");
    const out = path.join(tmp, "out.swift");

    expect(() => convertFile({ input: missing, output: out })).toThrow(
      /Input file not found/,
    );
  });

  it("passes usageComment through to the core converter", () => {
    const tmp = makeTmpDir();
    const out = path.join(tmp, "icon.swift");

    convertFile({ input: FIXTURE, output: out, usageComment: true });

    const written = fs.readFileSync(out, "utf8");
    expect(written.trimStart().startsWith("//")).toBe(true);
  });
});
