import { compile, type Options as SelectorOptions } from "css-select";
import postcss, { type Container, type Declaration, type Rule } from "postcss";
import safeParse from "postcss-safe-parser";
import selectorParser, { type Selector, type Node as SelectorNode } from "postcss-selector-parser";
import valueParser, { type Node as ValueNode } from "postcss-value-parser";
import type { ElementNode, TextNode } from "svg-parser";
import type { CSSDiagnosticContext, RenderDiagnostic, SourceLocation } from "./renderTree/types";
import {
  canonicalPropertyName,
  isStyleProperty,
  STYLE_PROPERTY_DEFINITIONS,
  StylePropertiesSet,
} from "./styleProperties";

export type Presentation = Record<string, string | number>;

export interface StyleResolution {
  values: Presentation;
  provenance: Readonly<Record<string, CSSDiagnosticContext>>;
}

type StyleNode = ElementNode | TextNode | string;

interface CascadedDeclaration {
  property: string;
  value: string;
  important: boolean;
  specificity: Specificity;
  order: number;
  css: CSSDiagnosticContext;
}

interface Specificity {
  inline: number;
  a: number;
  b: number;
  c: number;
}

interface CompiledRule {
  matches: (node: StyleNode) => boolean;
  specificity: Specificity;
  declarations: Omit<CascadedDeclaration, "specificity">[];
}

const ZERO_SPECIFICITY: Specificity = { inline: 0, a: 0, b: 0, c: 0 };
const INLINE_SPECIFICITY: Specificity = { inline: 1, a: 0, b: 0, c: 0 };
const DYNAMIC_PSEUDO_CLASSES = new Set([
  ":active",
  ":checked",
  ":disabled",
  ":enabled",
  ":focus",
  ":focus-visible",
  ":focus-within",
  ":hover",
  ":indeterminate",
  ":link",
  ":optional",
  ":required",
  ":target",
  ":visited",
]);

const LEGACY_PSEUDO_ELEMENTS = new Set([":before", ":after", ":first-line", ":first-letter"]);

function addSpecificity(left: Specificity, right: Specificity): Specificity {
  return {
    inline: left.inline + right.inline,
    a: left.a + right.a,
    b: left.b + right.b,
    c: left.c + right.c,
  };
}

function compareSpecificity(left: Specificity, right: Specificity): number {
  if (left.inline !== right.inline) return left.inline - right.inline;
  if (left.a !== right.a) return left.a - right.a;
  if (left.b !== right.b) return left.b - right.b;
  return left.c - right.c;
}

function mostSpecific(nodes: readonly SelectorNode[]): Specificity {
  let result = ZERO_SPECIFICITY;
  for (const node of nodes) {
    const specificity = selectorSpecificity(node);
    if (compareSpecificity(specificity, result) > 0) result = specificity;
  }
  return result;
}

/** Selectors Level 4 specificity for the supported static selector subset. */
function selectorSpecificity(node: SelectorNode): Specificity {
  if (node.type === "id") return { inline: 0, a: 1, b: 0, c: 0 };
  if (node.type === "class" || node.type === "attribute") return { inline: 0, a: 0, b: 1, c: 0 };
  if (node.type === "tag") return { inline: 0, a: 0, b: 0, c: 1 };
  if (node.type === "universal" || node.type === "combinator" || node.type === "comment") return ZERO_SPECIFICITY;
  if (node.type === "pseudo") {
    const name = node.value.toLowerCase();
    if (name.startsWith("::") || LEGACY_PSEUDO_ELEMENTS.has(name)) return { inline: 0, a: 0, b: 0, c: 1 };
    if (name === ":where") return ZERO_SPECIFICITY;
    if ([":is", ":not", ":has", ":matches"].includes(name)) return mostSpecific(node.nodes ?? []);
    return { inline: 0, a: 0, b: 1, c: 0 };
  }
  if ("nodes" in node && node.nodes) {
    return node.nodes.reduce((result, child) => addSpecificity(result, selectorSpecificity(child)), ZERO_SPECIFICITY);
  }
  return ZERO_SPECIFICITY;
}

function sourceLocation(element: ElementNode): SourceLocation {
  const id = element.properties?.id;
  return { element: element.tagName ?? "unknown", ...(id === undefined ? {} : { id: String(id) }) };
}

function textContent(element: ElementNode): string {
  return element.children
    .map((child) => {
      if (typeof child === "string") return child;
      if (child.type === "text") return String(child.value ?? "");
      return textContent(child);
    })
    .join("");
}

