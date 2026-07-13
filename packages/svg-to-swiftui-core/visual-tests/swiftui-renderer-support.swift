import Foundation
import AppKit
import CoreText
import SwiftUI

// Generated shapes use these helpers to preserve SVG winding semantics. The
// production output stays self-contained while this host supplies the same
// operations against the real SwiftUI.Path type.
extension Path {
    mutating func addReversedPath(_ other: Path) {
        struct Element {
            let type: CGPathElementType
            let points: [CGPoint]
        }
        var elements: [Element] = []
        other.cgPath.applyWithBlock { pointer in
            let element = pointer.pointee
            let points: [CGPoint]
            switch element.type {
            case .moveToPoint, .addLineToPoint:
                points = [element.points[0]]
            case .addQuadCurveToPoint:
                points = [element.points[0], element.points[1]]
            case .addCurveToPoint:
                points = [element.points[0], element.points[1], element.points[2]]
            case .closeSubpath:
                points = []
            @unknown default:
                points = []
            }
            elements.append(Element(type: element.type, points: points))
        }

        var index = 0
        while index < elements.count {
            guard elements[index].type == .moveToPoint else {
                index += 1
                continue
            }
            var trail = [elements[index].points[0]]
            var commands: [Element] = []
            var closes = false
            var cursor = index + 1
            while cursor < elements.count && elements[cursor].type != .moveToPoint {
                let element = elements[cursor]
                switch element.type {
                case .addLineToPoint:
                    trail.append(element.points[0])
                    commands.append(element)
                case .addQuadCurveToPoint:
                    trail.append(element.points[1])
                    commands.append(element)
                case .addCurveToPoint:
                    trail.append(element.points[2])
                    commands.append(element)
                case .closeSubpath:
                    closes = true
                default:
                    break
                }
                cursor += 1
            }

            move(to: trail[trail.count - 1])
            if !commands.isEmpty {
                for reverseIndex in stride(from: commands.count - 1, through: 0, by: -1) {
                    let command = commands[reverseIndex]
                    let destination = trail[reverseIndex]
                    switch command.type {
                    case .addLineToPoint:
                        addLine(to: destination)
                    case .addQuadCurveToPoint:
                        addQuadCurve(to: destination, control: command.points[0])
                    case .addCurveToPoint:
                        addCurve(to: destination, control1: command.points[1], control2: command.points[0])
                    default:
                        break
                    }
                }
            }
            if closes { closeSubpath() }
            index = cursor
        }
    }

    private func normalizedStroke(_ style: StrokeStyle, clockwise: Bool) -> Path {
        let stroked = strokedPath(style)
        var subpathCount = 0
        var trail: [CGPoint] = []
        stroked.cgPath.applyWithBlock { pointer in
            let element = pointer.pointee
            if element.type == .moveToPoint { subpathCount += 1 }
            switch element.type {
            case .moveToPoint, .addLineToPoint:
                trail.append(element.points[0])
            case .addQuadCurveToPoint:
                trail.append(element.points[1])
            case .addCurveToPoint:
                trail.append(element.points[2])
            default:
                break
            }
        }

        guard subpathCount == 1, trail.count > 2 else { return stroked }
        var area: CGFloat = 0
        for index in trail.indices {
            let next = (index + 1) % trail.count
            area += trail[index].x * trail[next].y - trail[next].x * trail[index].y
        }
        let shouldReverse = clockwise ? area < 0 : area > 0
        guard shouldReverse else { return stroked }
        var result = Path()
        result.addReversedPath(stroked)
        return result
    }

    func cwStrokedPath(_ style: StrokeStyle) -> Path {
        normalizedStroke(style, clockwise: true)
    }

    func ccwStrokedPath(_ style: StrokeStyle) -> Path {
        normalizedStroke(style, clockwise: false)
    }
}

struct _VisualTask: Decodable {
    let index: Int
    let width: Double
    let height: Double
    let scale: Double
    let backgroundR: Double
    let backgroundG: Double
    let backgroundB: Double
    let backgroundA: Double
    let fonts: [String]
    let output: String
}

enum _VisualRenderError: Error, CustomStringConvertible {
    case invalidIndex(Int)
    case imageRendererFailed
    case contextFailed
    case pngEncodingFailed
    case wrongDimensions(expected: String, actual: String)

    var description: String {
        switch self {
        case .invalidIndex(let index): return "Invalid generated view index: \(index)"
        case .imageRendererFailed: return "SwiftUI ImageRenderer did not produce a CGImage"
        case .contextFailed: return "Could not create the deterministic sRGB bitmap context"
        case .pngEncodingFailed: return "Could not encode the SwiftUI render as PNG"
        case .wrongDimensions(let expected, let actual): return "Expected \(expected) pixels, rendered \(actual)"
        }
    }
}

@MainActor
func _renderVisualTask(_ task: _VisualTask, factories: [() -> AnyView]) throws {
    guard factories.indices.contains(task.index) else { throw _VisualRenderError.invalidIndex(task.index) }

    for font in task.fonts {
        var registrationError: Unmanaged<CFError>?
        let registered = CTFontManagerRegisterFontsForURL(
            URL(fileURLWithPath: font) as CFURL,
            .process,
            &registrationError
        )
        if !registered, let error = registrationError?.takeRetainedValue() {
            fputs("Font registration failed for \(font): \(error)\n", stderr)
        }
    }

    let background = Color(
        .sRGB,
        red: task.backgroundR,
        green: task.backgroundG,
        blue: task.backgroundB,
        opacity: task.backgroundA
    )
    let content = factories[task.index]()
        .frame(width: task.width, height: task.height, alignment: .topLeading)
        .background(background)
        .environment(\.colorScheme, .light)
    let renderer = ImageRenderer(content: content)
    renderer.proposedSize = ProposedViewSize(width: task.width, height: task.height)
    renderer.scale = task.scale
    renderer.isOpaque = task.backgroundA == 1
    guard let rendered = renderer.cgImage else { throw _VisualRenderError.imageRendererFailed }

    let pixelWidth = Int((task.width * task.scale).rounded())
    let pixelHeight = Int((task.height * task.scale).rounded())
    guard rendered.width == pixelWidth, rendered.height == pixelHeight else {
        throw _VisualRenderError.wrongDimensions(
            expected: "\(pixelWidth)x\(pixelHeight)",
            actual: "\(rendered.width)x\(rendered.height)"
        )
    }
    guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
          let context = CGContext(
            data: nil,
            width: pixelWidth,
            height: pixelHeight,
            bitsPerComponent: 8,
            bytesPerRow: pixelWidth * 4,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
          ) else { throw _VisualRenderError.contextFailed }
    context.clear(CGRect(x: 0, y: 0, width: pixelWidth, height: pixelHeight))
    context.draw(rendered, in: CGRect(x: 0, y: 0, width: pixelWidth, height: pixelHeight))
    guard let normalized = context.makeImage() else { throw _VisualRenderError.contextFailed }
    let representation = NSBitmapImageRep(cgImage: normalized)
    guard let png = representation.representation(using: .png, properties: [:]) else {
        throw _VisualRenderError.pngEncodingFailed
    }
    try png.write(to: URL(fileURLWithPath: task.output))
}
