import type { MDXComponents } from "mdx/types";
import { CurrentYear } from "@/components/current-year";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    CurrentYear: CurrentYear,
    ...components,
  };
}
