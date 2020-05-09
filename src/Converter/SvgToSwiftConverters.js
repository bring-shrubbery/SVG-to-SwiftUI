import { handleGroupElement } from "./ElementHandlers/groupElementHandler";
import { handlePathElement } from "./ElementHandlers/pathElementHandler";
import { extractProps } from "./StyleUtilities";

export function handleElement(element, options) {
  switch (element.tagName) {
    case "g":
      return handleGroupElement(element, options);

    case "path":
      return handlePathElement(element, options);

    case "circle":
      return handleCircleElement(element, options);

    case "rect":
      return handleRectElement(element, options);
  }
}

function handleCircleElement(element, options) {
  const { properties, children, style } = extractProps(element, options);
}

function handleRectElement(element, options) {
  const { properties, children, style } = extractProps(element, options);
}
