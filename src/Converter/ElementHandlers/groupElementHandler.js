import { extractProps } from "../StyleUtilities";
import { handleElement } from "../SvgToSwiftConverters";

// Handles 'g' svg element, returns generated swift string.
export function handleGroupElement(element, options) {
  const { properties, children, style } = extractProps(element, options);

  // For each child run the generator, accumulate swift string and return it.
  return children.reduce(
    (acc, child) =>
      acc +
      handleElement(child, {
        ...options,
        ...style,
      }),
    ""
  );
}
