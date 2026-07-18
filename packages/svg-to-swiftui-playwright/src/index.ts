import { Buffer } from "node:buffer";
import { type Browser, type BrowserContextOptions, type BrowserType, type ChromiumBrowser, chromium } from "playwright";
import { PNG } from "pngjs";
import type { ForeignObjectRenderer, ForeignObjectSnapshotRequest } from "svg-to-swiftui-core";

export interface PlaywrightForeignObjectRendererOptions {
  /** Reuse a caller-owned Chromium browser. The adapter never closes it. */
  browser?: Browser;
  /** Chromium executable override for hermetic consumer environments. */
  executablePath?: string;
  /** Launch timeout in milliseconds. Defaults to 30 seconds. */
  timeout?: number;
  /** Additional launch arguments appended after the adapter's deterministic security flags. */
  launchArgs?: string[];
  /** Test/embedding hook. Defaults to Playwright's pinned Chromium browser type. */
  browserType?: BrowserType<ChromiumBrowser>;
}

const SECURITY_ARGS = [
  "--disable-background-networking",
  "--disable-breakpad",
  "--disable-component-update",
  "--disable-default-apps",
  "--disable-domain-reliability",
  "--disable-features=AutofillServerCommunication,OptimizationHints,MediaRouter",
  "--disable-sync",
  "--metrics-recording-only",
  "--no-first-run",
  "--safebrowsing-disable-auto-update",
];

function contextOptions(request: ForeignObjectSnapshotRequest): BrowserContextOptions {
  const logicalWidth = Math.max(1, Math.round(request.pixelWidth / request.scale));
  const logicalHeight = Math.max(1, Math.round(request.pixelHeight / request.scale));
  return {
    viewport: { width: logicalWidth, height: logicalHeight },
    deviceScaleFactor: request.scale,
    javaScriptEnabled: false,
    serviceWorkers: "block",
    acceptDownloads: false,
    locale: "en-US",
    timezoneId: "UTC",
    colorScheme: "light",
    reducedMotion: "reduce",
    forcedColors: "none",
  };
}

async function renderWithBrowser(browser: Browser, request: ForeignObjectSnapshotRequest) {
  const context = await browser.newContext(contextOptions(request));
  try {
    const page = await context.newPage();
    page.on("dialog", (dialog) => void dialog.dismiss());
    await page.route("**/*", async (route) => {
      const url = route.request().url();
      if (/^(?:data|blob|about):/i.test(url)) {
        await route.continue();
        return;
      }
      const resource = await request.resolveResource(url);
      if (!resource) {
        await route.abort("blockedbyclient");
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: resource.mimeType,
        body: Buffer.from(resource.bytes),
        headers: {
          "cache-control": "public, max-age=31536000, immutable",
          "content-security-policy": "default-src 'none'",
          "x-content-type-options": "nosniff",
        },
      });
    });
    const base = request.baseURL.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    const document = request.document.replace(/<head>/i, `<head><base href="${base}">`);
    await page.setContent(document, { waitUntil: "load" });
    const screenshot = await page.screenshot({
      type: "png",
      omitBackground: true,
      animations: "disabled",
      caret: "hide",
      scale: "device",
      clip: {
        x: 0,
        y: 0,
        width: request.viewport.width,
        height: request.viewport.height,
      },
    });
    const png = PNG.sync.read(screenshot);
    if (png.width !== request.pixelWidth || png.height !== request.pixelHeight)
      throw new Error(
        `Chromium produced ${png.width}×${png.height}; expected ${request.pixelWidth}×${request.pixelHeight}. Use integer logical dimensions for non-integer scales.`,
      );
    return {
      rgba: Uint8Array.from(png.data),
      width: png.width,
      height: png.height,
      scale: request.scale,
    };
  } finally {
    await context.close();
  }
}

/** Create the official secure, static Chromium foreignObject renderer. */
export function createPlaywrightForeignObjectRenderer(
  options: PlaywrightForeignObjectRendererOptions = {},
): ForeignObjectRenderer {
  return async (request) => {
    if (options.browser) return renderWithBrowser(options.browser, request);
    const browser = await (options.browserType ?? chromium).launch({
      headless: true,
      ...(options.executablePath ? { executablePath: options.executablePath } : {}),
      timeout: options.timeout ?? 30_000,
      args: [...SECURITY_ARGS, ...(options.launchArgs ?? [])],
    });
    try {
      return await renderWithBrowser(browser, request);
    } finally {
      await browser.close();
    }
  };
}

export const __testing = { SECURITY_ARGS, contextOptions };
