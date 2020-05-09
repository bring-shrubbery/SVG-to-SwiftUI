export function extractProps(element, options) {
  const { properties, children } = element;

  const propertiesStyle = parseStyle(
    typeof properties.style == "undefined" ? properties : properties.style
  );

  const parentStyle = parseStyle(options);

  return {
    properties,
    children,
    style: {
      ...parentStyle,
      ...propertiesStyle,
    },
  };
}

export function parseStyle(style) {
  let styleProperties = {};
  if (typeof style == "string") {
    const styleArray = style
      .replace(/\s/g, "")
      .split(";")
      .map((el) => {
        const [property, value] = el.split(":");
        return { property, value };
      });

    for (const el of styleArray) {
      styleProperties[el.property] = el.value;
    }
  } else {
    styleProperties = style;
  }

  const filteredStyle = Object.keys(styleProperties)
    .filter((key) => stylePropertiesSet.has(key))
    .reduce((obj, key) => {
      obj[key] = styleProperties[key];
      return obj;
    }, {});

  return filteredStyle;
}

const stylePropertiesSet = new Set([
  "alignment-baseline",
  "baseline-shift",
  "clip", // Deprecated
  "clip-path",
  "clip-rule",
  "color",
  "color-interpolation",
  "color-interpolation-filters",
  "color-profile", // Deprecated since SVG 2
  "color-rendering",
  "cursor",
  "direction",
  "display",
  "dominant-baseline",
  "enable-background", // Deprecated since SVG 2
  "fill",
  "fill-opacity",
  "fill-rule",
  "filter",
  "flood-color",
  "flood-opacity",
  "font-family",
  "font-size",
  "font-size-adjust",
  "font-stretch",
  "font-style",
  "font-variant",
  "font-weight",
  "glyph-orientation-horizontal", // Deprecated since SVG 2
  "glyph-orientation-vertical", // Deprecated since SVG 2
  "image-rendering",
  "kerning", // Deprecated since SVG 2
  "letter-spacing",
  "lighting-color",
  "marker-end",
  "marker-mid",
  "marker-start",
  "mask",
  "opacity",
  "overflow",
  "pointer-events",
  "shape-rendering",
  "solid-color",
  "solid-opacity",
  "stop-color",
  "stop-opacity",
  "stroke",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-opacity",
  "stroke-width",
  "text-anchor",
  "text-decoration",
  "text-rendering",
  "transform",
  "unicode-bidi",
  "vector-effect",
  "visibility",
  "word-spacing",
  "writing-mode",
]);