function compareCandidates(left: CascadedDeclaration, right: CascadedDeclaration): number {
  if (left.important !== right.important) return left.important ? 1 : -1;
  if (left.specificity.inline !== right.specificity.inline) return left.specificity.inline - right.specificity.inline;
  if (left.specificity.a !== right.specificity.a) return left.specificity.a - right.specificity.a;
  if (left.specificity.b !== right.specificity.b) return left.specificity.b - right.specificity.b;
  if (left.specificity.c !== right.specificity.c) return left.specificity.c - right.specificity.c;
  return left.order - right.order;
}

function replaceNodeWithWord(node: ValueNode, value: string): void {
  Object.assign(node, { type: "word", value });
  if ("nodes" in node) delete (node as ValueNode & { nodes?: ValueNode[] }).nodes;
}

function substituteVariables(raw: string, resolveCustom: (name: string) => string | undefined): string | undefined {
  const parsed = valueParser(raw);
  let valid = true;

  const visit = (nodes: ValueNode[]): void => {
    for (const node of nodes) {
      if (node.type !== "function") continue;
      if (node.value.toLowerCase() !== "var") {
        visit(node.nodes);
        continue;
      }

      const comma = node.nodes.findIndex((child) => child.type === "div" && child.value === ",");
      const nameNodes = comma < 0 ? node.nodes : node.nodes.slice(0, comma);
      const fallbackNodes = comma < 0 ? [] : node.nodes.slice(comma + 1);
      const name = valueParser.stringify(nameNodes).trim();
      let replacement = name.startsWith("--") ? resolveCustom(name) : undefined;
      if (replacement === undefined && fallbackNodes.length > 0) {
        replacement = substituteVariables(valueParser.stringify(fallbackNodes), resolveCustom);
      }
      if (replacement === undefined) {
        valid = false;
        continue;
      }
      replaceNodeWithWord(node, replacement);
    }
  };

  visit(parsed.nodes);
  return valid ? parsed.toString().trim() : undefined;
}

function resolveCurrentColor(value: string | number, color: string | number): string | number {
  if (typeof value === "number") return value;
  const parsed = valueParser(value);
  parsed.walk((node) => {
    if (node.type === "word" && node.value.toLowerCase() === "currentcolor") node.value = String(color);
  });
  return parsed.toString();
}

function declarationNodes(container: Container): Declaration[] {
  return (container.nodes ?? []).filter((node): node is Declaration => node.type === "decl");
}

/**
 * Standards-oriented author-style resolver for a single parsed SVG document.
 * Selector matching happens against the original document tree; callers pass
 * the inherited instance context when resolving referenced `<use>` content.
 */
export class SVGStyleResolver {
  private readonly rules: CompiledRule[] = [];
  private readonly parent = new WeakMap<object, ElementNode | null>();
  private readonly ownDeclarations = new WeakMap<
    ElementNode,
    {
      presentation: Omit<CascadedDeclaration, "specificity">[];
      inline: Omit<CascadedDeclaration, "specificity">[];
    }
  >();
  private order = 0;
  private readonly selectorOptions: SelectorOptions<StyleNode, ElementNode>;

  constructor(
    root: ElementNode,
    private readonly diagnostics: RenderDiagnostic[],
  ) {
    this.indexTree(root, null);
    this.selectorOptions = {
      adapter: {
        isTag: (node): node is ElementNode => typeof node !== "string" && node.type === "element",
        getAttributeValue: (element, name) => {
          const value = element.properties?.[name];
          return value === undefined ? undefined : String(value);
        },
        getChildren: (node) =>
          typeof node !== "string" && node.type === "element" ? (node.children as StyleNode[]) : [],
        getName: (element) => element.tagName ?? "",
        getParent: (element) => this.parent.get(element) ?? null,
        getSiblings: (node) => {
          if (typeof node === "string") return [node];
          const parent = this.parent.get(node);
          return parent ? (parent.children as StyleNode[]) : [node];
        },
        getText: (node) => {
          if (typeof node === "string") return node;
          if (node.type === "text") return String(node.value ?? "");
          return textContent(node);
        },
        hasAttrib: (element, name) => element.properties?.[name] !== undefined,
        removeSubsets: (nodes) => {
          const unique = [...new Set(nodes)];
          const selected = new Set(unique);
          return unique.filter((node) => {
            if (typeof node === "string") return true;
            let ancestor = this.parent.get(node) ?? null;
            while (ancestor) {
              if (selected.has(ancestor)) return false;
              ancestor = this.parent.get(ancestor) ?? null;
            }
            return true;
          });
        },
      },
      xmlMode: true,
      relativeSelector: false,
      cacheResults: true,
    };
    this.collectStylesheets(root);
  }

