import Foundation
import AppKit

// --- SwiftUI Path/Shape shim (backed by CoreGraphics) ---

struct StrokeStyle {
    var lineWidth: CGFloat
    var lineCap: CGLineCap
    var lineJoin: CGLineJoin
    var miterLimit: CGFloat

    init(lineWidth: CGFloat = 1, lineCap: CGLineCap = .butt, lineJoin: CGLineJoin = .miter, miterLimit: CGFloat = 10) {
        self.lineWidth = lineWidth
        self.lineCap = lineCap
        self.lineJoin = lineJoin
        self.miterLimit = miterLimit
    }
}

struct Path {
    var cgPath: CGPath { _path.copy()! }
    private var _path = CGMutablePath()

    mutating func move(to point: CGPoint) {
        _path.move(to: point)
    }
    mutating func addLine(to point: CGPoint) {
        _path.addLine(to: point)
    }
    mutating func addCurve(to end: CGPoint, control1: CGPoint, control2: CGPoint) {
        _path.addCurve(to: end, control1: control1, control2: control2)
    }
    mutating func addQuadCurve(to end: CGPoint, control: CGPoint) {
        _path.addQuadCurve(to: end, control: control)
    }
    mutating func addEllipse(in rect: CGRect) {
        _path.addEllipse(in: rect)
    }
    mutating func addRect(_ rect: CGRect) {
        _path.addRect(rect)
    }
    mutating func closeSubpath() {
        _path.closeSubpath()
    }
    mutating func addPath(_ other: Path) {
        _path.addPath(other.cgPath)
    }
    func strokedPath(_ style: StrokeStyle) -> Path {
        var result = Path()
        let stroked = cgPath.copy(
            strokingWithWidth: style.lineWidth,
            lineCap: style.lineCap,
            lineJoin: style.lineJoin,
            miterLimit: style.miterLimit
        )
        result._path.addPath(stroked)
        return result
    }
}

protocol Shape {
    func path(in rect: CGRect) -> Path
}

// --- Generated SwiftUI Shape ---

__SHAPE_CODE__

// --- Renderer ---

let renderWidth = __WIDTH__
let renderHeight = __HEIGHT__

let size = CGSize(width: renderWidth, height: renderHeight)
let rect = CGRect(origin: .zero, size: size)
let shape = __SHAPE_NAME__()
let shapePath = shape.path(in: rect)

let colorSpace = CGColorSpaceCreateDeviceRGB()
guard let ctx = CGContext(
    data: nil,
    width: renderWidth,
    height: renderHeight,
    bitsPerComponent: 8,
    bytesPerRow: renderWidth * 4,
    space: colorSpace,
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
) else {
    fputs("Error: Failed to create CGContext\n", stderr)
    exit(1)
}

// White background
ctx.setFillColor(red: 1, green: 1, blue: 1, alpha: 1)
ctx.fill(rect)

// Flip Y axis to match SVG/SwiftUI coordinate system (top-left origin)
ctx.translateBy(x: 0, y: CGFloat(renderHeight))
ctx.scaleBy(x: 1, y: -1)

// Fill path in black
ctx.addPath(shapePath.cgPath)
ctx.setFillColor(red: 0, green: 0, blue: 0, alpha: 1)
ctx.fillPath()

// Save as PNG
guard let image = ctx.makeImage() else {
    fputs("Error: Failed to create CGImage\n", stderr)
    exit(1)
}
let bitmapRep = NSBitmapImageRep(cgImage: image)
guard let pngData = bitmapRep.representation(using: .png, properties: [:]) else {
    fputs("Error: Failed to encode PNG\n", stderr)
    exit(1)
}
do {
    try pngData.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
} catch {
    fputs("Error: Failed to write PNG: \(error)\n", stderr)
    exit(1)
}
