import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "SVG to SwiftUI Converter";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0C0A09 0%, #1C1917 50%, #0C0A09 100%)",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Top accent bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: "linear-gradient(90deg, #EA580C, #F97316, #EA580C)",
        }}
      />

      {/* SVG → Swift visual */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 40,
          marginBottom: 40,
        }}
      >
        {/* SVG side */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: "#F97316",
              letterSpacing: -2,
            }}
          >
            SVG
          </div>
        </div>

        {/* Arrow */}
        <div
          style={{
            fontSize: 48,
            color: "#A8A29E",
          }}
        >
          →
        </div>

        {/* SwiftUI side */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: "#FAFAF9",
              letterSpacing: -2,
            }}
          >
            SwiftUI
          </div>
        </div>
      </div>

      {/* Title */}
      <div
        style={{
          fontSize: 28,
          color: "#A8A29E",
          letterSpacing: 1,
        }}
      >
        Convert SVG icons to SwiftUI Shape code instantly
      </div>

      {/* URL */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          fontSize: 18,
          color: "#78716C",
        }}
      >
        svg-to-swiftui.quassum.com
      </div>
    </div>,
    { ...size },
  );
}