  private indexTree(element: ElementNode, parent: ElementNode | null): void {
    this.parent.set(element, parent);
    for (const child of element.children) {
      if (typeof child === "string") continue;
      this.parent.set(child, element);
      if (child.type === "element") this.indexTree(child, element);
    }
  }

  private diagnostic(element: ElementNode, code: string, message: string, css: CSSDiagnosticContext): void {
    this.diagnostics.push({ code, message, severity: "warning", source: sourceLocation(element), css });
  }

  private collectStylesheets(element: ElementNode): void {
    if (element.tagName === "style") {
      const type = String(element.properties?.type ?? "text/css")
        .trim()
        .toLowerCase();
      const media = String(element.properties?.media ?? "all")
        .trim()
        .toLowerCase();
      if (type !== "text/css") {
        this.diagnostic(element, "unsupported-style-type", `Style type '${type}' is not supported.`, {
          source: "embedded-style",
        });
      } else if (media !== "all" && media !== "") {
        this.diagnostic(element, "unsupported-dynamic-media", `Style media '${media}' is ignored.`, {
          source: "embedded-style",
          selector: `media=${media}`,
        });
      } else {
        this.parseStylesheet(element, textContent(element));
      }
    }
    for (const child of element.children) {
      if (typeof child !== "string" && child.type === "element") this.collectStylesheets(child);
    }
  }

  private parseStylesheet(styleElement: ElementNode, css: string): void {
    try {
      postcss.parse(css);
    } catch (error) {
      const syntax = error as { reason?: string; line?: number; column?: number };
      this.diagnostic(styleElement, "invalid-css-syntax", syntax.reason ?? String(error), {
        source: "embedded-style",
        ...(syntax.line === undefined ? {} : { line: syntax.line }),
        ...(syntax.column === undefined ? {} : { column: syntax.column }),
      });
    }

    let root: ReturnType<typeof safeParse>;
    try {
      root = safeParse(css);
    } catch (error) {
      this.diagnostic(styleElement, "invalid-css-syntax", String(error), { source: "embedded-style" });
      return;
    }
    this.collectContainerRules(root, styleElement);
  }

  private collectContainerRules(container: Container, styleElement: ElementNode): void {
    for (const node of container.nodes ?? []) {
      if (node.type === "atrule") {
        const code = node.name.toLowerCase() === "media" ? "unsupported-dynamic-media" : "unsupported-css-at-rule";
        this.diagnostic(styleElement, code, `Static style resolution does not support @${node.name} ${node.params}.`, {
          source: "embedded-style",
          selector: `@${node.name} ${node.params}`.trim(),
          ...(node.source?.start?.line === undefined ? {} : { line: node.source.start.line }),
          ...(node.source?.start?.column === undefined ? {} : { column: node.source.start.column }),
        });
        continue;
      }
      if (node.type === "rule") this.compileRule(node, styleElement);
    }
  }

  private compileRule(rule: Rule, styleElement: ElementNode): void {
    let selectors: Selector[];
    try {
      selectors = selectorParser().astSync(rule.selector).nodes as Selector[];
    } catch (error) {
      this.diagnostic(styleElement, "invalid-css-selector", String(error), {
        source: "embedded-style",
        selector: rule.selector,
        ...(rule.source?.start?.line === undefined ? {} : { line: rule.source.start.line }),
        ...(rule.source?.start?.column === undefined ? {} : { column: rule.source.start.column }),
      });
      return;
    }

    const declarations = this.parseDeclarations(rule, styleElement, "embedded-style", rule.selector);
    for (const selector of selectors) {
      const selectorText = selector.toString();
      let dynamic = false;
      selector.walkPseudos((pseudo) => {
        if (DYNAMIC_PSEUDO_CLASSES.has(pseudo.value.toLowerCase())) dynamic = true;
      });
      if (dynamic) {
        this.diagnostic(
          styleElement,
          "unsupported-dynamic-selector",
          `Dynamic selector '${selectorText}' is ignored during static rendering.`,
          { source: "embedded-style", selector: selectorText },
        );
        continue;
      }

      try {
        const matches = compile<StyleNode, ElementNode>(selectorText, this.selectorOptions);
        this.rules.push({
          matches,
          specificity: selectorSpecificity(selector),
          declarations,
        });
      } catch (error) {
        this.diagnostic(styleElement, "unsupported-css-selector", String(error), {
          source: "embedded-style",
          selector: selectorText,
        });
      }
    }
  }

