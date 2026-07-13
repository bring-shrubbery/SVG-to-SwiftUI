import AppKit
import WebKit

final class SVGSnapshotRenderer: NSObject, WKNavigationDelegate {
    private let output: URL
    private let pixelWidth: Int
    private let pixelHeight: Int
    private let webView: WKWebView

    init(input: URL, output: URL, width: Int, height: Int, pixelWidth: Int, pixelHeight: Int) {
        self.output = output
        self.pixelWidth = pixelWidth
        self.pixelHeight = pixelHeight
        self.webView = WKWebView(frame: NSRect(x: 0, y: 0, width: width, height: height))
        super.init()
        webView.navigationDelegate = self
        webView.setValue(false, forKey: "drawsBackground")
        webView.loadFileURL(input, allowingReadAccessTo: input.deletingLastPathComponent())
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        let configuration = WKSnapshotConfiguration()
        configuration.rect = webView.bounds
        configuration.snapshotWidth = NSNumber(value: pixelWidth)
        webView.takeSnapshot(with: configuration) { image, error in
            guard error == nil, let image,
                  let bitmap = NSBitmapImageRep(
                    bitmapDataPlanes: nil,
                    pixelsWide: self.pixelWidth,
                    pixelsHigh: self.pixelHeight,
                    bitsPerSample: 8,
                    samplesPerPixel: 4,
                    hasAlpha: true,
                    isPlanar: false,
                    colorSpaceName: .deviceRGB,
                    bytesPerRow: 0,
                    bitsPerPixel: 0
                  ),
                  let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
                fputs("WebKit SVG snapshot failed: \(String(describing: error))\n", stderr)
                exit(1)
            }
            NSGraphicsContext.saveGraphicsState()
            NSGraphicsContext.current = context
            context.imageInterpolation = .high
            image.draw(
                in: NSRect(x: 0, y: 0, width: self.pixelWidth, height: self.pixelHeight),
                from: NSRect(origin: .zero, size: image.size),
                operation: .copy,
                fraction: 1
            )
            context.flushGraphics()
            NSGraphicsContext.restoreGraphicsState()
            guard let png = bitmap.representation(using: .png, properties: [:]) else {
                fputs("Could not encode WebKit SVG snapshot\n", stderr)
                exit(1)
            }
            do {
                try png.write(to: self.output)
                exit(0)
            } catch {
                fputs("Could not write WebKit SVG snapshot: \(error)\n", stderr)
                exit(1)
            }
        }
    }
}

let arguments = CommandLine.arguments
guard arguments.count == 7,
      let width = Int(arguments[3]),
      let height = Int(arguments[4]),
      let pixelWidth = Int(arguments[5]),
      let pixelHeight = Int(arguments[6]) else {
    fputs("usage: webkit-reference-render input.svg output.png width height pixel-width pixel-height\n", stderr)
    exit(2)
}
let application = NSApplication.shared
application.setActivationPolicy(.prohibited)
let renderer = SVGSnapshotRenderer(
    input: URL(fileURLWithPath: arguments[1]),
    output: URL(fileURLWithPath: arguments[2]),
    width: width,
    height: height,
    pixelWidth: pixelWidth,
    pixelHeight: pixelHeight
)
withExtendedLifetime(renderer) { application.run() }
