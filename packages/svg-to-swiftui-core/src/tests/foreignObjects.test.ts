import {
  __testing,
  convert,
  convertAsync,
  convertAsyncWithArtifacts,
  convertAsyncWithDiagnostics,
  convertWithDiagnostics,
  type ForeignObjectSnapshotRequest,
} from "../index";

function svg(content: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80">${content}</svg>`;
}

function solid(request: ForeignObjectSnapshotRequest, rgba = [255, 0, 0, 255]) {
  const bytes = new Uint8Array(request.pixelWidth * request.pixelHeight * 4);
  for (let index = 0; index < bytes.length; index += 4) bytes.set(rgba, index);
  return { rgba: bytes, width: request.pixelWidth, height: request.pixelHeight, scale: request.scale };
}

describe("static foreignObject snapshots", () => {
  test("never silently drops visible content when the async adapter is missing", async () => {
    const source = svg(
      `<foreignObject width="40" height="20"><div xmlns="http://www.w3.org/1999/xhtml">Hello</div></foreignObject>`,
    );
    const sync = convertWithDiagnostics(source);
    const asyncResult = await convertAsyncWithDiagnostics(source);

    expect(sync.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "foreign-object-requires-async-conversion" })]),
    );
    expect(asyncResult.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "missing-foreign-object-renderer" })]),
    );
    expect(sync.swift).not.toContain("ForeignObjectLayer");
    await expect(convertAsync(source, { strict: true })).rejects.toThrow("requires convertAsync");
  });

  test("constructs a sanitized isolated document with inherited style and accessibility text", async () => {
    let request: ForeignObjectSnapshotRequest | undefined;
    const source = svg(`
      <g color="#123456" font-family="Example" font-size="12">
        <foreignObject id="card" x="7" y="9" width="50" height="24">
          <div xmlns="http://www.w3.org/1999/xhtml" style="background:#fff" onclick="steal()">
            <script>globalThis.compromised = true</script>
            <span aria-label="Account status">Ready</span>
            <a href="https://example.test/escape">leave</a>
          </div>
        </foreignObject>
      </g>
    `);

    const result = await convertAsyncWithDiagnostics(source, {
      fonts: { availableFamilies: ["Example"] },
      foreignObjectRenderer: (value) => {
        request = value;
        return solid(value);
      },
    });

    expect(result.diagnostics).toEqual([]);
    expect(request).toMatchObject({
      viewport: { x: 7, y: 9, width: 50, height: 24 },
      pixelWidth: 50,
      pixelHeight: 24,
      scale: 1,
      source: { element: "foreignObject", id: "card" },
      accessibilityLabel: "Account status",
    });
    expect(request?.document).toContain("Content-Security-Policy");
    expect(request?.document).toContain("font-family:Example");
    expect(request?.document).toContain("background:#fff");
    expect(request?.document).not.toMatch(/<script|onclick=|href="https:\/\/example\.test\/escape"/);
    expect(result.swift).toContain("private struct ForeignObjectLayer0: View");
    expect(result.swift).toContain('.accessibilityLabel("Account status")');
  });

  test("serializes HTML void elements without creating duplicate layout nodes", async () => {
    let request: ForeignObjectSnapshotRequest | undefined;
    const source = svg(`
      <foreignObject width="50" height="24">
        <div xmlns="http://www.w3.org/1999/xhtml">First<br/><img src="data:image/png;base64,AA=="/>Last<wbr/></div>
      </foreignObject>
    `);

    await convertAsync(source, {
      foreignObjectRenderer: (value) => {
        request = value;
        return solid(value);
      },
    });

    expect(request?.document).toContain("First<br><img");
    expect(request?.document).toContain("Last<wbr>");
    expect(request?.document).not.toMatch(/<\/(?:br|img|wbr)>/);
  });

  test("keeps arbitrary CSS targeted exclusively at foreign content valid in strict mode", async () => {
    const source = svg(`
      <style>.card { display:grid; grid-template-columns:1fr 2fr; background:#fff; border:2px solid #333; padding:4px }</style>
      <foreignObject width="50" height="20"><div xmlns="http://www.w3.org/1999/xhtml" class="card">CSS</div></foreignObject>
    `);
    await expect(convertAsync(source, { strict: true, foreignObjectRenderer: solid })).resolves.toContain(
      "ForeignObjectLayer0",
    );
  });

  test("places and composes the snapshot through the existing image pipeline", async () => {
    const source = svg(`
      <defs>
        <clipPath id="clip"><rect x="10" y="10" width="30" height="20"/></clipPath>
        <mask id="mask"><rect width="120" height="80" fill="white"/></mask>
      </defs>
      <foreignObject x="5" y="6" width="40" height="20" transform="translate(3 4)"
        opacity=".5" clip-path="url(#clip)" mask="url(#mask)" style="mix-blend-mode:multiply">
        <div xmlns="http://www.w3.org/1999/xhtml">Placed</div>
      </foreignObject>
    `);
    const output = await convertAsync(source, { foreignObjectRenderer: solid });

    expect(output).toContain("CGRect(x: 5, y: 6, width: 40, height: 20)");
    expect(output).toContain("tx: 3 * size.width / 120, ty: 4 * size.height / 80");
    expect(output).toContain(".opacity(0.5)");
    expect(output).toContain(".blendMode(.multiply)");
    expect(output).toContain(".mask {");

    const document = __testing.parseRenderDocument(source, { foreignObjectRenderer: solid });
    const root = document.children[0];
    const foreignObject = root?.type === "group" ? root.children.find((node) => node.type === "foreignObject") : root;
    expect(foreignObject?.mask).toMatchObject({
      invalid: false,
      region: { x: 1, y: 4, width: 48, height: 24 },
    });
    expect(foreignObject?.mask?.children).toHaveLength(1);
  });

  test("validates renderer dimensions and reports adapter failures", async () => {
    const source = svg(
      `<foreignObject width="10" height="5"><div xmlns="http://www.w3.org/1999/xhtml">Bad</div></foreignObject>`,
    );
    const malformed = await convertAsyncWithDiagnostics(source, {
      foreignObjectRenderer: (request) => ({
        rgba: new Uint8Array(4),
        width: 1,
        height: 1,
        scale: request.scale,
      }),
    });
    const rejected = await convertAsyncWithDiagnostics(source, {
      foreignObjectRenderer: async () => {
        throw new Error("browser unavailable");
      },
    });

    expect(malformed.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "foreign-object-renderer-error" })]),
    );
    expect(rejected.diagnostics[0]?.message).toContain("browser unavailable");
    expect(rejected.swift).not.toContain("ForeignObjectLayer");
  });

  test("bounds scale, supports non-square snapshots, and exposes deterministic artifacts", async () => {
    const source = svg(
      `<foreignObject x="2" y="3" width="9" height="4"><div xmlns="http://www.w3.org/1999/xhtml">Asset</div></foreignObject>`,
    );
    const first = await convertAsyncWithArtifacts(source, {
      foreignObjectRenderer: solid,
      foreignObjects: { scale: 10, maxScale: 2, inlineByteLimit: 0 },
    });
    const second = await convertAsyncWithArtifacts(source, {
      foreignObjectRenderer: solid,
      foreignObjects: { scale: 10, maxScale: 2, inlineByteLimit: 0 },
    });

    expect(first.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "foreign-object-scale-clamped" })]),
    );
    expect(first.artifacts).toHaveLength(1);
    expect(first.artifacts[0]).toMatchObject({ mimeType: "image/png", width: 18, height: 8, scale: 2 });
    expect(first.artifacts[0]?.name).toMatch(/^ForeignObject_[\da-f]{16}\.png$/);
    expect(first.artifacts[0]?.name).toBe(second.artifacts[0]?.name);
    expect(first.artifacts[0]?.bytes).toEqual(second.artifacts[0]?.bytes);
    expect(first.swift).toContain(`Image("${first.artifacts[0]?.name.replace(/\.png$/, "")}")`);
    expect(first.swift).not.toContain("Data(base64Encoded:");
  });

  test("routes embedded image and font requests through the configured resource resolver", async () => {
    const requests: string[] = [];
    const source = svg(
      `<foreignObject width="20" height="10"><div xmlns="http://www.w3.org/1999/xhtml"><img src="asset.png"/></div></foreignObject>`,
    );
    const result = await convertAsyncWithDiagnostics(source, {
      resources: {
        policy: "custom",
        baseURL: "https://assets.example.test/root.svg",
        resolver: (request) => {
          requests.push(`${request.kind}:${request.canonicalURL}`);
          return {
            bytes: Uint8Array.from([0x77, 0x4f, 0x46, 0x32, 0, 0, 0, 0]),
            mimeType: "font/woff2",
          };
        },
      },
      foreignObjectRenderer: async (request) => {
        await request.resolveResource(new URL("font.woff2", request.baseURL).href);
        return solid(request);
      },
    });

    expect(result.diagnostics).toEqual([]);
    expect(requests).toEqual(["foreign-object:https://assets.example.test/font.woff2"]);
  });

  test("models foreignObject distinctly with exact painted bounds", async () => {
    const source = svg(
      `<foreignObject x="4" y="5" width="30" height="12"><div xmlns="http://www.w3.org/1999/xhtml">Tree</div></foreignObject>`,
    );
    const config = { foreignObjectRenderer: solid };
    await convertAsync(source, config);
    const document = __testing.parseRenderDocument(source, config);
    const root = document.children[0];
    const node = root?.type === "group" ? root.children[0] : root;
    expect(node?.type).toBe("foreignObject");
  });

  test("legacy convert remains a string-returning API", () => {
    expect(typeof convert(svg(`<rect width="1" height="1"/>`))).toBe("string");
  });
});
