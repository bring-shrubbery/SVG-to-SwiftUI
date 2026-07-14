import { __testing, convert, convertAsync, convertWithDiagnostics, type ResourceRequest } from "../index";

const PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgQIAZcfRzQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

function svgBytes(source: string): Uint8Array {
  return Uint8Array.from(Buffer.from(source, "utf8"));
}

function pngWithDimensions(width: number, height: number): Uint8Array {
  const bytes = Uint8Array.from(PNG);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

function source(image: string): string {
  return `<svg width="40" height="30" viewBox="0 0 40 30" xmlns="http://www.w3.org/2000/svg">${image}</svg>`;
}

describe("SVG image resources", () => {
  test("embeds base64 PNG bytes and decodes only the first image frame at runtime", () => {
    const href = `data:image/png;base64,${Buffer.from(PNG).toString("base64")}`;
    const output = convert(source(`<image href="${href}" x="2" y="3" width="20" height="10"/>`), {
      structName: "EmbeddedPNG",
    });

    expect(output).toContain("struct EmbeddedPNG: View");
    expect(output).toContain("import ImageIO");
    expect(output).toContain("CGImageSourceCreateImageAtIndex(source, 0, nil)");
    expect(output).toContain("context.clip(to: Path(CGRect(x: 2, y: 3, width: 20, height: 10)).applying(");
    expect(output).not.toContain("URLSession");
    expect(output).not.toContain("contentsOf:");
  });

  test("supports percent-encoded SVG data URLs as recursively generated scoped views", () => {
    const nested = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="4" viewBox="0 0 8 4"><rect width="8" height="4" fill="#12ab34"/></svg>`;
    const href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(nested)}`;
    const output = convert(source(`<image href="${href}" x="4" y="5" width="24" height="12"/>`), {
      structName: "NestedImage",
    });

    expect(output).toContain("struct NestedImage: View");
    expect(output).toContain("struct NestedImageImageDocument0: View");
    expect(output).toContain("context.resolveSymbol(id: 0)");
    expect(output).toContain("red: 0.0706");
  });

  test("accepts legacy xlink:href and derives omitted dimensions from raster intrinsic size", () => {
    const document = __testing.parseRenderDocument(source(`<image xlink:href="pixel.png" x="1" y="2"/>`), {
      resources: { supplied: { "pixel.png": { bytes: PNG, mimeType: "image/png" } } },
    });
    const root = document.children[0];
    const image = root?.type === "group" ? root.children[0] : root;

    expect(image?.type).toBe("image");
    if (image?.type !== "image") throw new Error("expected image node");
    expect(image.viewport).toEqual({ x: 1, y: 2, width: 1, height: 1 });
    expect(image.resource?.type).toBe("raster");
  });

  test("defaults to embeddedOnly, emits a precise diagnostic, and never calls a resolver", () => {
    const resolver = jest.fn(() => ({ bytes: PNG, mimeType: "image/png" }));
    const result = convertWithDiagnostics(
      source(`<image href="https://example.test/image.png" width="10" height="10"/>`),
      {
        resources: { resolver },
      },
    );

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "external-resource-denied", source: { element: "image" } }),
      ]),
    );
    expect(resolver).not.toHaveBeenCalled();
    expect(result.swift).not.toContain("ImageLayer0");
  });

  test("reports an async resolver in convert() and resolves it in convertAsync()", async () => {
    const resolver = async () => ({ bytes: PNG, mimeType: "image/png", canonicalURL: "memory://pixel.png" });
    const input = source(`<image href="pixel.png" width="10" height="10"/>`);
    const sync = convertWithDiagnostics(input, { resources: { policy: "custom", resolver } });

    expect(sync.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "async-resource-in-sync-convert" })]),
    );
    await expect(convertAsync(input, { resources: { policy: "custom", resolver } })).resolves.toContain(
      "CGImageSourceCreateWithData",
    );
  });

  test("preloads async resources recursively with subdocument-relative URLs", async () => {
    const requests: string[] = [];
    const child = svgBytes(
      `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><image href="pixel.png" width="10" height="10"/></svg>`,
    );
    const output = await convertAsync(source(`<image href="icons/child.svg" width="20" height="20"/>`), {
      structName: "AsyncNested",
      resources: {
        policy: "custom",
        baseURL: "https://assets.example.test/root.svg",
        resolver: async (request) => {
          requests.push(request.canonicalURL);
          if (request.canonicalURL === "https://assets.example.test/icons/child.svg")
            return { bytes: child, mimeType: "image/svg+xml" };
          if (request.canonicalURL === "https://assets.example.test/icons/pixel.png")
            return { bytes: PNG, mimeType: "image/png" };
          return undefined;
        },
      },
    });

    expect(requests).toEqual([
      "https://assets.example.test/icons/child.svg",
      "https://assets.example.test/icons/pixel.png",
    ]);
    expect(output).toContain("struct AsyncNestedImageDocument0: View");
    expect(output).toContain("CGImageSourceCreateImageAtIndex(source, 0, nil)");
  });

  test("provides a complete deterministic request to custom resolvers", () => {
    let request: ResourceRequest | undefined;
    convert(source(`<image id="avatar" href="icons/avatar.png" width="12" height="8"/>`), {
      resources: {
        policy: "custom",
        baseURL: "https://assets.example.test/ui/root.svg",
        resolver: (value) => {
          request = value;
          return { bytes: PNG, mimeType: "image/png" };
        },
      },
    });

    expect(request).toEqual(
      expect.objectContaining({
        rawURL: "icons/avatar.png",
        canonicalURL: "https://assets.example.test/ui/icons/avatar.png",
        baseURL: "https://assets.example.test/ui/root.svg",
        kind: "image",
        source: { element: "image", id: "avatar" },
      }),
    );
    expect(request?.limits.maxNestingDepth).toBe(8);
  });

  test("rejects local traversal before invoking the caller's local resolver", () => {
    const resolver = jest.fn(() => ({ bytes: PNG, mimeType: "image/png" }));
    const result = convertWithDiagnostics(source(`<image href="../secret.png" width="10" height="10"/>`), {
      resources: { policy: "local", baseDirectory: "/approved", resolver },
    });

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "resource-path-traversal" })]),
    );
    expect(resolver).not.toHaveBeenCalled();
  });

  test("resolves nested local paths relative to their SVG while staying inside baseDirectory", () => {
    const requests: string[] = [];
    const child = svgBytes(
      `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><image href="../shared.png" width="10" height="10"/></svg>`,
    );
    const result = convertWithDiagnostics(source(`<image href="icons/child.svg" width="20" height="20"/>`), {
      resources: {
        policy: "local",
        baseDirectory: "/approved",
        resolver: (request) => {
          requests.push(request.canonicalURL);
          if (request.canonicalURL === "/approved/icons/child.svg") return { bytes: child, mimeType: "image/svg+xml" };
          if (request.canonicalURL === "/approved/shared.png") return { bytes: PNG, mimeType: "image/png" };
          return undefined;
        },
      },
    });

    expect(result.diagnostics).toEqual([]);
    expect(requests).toEqual(["/approved/icons/child.svg", "/approved/shared.png"]);
    expect(result.swift).toContain("ImageDocument0");
    expect(result.swift).toContain("CGImageSourceCreateWithData");
  });

  test("rejects malformed data URLs, unsupported charsets, and invalid intrinsic dimensions", () => {
    const malformed = convertWithDiagnostics(source(`<image href="data:image/png;base64,***" width="1" height="1"/>`));
    expect(malformed.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "malformed-base64-data-url" })]),
    );

    const charset = convertWithDiagnostics(
      source(`<image href="data:image/svg+xml;charset=utf-16,%3Csvg%2F%3E" width="1" height="1"/>`),
    );
    expect(charset.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "unsupported-data-url-charset" })]),
    );

    const dimensions = convertWithDiagnostics(source(`<image href="asset" width="1" height="1"/>`), {
      resources: {
        supplied: { asset: { assetName: "BadAsset", mimeType: "image/png", intrinsicSize: { width: -1, height: 2 } } },
      },
    });
    expect(dimensions.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "invalid-resource-dimensions" })]),
    );
  });

  test("validates signatures, per-resource bytes, decoded pixels, totals, and counts", () => {
    const mismatch = convertWithDiagnostics(source(`<image href="bad.png" width="1" height="1"/>`), {
      resources: { supplied: { "bad.png": { bytes: PNG, mimeType: "image/jpeg" } } },
    });
    expect(mismatch.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "resource-mime-mismatch" })]),
    );

    const bytes = convertWithDiagnostics(source(`<image href="large.png" width="1" height="1"/>`), {
      resources: { supplied: { "large.png": { bytes: PNG } }, limits: { maxResourceBytes: 8 } },
    });
    expect(bytes.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "resource-byte-limit" })]),
    );

    const pixels = convertWithDiagnostics(source(`<image href="pixels.png" width="1" height="1"/>`), {
      resources: {
        supplied: { "pixels.png": { bytes: pngWithDimensions(100, 100) } },
        limits: { maxImagePixels: 99 },
      },
    });
    expect(pixels.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "resource-pixel-limit" })]),
    );

    const total = convertWithDiagnostics(
      source(`<image href="a.png" width="1" height="1"/><image href="b.png" width="1" height="1"/>`),
      {
        resources: {
          supplied: { "a.png": { bytes: PNG }, "b.png": { bytes: PNG } },
          limits: { maxTotalBytes: PNG.byteLength },
        },
      },
    );
    expect(total.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "resource-total-byte-limit" })]),
    );

    const count = convertWithDiagnostics(
      source(`<image href="a.png" width="1" height="1"/><image href="b.png" width="1" height="1"/>`),
      {
        resources: {
          supplied: { "a.png": { bytes: PNG }, "b.png": { bytes: PNG } },
          limits: { maxResources: 1 },
        },
      },
    );
    expect(count.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "resource-count-limit" })]),
    );
  });

  test("supports generated app asset references without embedding bytes", () => {
    const output = convert(source(`<image href="avatar" width="20" height="10" image-rendering="pixelated"/>`), {
      resources: {
        supplied: {
          avatar: { assetName: "AvatarAsset", mimeType: "image/png", intrinsicSize: { width: 2, height: 1 } },
        },
      },
    });

    expect(output).toContain('context.resolve(Image("AvatarAsset"))');
    expect(output).toContain("interpolationQuality = .none");
    expect(output).not.toContain("Data(base64Encoded:");
  });

  test("detects nested SVG image cycles and depth limits", () => {
    const recursive = svgBytes(
      `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><image href="self.svg" width="10" height="10"/></svg>`,
    );
    const result = convertWithDiagnostics(source(`<image href="self.svg" width="20" height="20"/>`), {
      resources: {
        supplied: { "self.svg": { bytes: recursive, mimeType: "image/svg+xml", canonicalURL: "self.svg" } },
      },
    });
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "recursive-svg-image" })]),
    );

    const child = svgBytes(
      `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><image href="leaf.svg" width="10" height="10"/></svg>`,
    );
    const depth = convertWithDiagnostics(source(`<image href="child.svg" width="20" height="20"/>`), {
      resources: {
        supplied: {
          "child.svg": { bytes: child, mimeType: "image/svg+xml" },
          "leaf.svg": {
            bytes: svgBytes(`<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>`),
            mimeType: "image/svg+xml",
          },
        },
        limits: { maxNestingDepth: 1 },
      },
    });
    expect(depth.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "resource-nesting-limit" })]),
    );
  });

  test("retains preserveAspectRatio, transforms, opacity, clipping, masking, and blend effects", () => {
    const output = convert(
      source(`
        <defs>
          <clipPath id="clip"><rect x="4" y="3" width="10" height="8"/></clipPath>
          <mask id="mask"><rect width="40" height="30" fill="white"/></mask>
        </defs>
        <image href="pixel.png" x="2" y="3" width="20" height="10"
          preserveAspectRatio="xMaxYMin slice" transform="translate(3 2)" opacity=".5"
          clip-path="url(#clip)" mask="url(#mask)" style="mix-blend-mode:multiply"/>
      `),
      { resources: { supplied: { "pixel.png": { bytes: PNG } } } },
    );

    expect(output).toContain("context.clip(to: Path(CGRect(x: 2, y: 3, width: 20, height: 10)).applying(");
    expect(output).toContain("tx: 3 * size.width / 40, ty: 2 * size.height / 30");
    expect(output).toContain(".opacity(0.5)");
    expect(output).toContain(".blendMode(.multiply)");
    expect(output).toContain(".mask {");
  });
});