  private parseDeclarations(
    container: Container,
    sourceElement: ElementNode,
    source: CSSDiagnosticContext["source"],
    selector: string,
  ): Omit<CascadedDeclaration, "specificity">[] {
    const result: Omit<CascadedDeclaration, "specificity">[] = [];
    for (const declaration of declarationNodes(container)) {
      const property = canonicalPropertyName(declaration.prop);
      const css: CSSDiagnosticContext = {
        source,
        selector,
        property,
        ...(declaration.source?.start?.line === undefined ? {} : { line: declaration.source.start.line }),
        ...(declaration.source?.start?.column === undefined ? {} : { column: declaration.source.start.column }),
      };
      if (!property.startsWith("--") && !isStyleProperty(property) && property !== "marker") {
        this.diagnostic(
          sourceElement,
          "unsupported-css-property",
          `Property '${property}' is not supported by the SVG computed-style model.`,
          css,
        );
        continue;
      }
      if (declaration.value.trim() === "") {
        this.diagnostic(sourceElement, "invalid-css-declaration", `Property '${property}' has an empty value.`, css);
        continue;
      }
      const targets = property === "marker" ? ["marker-start", "marker-mid", "marker-end"] : [property];
      for (const target of targets) {
        result.push({
          property: target,
          value: declaration.value.trim(),
          important: Boolean(declaration.important),
          order: this.order++,
          css: { ...css, property: target },
        });
      }
    }
    return result;
  }

  private inlineDeclarations(element: ElementNode): Omit<CascadedDeclaration, "specificity">[] {
    const raw = element.properties?.style;
    if (typeof raw !== "string" || raw.trim() === "") return [];
    const wrapped = `__inline__ { ${raw} }`;
    try {
      postcss.parse(wrapped);
    } catch (error) {
      const syntax = error as { reason?: string; line?: number; column?: number };
      this.diagnostic(element, "invalid-css-declaration", syntax.reason ?? String(error), {
        source: "inline-style",
        selector: "<inline style>",
        ...(syntax.line === undefined ? {} : { line: syntax.line }),
        ...(syntax.column === undefined ? {} : { column: syntax.column }),
      });
    }
    const root = safeParse(wrapped);
    const rule = root.nodes.find((node): node is Rule => node.type === "rule");
    return rule ? this.parseDeclarations(rule, element, "inline-style", "<inline style>") : [];
  }

  private presentationDeclarations(element: ElementNode): Omit<CascadedDeclaration, "specificity">[] {
    const result: Omit<CascadedDeclaration, "specificity">[] = [];
    for (const [rawName, rawValue] of Object.entries(element.properties ?? {})) {
      const property = canonicalPropertyName(rawName);
      if (!StylePropertiesSet.has(property) && property !== "marker") continue;
      const value = String(rawValue).trim();
      const css: CSSDiagnosticContext = { source: "presentation-attribute", property };
      if (/!\s*important\s*$/i.test(value)) {
        this.diagnostic(
          element,
          "invalid-presentation-attribute",
          `Presentation attribute '${property}' cannot contain !important.`,
          css,
        );
        continue;
      }
      const targets = property === "marker" ? ["marker-start", "marker-mid", "marker-end"] : [property];
      for (const target of targets) {
        result.push({
          property: target,
          value,
          important: false,
          order: this.order++,
          css: { ...css, property: target },
        });
      }
    }
    return result;
  }

  private declarationsFor(element: ElementNode) {
    const cached = this.ownDeclarations.get(element);
    if (cached) return cached;
    const declarations = {
      presentation: this.presentationDeclarations(element),
      inline: this.inlineDeclarations(element),
    };
    this.ownDeclarations.set(element, declarations);
    return declarations;
  }

