const faqs = [
  {
    question: "How do I convert an SVG to SwiftUI?",
    answer:
      "Paste your SVG source code into the editor above (or upload an .svg file) and the tool instantly converts it into a SwiftUI Shape. Copy the generated Swift code straight into your Xcode project — no manual path tracing required.",
  },
  {
    question: "How do I display an SVG in SwiftUI?",
    answer:
      "SwiftUI has no built-in SVG view, so the common approach is to turn the SVG into a native Shape backed by a Path. This converter does exactly that: it reads the SVG path data and outputs a reusable SwiftUI Shape you can size, fill, and animate like any other view.",
  },
  {
    question: "Does SwiftUI support SVG images natively?",
    answer:
      "No. SwiftUI's Image view supports PNG, JPEG, PDF, and SF Symbols, but not raw SVG files. Converting your SVG to a SwiftUI Shape gives you a resolution-independent, fully native alternative that scales perfectly on every device.",
  },
  {
    question: "What does the generated SwiftUI Shape look like?",
    answer:
      "The output is a Swift struct conforming to Shape with a single path(in:) implementation. Every SVG element is combined into one scalable Path, so the shape adapts to whatever frame you give it while preserving the original proportions.",
  },
  {
    question: "Can I convert an SVG path to SwiftUI?",
    answer:
      "Yes. Whether you have a full SVG document or just a single <path> element, paste the code in and the converter produces the equivalent SwiftUI Path commands (move, line, curve, arc) inside a ready-to-use Shape.",
  },
  {
    question: "Is the SVG to SwiftUI converter free?",
    answer:
      "Yes, the converter is completely free to use and runs entirely in your browser — your SVG code never leaves your device.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
};

export function HomeContent() {
  return (
    <section className="mx-auto w-full max-w-3xl px-6 py-16">
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD requires this, data is a static constant */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <h2 className="text-2xl font-bold tracking-tight">Convert SVG to SwiftUI in seconds</h2>
      <div className="mt-4 space-y-4 text-muted-foreground">
        <p>
          This free <strong>SVG to SwiftUI converter</strong> turns any SVG icon or vector graphic into a native SwiftUI{" "}
          <code>Shape</code>. SwiftUI has no built-in way to render an SVG image, so the cleanest way to display an{" "}
          <strong>SVG in SwiftUI</strong> is to convert its path data into a resolution-independent <code>Path</code>{" "}
          that scales perfectly on every iPhone, iPad, and Mac.
        </p>
        <p>
          Paste your SVG source code above and copy the generated Swift code directly into Xcode. Whether you need to{" "}
          convert a single <strong>SVG path to SwiftUI</strong> or a complete multi-element icon, the tool handles the
          conversion instantly and entirely in your browser — your code never leaves your device.
        </p>
        <p>
          New to this? Read the{" "}
          <a href="/convert-svg-to-swiftui" className="font-medium text-foreground underline underline-offset-4">
            step-by-step guide to converting SVG to SwiftUI
          </a>
          , or jump to a guide for{" "}
          <a href="/icons/font-awesome" className="font-medium text-foreground underline underline-offset-4">
            Font Awesome
          </a>
          ,{" "}
          <a href="/icons/material-design-icons" className="font-medium text-foreground underline underline-offset-4">
            Material Design
          </a>
          , or{" "}
          <a href="/icons/heroicons" className="font-medium text-foreground underline underline-offset-4">
            Heroicons
          </a>{" "}
          icons.
        </p>
      </div>

      <h2 className="mt-12 text-2xl font-bold tracking-tight">Frequently asked questions</h2>
      <dl className="mt-6 space-y-8">
        {faqs.map((faq) => (
          <div key={faq.question}>
            <dt className="text-lg font-semibold">{faq.question}</dt>
            <dd className="mt-2 text-muted-foreground">{faq.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
