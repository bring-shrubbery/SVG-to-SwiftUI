import AppKit
import AVFoundation
import CoreVideo

struct VideoTask: Decodable {
    let output: String
    let width: Int
    let height: Int
    let framesPerSecond: Int32
    let frames: [String]
}
enum VideoEncodingError: Error, CustomStringConvertible {
    case invalidTask
    case image(String)
    case pixelBuffer
    case append(Int)
    case writer(String)

    var description: String {
        switch self {
        case .invalidTask: return "Video task has invalid dimensions, frame rate, or no frames"
        case .image(let path): return "Could not decode review frame: \(path)"
        case .pixelBuffer: return "Could not allocate the review-video pixel buffer"
        case .append(let index): return "Could not append review-video frame \(index)"
        case .writer(let message): return "Review-video writer failed: \(message)"
        }
    }
}

func pixelBuffer(path: String, width: Int, height: Int, pool: CVPixelBufferPool?) throws -> CVPixelBuffer {
    guard let image = NSImage(contentsOfFile: path),
          let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        throw VideoEncodingError.image(path)
    }
    var optionalBuffer: CVPixelBuffer?
    let status = pool.map { CVPixelBufferPoolCreatePixelBuffer(nil, $0, &optionalBuffer) }
        ?? CVPixelBufferCreate(
            nil,
            width,
            height,
            kCVPixelFormatType_32BGRA,
            [kCVPixelBufferCGImageCompatibilityKey: true, kCVPixelBufferCGBitmapContextCompatibilityKey: true] as CFDictionary,
            &optionalBuffer
        )
    guard status == kCVReturnSuccess, let buffer = optionalBuffer else { throw VideoEncodingError.pixelBuffer }
    CVPixelBufferLockBaseAddress(buffer, [])
    defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
    guard let context = CGContext(
        data: CVPixelBufferGetBaseAddress(buffer),
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
    ) else { throw VideoEncodingError.pixelBuffer }
    context.setFillColor(NSColor.white.cgColor)
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    context.interpolationQuality = .high
    context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))
    return buffer
}

func encode(_ task: VideoTask) throws {
    guard task.width > 0, task.height > 0, task.framesPerSecond > 0, !task.frames.isEmpty else {
        throw VideoEncodingError.invalidTask
    }
    let output = URL(fileURLWithPath: task.output)
    try? FileManager.default.removeItem(at: output)
    let writer = try AVAssetWriter(outputURL: output, fileType: .mp4)
    let input = AVAssetWriterInput(
        mediaType: .video,
        outputSettings: [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: task.width,
            AVVideoHeightKey: task.height,
        ]
    )
    input.expectsMediaDataInRealTime = false
    let adaptor = AVAssetWriterInputPixelBufferAdaptor(
        assetWriterInput: input,
        sourcePixelBufferAttributes: [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
            kCVPixelBufferWidthKey as String: task.width,
            kCVPixelBufferHeightKey as String: task.height,
        ]
    )
    guard writer.canAdd(input) else { throw VideoEncodingError.writer("cannot add H.264 input") }
    writer.add(input)
    guard writer.startWriting() else {
        throw VideoEncodingError.writer(writer.error?.localizedDescription ?? "could not start")
    }
    writer.startSession(atSourceTime: .zero)
    for (index, frame) in task.frames.enumerated() {
        while !input.isReadyForMoreMediaData {
            if writer.status == .failed {
                throw VideoEncodingError.writer(writer.error?.localizedDescription ?? "failed while waiting")
            }
            Thread.sleep(forTimeInterval: 0.001)
        }
        let buffer = try pixelBuffer(path: frame, width: task.width, height: task.height, pool: adaptor.pixelBufferPool)
        let time = CMTime(value: Int64(index), timescale: task.framesPerSecond)
        guard adaptor.append(buffer, withPresentationTime: time) else { throw VideoEncodingError.append(index) }
    }
    input.markAsFinished()
    let semaphore = DispatchSemaphore(value: 0)
    writer.finishWriting { semaphore.signal() }
    semaphore.wait()
    guard writer.status == .completed else {
        throw VideoEncodingError.writer(writer.error?.localizedDescription ?? "did not complete")
    }
}

let arguments = CommandLine.arguments
guard arguments.count == 2 else {
    fputs("usage: animation-video-encoder task.json\n", stderr)
    exit(2)
}

do {
    let data = try Data(contentsOf: URL(fileURLWithPath: arguments[1]))
    try encode(JSONDecoder().decode(VideoTask.self, from: data))
} catch {
    fputs("\(error)\n", stderr)
    exit(1)
}
