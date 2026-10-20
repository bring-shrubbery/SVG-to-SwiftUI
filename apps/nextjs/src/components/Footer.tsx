import { QUASSUM_URL, SIBLING_PRODUCTS, withFooterUtm } from "@/lib/quassum";

const linkClass = "font-medium text-foreground underline underline-offset-4";

export function Footer() {
  return (
    <footer className="mx-auto w-full max-w-3xl px-6 pb-16 pt-8 text-sm text-muted-foreground">
      <p>
        SVG to SwiftUI is built by{" "}
        <a href={withFooterUtm(QUASSUM_URL)} target="_blank" rel="noopener noreferrer" className={linkClass}>
          Quassum
        </a>
        , a product studio in Vilnius that has shipped 25+ products.
      </p>
      <p className="mt-4">More from Quassum:</p>
      <ul className="mt-2 space-y-1">
        {SIBLING_PRODUCTS.map((product) => (
          <li key={product.name}>
            <a href={withFooterUtm(product.href)} target="_blank" rel="noopener noreferrer" className={linkClass}>
              {product.name}
            </a>{" "}
            {product.tagline}
          </li>
        ))}
      </ul>
    </footer>
  );
}
