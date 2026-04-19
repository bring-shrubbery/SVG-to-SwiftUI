import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PKG_ROOT = path.resolve(__dirname, "..", "..");
const BIN = path.join(PKG_ROOT, "dist", "cli.js");
const FIXTURE = path.join(__dirname, "fixtures", "icon.svg");

describe("svg2swiftui CLI (e2e)", () => {
  beforeAll(() => {
    if (!fs.existsSync(BIN)) {
      execFileSync("bun", ["run", "build"], { cwd: PKG_ROOT, stdio: "inherit" });
    }
  });

  it("converts a fixture SVG into a Swift file", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "svg2swiftui-e2e-"));
    const out = path.join(tmp, "Icon.swift");

    execFileSync("node", [BIN, FIXTURE, out], { stdio: "pipe" });

    expect(fs.existsSync(out)).toBe(true);
    const written = fs.readFileSync(out, "utf8");
    expect(written).toContain("struct Icon: Shape");
    expect(written).toContain("func path(in rect: CGRect)");
  });

  it("exits with code 1 and a clear error when input is missing", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "svg2swiftui-e2e-"));
    const missing = path.join(tmp, "nope.svg");
    const out = path.join(tmp, "out.swift");

    let caught: { status: number | null; stderr: string } | null = null;
    try {
      execFileSync("node", [BIN, missing, out], { stdio: "pipe" });
    } catch (err) {
      const e = err as { status: number | null; stderr: Buffer };
      caught = { status: e.status, stderr: e.stderr.toString() };
    }

    expect(caught).not.toBeNull();
    expect(caught?.status).toBe(1);
    expect(caught?.stderr).toMatch(/Input file not found/);
  });
});
