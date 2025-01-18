import withMDX from "@next/mdx";

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,

  transpilePackages: ["svg-to-swiftui-core"],

  pageExtensions: ["js", "jsx", "mdx", "ts", "tsx"],

  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default withMDX()(config);
