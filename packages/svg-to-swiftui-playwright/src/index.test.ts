import { PNG } from "pngjs";
import type { ForeignObjectSnapshotRequest } from "svg-to-swiftui-core";
import { __testing, createPlaywrightForeignObjectRenderer } from "./index";

function request(overrides: Partial<ForeignObjectSnapshotRequest> = {}): ForeignObjectSnapshotRequest {
  return {
    document: "<!doctype html><html><body>safe</body></html>",
    viewport: { x: 0, y: 0, width: 2, height: 1 },
    pixelWidth: 4,
    pixelHeight: 2,
    scale: 2,
    source: { element: "foreignObject" },
    baseURL: "https://assets.example.test/root.svg",
    resolveResource: async () => undefined,
    ...overrides,
  };
}

function screenshot(width = 4, height = 2): Buffer {
  const png = new PNG({ width, height });
  png.data.fill(255);
  return PNG.sync.write(png);
}

function browserMock(onRoute?: (handler: (route: any) => Promise<void>) => Promise<void>) {
  const page = {
    on: jest.fn(),
    route: jest.fn(async (_pattern, handler) => onRoute?.(handler)),
    setContent: jest.fn(async () => undefined),
    screenshot: jest.fn(async () => screenshot()),
  };
  const context = { newPage: jest.fn(async () => page), close: jest.fn(async () => undefined) };
  const browser = { newContext: jest.fn(async () => context), close: jest.fn(async () => undefined) };
  return { browser, context, page };
}

describe("Playwright foreignObject adapter", () => {
  test("uses a deterministic JavaScript-free transparent Chromium context", async () => {
    const mock = browserMock();
    const renderer = createPlaywrightForeignObjectRenderer({ browser: mock.browser as any });
    const result = await renderer(request());

    expect(mock.browser.newContext).toHaveBeenCalledWith(
      expect.objectContaining({
        viewport: { width: 2, height: 1 },
        deviceScaleFactor: 2,
        javaScriptEnabled: false,
        serviceWorkers: "block",
        locale: "en-US",
        timezoneId: "UTC",
        reducedMotion: "reduce",
      }),
    );
    expect(mock.page.screenshot).toHaveBeenCalledWith(
      expect.objectContaining({ omitBackground: true, animations: "disabled", caret: "hide", scale: "device" }),
    );
    expect(result).toMatchObject({ width: 4, height: 2, scale: 2 });
    expect(result.rgba).toHaveLength(32);
    expect(mock.context.close).toHaveBeenCalledTimes(1);
    expect(mock.browser.close).not.toHaveBeenCalled();
  });

  test("fulfills only resolver-approved resources and aborts network misses", async () => {
    const fulfilled = jest.fn(async () => undefined);
    const aborted = jest.fn(async () => undefined);
    const mock = browserMock(async (handler) => {
      await handler({
        request: () => ({ url: () => "https://assets.example.test/font.woff2" }),
        fulfill: fulfilled,
        abort: aborted,
        continue: jest.fn(),
      });
      await handler({
        request: () => ({ url: () => "https://tracker.example.test/pixel" }),
        fulfill: fulfilled,
        abort: aborted,
        continue: jest.fn(),
      });
    });
    const renderer = createPlaywrightForeignObjectRenderer({ browser: mock.browser as any });
    await renderer(
      request({
        resolveResource: async (url) =>
          url.includes("assets.example.test")
            ? {
                bytes: Uint8Array.from([1, 2, 3]),
                mimeType: "font/woff2",
                canonicalURL: url,
              }
            : undefined,
      }),
    );

    expect(fulfilled).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: "font/woff2",
        headers: expect.objectContaining({ "x-content-type-options": "nosniff" }),
      }),
    );
    expect(aborted).toHaveBeenCalledWith("blockedbyclient");
  });

  test("pins secure launch flags and closes adapter-owned browsers", async () => {
    const mock = browserMock();
    const browserType = { launch: jest.fn(async () => mock.browser) };
    const renderer = createPlaywrightForeignObjectRenderer({ browserType: browserType as any });
    await renderer(request());

    expect(browserType.launch).toHaveBeenCalledWith(
      expect.objectContaining({
        headless: true,
        args: expect.arrayContaining(["--disable-background-networking", "--no-first-run"]),
      }),
    );
    expect(mock.browser.close).toHaveBeenCalledTimes(1);
    expect(__testing.SECURITY_ARGS).toContain("--disable-sync");
  });

  test("rejects Chromium output with unexpected dimensions", async () => {
    const mock = browserMock();
    mock.page.screenshot.mockResolvedValueOnce(screenshot(3, 2));
    const renderer = createPlaywrightForeignObjectRenderer({ browser: mock.browser as any });
    await expect(renderer(request())).rejects.toThrow("Chromium produced 3×2; expected 4×2");
    expect(mock.context.close).toHaveBeenCalledTimes(1);
  });
});
