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
    mutating func addRoundedRect(in rect: CGRect, cornerSize: CGSize) {
        _path.addRoundedRect(in: rect, cornerWidth: cornerSize.width, cornerHeight: cornerSize.height)
    }
    mutating func closeSubpath() {
        _path.closeSubpath()
    }
    mutating func addPath(_ other: Path) {
        _path.addPath(other.cgPath)
    }
    mutating func addReversedPath(_ other: Path) {
        struct Elem {
            var type: CGPathElementType
            var points: [CGPoint]
        }
        var elements: [Elem] = []
        other.cgPath.applyWithBlock { ptr in
            let e = ptr.pointee
            var pts: [CGPoint] = []
            switch e.type {
            case .moveToPoint: pts = [e.points[0]]
            case .addLineToPoint: pts = [e.points[0]]
            case .addQuadCurveToPoint: pts = [e.points[0], e.points[1]]
            case .addCurveToPoint: pts = [e.points[0], e.points[1], e.points[2]]
            case .closeSubpath: break
            @unknown default: break
            }
            elements.append(Elem(type: e.type, points: pts))
        }
        var idx = 0
        while idx < elements.count {
            guard elements[idx].type == .moveToPoint else { idx += 1; continue }
            let subStart = elements[idx].points[0]
            var trail: [CGPoint] = [subStart]
            var cmds: [Elem] = []
            var hasClose = false
            var k = idx + 1
            while k < elements.count && elements[k].type != .moveToPoint {
                let e = elements[k]
                switch e.type {
                case .addLineToPoint:
                    trail.append(e.points[0]); cmds.append(e)
                case .addQuadCurveToPoint:
                    trail.append(e.points[1]); cmds.append(e)
                case .addCurveToPoint:
                    trail.append(e.points[2]); cmds.append(e)
                case .closeSubpath:
                    hasClose = true
                default: break
                }
                k += 1
            }
            _path.move(to: trail[trail.count - 1])
            for ri in stride(from: cmds.count - 1, through: 0, by: -1) {
                let cmd = cmds[ri]
                let toPt = trail[ri]
                switch cmd.type {
                case .addLineToPoint:
                    _path.addLine(to: toPt)
                case .addQuadCurveToPoint:
                    _path.addQuadCurve(to: toPt, control: cmd.points[0])
                case .addCurveToPoint:
                    _path.addCurve(to: toPt, control1: cmd.points[1], control2: cmd.points[0])
                default: break
                }
            }
            if hasClose { _path.closeSubpath() }
            idx = k
        }
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
    func ccwStrokedPath(_ style: StrokeStyle) -> Path {
        var result = Path()
        let stroked = cgPath.copy(
            strokingWithWidth: style.lineWidth,
            lineCap: style.lineCap,
            lineJoin: style.lineJoin,
            miterLimit: style.miterLimit
        )
        var subpathCount = 0
        stroked.applyWithBlock { ptr in
            if ptr.pointee.type == .moveToPoint { subpathCount += 1 }
        }
        if subpathCount == 1 {
            var trail: [CGPoint] = []
            stroked.applyWithBlock { ptr in
                let e = ptr.pointee
                switch e.type {
                case .moveToPoint: trail.append(e.points[0])
                case .addLineToPoint: trail.append(e.points[0])
                case .addQuadCurveToPoint: trail.append(e.points[1])
                case .addCurveToPoint: trail.append(e.points[2])
                default: break
                }
            }
            var area: CGFloat = 0
            for i in 0..<trail.count {
                let j = (i + 1) % trail.count
                area += trail[i].x * trail[j].y - trail[j].x * trail[i].y
            }
            if area > 0 {
                // CW — reverse to CCW for hole-cutting
                var src = Path()
                src._path.addPath(stroked)
                result.addReversedPath(src)
            } else {
                // Already CCW
                result._path.addPath(stroked)
            }
        } else {
            // Multi-contour: reverse all subpaths for consistent hole behavior
            var src = Path()
            src._path.addPath(stroked)
            result.addReversedPath(src)
        }
        return result
    }
    func cwStrokedPath(_ style: StrokeStyle) -> Path {
        var result = Path()
        let stroked = cgPath.copy(
            strokingWithWidth: style.lineWidth,
            lineCap: style.lineCap,
            lineJoin: style.lineJoin,
            miterLimit: style.miterLimit
        )
        // Count subpaths in the stroked outline
        var subpathCount = 0
        stroked.applyWithBlock { ptr in
            if ptr.pointee.type == .moveToPoint { subpathCount += 1 }
        }
        // Single-contour outlines (from open paths) are safe to normalize
        // to CW, preventing holes when overlapping CW filled shapes.
        // Multi-contour outlines (from closed paths) have intentional
        // inner CCW contours that must be preserved.
        if subpathCount == 1 {
            // Check winding via signed area (shoelace on endpoints)
            var trail: [CGPoint] = []
            stroked.applyWithBlock { ptr in
                let e = ptr.pointee
                switch e.type {
                case .moveToPoint: trail.append(e.points[0])
                case .addLineToPoint: trail.append(e.points[0])
                case .addQuadCurveToPoint: trail.append(e.points[1])
                case .addCurveToPoint: trail.append(e.points[2])
                default: break
                }
            }
            var area: CGFloat = 0
            for i in 0..<trail.count {
                let j = (i + 1) % trail.count
                area += trail[i].x * trail[j].y - trail[j].x * trail[i].y
            }
            if area < 0 {
                // CCW — reverse to CW
                var src = Path()
                src._path.addPath(stroked)
                result.addReversedPath(src)
            } else {
                result._path.addPath(stroked)
            }
        } else {
            result._path.addPath(stroked)
        }
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

// Fill path with dominant SVG fill color
ctx.addPath(shapePath.cgPath)
ctx.setFillColor(red: __FILL_R__, green: __FILL_G__, blue: __FILL_B__, alpha: 1)
ctx.fillPath(using: __FILL_RULE__)

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
