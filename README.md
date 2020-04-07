# SVG-to-SwiftUI

Tool to convert SVG to SwiftUI's code which ustilises GeometryReader and Path objects

**Disclaimer:** If you need to import SVG into SwiftUI app, it's better to use [this](https://developer.apple.com/documentation/uikit/uiimage/creating_custom_symbol_images_for_your_app) guide to create a symbol instead. This repository is just for fun and was written in an evening, so don't judge the code style 🤮🙊

## Usage

Just go on the link in the repository description, it's intuitive from there on.

## Functionality Coverage

This program supports a very limited conversion. In particular it can only use M, L, C and Z data points for now.
Additionally, it requires the 'svg' element to have 'width' and 'height' properties (it does not take viewBox into account).

## Example usage

To demonstrate this tool I created a thicc plus sign with rounded corners. It's saved as 'demo-plus.svg' file in this repository.
You can see below how it looks like in the browser, and how it looks like after converting into SwiftUI Shape.

### In the browser:

![SVG file wiewed in the browser](example_svg.png)

### In SwiftUI View, exported as Shape:

![SVG file wiewed in the browser](example_swift.png)
