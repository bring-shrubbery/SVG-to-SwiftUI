import { CurrentYear } from "@/components/current-year";
import type { MDXComponents } from "mdx/types";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    CurrentYear: CurrentYear,
    ...components,
  };
}
