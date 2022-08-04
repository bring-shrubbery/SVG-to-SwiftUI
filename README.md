<img align="right" src="./content/svg-to-swiftui-logo.png" width="200px" />

# SVG to SwiftUI Converter

Tool to convert SVG to SwiftUI's Shape structure. This approach is much more memory efficient than introducing a SVG library for rendering.

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/bring.shrubbery)

## Disclaimer (Before you use this tool)

This tool is oriented towards specific implementations where you might otherwise need to convert the icon into SwiftUI Shape manually, for example when you need a custom animatable icon, need to use SFSymbol in your macOS app, etc. For general purpose icons it might be better to use [this](https://developer.apple.com/documentation/uikit/uiimage/creating_custom_symbol_images_for_your_app) guide to create an SF Symbol instead.

## Usage

### Online

The tool is available online, just follow [this](https://quassum.github.io/SVG-to-SwiftUI/) link.

### Running locally

```
git clone https://github.com/quassum/SVG-to-SwiftUI
cd SVG-to-SwiftUI
yarn
yarn dev
```

## Functionality Coverage

This repository is just a front-end wrapper over our [svg-to-swiftui-core](https://github.com/quassum/svg-to-swiftui-core) ([npm link](https://www.npmjs.com/package/svg-to-swiftui-core)) package. You can find the functionality coverage on that package's page. We encourage you checking it out and maybe starring it on GitHub 😍!

## Example usage

To demonstrate this tool I created a thicc plus sign with rounded corners (created it in Sketch, so shapes from Sketch should work fine with this tool).
It's saved as `content/demo-plus.svg` file in this repository. You can see below how it looks like in the browser, and how it looks like after converting into SwiftUI Shape.

### In the browser

![SVG file wiewed in the browser](content/example_svg.png)

### In SwiftUI View, exported as a Shape

![SVG file wiewed in the browser](content/example_swift.png)

## Contributing

- Feel free to open an issue for the SVG code that did not work - provide the SVG code of course!
- Pull requests are very welcome! Introducing support for more SVG element types would be the best contribution at this point.

## Author

[Antoni Silvestrovic](https://github.com/bring-shrubbery)

## License

[MIT](https://github.com/quassum/SVG-to-SwiftUI/blob/master/LICENSE)
