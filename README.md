<img align="right" src="./content/svg-to-swiftui-logo.png" width="200px" />

# SVG to SwiftUI Converter

Tool to convert SVG to SwiftUI's Shape structure. This approach is much more memory efficient than introducing a SVG library for rendering.

<a href="https://www.producthunt.com/posts/svg-to-swiftui-converter?embed=true&utm_source=badge-featured&utm_medium=badge&utm_souce=badge-svg&#0045;to&#0045;swiftui&#0045;converter" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=485547&theme=dark" alt="SVG&#0032;to&#0032;SwiftUI&#0032;Converter - SVG&#0032;icons&#0032;in&#0032;your&#0032;SwiftUI&#0032;project&#0032;in&#0032;a&#0032;minute&#0033; | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a>

## Disclaimer (Before you use this tool)

This tool is oriented towards specific implementations where you might otherwise need to convert the icon into SwiftUI Shape manually, for example when you need a custom animatable icon, need to use SFSymbol in your macOS app, etc. For general purpose icons it might be better to use [this](https://developer.apple.com/documentation/uikit/uiimage/creating_custom_symbol_images_for_your_app) guide to create an SF Symbol instead.

## Quick Links

- [Web App (SVG to SwiftUI)](https://svg-to-swiftui.quassum.com?utm_source=github&utm_medium=readme)
- [Figma Plugin](https://dub.sh/figma-to-swiftui)

## Usage

### Step 1

⭐️ Star this repository! ⭐️

### Online

The tool is available online, just follow [this](https://svg-to-swiftui.quassum.com/) link.

### Running locally

```
git clone https://github.com/bring-shrubbery/SVG-to-SwiftUI
cd SVG-to-SwiftUI
yarn
yarn dev
```

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

Please consider following this project's author, Antoni Silvestrovič on [Github](https://github.com/bring-shrubbery) or [Bluesky](https://bsky.app/profile/bring-shrubbery.bsky.social), or by starring the project to show your ❤️ and support.

## License

[MIT](https://github.com/bring-shrubbery/SVG-to-SwiftUI/blob/master/LICENSE)
