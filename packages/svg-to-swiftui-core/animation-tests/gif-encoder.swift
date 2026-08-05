import AppKit
import ImageIO
import UniformTypeIdentifiers

struct GIFTask: Decodable {
    let output: String
    let framesPerSecond: Double
    let frames: [String]
}

enum GIFEncodingError: Error, CustomStringConvertible {
    case invalidTask
    case destination
    case image(String)
    case finalize

    var description: String {
        switch self {
        case .invalidTask: return "GIF task requires a positive frame rate and at least one frame"
        case .destination: return "Could not create the GIF destination"
        case .image(let path): return "Could not decode showcase frame: \(path)"
        case .finalize: return "Could not finalize the showcase GIF"
        }
    }
}

func encode(_ task: GIFTask) throws {
    guard task.framesPerSecond > 0, !task.frames.isEmpty else { throw GIFEncodingError.invalidTask }
    let output = URL(fileURLWithPath: task.output)
    try? FileManager.default.removeItem(at: output)
    guard let destination = CGImageDestinationCreateWithURL(
        output as CFURL,
        UTType.gif.identifier as CFString,
        task.frames.count,
        nil
    ) else { throw GIFEncodingError.destination }

    CGImageDestinationSetProperties(destination, [
        kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFLoopCount: 0]
    ] as CFDictionary)
    let delay = 1.0 / task.framesPerSecond
    let properties = [
        kCGImagePropertyGIFDictionary: [
            kCGImagePropertyGIFDelayTime: delay,
            kCGImagePropertyGIFUnclampedDelayTime: delay,
        ]
    ] as CFDictionary
    for path in task.frames {
        guard let image = NSImage(contentsOfFile: path),
              let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
            throw GIFEncodingError.image(path)
        }
        CGImageDestinationAddImage(destination, cgImage, properties)
    }
    guard CGImageDestinationFinalize(destination) else { throw GIFEncodingError.finalize }
}

guard CommandLine.arguments.count == 2 else {
    fputs("usage: animation-gif-encoder task.json\n", stderr)
    exit(2)
}

do {
    let data = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
    try encode(JSONDecoder().decode(GIFTask.self, from: data))
} catch {
    fputs("\(error)\n", stderr)
    exit(1)
}
