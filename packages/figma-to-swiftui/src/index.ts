import { convert } from "../../svg-to-swiftui-core/src/index";

// Make sure that we're in Dev Mode and running codegen
if (figma.editorType === "dev" && figma.mode === "codegen") {
  // Register a callback to the "generate" event
  figma.codegen.on("generate", ({ node }) => {
    // If the node is not a vector, return a comment with a message
    if (!node || node?.type !== "VECTOR") {
      return [
        {
          title: "SwiftUI Shape",
          language: "SWIFT",
          code: `// Please select a vector element and then enter the DEV mode.`,
        },
      ];
    }

    const vbx = node.absoluteBoundingBox?.x;
    const vby = node.absoluteBoundingBox?.y;
    const vbWidth = node.absoluteBoundingBox?.width;
    const vbHeight = node.absoluteBoundingBox?.height;
    const viewBox = [vbx, vby, vbWidth, vbHeight].join(" ");

    const justPaths = node.vectorPaths.map((path) => path.data);

    const SVG_TEMPLATE = `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">
      ${justPaths.map((p) => `<path d="${p}" />\n  `)}
    </svg>`;

    const swiftUI = convert(SVG_TEMPLATE, {
      structName: node.name.replace(/\s/g, ""),
      usageCommentPrefix: true,
    });

    return [
      {
        title: "SwiftUI Shape",
        language: "SWIFT",
        code: swiftUI,
      },
    ];
  });
}
