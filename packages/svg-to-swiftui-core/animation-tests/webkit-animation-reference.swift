import AppKit
import WebKit

struct AnimationFrameTask: Decodable {
    let timeMicroseconds: Int64
    let output: String
}

struct AnimationRenderTask: Decodable {
    let input: String
    let width: Int
    let height: Int
    let pixelWidth: Int
    let pixelHeight: Int
    let frames: [AnimationFrameTask]
}

final class AnimationSnapshotRenderer: NSObject, WKNavigationDelegate {
    private let task: AnimationRenderTask
    private let webView: WKWebView
    private var frameIndex = 0

    init(task: AnimationRenderTask) {
        self.task = task
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        self.webView = WKWebView(
            frame: NSRect(x: 0, y: 0, width: task.width, height: task.height),
            configuration: configuration
        )
        super.init()
        webView.navigationDelegate = self
        webView.setValue(false, forKey: "drawsBackground")
        let input = URL(fileURLWithPath: task.input)
        webView.loadFileURL(input, allowingReadAccessTo: input.deletingLastPathComponent())
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        fail("WebKit animation fixture failed to load: \(error)")
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        fail("WebKit animation fixture failed provisional navigation: \(error)")
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        renderNextFrame()
    }

    private func renderNextFrame() {
        guard frameIndex < task.frames.count else { exit(0) }
        let frame = task.frames[frameIndex]
        let seconds = Double(frame.timeMicroseconds) / 1_000_000
        let milliseconds = Double(frame.timeMicroseconds) / 1_000
        let script = """
        (() => {
          const root = document.documentElement;
          if (typeof root.pauseAnimations === 'function') root.pauseAnimations();
          if (typeof root.setCurrentTime === 'function') root.setCurrentTime(\(seconds));
          for (const animation of document.getAnimations()) {
            animation.pause();
            try { animation.currentTime = \(milliseconds); } catch (_) {}
          }
          document.documentElement.getBoundingClientRect();
          getComputedStyle(document.documentElement).opacity;
          return true;
        })()
        """
        webView.evaluateJavaScript(script) { _, error in
            if let error {
                self.fail("Could not seek WebKit animation to \(frame.timeMicroseconds)us: \(error)")
                return
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.02) {
                self.snapshot(frame)
            }
        }
    }

    private func snapshot(_ frame: AnimationFrameTask) {
        let configuration = WKSnapshotConfiguration()
        configuration.rect = webView.bounds
        configuration.snapshotWidth = NSNumber(value: task.pixelWidth)
        webView.takeSnapshot(with: configuration) { image, error in
            guard error == nil, let image,
                  let bitmap = NSBitmapImageRep(
                    bitmapDataPlanes: nil,
                    pixelsWide: self.task.pixelWidth,
                    pixelsHigh: self.task.pixelHeight,
                    bitsPerSample: 8,
                    samplesPerPixel: 4,
                    hasAlpha: true,
                    isPlanar: false,
                    colorSpaceName: .deviceRGB,
                    bytesPerRow: 0,
                    bitsPerPixel: 0
                  ),
                  let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
                self.fail("WebKit animation snapshot failed at \(frame.timeMicroseconds)us: \(String(describing: error))")
                return
            }
            NSGraphicsContext.saveGraphicsState()
            NSGraphicsContext.current = context
            context.imageInterpolation = .high
            image.draw(
                in: NSRect(x: 0, y: 0, width: self.task.pixelWidth, height: self.task.pixelHeight),
                from: NSRect(origin: .zero, size: image.size),
                operation: .copy,
                fraction: 1
            )
            context.flushGraphics()
            NSGraphicsContext.restoreGraphicsState()
            guard let png = bitmap.representation(using: .png, properties: [:]) else {
                self.fail("Could not encode WebKit animation frame at \(frame.timeMicroseconds)us")
                return
            }
            do {
                try png.write(to: URL(fileURLWithPath: frame.output))
                self.frameIndex += 1
                self.renderNextFrame()
            } catch {
                self.fail("Could not write WebKit animation frame at \(frame.timeMicroseconds)us: \(error)")
            }
        }
    }

    private func fail(_ message: String) {
        fputs("\(message)\n", stderr)
        exit(1)
    }
}

let arguments = CommandLine.arguments
guard arguments.count == 2 else {
    fputs("usage: webkit-animation-reference task.json\n", stderr)
    exit(2)
}

do {
    let data = try Data(contentsOf: URL(fileURLWithPath: arguments[1]))
    let task = try JSONDecoder().decode(AnimationRenderTask.self, from: data)
    guard task.width > 0, task.height > 0, task.pixelWidth > 0, task.pixelHeight > 0, !task.frames.isEmpty else {
        fputs("Animation reference task has invalid dimensions or no frames\n", stderr)
        exit(2)
    }
    let application = NSApplication.shared
    application.setActivationPolicy(.prohibited)
    let renderer = AnimationSnapshotRenderer(task: task)
    withExtendedLifetime(renderer) { application.run() }
} catch {
    fputs("Could not decode animation reference task: \(error)\n", stderr)
    exit(2)
}