  resolve(element: ElementNode, inherited: Presentation = {}): StyleResolution {
    const candidates: CascadedDeclaration[] = [];
    for (const rule of this.rules) {
      if (!rule.matches(element)) continue;
      candidates.push(...rule.declarations.map((declaration) => ({ ...declaration, specificity: rule.specificity })));
    }
    const own = this.declarationsFor(element);
    candidates.push(
      ...own.presentation.map((declaration) => ({
        ...declaration,
        specificity: ZERO_SPECIFICITY,
      })),
    );
    candidates.push(
      ...own.inline.map((declaration) => ({
        ...declaration,
        specificity: INLINE_SPECIFICITY,
      })),
    );

    const winners = new Map<string, CascadedDeclaration>();
    for (const candidate of candidates) {
      const current = winners.get(candidate.property);
      if (!current || compareCandidates(candidate, current) >= 0) winners.set(candidate.property, candidate);
    }

    const inheritedCustom: Presentation = {};
    for (const [property, value] of Object.entries(inherited)) {
      if (property.startsWith("--")) inheritedCustom[property] = value;
    }
    const customCache = new Map<string, string | undefined>();
    const resolving: string[] = [];
    const cycleMembers = new Set<string>();
    const resolveCustom = (name: string): string | undefined => {
      if (customCache.has(name)) return customCache.get(name);
      const cycleStart = resolving.indexOf(name);
      if (cycleStart >= 0) {
        for (const member of resolving.slice(cycleStart)) cycleMembers.add(member);
        const candidate = winners.get(name);
        this.diagnostic(element, "css-variable-cycle", `Custom property cycle detected while resolving '${name}'.`, {
          source: candidate?.css.source ?? "inline-style",
          selector: candidate?.css.selector,
          property: name,
        });
        customCache.set(name, undefined);
        return undefined;
      }
      resolving.push(name);
      const winner = winners.get(name);
      const keyword = winner?.value.trim().toLowerCase();
      const raw =
        winner === undefined ||
        keyword === "inherit" ||
        keyword === "unset" ||
        keyword === "revert" ||
        keyword === "revert-layer"
          ? inheritedCustom[name]
          : keyword === "initial"
            ? undefined
            : winner.value;
      const substituted = raw === undefined ? undefined : substituteVariables(String(raw), resolveCustom);
      resolving.pop();
      const value = cycleMembers.has(name) ? undefined : substituted;
      customCache.set(name, value);
      return value;
    };

    const values: Presentation = {};
    const provenance: Record<string, CSSDiagnosticContext> = {};
    for (const name of new Set([
      ...Object.keys(inheritedCustom),
      ...[...winners.keys()].filter((property) => property.startsWith("--")),
    ])) {
      const value = resolveCustom(name);
      if (value !== undefined) values[name] = value;
      const css = winners.get(name)?.css;
      if (css) provenance[name] = css;
    }

    for (const [property, definition] of Object.entries(STYLE_PROPERTY_DEFINITIONS)) {
      const winner = winners.get(property);
      let value: string | number;
      if (!winner) {
        const contextualOverflow = property === "overflow" && ["svg", "symbol"].includes(element.tagName ?? "");
        value =
          definition.inherited && inherited[property] !== undefined
            ? inherited[property]!
            : contextualOverflow
              ? "hidden"
              : definition.initial;
      } else {
        const substituted = substituteVariables(winner.value, resolveCustom);
        if (substituted === undefined) {
          this.diagnostic(
            element,
            "invalid-css-variable",
            `Property '${property}' is invalid after var() substitution.`,
            winner.css,
          );
          value = definition.inherited && inherited[property] !== undefined ? inherited[property]! : definition.initial;
        } else {
          const keyword = substituted.trim().toLowerCase();
          if (keyword === "inherit") value = inherited[property] ?? definition.initial;
          else if (keyword === "initial") value = definition.initial;
          else if (keyword === "unset" || keyword === "revert" || keyword === "revert-layer") {
            value =
              definition.inherited && inherited[property] !== undefined ? inherited[property]! : definition.initial;
          } else value = substituted;
        }
        provenance[property] = winner.css;
      }
      values[property] = value;
    }

    const rawColor = values.color ?? STYLE_PROPERTY_DEFINITIONS.color.initial;
    const color =
      String(rawColor).trim().toLowerCase() === "currentcolor"
        ? (inherited.color ?? STYLE_PROPERTY_DEFINITIONS.color.initial)
        : rawColor;
    values.color = color;
    for (const property of ["fill", "stroke", "stop-color", "flood-color", "lighting-color", "solid-color"] as const) {
      values[property] = resolveCurrentColor(values[property]!, color);
    }
    return { values, provenance };
  }
}
