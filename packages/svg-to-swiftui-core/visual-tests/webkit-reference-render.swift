import AppKit
import WebKit

final class SVGSnapshotRenderer: NSObject, WKNavigationDelegate {
    private let output: URL
    private let webView: WKWebView

    init(input: URL, output: URL, width: Int, height: Int) {
        self.output = output
        self.webView = WKWebView(frame: NSRect(x: 0, y: 0, width: width, height: height))
        super.init()
        webView.navigationDelegate = self
        webView.setValue(false, forKey: "drawsBackground")
        webView.loadFileURL(input, allowingReadAccessTo: input.deletingLastPathComponent())
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        let configuration = WKSnapshotConfiguration()
        configuration.rect = webView.bounds
        webView.takeSnapshot(with: configuration) { image, error in
            guard error == nil, let image,
                  let data = image.tiffRepresentation,
                  let bitmap = NSBitmapImageRep(data: data),
                  let png = bitmap.representation(using: .png, properties: [:]) else {
                fputs("WebKit SVG snapshot failed: \(String(describing: error))\n", stderr)
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
guard arguments.count == 5, let width = Int(arguments[3]), let height = Int(arguments[4]) else {
    fputs("usage: webkit-reference-render input.svg output.png width height\n", stderr)
    exit(2)
}
let application = NSApplication.shared
application.setActivationPolicy(.prohibited)
let renderer = SVGSnapshotRenderer(
    input: URL(fileURLWithPath: arguments[1]),
    output: URL(fileURLWithPath: arguments[2]),
    width: width,
    height: height
)
withExtendedLifetime(renderer) { application.run() }
