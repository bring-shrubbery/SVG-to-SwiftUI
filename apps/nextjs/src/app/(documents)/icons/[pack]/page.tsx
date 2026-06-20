import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { generateIconExample } from "@/lib/icon-pack-example";
import { getIconPackArticle, ICON_PACK_ARTICLES } from "@/lib/icon-pack-articles";

const SITE_URL = "https://svg-to-swiftui.quassum.com";

export function generateStaticParams() {
  return ICON_PACK_ARTICLES.map((article) => ({ pack: article.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ pack: string }> }): Promise<Metadata> {
  const { pack } = await params;
  const article = getIconPackArticle(pack);
  if (!article) return {};

  const title = `How to Use ${article.name} Icons in SwiftUI & iOS`;
  const description = `Add ${article.name} icons to your SwiftUI and iOS apps. Convert any ${article.name} SVG icon into a native SwiftUI Shape for iPhone, iPad, and Mac — free and in your browser.`;
  const path = `/icons/${article.slug}`;

  return {
    title: { absolute: `${title} — SVG to SwiftUI Converter` },
    description,
    alternates: { canonical: path },
    openGraph: { type: "article", title, description, url: path },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function IconPackArticlePage({ params }: { params: Promise<{ pack: string }> }) {
  const { pack } = await params;
  const article = getIconPackArticle(pack);
  if (!article) notFound();

  const example = await generateIconExample(article.manifestId, article.sampleIconNames);
  const title = `How to Use ${article.name} Icons in SwiftUI & iOS`;
  const examplesHref = `/?examples=${article.manifestId}`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: title,
      description: `Convert ${article.name} SVG icons into native SwiftUI Shapes for iOS apps.`,
      url: `${SITE_URL}/icons/${article.slug}`,
      author: { "@type": "Person", name: "Antoni Silvestrovic", url: "https://github.com/bring-shrubbery" },
      publisher: { "@type": "Organization", name: "Quassum", url: "https://quassum.com" },
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: title,
      description: `Add a ${article.name} icon to a SwiftUI iOS app by converting its SVG into a SwiftUI Shape.`,
      step: [
        {
          "@type": "HowToStep",
          name: `Open the ${article.name} examples`,
          text: `Open the SVG to SwiftUI Converter with the ${article.name} library pre-selected in the Examples browser.`,
          url: `${SITE_URL}${examplesHref}`,
        },
        {
          "@type": "HowToStep",
          name: "Pick your icon",
          text: `Search the ${article.name} grid and click the icon you want — its SVG loads into the editor.`,
        },
        {
          "@type": "HowToStep",
          name: "Convert to SwiftUI",
          text: "Press Convert & Copy to turn the SVG into a native SwiftUI Shape.",
        },
        {
          "@type": "HowToStep",
          name: "Paste into Xcode",
          text: "Paste the generated Swift struct into your iOS project and use it like any other view.",
        },
      ],
    },
  ];

  return (
    <>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD requires this, data is a static constant */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <h1>{title}</h1>

      <p>
        {article.blurb} This guide shows you how to use <strong>{article.name}</strong> icons in your SwiftUI and iOS
        apps. SwiftUI can&apos;t render SVG or icon-font files directly, so the cleanest way to get a{" "}
        {article.name} icon onto an iPhone, iPad, or Mac screen is to convert it into a native SwiftUI{" "}
        <code>Shape</code>.
      </p>

      <p>
        <Link href={examplesHref}>
          Open the converter with {article.name} icons →
        </Link>{" "}
        ({article.count.toLocaleString()} icons, {article.license}, from{" "}
        <a href={article.vendorUrl} target="_blank" rel="noopener noreferrer">
          {article.vendorUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
        </a>
        ).
      </p>

      <h2>Why you can&apos;t drop an SVG icon straight into SwiftUI</h2>
      <p>
        SwiftUI&apos;s <code>Image</code> view supports PNG, JPEG, PDF, and SF Symbols — but not raw SVG files or icon
        fonts like {article.name}. Converting the icon to a SwiftUI <code>Shape</code> gives you a
        resolution-independent vector that scales perfectly at any size and can be filled, stroked, and animated like
        any other SwiftUI view.
      </p>

      <h2>Add a {article.name} icon to SwiftUI in 4 steps</h2>
      <ol>
        <li>
          <strong>Open the {article.name} examples.</strong>{" "}
          <Link href={examplesHref}>Launch the converter with {article.name} pre-selected</Link> in the Examples
          browser.
        </li>
        <li>
          <strong>Pick your icon.</strong> Search the grid and click the icon you want — its SVG loads into the editor.
        </li>
        <li>
          <strong>Convert to SwiftUI.</strong> Press <em>Convert &amp; Copy</em> to generate a native SwiftUI{" "}
          <code>Shape</code>.
        </li>
        <li>
          <strong>Paste into Xcode.</strong> Drop the Swift struct into your iOS project and use it like any other view.
        </li>
      </ol>

      <h2>Example: the {article.name} &ldquo;{example.iconName}&rdquo; icon in SwiftUI</h2>
      <p>
        Starting from the original {article.name} <code>{example.iconName}</code> SVG source:
      </p>
      <pre>
        <code>{example.svg}</code>
      </pre>
      <p>
        the converter produces this native SwiftUI <code>Shape</code>:
      </p>
      <pre>
        <code>{example.swift}</code>
      </pre>
      <p>Then use it anywhere in your SwiftUI layout:</p>
      <pre>
        <code>{`${toUsageName(example.swift)}()
    .fill(Color.accentColor)
    .frame(width: 100, height: 100)`}</code>
      </pre>

      <h2>Frequently asked questions</h2>
      <h3>Is {article.name} free to use in iOS apps?</h3>
      <p>
        {article.name} is distributed under the {article.license}. Always check the official{" "}
        <a href={article.vendorUrl} target="_blank" rel="noopener noreferrer">
          {article.name} license
        </a>{" "}
        for the exact terms before shipping.
      </p>
      <h3>Do I need a third-party package to use {article.name} in SwiftUI?</h3>
      <p>
        No. Converting the icon to a SwiftUI <code>Shape</code> produces plain SwiftUI code with no dependencies — paste
        it straight into your project.
      </p>

      <h2>Convert your {article.name} icon now</h2>
      <p>
        <Link href={examplesHref}>Open the {article.name} icon browser</Link>, pick an icon, and copy the SwiftUI code.
        For more detail on how the conversion works, read the{" "}
        <Link href="/convert-svg-to-swiftui">SVG to SwiftUI guide</Link>.
      </p>
    </>
  );
}

/** Extracts the generated struct name (e.g. "StarShape") for the usage snippet. */
function toUsageName(swift: string): string {
  const match = swift.match(/struct\s+(\w+)\s*:/);
  return match?.[1] ?? "MyIconShape";
}
