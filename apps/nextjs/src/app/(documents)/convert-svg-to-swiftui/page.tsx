import type { Metadata } from "next";
import Link from "next/link";

const SITE_URL = "https://svg-to-swiftui.quassum.com";
const PAGE_PATH = "/convert-svg-to-swiftui";
const TITLE = "How to Convert SVG to SwiftUI";
const DESCRIPTION =
  "A step-by-step guide to converting an SVG into a native SwiftUI Shape. Learn why SwiftUI has no built-in SVG support and how to turn SVG path data into a scalable SwiftUI Path.";

export const metadata: Metadata = {
  title: { absolute: `${TITLE} — SVG to SwiftUI Converter` },
  description: DESCRIPTION,
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    type: "article",
    title: TITLE,
    description: DESCRIPTION,
    url: PAGE_PATH,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}${PAGE_PATH}`,
    author: { "@type": "Person", name: "Antoni Silvestrovic", url: "https://github.com/bring-shrubbery" },
    publisher: { "@type": "Organization", name: "Quassum", url: "https://quassum.com" },
  },
  {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: TITLE,
    description: DESCRIPTION,
    step: [
      {
        "@type": "HowToStep",
        name: "Copy your SVG source code",
        text: "Open your SVG file in any text editor and copy the full markup, including the <svg> tag and its <path> elements.",
      },
      {
        "@type": "HowToStep",
        name: "Paste the SVG into the converter",
        text: "Paste the SVG code into the SVG to SwiftUI Converter, or upload the .svg file directly.",
        url: `${SITE_URL}/`,
      },
      {
        "@type": "HowToStep",
        name: "Copy the generated SwiftUI Shape",
        text: "The tool outputs a Swift struct conforming to Shape. Copy it and paste it into your Xcode project.",
      },
      {
        "@type": "HowToStep",
        name: "Use the Shape in your view",
        text: "Instantiate the Shape, then fill, stroke, frame, or animate it like any other SwiftUI view.",
      },
    ],
  },
];

export default function ConvertSvgToSwiftUIGuide() {
  return (
    <>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD requires this, data is a static constant */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <h1>How to Convert SVG to SwiftUI</h1>

      <p>
        SwiftUI has no built-in way to render an SVG image — the <code>Image</code> view supports PNG, JPEG, PDF, and SF
        Symbols, but not raw SVG files. The cleanest way to display an <strong>SVG in SwiftUI</strong> is to convert its
        path data into a native <code>Shape</code> backed by a <code>Path</code>. This guide shows you how to{" "}
        <strong>convert an SVG to SwiftUI</strong> in a few seconds using the{" "}
        <Link href="/">free SVG to SwiftUI Converter</Link>.
      </p>

      <h2>Why SwiftUI doesn&apos;t support SVG natively</h2>
      <p>
        Apple&apos;s vector format of choice on iOS is the PDF (and SF Symbols for icons). There is no native SVG view,
        so importing an SVG into Xcode normally means rasterizing it or hand-tracing the path. Converting the SVG into a
        SwiftUI <code>Shape</code> avoids both problems: the result is resolution-independent, scales perfectly on every
        iPhone, iPad, and Mac, and can be filled, stroked, and animated like any other SwiftUI view.
      </p>

      <h2>Convert an SVG to a SwiftUI Shape step by step</h2>
      <ol>
        <li>
          <strong>Copy your SVG source code.</strong> Open the <code>.svg</code> file in any text editor and copy the
          full markup, including the <code>&lt;path&gt;</code> elements.
        </li>
        <li>
          <strong>Paste it into the converter.</strong> Drop the code into the{" "}
          <Link href="/">SVG to SwiftUI Converter</Link> (or upload the file). The conversion runs entirely in your
          browser — your code never leaves your device.
        </li>
        <li>
          <strong>Copy the generated SwiftUI Shape.</strong> The tool produces a Swift struct conforming to{" "}
          <code>Shape</code> with a single <code>path(in:)</code> implementation.
        </li>
        <li>
          <strong>Use the Shape in your view.</strong> Give it a frame and a fill, and you&apos;re done.
        </li>
      </ol>

      <h2>Example: an SVG path to a SwiftUI Shape</h2>
      <p>The converter turns an SVG path into a reusable, scalable Shape that looks like this:</p>
      <pre>
        <code>{`import SwiftUI

struct MyIconShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let width = rect.size.width
        let height = rect.size.height

        path.move(to: CGPoint(x: 0.5 * width, y: 0.1 * height))
        path.addLine(to: CGPoint(x: 0.9 * width, y: 0.9 * height))
        path.addLine(to: CGPoint(x: 0.1 * width, y: 0.9 * height))
        path.closeSubpath()

        return path
    }
}`}</code>
      </pre>
      <p>Then use it anywhere in your SwiftUI layout:</p>
      <pre>
        <code>{`MyIconShape()
    .fill(Color.accentColor)
    .frame(width: 100, height: 100)`}</code>
      </pre>
      <p>
        Because the path is expressed relative to the view&apos;s <code>rect</code>, the shape scales to whatever frame
        you give it without losing sharpness — the whole point of converting an <strong>SVG path to SwiftUI</strong>{" "}
        rather than shipping a bitmap.
      </p>

      <h2>Ready to convert your SVG?</h2>
      <p>
        Paste your icon into the <Link href="/">SVG to SwiftUI Converter</Link> and copy the Swift code straight into
        Xcode. It&apos;s free, runs locally in your browser, and handles everything from a single path to multi-element
        icons.
      </p>
    </>
  );
}
