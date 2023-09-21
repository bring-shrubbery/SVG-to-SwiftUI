"use strict";
function _arrayLikeToArray(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _arrayWithHoles(arr) {
    if (Array.isArray(arr)) return arr;
}
function _arrayWithoutHoles(arr) {
    if (Array.isArray(arr)) return _arrayLikeToArray(arr);
}
function _defineProperty(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
    }
    return obj;
}
function _instanceof(left, right) {
    if (right != null && typeof Symbol !== "undefined" && right[Symbol.hasInstance]) {
        return !!right[Symbol.hasInstance](left);
    } else {
        return left instanceof right;
    }
}
function _iterableToArray(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter);
}
function _iterableToArrayLimit(arr, i) {
    var _i = arr == null ? null : typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"];
    if (_i == null) return;
    var _arr = [];
    var _n = true;
    var _d = false;
    var _s, _e;
    try {
        for(_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true){
            _arr.push(_s.value);
            if (i && _arr.length === i) break;
        }
    } catch (err) {
        _d = true;
        _e = err;
    } finally{
        try {
            if (!_n && _i["return"] != null) _i["return"]();
        } finally{
            if (_d) throw _e;
        }
    }
    return _arr;
}
function _nonIterableRest() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _nonIterableSpread() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _objectSpread(target) {
    for(var i = 1; i < arguments.length; i++){
        var source = arguments[i] != null ? arguments[i] : {};
        var ownKeys = Object.keys(source);
        if (typeof Object.getOwnPropertySymbols === "function") {
            ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function(sym) {
                return Object.getOwnPropertyDescriptor(source, sym).enumerable;
            }));
        }
        ownKeys.forEach(function(key) {
            _defineProperty(target, key, source[key]);
        });
    }
    return target;
}
function ownKeys(object, enumerableOnly) {
    var keys = Object.keys(object);
    if (Object.getOwnPropertySymbols) {
        var symbols = Object.getOwnPropertySymbols(object);
        if (enumerableOnly) {
            symbols = symbols.filter(function(sym) {
                return Object.getOwnPropertyDescriptor(object, sym).enumerable;
            });
        }
        keys.push.apply(keys, symbols);
    }
    return keys;
}
function _objectSpreadProps(target, source) {
    source = source != null ? source : {};
    if (Object.getOwnPropertyDescriptors) {
        Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
        ownKeys(Object(source)).forEach(function(key) {
            Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
        });
    }
    return target;
}
function _objectWithoutProperties(source, excluded) {
    if (source == null) return {};
    var target = _objectWithoutPropertiesLoose(source, excluded);
    var key, i;
    if (Object.getOwnPropertySymbols) {
        var sourceSymbolKeys = Object.getOwnPropertySymbols(source);
        for(i = 0; i < sourceSymbolKeys.length; i++){
            key = sourceSymbolKeys[i];
            if (excluded.indexOf(key) >= 0) continue;
            if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;
            target[key] = source[key];
        }
    }
    return target;
}
function _objectWithoutPropertiesLoose(source, excluded) {
    if (source == null) return {};
    var target = {};
    var sourceKeys = Object.keys(source);
    var key, i;
    for(i = 0; i < sourceKeys.length; i++){
        key = sourceKeys[i];
        if (excluded.indexOf(key) >= 0) continue;
        target[key] = source[key];
    }
    return target;
}
function _slicedToArray(arr, i) {
    return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest();
}
function _toConsumableArray(arr) {
    return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread();
}
var _typeof = function(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
};
function _unsupportedIterableToArray(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _arrayLikeToArray(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen);
}
(function() {
    var getLocator = // ../../node_modules/.pnpm/svg-parser@2.0.4/node_modules/svg-parser/dist/svg-parser.esm.js
    function getLocator(source, options) {
        if (options === void 0) {
            options = {};
        }
        var offsetLine = options.offsetLine || 0;
        var offsetColumn = options.offsetColumn || 0;
        var originalLines = source.split("\n");
        var start = 0;
        var lineRanges = originalLines.map(function(line, i3) {
            var end = start + line.length + 1;
            var range = {
                start: start,
                end: end,
                line: i3
            };
            start = end;
            return range;
        });
        var i2 = 0;
        function rangeContains(range, index) {
            return range.start <= index && index < range.end;
        }
        function getLocation(range, index) {
            return {
                line: offsetLine + range.line,
                column: offsetColumn + index - range.start,
                character: index
            };
        }
        function locate2(search, startIndex) {
            if (typeof search === "string") {
                search = source.indexOf(search, startIndex || 0);
            }
            var range = lineRanges[i2];
            var d = search >= range.end ? 1 : -1;
            while(range){
                if (rangeContains(range, search)) return getLocation(range, search);
                i2 += d;
                range = lineRanges[i2];
            }
        }
        return locate2;
    };
    var locate = function locate(source, search, options) {
        if (typeof options === "number") {
            throw new Error("locate takes a { startIndex, offsetLine, offsetColumn } object as the third argument");
        }
        return getLocator(source, options)(search, options && options.startIndex);
    };
    var repeat = function repeat(str, i2) {
        var result = "";
        while(i2--){
            result += str;
        }
        return result;
    };
    var parse = function parse(source) {
        var header = "";
        var stack = [];
        var state = metadata;
        var currentElement = null;
        var root = null;
        function error(message) {
            var ref = locate(source, i2);
            var line = ref.line;
            var column = ref.column;
            var before = source.slice(0, i2);
            var beforeLine = /(^|\n).*$/.exec(before)[0].replace(/\t/g, "  ");
            var after = source.slice(i2);
            var afterLine = /.*(\n|$)/.exec(after)[0];
            var snippet = "" + beforeLine + afterLine + "\n" + repeat(" ", beforeLine.length) + "^";
            throw new Error(message + " (" + line + ":" + column + "). If this is valid SVG, it's probably a bug in svg-parser. Please raise an issue at https://github.com/Rich-Harris/svg-parser/issues – thanks!\n\n" + snippet);
        }
        function metadata() {
            while(i2 < source.length && source[i2] !== "<" || !validNameCharacters.test(source[i2 + 1])){
                header += source[i2++];
            }
            return neutral();
        }
        function neutral() {
            var text = "";
            while(i2 < source.length && source[i2] !== "<"){
                text += source[i2++];
            }
            if (/\S/.test(text)) {
                currentElement.children.push({
                    type: "text",
                    value: text
                });
            }
            if (source[i2] === "<") {
                return tag;
            }
            return neutral;
        }
        function tag() {
            var char = source[i2];
            if (char === "?") {
                return neutral;
            }
            if (char === "!") {
                if (source.slice(i2 + 1, i2 + 3) === "--") {
                    return comment;
                }
                if (source.slice(i2 + 1, i2 + 8) === "[CDATA[") {
                    return cdata;
                }
                if (/doctype/i.test(source.slice(i2 + 1, i2 + 8))) {
                    return neutral;
                }
            }
            if (char === "/") {
                return closingTag;
            }
            var tagName = getName();
            var element = {
                type: "element",
                tagName: tagName,
                properties: {},
                children: []
            };
            if (currentElement) {
                currentElement.children.push(element);
            } else {
                root = element;
            }
            var attribute;
            while(i2 < source.length && (attribute = getAttribute())){
                element.properties[attribute.name] = attribute.value;
            }
            var selfClosing = false;
            if (source[i2] === "/") {
                i2 += 1;
                selfClosing = true;
            }
            if (source[i2] !== ">") {
                error("Expected >");
            }
            if (!selfClosing) {
                currentElement = element;
                stack.push(element);
            }
            return neutral;
        }
        function comment() {
            var index = source.indexOf("-->", i2);
            if (!~index) {
                error("expected -->");
            }
            i2 = index + 2;
            return neutral;
        }
        function cdata() {
            var index = source.indexOf("]]>", i2);
            if (!~index) {
                error("expected ]]>");
            }
            currentElement.children.push(source.slice(i2 + 7, index));
            i2 = index + 2;
            return neutral;
        }
        function closingTag() {
            var tagName = getName();
            if (!tagName) {
                error("Expected tag name");
            }
            if (tagName !== currentElement.tagName) {
                error("Expected closing tag </" + tagName + "> to match opening tag <" + currentElement.tagName + ">");
            }
            allowSpaces();
            if (source[i2] !== ">") {
                error("Expected >");
            }
            stack.pop();
            currentElement = stack[stack.length - 1];
            return neutral;
        }
        function getName() {
            var name = "";
            while(i2 < source.length && validNameCharacters.test(source[i2])){
                name += source[i2++];
            }
            return name;
        }
        function getAttribute() {
            if (!whitespace.test(source[i2])) {
                return null;
            }
            allowSpaces();
            var name = getName();
            if (!name) {
                return null;
            }
            var value = true;
            allowSpaces();
            if (source[i2] === "=") {
                i2 += 1;
                allowSpaces();
                value = getAttributeValue();
                if (!isNaN(value) && value.trim() !== "") {
                    value = +value;
                }
            }
            return {
                name: name,
                value: value
            };
        }
        function getAttributeValue() {
            return quotemark.test(source[i2]) ? getQuotedAttributeValue() : getUnquotedAttributeValue();
        }
        function getUnquotedAttributeValue() {
            var value = "";
            do {
                var char = source[i2];
                if (char === " " || char === ">" || char === "/") {
                    return value;
                }
                value += char;
                i2 += 1;
            }while (i2 < source.length);
            return value;
        }
        function getQuotedAttributeValue() {
            var quotemark2 = source[i2++];
            var value = "";
            var escaped = false;
            while(i2 < source.length){
                var char = source[i2++];
                if (char === quotemark2 && !escaped) {
                    return value;
                }
                if (char === "\\" && !escaped) {
                    escaped = true;
                }
                value += escaped ? "\\" + char : char;
                escaped = false;
            }
        }
        function allowSpaces() {
            while(i2 < source.length && whitespace.test(source[i2])){
                i2 += 1;
            }
        }
        var i2 = metadata.length;
        while(i2 < source.length){
            if (!state) {
                error("Unexpected character");
            }
            state = state();
            i2 += 1;
        }
        if (state !== neutral) {
            error("Unexpected end of input");
        }
        if (root.tagName === "svg") {
            root.metadata = header;
        }
        return {
            type: "root",
            children: [
                root
            ]
        };
    };
    var convertToPixels = // ../svg-to-swiftui-core/src/utils.ts
    function convertToPixels(num) {
        if (typeof num === "number") return num;
        var unit = String(num).substr(-2, 2);
        if (unit.search(/^[a-z]{2}$/i) !== -1) {
            switch(unit){
                case "em":
                    return parseFloat(num);
                case "ex":
                    return parseFloat(num);
                case "px":
                    return parseFloat(num);
                case "pt":
                    return parseFloat(num);
                case "pc":
                    return parseFloat(num);
                case "cm":
                    return parseFloat(num);
                case "mm":
                    return parseFloat(num);
                case "in":
                    return parseFloat(num);
                default:
                    return parseFloat(num);
            }
        } else {
            return parseFloat(num);
        }
    };
    var extractSVGProperties = function extractSVGProperties(svg) {
        var _svg_properties, _svg_properties1, _svg_properties2;
        var viewBox = (_svg_properties = svg.properties) === null || _svg_properties === void 0 ? void 0 : _svg_properties.viewBox;
        var width = (_svg_properties1 = svg.properties) === null || _svg_properties1 === void 0 ? void 0 : _svg_properties1.width;
        var height = (_svg_properties2 = svg.properties) === null || _svg_properties2 === void 0 ? void 0 : _svg_properties2.height;
        var sizeProvided = width && height;
        var viewBoxProvided = !!viewBox;
        if (!sizeProvided && !viewBoxProvided) {
            throw new Error("Width and height or viewBox must be provided on <svg> element!");
        }
        var viewBoxElements = String(viewBox).split(" ").map(function(n2) {
            return parseFloat(n2);
        });
        var _viewBoxElements = _slicedToArray(viewBoxElements, 4), vbx = _viewBoxElements[0], vby = _viewBoxElements[1], vbWidth = _viewBoxElements[2], vbHeight = _viewBoxElements[3];
        var viewBoxValid = viewBoxElements.every(function(value) {
            return !isNaN(value);
        });
        var widthUnit = convertToPixels(width || vbWidth);
        var heightUnit = convertToPixels(height || vbHeight);
        return {
            width: widthUnit,
            height: heightUnit,
            viewBox: viewBoxValid ? {
                x: vbx,
                y: vby,
                width: vbWidth,
                height: vbHeight
            } : {
                x: 0,
                y: 0,
                width: widthUnit,
                height: heightUnit
            }
        };
    };
    var getSVGElement = function getSVGElement(rootNode) {
        var frontier = [
            rootNode
        ];
        while(frontier.length > 0){
            var currentNode = frontier.shift();
            if (currentNode && typeof currentNode !== "string") {
                if (currentNode.type === "root") {
                    var _frontier;
                    (_frontier = frontier).push.apply(_frontier, _toConsumableArray(currentNode.children));
                    continue;
                } else if (currentNode.type === "element") {
                    var _frontier1;
                    if (currentNode.tagName === "svg") return currentNode;
                    (_frontier1 = frontier).push.apply(_frontier1, _toConsumableArray(currentNode.children));
                    continue;
                } else {
                    continue;
                }
            }
        }
        return void 0;
    };
    var clampNormalisedSizeProduct = function clampNormalisedSizeProduct(value, suffix) {
        if (parseFloat(value) === 1) {
            return suffix;
        } else if (parseFloat(value) === 0) {
            return "0";
        } else {
            return "".concat(value, "*").concat(suffix);
        }
    };
    var normaliseRectValues = function normaliseRectValues(rect, viewBox) {
        if (rect.width && rect.height) {
            return {
                x: rect.x / viewBox.width,
                y: rect.y / viewBox.height,
                width: rect.width / viewBox.width,
                height: rect.height / viewBox.height
            };
        } else {
            return {
                x: rect.x / viewBox.width,
                y: rect.y / viewBox.height
            };
        }
    };
    var stringifyRectValues = function stringifyRectValues(rect, precision) {
        var toFixed = function(value) {
            return value.toFixed(precision).replace(/0+$/, "");
        };
        if (!rect.width || !rect.height) {
            return {
                x: toFixed(rect.x),
                y: toFixed(rect.y)
            };
        } else {
            return {
                x: toFixed(rect.x),
                y: toFixed(rect.y),
                width: toFixed(rect.width),
                height: toFixed(rect.height)
            };
        }
    };
    var handleCircleElement = // ../svg-to-swiftui-core/src/elementHandlers/circleElementHandler.ts
    function handleCircleElement(element, options) {
        var props = element.properties;
        if (props) {
            var circleProps = props;
            if (!circleProps.cx || !circleProps.cy || !circleProps.r) {
                throw new Error("Circle element has to contain cx, cy, and r properties!");
            }
            var cx = parseFloat(circleProps.cx);
            var cy = parseFloat(circleProps.cy);
            var r2 = parseFloat(circleProps.r);
            var x = cx - r2;
            var y2 = cy - r2;
            var width = r2 * 2;
            var height = r2 * 2;
            var normalisedRect = normaliseRectValues({
                x: x,
                y: y2,
                width: width,
                height: height
            }, options.viewBox);
            var SR = stringifyRectValues(normalisedRect, options.precision);
            var strX = clampNormalisedSizeProduct(SR.x, "width");
            var strY = clampNormalisedSizeProduct(SR.y, "height");
            var strWidth = clampNormalisedSizeProduct(SR.width, "width");
            var strHeight = clampNormalisedSizeProduct(SR.height, "height");
            var CGRect = "CGRect(x: ".concat(strX, ", y: ").concat(strY, ", width: ").concat(strWidth, ", height: ").concat(strHeight, ")");
            return [
                "path.addEllipse(in: ".concat(CGRect, ")")
            ];
        } else {
            throw new Error("Circle element has to some properties");
        }
    };
    var handleEllipseElement = // ../svg-to-swiftui-core/src/elementHandlers/ellipseElementHandler.ts
    function handleEllipseElement(element, options) {
        var props = element.properties;
        if (props) {
            var ellipseProps = props;
            if (!ellipseProps.cx || !ellipseProps.cy || !ellipseProps.rx || !ellipseProps.ry) {
                throw new Error("Ellipse element has to contain cx, cy, rx and ry properties!");
            }
            var cx = parseFloat(ellipseProps.cx);
            var cy = parseFloat(ellipseProps.cy);
            var rx = parseFloat(ellipseProps.rx);
            var ry = parseFloat(ellipseProps.ry);
            var x = cx - rx;
            var y2 = cy - ry;
            var width = rx * 2;
            var height = ry * 2;
            var normalizedRect = normaliseRectValues({
                x: x,
                y: y2,
                width: width,
                height: height
            }, options.viewBox);
            var SR = stringifyRectValues(normalizedRect, options.precision);
            var strX = clampNormalisedSizeProduct(SR.x, "width");
            var strY = clampNormalisedSizeProduct(SR.y, "height");
            var strWidth = clampNormalisedSizeProduct(SR.width, "width");
            var strHeight = clampNormalisedSizeProduct(SR.height, "height");
            var CGrect = "CGRect(x: ".concat(strX, ", y: ").concat(strY, ", width: ").concat(strWidth, ", height: ").concat(strHeight, ")");
            return [
                "path.addEllipse(in: ".concat(CGrect, ")")
            ];
        } else {
            throw new Error("Ellipse element has to some properties");
        }
    };
    var extractStyle = // ../svg-to-swiftui-core/src/styleUtils.ts
    function extractStyle(element) {
        var props = element.properties;
        if (props) {
            if (typeof props.style === "string") {
                return parseStyle(props.style);
            } else {
                return filterStyleProps(props);
            }
        } else {
            throw new Error("No properties found on ".concat(element.tagName, " node!"));
        }
    };
    var parseStyle = function parseStyle(style) {
        var styleProperties = {};
        var styleArray = style.replace(/\s/g, "").split(";").map(function(el) {
            var _el_split = _slicedToArray(el.split(":"), 2), property = _el_split[0], value = _el_split[1];
            return {
                property: property,
                value: value
            };
        });
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = styleArray[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var el = _step.value;
                styleProperties[el.property] = el.value;
            }
        } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
        } finally{
            try {
                if (!_iteratorNormalCompletion && _iterator.return != null) {
                    _iterator.return();
                }
            } finally{
                if (_didIteratorError) {
                    throw _iteratorError;
                }
            }
        }
        return styleProperties;
    };
    var filterStyleProps = function filterStyleProps(props) {
        return Object.keys(props).filter(function(key) {
            return StylePropertiesSet.has(key);
        }).reduce(function(obj, key) {
            obj[key] = props[key];
            return obj;
        }, {});
    };
    var handleGroupElement = // ../svg-to-swiftui-core/src/elementHandlers/groupElementHandler.ts
    function handleGroupElement(element, options) {
        var children = element.children;
        var style = element.type === "element" ? extractStyle(element) : {};
        var acc = [];
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = children[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var child = _step.value;
                var _acc;
                if (typeof child === "string") continue;
                if (child.type === "text") continue;
                (_acc = acc).push.apply(_acc, _toConsumableArray(handleElement(child, _objectSpread({}, options, style))));
            }
        } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
        } finally{
            try {
                if (!_iteratorNormalCompletion && _iterator.return != null) {
                    _iterator.return();
                }
            } finally{
                if (_didIteratorError) {
                    throw _iteratorError;
                }
            }
        }
        return acc;
    };
    var r = function r(r2, e2) {
        if ("function" != typeof e2 && null !== e2) throw new TypeError("Class extends value " + String(e2) + " is not a constructor or null");
        function i2() {
            this.constructor = r2;
        }
        t(r2, e2), r2.prototype = null === e2 ? Object.create(e2) : (i2.prototype = e2.prototype, new i2());
    };
    var e = function e(t2) {
        var r2 = "";
        Array.isArray(t2) || (t2 = [
            t2
        ]);
        for(var e2 = 0; e2 < t2.length; e2++){
            var i2 = t2[e2];
            if (i2.type === _.CLOSE_PATH) r2 += "z";
            else if (i2.type === _.HORIZ_LINE_TO) r2 += (i2.relative ? "h" : "H") + i2.x;
            else if (i2.type === _.VERT_LINE_TO) r2 += (i2.relative ? "v" : "V") + i2.y;
            else if (i2.type === _.MOVE_TO) r2 += (i2.relative ? "m" : "M") + i2.x + " " + i2.y;
            else if (i2.type === _.LINE_TO) r2 += (i2.relative ? "l" : "L") + i2.x + " " + i2.y;
            else if (i2.type === _.CURVE_TO) r2 += (i2.relative ? "c" : "C") + i2.x1 + " " + i2.y1 + " " + i2.x2 + " " + i2.y2 + " " + i2.x + " " + i2.y;
            else if (i2.type === _.SMOOTH_CURVE_TO) r2 += (i2.relative ? "s" : "S") + i2.x2 + " " + i2.y2 + " " + i2.x + " " + i2.y;
            else if (i2.type === _.QUAD_TO) r2 += (i2.relative ? "q" : "Q") + i2.x1 + " " + i2.y1 + " " + i2.x + " " + i2.y;
            else if (i2.type === _.SMOOTH_QUAD_TO) r2 += (i2.relative ? "t" : "T") + i2.x + " " + i2.y;
            else {
                if (i2.type !== _.ARC) throw new Error('Unexpected command type "' + i2.type + '" at index ' + e2 + ".");
                r2 += (i2.relative ? "a" : "A") + i2.rX + " " + i2.rY + " " + i2.xRot + " " + +i2.lArcFlag + " " + +i2.sweepFlag + " " + i2.x + " " + i2.y;
            }
        }
        return r2;
    };
    var i = function i(t2, r2) {
        var e2 = t2[0], i2 = t2[1];
        return [
            e2 * Math.cos(r2) - i2 * Math.sin(r2),
            e2 * Math.sin(r2) + i2 * Math.cos(r2)
        ];
    };
    var a = function a() {
        for(var t2 = [], r2 = 0; r2 < arguments.length; r2++)t2[r2] = arguments[r2];
        for(var e2 = 0; e2 < t2.length; e2++)if ("number" != typeof t2[e2]) throw new Error("assertNumbers arguments[" + e2 + "] is not a number. " + _typeof(t2[e2]) + " == typeof " + t2[e2]);
        return true;
    };
    var o = function o(t2, r2, e2) {
        t2.lArcFlag = 0 === t2.lArcFlag ? 0 : 1, t2.sweepFlag = 0 === t2.sweepFlag ? 0 : 1;
        var a2 = t2.rX, o2 = t2.rY, s2 = t2.x, u2 = t2.y;
        a2 = Math.abs(t2.rX), o2 = Math.abs(t2.rY);
        var h2 = i([
            (r2 - s2) / 2,
            (e2 - u2) / 2
        ], -t2.xRot / 180 * n), c2 = h2[0], y2 = h2[1], p2 = Math.pow(c2, 2) / Math.pow(a2, 2) + Math.pow(y2, 2) / Math.pow(o2, 2);
        1 < p2 && (a2 *= Math.sqrt(p2), o2 *= Math.sqrt(p2)), t2.rX = a2, t2.rY = o2;
        var m2 = Math.pow(a2, 2) * Math.pow(y2, 2) + Math.pow(o2, 2) * Math.pow(c2, 2), O2 = (t2.lArcFlag !== t2.sweepFlag ? 1 : -1) * Math.sqrt(Math.max(0, (Math.pow(a2, 2) * Math.pow(o2, 2) - m2) / m2)), l2 = a2 * y2 / o2 * O2, T2 = -o2 * c2 / a2 * O2, v2 = i([
            l2,
            T2
        ], t2.xRot / 180 * n);
        t2.cX = v2[0] + (r2 + s2) / 2, t2.cY = v2[1] + (e2 + u2) / 2, t2.phi1 = Math.atan2((y2 - T2) / o2, (c2 - l2) / a2), t2.phi2 = Math.atan2((-y2 - T2) / o2, (-c2 - l2) / a2), 0 === t2.sweepFlag && t2.phi2 > t2.phi1 && (t2.phi2 -= 2 * n), 1 === t2.sweepFlag && t2.phi2 < t2.phi1 && (t2.phi2 += 2 * n), t2.phi1 *= 180 / n, t2.phi2 *= 180 / n;
    };
    var s = function s(t2, r2, e2) {
        a(t2, r2, e2);
        var i2 = t2 * t2 + r2 * r2 - e2 * e2;
        if (0 > i2) return [];
        if (0 === i2) return [
            [
                t2 * e2 / (t2 * t2 + r2 * r2),
                r2 * e2 / (t2 * t2 + r2 * r2)
            ]
        ];
        var n2 = Math.sqrt(i2);
        return [
            [
                (t2 * e2 + r2 * n2) / (t2 * t2 + r2 * r2),
                (r2 * e2 - t2 * n2) / (t2 * t2 + r2 * r2)
            ],
            [
                (t2 * e2 - r2 * n2) / (t2 * t2 + r2 * r2),
                (r2 * e2 + t2 * n2) / (t2 * t2 + r2 * r2)
            ]
        ];
    };
    var c = function c(t2, r2, e2) {
        return (1 - e2) * t2 + e2 * r2;
    };
    var y = function y(t2, r2, e2, i2) {
        return t2 + Math.cos(i2 / 180 * n) * r2 + Math.sin(i2 / 180 * n) * e2;
    };
    var p = function p(t2, r2, e2, i2) {
        var a2 = 1e-6, n2 = r2 - t2, o2 = e2 - r2, s2 = 3 * n2 + 3 * (i2 - e2) - 6 * o2, u2 = 6 * (o2 - n2), h2 = 3 * n2;
        return Math.abs(s2) < a2 ? [
            -h2 / u2
        ] : function(t3, r3, e3) {
            void 0 === e3 && (e3 = 1e-6);
            var i3 = t3 * t3 / 4 - r3;
            if (i3 < -e3) return [];
            if (i3 <= e3) return [
                -t3 / 2
            ];
            var a3 = Math.sqrt(i3);
            return [
                -t3 / 2 - a3,
                -t3 / 2 + a3
            ];
        }(u2 / s2, h2 / s2, a2);
    };
    var m = function m(t2, r2, e2, i2, a2) {
        var n2 = 1 - a2;
        return t2 * (n2 * n2 * n2) + r2 * (3 * n2 * n2 * a2) + e2 * (3 * n2 * a2 * a2) + i2 * (a2 * a2 * a2);
    };
    var handlePathElement = // ../svg-to-swiftui-core/src/elementHandlers/pathElementHandler/index.ts
    function handlePathElement(element, options) {
        var properties = element.properties;
        if (properties) {
            var props = properties;
            if (!props.d) {
                throw new Error("Parameter `d` has to be provided on the <path> element!");
            }
            options.lastPathId++;
            var pathData = new _(props.d).toAbs();
            return convertPathToSwift(pathData.commands, options);
        } else {
            throw new Error("Path element does not have any properties!");
        }
    };
    var handleRectElement = // ../svg-to-swiftui-core/src/elementHandlers/rectElementHandler.ts
    function handleRectElement(element, options) {
        var props = element.properties;
        if (props) {
            var circleProps = props;
            circleProps.x = circleProps.x || "0";
            circleProps.y = circleProps.y || "0";
            if (!circleProps.width || !circleProps.height) {
                throw new Error("Rectangle has to have width and height properties!");
            }
            var x = parseFloat(circleProps.x);
            var y2 = parseFloat(circleProps.y);
            var width = parseFloat(circleProps.width);
            var height = parseFloat(circleProps.height);
            var normalisedRect = normaliseRectValues({
                x: x,
                y: y2,
                width: width,
                height: height
            }, options.viewBox);
            var SR = stringifyRectValues(normalisedRect, options.precision);
            var strX = clampNormalisedSizeProduct(SR.x, "width");
            var strY = clampNormalisedSizeProduct(SR.y, "height");
            var strWidth = clampNormalisedSizeProduct(SR.width, "width");
            var strHeight = clampNormalisedSizeProduct(SR.height, "height");
            var CGRect = "CGRect(x: ".concat(strX, ", y: ").concat(strY, ", width: ").concat(strWidth, ", height: ").concat(strHeight, ")");
            return [
                "path.addRect(".concat(CGRect, ")")
            ];
        } else {
            throw new Error("Circle element has to some properties");
        }
    };
    var handleElement = // ../svg-to-swiftui-core/src/elementHandlers/index.ts
    function handleElement(element, options) {
        switch(element.tagName){
            case "g":
                return handleGroupElement(element, options);
            case "svg":
                return handleGroupElement(element, options);
            case "path":
                return handlePathElement(element, options);
            case "circle":
                return handleCircleElement(element, options);
            case "rect":
                return handleRectElement(element, options);
            case "ellipse":
                return handleEllipseElement(element, options);
            default:
                console.error([
                    "Element <".concat(element.tagName, "> is not supported!"),
                    "Please open a Github issue for this or send a PR with the implementation!"
                ].join("\n"));
                return [];
        }
    };
    var convert = // ../svg-to-swiftui-core/src/index.ts
    function convert(rawSVGString, config) {
        var AST = parse(rawSVGString);
        var svgElement = getSVGElement(AST);
        if (svgElement) {
            return swiftUIGenerator(svgElement, config);
        } else {
            throw new Error("Could not find SVG element, please provide full SVG source!");
        }
    };
    var swiftUIGenerator = function swiftUIGenerator(svgElement, config) {
        var svgProperties = extractSVGProperties(svgElement);
        var rootTranspilerOptions = _objectSpreadProps(_objectSpread({}, svgProperties), {
            precision: (config === null || config === void 0 ? void 0 : config.precision) || 10,
            lastPathId: 0,
            indentationSize: (config === null || config === void 0 ? void 0 : config.indentationSize) || 4,
            currentIndentationLevel: 0,
            parentStyle: {}
        });
        var generatedBody = handleElement(svgElement, rootTranspilerOptions);
        var fullSwiftUIShape = generateSwiftUIShape(generatedBody, _objectSpread({}, DEFAULT_CONFIG, config));
        return fullSwiftUIShape;
    };
    var validNameCharacters = /[a-zA-Z0-9:_-]/;
    var whitespace = /[\s\t\r\n]/;
    var quotemark = /['"]/;
    // ../svg-to-swiftui-core/src/stubs.ts
    var generateSwiftUIShape = function(body, config) {
        var indStr = new Array(config.indentationSize).fill(" ").join("");
        var getInd = function(indLevel) {
            return new Array(indLevel).fill(indStr).join("");
        };
        var indentedBody = "".concat(getInd(2)).concat(body.join("\n".concat(getInd(2))));
        return [
            "struct ".concat(config.structName, ": Shape {"),
            "".concat(getInd(1), "func path(in rect: CGRect) -> Path {"),
            "".concat(getInd(2), "var path = Path()"),
            "".concat(getInd(2), "let width = rect.size.width"),
            "".concat(getInd(2), "let height = rect.size.height"),
            indentedBody,
            "".concat(getInd(2), "return path"),
            "".concat(getInd(1), "}"),
            "}"
        ].join("\n");
    };
    var StylePropertiesSet = /* @__PURE__ */ new Set([
        "alignment-baseline",
        "baseline-shift",
        "clip",
        "clip-path",
        "clip-rule",
        "color",
        "color-interpolation",
        "color-interpolation-filters",
        "color-profile",
        "color-rendering",
        "cursor",
        "direction",
        "display",
        "dominant-baseline",
        "enable-background",
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
        "glyph-orientation-horizontal",
        "glyph-orientation-vertical",
        "image-rendering",
        "kerning",
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
        "writing-mode"
    ]);
    // ../../node_modules/.pnpm/svg-pathdata@6.0.3/node_modules/svg-pathdata/lib/SVGPathData.module.js
    var t = function t1(r2, e2) {
        return (t = Object.setPrototypeOf || _instanceof({
            __proto__: []
        }, Array) && function(t2, r3) {
            t2.__proto__ = r3;
        } || function(t2, r3) {
            for(var e3 in r3)Object.prototype.hasOwnProperty.call(r3, e3) && (t2[e3] = r3[e3]);
        })(r2, e2);
    };
    var n = Math.PI;
    var u;
    var h = Math.PI / 180;
    !function(t2) {
        var r2 = function r2() {
            return u2(function(t3, r3, e3) {
                return t3.relative && (void 0 !== t3.x1 && (t3.x1 += r3), void 0 !== t3.y1 && (t3.y1 += e3), void 0 !== t3.x2 && (t3.x2 += r3), void 0 !== t3.y2 && (t3.y2 += e3), void 0 !== t3.x && (t3.x += r3), void 0 !== t3.y && (t3.y += e3), t3.relative = false), t3;
            });
        };
        var e2 = function e2() {
            var t3 = NaN, r3 = NaN, e3 = NaN, i2 = NaN;
            return u2(function(a2, n3, o2) {
                return a2.type & _.SMOOTH_CURVE_TO && (a2.type = _.CURVE_TO, t3 = isNaN(t3) ? n3 : t3, r3 = isNaN(r3) ? o2 : r3, a2.x1 = a2.relative ? n3 - t3 : 2 * n3 - t3, a2.y1 = a2.relative ? o2 - r3 : 2 * o2 - r3), a2.type & _.CURVE_TO ? (t3 = a2.relative ? n3 + a2.x2 : a2.x2, r3 = a2.relative ? o2 + a2.y2 : a2.y2) : (t3 = NaN, r3 = NaN), a2.type & _.SMOOTH_QUAD_TO && (a2.type = _.QUAD_TO, e3 = isNaN(e3) ? n3 : e3, i2 = isNaN(i2) ? o2 : i2, a2.x1 = a2.relative ? n3 - e3 : 2 * n3 - e3, a2.y1 = a2.relative ? o2 - i2 : 2 * o2 - i2), a2.type & _.QUAD_TO ? (e3 = a2.relative ? n3 + a2.x1 : a2.x1, i2 = a2.relative ? o2 + a2.y1 : a2.y1) : (e3 = NaN, i2 = NaN), a2;
            });
        };
        var n2 = function n2() {
            var t3 = NaN, r3 = NaN;
            return u2(function(e3, i2, a2) {
                if (e3.type & _.SMOOTH_QUAD_TO && (e3.type = _.QUAD_TO, t3 = isNaN(t3) ? i2 : t3, r3 = isNaN(r3) ? a2 : r3, e3.x1 = e3.relative ? i2 - t3 : 2 * i2 - t3, e3.y1 = e3.relative ? a2 - r3 : 2 * a2 - r3), e3.type & _.QUAD_TO) {
                    t3 = e3.relative ? i2 + e3.x1 : e3.x1, r3 = e3.relative ? a2 + e3.y1 : e3.y1;
                    var n3 = e3.x1, o2 = e3.y1;
                    e3.type = _.CURVE_TO, e3.x1 = ((e3.relative ? 0 : i2) + 2 * n3) / 3, e3.y1 = ((e3.relative ? 0 : a2) + 2 * o2) / 3, e3.x2 = (e3.x + 2 * n3) / 3, e3.y2 = (e3.y + 2 * o2) / 3;
                } else t3 = NaN, r3 = NaN;
                return e3;
            });
        };
        var u2 = function u2(t3) {
            var r3 = 0, e3 = 0, i2 = NaN, a2 = NaN;
            return function(n3) {
                if (isNaN(i2) && !(n3.type & _.MOVE_TO)) throw new Error("path must start with moveto");
                var o2 = t3(n3, r3, e3, i2, a2);
                return n3.type & _.CLOSE_PATH && (r3 = i2, e3 = a2), void 0 !== n3.x && (r3 = n3.relative ? r3 + n3.x : n3.x), void 0 !== n3.y && (e3 = n3.relative ? e3 + n3.y : n3.y), n3.type & _.MOVE_TO && (i2 = r3, a2 = e3), o2;
            };
        };
        var O2 = function O2(t3, r3, e3, i2, n3, o2) {
            return a(t3, r3, e3, i2, n3, o2), u2(function(a2, s2, u3, h2) {
                var c2 = a2.x1, y2 = a2.x2, p2 = a2.relative && !isNaN(h2), m2 = void 0 !== a2.x ? a2.x : p2 ? 0 : s2, O3 = void 0 !== a2.y ? a2.y : p2 ? 0 : u3;
                function l3(t4) {
                    return t4 * t4;
                }
                a2.type & _.HORIZ_LINE_TO && 0 !== r3 && (a2.type = _.LINE_TO, a2.y = a2.relative ? 0 : u3), a2.type & _.VERT_LINE_TO && 0 !== e3 && (a2.type = _.LINE_TO, a2.x = a2.relative ? 0 : s2), void 0 !== a2.x && (a2.x = a2.x * t3 + O3 * e3 + (p2 ? 0 : n3)), void 0 !== a2.y && (a2.y = m2 * r3 + a2.y * i2 + (p2 ? 0 : o2)), void 0 !== a2.x1 && (a2.x1 = a2.x1 * t3 + a2.y1 * e3 + (p2 ? 0 : n3)), void 0 !== a2.y1 && (a2.y1 = c2 * r3 + a2.y1 * i2 + (p2 ? 0 : o2)), void 0 !== a2.x2 && (a2.x2 = a2.x2 * t3 + a2.y2 * e3 + (p2 ? 0 : n3)), void 0 !== a2.y2 && (a2.y2 = y2 * r3 + a2.y2 * i2 + (p2 ? 0 : o2));
                var T2 = t3 * i2 - r3 * e3;
                if (void 0 !== a2.xRot && (1 !== t3 || 0 !== r3 || 0 !== e3 || 1 !== i2)) if (0 === T2) delete a2.rX, delete a2.rY, delete a2.xRot, delete a2.lArcFlag, delete a2.sweepFlag, a2.type = _.LINE_TO;
                else {
                    var v2 = a2.xRot * Math.PI / 180, f2 = Math.sin(v2), N2 = Math.cos(v2), x = 1 / l3(a2.rX), d = 1 / l3(a2.rY), E = l3(N2) * x + l3(f2) * d, A = 2 * f2 * N2 * (x - d), C = l3(f2) * x + l3(N2) * d, M = E * i2 * i2 - A * r3 * i2 + C * r3 * r3, R = A * (t3 * i2 + r3 * e3) - 2 * (E * e3 * i2 + C * t3 * r3), g = E * e3 * e3 - A * t3 * e3 + C * t3 * t3, I = (Math.atan2(R, M - g) + Math.PI) % Math.PI / 2, S = Math.sin(I), L = Math.cos(I);
                    a2.rX = Math.abs(T2) / Math.sqrt(M * l3(L) + R * S * L + g * l3(S)), a2.rY = Math.abs(T2) / Math.sqrt(M * l3(S) - R * S * L + g * l3(L)), a2.xRot = 180 * I / Math.PI;
                }
                return void 0 !== a2.sweepFlag && 0 > T2 && (a2.sweepFlag = +!a2.sweepFlag), a2;
            });
        };
        var l2 = function l2() {
            return function(t3) {
                var r3 = {};
                for(var e3 in t3)r3[e3] = t3[e3];
                return r3;
            };
        };
        t2.ROUND = function(t3) {
            var r3 = function r3(r4) {
                return Math.round(r4 * t3) / t3;
            };
            return void 0 === t3 && (t3 = 1e13), a(t3), function(t4) {
                return void 0 !== t4.x1 && (t4.x1 = r3(t4.x1)), void 0 !== t4.y1 && (t4.y1 = r3(t4.y1)), void 0 !== t4.x2 && (t4.x2 = r3(t4.x2)), void 0 !== t4.y2 && (t4.y2 = r3(t4.y2)), void 0 !== t4.x && (t4.x = r3(t4.x)), void 0 !== t4.y && (t4.y = r3(t4.y)), void 0 !== t4.rX && (t4.rX = r3(t4.rX)), void 0 !== t4.rY && (t4.rY = r3(t4.rY)), t4;
            };
        }, t2.TO_ABS = r2, t2.TO_REL = function() {
            return u2(function(t3, r3, e3) {
                return t3.relative || (void 0 !== t3.x1 && (t3.x1 -= r3), void 0 !== t3.y1 && (t3.y1 -= e3), void 0 !== t3.x2 && (t3.x2 -= r3), void 0 !== t3.y2 && (t3.y2 -= e3), void 0 !== t3.x && (t3.x -= r3), void 0 !== t3.y && (t3.y -= e3), t3.relative = true), t3;
            });
        }, t2.NORMALIZE_HVZ = function(t3, r3, e3) {
            return void 0 === t3 && (t3 = true), void 0 === r3 && (r3 = true), void 0 === e3 && (e3 = true), u2(function(i2, a2, n3, o2, s2) {
                if (isNaN(o2) && !(i2.type & _.MOVE_TO)) throw new Error("path must start with moveto");
                return r3 && i2.type & _.HORIZ_LINE_TO && (i2.type = _.LINE_TO, i2.y = i2.relative ? 0 : n3), e3 && i2.type & _.VERT_LINE_TO && (i2.type = _.LINE_TO, i2.x = i2.relative ? 0 : a2), t3 && i2.type & _.CLOSE_PATH && (i2.type = _.LINE_TO, i2.x = i2.relative ? o2 - a2 : o2, i2.y = i2.relative ? s2 - n3 : s2), i2.type & _.ARC && (0 === i2.rX || 0 === i2.rY) && (i2.type = _.LINE_TO, delete i2.rX, delete i2.rY, delete i2.xRot, delete i2.lArcFlag, delete i2.sweepFlag), i2;
            });
        }, t2.NORMALIZE_ST = e2, t2.QT_TO_C = n2, t2.INFO = u2, t2.SANITIZE = function(t3) {
            void 0 === t3 && (t3 = 0), a(t3);
            var r3 = NaN, e3 = NaN, i2 = NaN, n3 = NaN;
            return u2(function(a2, o2, s2, u3, h2) {
                var c2 = Math.abs, y2 = false, p2 = 0, m2 = 0;
                if (a2.type & _.SMOOTH_CURVE_TO && (p2 = isNaN(r3) ? 0 : o2 - r3, m2 = isNaN(e3) ? 0 : s2 - e3), a2.type & (_.CURVE_TO | _.SMOOTH_CURVE_TO) ? (r3 = a2.relative ? o2 + a2.x2 : a2.x2, e3 = a2.relative ? s2 + a2.y2 : a2.y2) : (r3 = NaN, e3 = NaN), a2.type & _.SMOOTH_QUAD_TO ? (i2 = isNaN(i2) ? o2 : 2 * o2 - i2, n3 = isNaN(n3) ? s2 : 2 * s2 - n3) : a2.type & _.QUAD_TO ? (i2 = a2.relative ? o2 + a2.x1 : a2.x1, n3 = a2.relative ? s2 + a2.y1 : a2.y2) : (i2 = NaN, n3 = NaN), a2.type & _.LINE_COMMANDS || a2.type & _.ARC && (0 === a2.rX || 0 === a2.rY || !a2.lArcFlag) || a2.type & _.CURVE_TO || a2.type & _.SMOOTH_CURVE_TO || a2.type & _.QUAD_TO || a2.type & _.SMOOTH_QUAD_TO) {
                    var O3 = void 0 === a2.x ? 0 : a2.relative ? a2.x : a2.x - o2, l3 = void 0 === a2.y ? 0 : a2.relative ? a2.y : a2.y - s2;
                    p2 = isNaN(i2) ? void 0 === a2.x1 ? p2 : a2.relative ? a2.x : a2.x1 - o2 : i2 - o2, m2 = isNaN(n3) ? void 0 === a2.y1 ? m2 : a2.relative ? a2.y : a2.y1 - s2 : n3 - s2;
                    var T2 = void 0 === a2.x2 ? 0 : a2.relative ? a2.x : a2.x2 - o2, v2 = void 0 === a2.y2 ? 0 : a2.relative ? a2.y : a2.y2 - s2;
                    c2(O3) <= t3 && c2(l3) <= t3 && c2(p2) <= t3 && c2(m2) <= t3 && c2(T2) <= t3 && c2(v2) <= t3 && (y2 = true);
                }
                return a2.type & _.CLOSE_PATH && c2(o2 - u3) <= t3 && c2(s2 - h2) <= t3 && (y2 = true), y2 ? [] : a2;
            });
        }, t2.MATRIX = O2, t2.ROTATE = function(t3, r3, e3) {
            void 0 === r3 && (r3 = 0), void 0 === e3 && (e3 = 0), a(t3, r3, e3);
            var i2 = Math.sin(t3), n3 = Math.cos(t3);
            return O2(n3, i2, -i2, n3, r3 - r3 * n3 + e3 * i2, e3 - r3 * i2 - e3 * n3);
        }, t2.TRANSLATE = function(t3, r3) {
            return void 0 === r3 && (r3 = 0), a(t3, r3), O2(1, 0, 0, 1, t3, r3);
        }, t2.SCALE = function(t3, r3) {
            return void 0 === r3 && (r3 = t3), a(t3, r3), O2(t3, 0, 0, r3, 0, 0);
        }, t2.SKEW_X = function(t3) {
            return a(t3), O2(1, 0, Math.atan(t3), 1, 0, 0);
        }, t2.SKEW_Y = function(t3) {
            return a(t3), O2(1, Math.atan(t3), 0, 1, 0, 0);
        }, t2.X_AXIS_SYMMETRY = function(t3) {
            return void 0 === t3 && (t3 = 0), a(t3), O2(-1, 0, 0, 1, t3, 0);
        }, t2.Y_AXIS_SYMMETRY = function(t3) {
            return void 0 === t3 && (t3 = 0), a(t3), O2(1, 0, 0, -1, 0, t3);
        }, t2.A_TO_C = function() {
            return u2(function(t3, r3, e3) {
                return _.ARC === t3.type ? function(t4, r4, e4) {
                    var a2, n3, s2, u3;
                    t4.cX || o(t4, r4, e4);
                    for(var y2 = Math.min(t4.phi1, t4.phi2), p2 = Math.max(t4.phi1, t4.phi2) - y2, m2 = Math.ceil(p2 / 90), O3 = new Array(m2), l3 = r4, T2 = e4, v2 = 0; v2 < m2; v2++){
                        var f2 = c(t4.phi1, t4.phi2, v2 / m2), N2 = c(t4.phi1, t4.phi2, (v2 + 1) / m2), x = N2 - f2, d = 4 / 3 * Math.tan(x * h / 4), E = [
                            Math.cos(f2 * h) - d * Math.sin(f2 * h),
                            Math.sin(f2 * h) + d * Math.cos(f2 * h)
                        ], A = E[0], C = E[1], M = [
                            Math.cos(N2 * h),
                            Math.sin(N2 * h)
                        ], R = M[0], g = M[1], I = [
                            R + d * Math.sin(N2 * h),
                            g - d * Math.cos(N2 * h)
                        ], S = I[0], L = I[1];
                        O3[v2] = {
                            relative: t4.relative,
                            type: _.CURVE_TO
                        };
                        var H = function H(r5, e5) {
                            var a3 = i([
                                r5 * t4.rX,
                                e5 * t4.rY
                            ], t4.xRot), n4 = a3[0], o2 = a3[1];
                            return [
                                t4.cX + n4,
                                t4.cY + o2
                            ];
                        };
                        a2 = H(A, C), O3[v2].x1 = a2[0], O3[v2].y1 = a2[1], n3 = H(S, L), O3[v2].x2 = n3[0], O3[v2].y2 = n3[1], s2 = H(R, g), O3[v2].x = s2[0], O3[v2].y = s2[1], t4.relative && (O3[v2].x1 -= l3, O3[v2].y1 -= T2, O3[v2].x2 -= l3, O3[v2].y2 -= T2, O3[v2].x -= l3, O3[v2].y -= T2), l3 = (u3 = [
                            O3[v2].x,
                            O3[v2].y
                        ])[0], T2 = u3[1];
                    }
                    return O3;
                }(t3, t3.relative ? 0 : r3, t3.relative ? 0 : e3) : t3;
            });
        }, t2.ANNOTATE_ARCS = function() {
            return u2(function(t3, r3, e3) {
                return t3.relative && (r3 = 0, e3 = 0), _.ARC === t3.type && o(t3, r3, e3), t3;
            });
        }, t2.CLONE = l2, t2.CALCULATE_BOUNDS = function() {
            var t3 = function t3(t4) {
                var r3 = {};
                for(var e3 in t4)r3[e3] = t4[e3];
                return r3;
            }, i2 = r2(), a2 = n2(), h2 = e2(), c2 = u2(function(r3, e3, n3) {
                var O3 = function O3(t4) {
                    t4 > c2.maxX && (c2.maxX = t4), t4 < c2.minX && (c2.minX = t4);
                };
                var l3 = function l3(t4) {
                    t4 > c2.maxY && (c2.maxY = t4), t4 < c2.minY && (c2.minY = t4);
                };
                var u3 = h2(a2(i2(t3(r3))));
                if (u3.type & _.DRAWING_COMMANDS && (O3(e3), l3(n3)), u3.type & _.HORIZ_LINE_TO && O3(u3.x), u3.type & _.VERT_LINE_TO && l3(u3.y), u3.type & _.LINE_TO && (O3(u3.x), l3(u3.y)), u3.type & _.CURVE_TO) {
                    O3(u3.x), l3(u3.y);
                    for(var T2 = 0, v2 = p(e3, u3.x1, u3.x2, u3.x); T2 < v2.length; T2++){
                        0 < (w = v2[T2]) && 1 > w && O3(m(e3, u3.x1, u3.x2, u3.x, w));
                    }
                    for(var f2 = 0, N2 = p(n3, u3.y1, u3.y2, u3.y); f2 < N2.length; f2++){
                        0 < (w = N2[f2]) && 1 > w && l3(m(n3, u3.y1, u3.y2, u3.y, w));
                    }
                }
                if (u3.type & _.ARC) {
                    O3(u3.x), l3(u3.y), o(u3, e3, n3);
                    for(var x = u3.xRot / 180 * Math.PI, d = Math.cos(x) * u3.rX, E = Math.sin(x) * u3.rX, A = -Math.sin(x) * u3.rY, C = Math.cos(x) * u3.rY, M = u3.phi1 < u3.phi2 ? [
                        u3.phi1,
                        u3.phi2
                    ] : -180 > u3.phi2 ? [
                        u3.phi2 + 360,
                        u3.phi1 + 360
                    ] : [
                        u3.phi2,
                        u3.phi1
                    ], R = M[0], g = M[1], I = function I(t4) {
                        var r4 = t4[0], e4 = t4[1], i3 = 180 * Math.atan2(e4, r4) / Math.PI;
                        return i3 < R ? i3 + 360 : i3;
                    }, S = 0, L = s(A, -d, 0).map(I); S < L.length; S++){
                        (w = L[S]) > R && w < g && O3(y(u3.cX, d, A, w));
                    }
                    for(var H = 0, U = s(C, -E, 0).map(I); H < U.length; H++){
                        var w;
                        (w = U[H]) > R && w < g && l3(y(u3.cY, E, C, w));
                    }
                }
                return r3;
            });
            return c2.minX = 1 / 0, c2.maxX = -1 / 0, c2.minY = 1 / 0, c2.maxY = -1 / 0, c2;
        };
    }(u || (u = {}));
    var O;
    var l = function() {
        var t2 = function t2() {};
        return t2.prototype.round = function(t3) {
            return this.transform(u.ROUND(t3));
        }, t2.prototype.toAbs = function() {
            return this.transform(u.TO_ABS());
        }, t2.prototype.toRel = function() {
            return this.transform(u.TO_REL());
        }, t2.prototype.normalizeHVZ = function(t3, r2, e2) {
            return this.transform(u.NORMALIZE_HVZ(t3, r2, e2));
        }, t2.prototype.normalizeST = function() {
            return this.transform(u.NORMALIZE_ST());
        }, t2.prototype.qtToC = function() {
            return this.transform(u.QT_TO_C());
        }, t2.prototype.aToC = function() {
            return this.transform(u.A_TO_C());
        }, t2.prototype.sanitize = function(t3) {
            return this.transform(u.SANITIZE(t3));
        }, t2.prototype.translate = function(t3, r2) {
            return this.transform(u.TRANSLATE(t3, r2));
        }, t2.prototype.scale = function(t3, r2) {
            return this.transform(u.SCALE(t3, r2));
        }, t2.prototype.rotate = function(t3, r2, e2) {
            return this.transform(u.ROTATE(t3, r2, e2));
        }, t2.prototype.matrix = function(t3, r2, e2, i2, a2, n2) {
            return this.transform(u.MATRIX(t3, r2, e2, i2, a2, n2));
        }, t2.prototype.skewX = function(t3) {
            return this.transform(u.SKEW_X(t3));
        }, t2.prototype.skewY = function(t3) {
            return this.transform(u.SKEW_Y(t3));
        }, t2.prototype.xSymmetry = function(t3) {
            return this.transform(u.X_AXIS_SYMMETRY(t3));
        }, t2.prototype.ySymmetry = function(t3) {
            return this.transform(u.Y_AXIS_SYMMETRY(t3));
        }, t2.prototype.annotateArcs = function() {
            return this.transform(u.ANNOTATE_ARCS());
        }, t2;
    }();
    var T = function T(t2) {
        return " " === t2 || "	" === t2 || "\r" === t2 || "\n" === t2;
    };
    var v = function v(t2) {
        return "0".charCodeAt(0) <= t2.charCodeAt(0) && t2.charCodeAt(0) <= "9".charCodeAt(0);
    };
    var f = function(t2) {
        var e2 = function e2() {
            var r2 = t2.call(this) || this;
            return r2.curNumber = "", r2.curCommandType = -1, r2.curCommandRelative = false, r2.canParseCommandOrComma = true, r2.curNumberHasExp = false, r2.curNumberHasExpDigits = false, r2.curNumberHasDecimal = false, r2.curArgs = [], r2;
        };
        return r(e2, t2), e2.prototype.finish = function(t3) {
            if (void 0 === t3 && (t3 = []), this.parse(" ", t3), 0 !== this.curArgs.length || !this.canParseCommandOrComma) throw new SyntaxError("Unterminated command at the path end.");
            return t3;
        }, e2.prototype.parse = function(t3, r2) {
            var e3 = this;
            void 0 === r2 && (r2 = []);
            for(var i2 = function i2(t4) {
                r2.push(t4), e3.curArgs.length = 0, e3.canParseCommandOrComma = true;
            }, a2 = 0; a2 < t3.length; a2++){
                var n2 = t3[a2], o2 = !(this.curCommandType !== _.ARC || 3 !== this.curArgs.length && 4 !== this.curArgs.length || 1 !== this.curNumber.length || "0" !== this.curNumber && "1" !== this.curNumber), s2 = v(n2) && ("0" === this.curNumber && "0" === n2 || o2);
                if (!v(n2) || s2) if ("e" !== n2 && "E" !== n2) if ("-" !== n2 && "+" !== n2 || !this.curNumberHasExp || this.curNumberHasExpDigits) if ("." !== n2 || this.curNumberHasExp || this.curNumberHasDecimal || o2) {
                    if (this.curNumber && -1 !== this.curCommandType) {
                        var u2 = Number(this.curNumber);
                        if (isNaN(u2)) throw new SyntaxError("Invalid number ending at " + a2);
                        if (this.curCommandType === _.ARC) {
                            if (0 === this.curArgs.length || 1 === this.curArgs.length) {
                                if (0 > u2) throw new SyntaxError('Expected positive number, got "' + u2 + '" at index "' + a2 + '"');
                            } else if ((3 === this.curArgs.length || 4 === this.curArgs.length) && "0" !== this.curNumber && "1" !== this.curNumber) throw new SyntaxError('Expected a flag, got "' + this.curNumber + '" at index "' + a2 + '"');
                        }
                        this.curArgs.push(u2), this.curArgs.length === N[this.curCommandType] && (_.HORIZ_LINE_TO === this.curCommandType ? i2({
                            type: _.HORIZ_LINE_TO,
                            relative: this.curCommandRelative,
                            x: u2
                        }) : _.VERT_LINE_TO === this.curCommandType ? i2({
                            type: _.VERT_LINE_TO,
                            relative: this.curCommandRelative,
                            y: u2
                        }) : this.curCommandType === _.MOVE_TO || this.curCommandType === _.LINE_TO || this.curCommandType === _.SMOOTH_QUAD_TO ? (i2({
                            type: this.curCommandType,
                            relative: this.curCommandRelative,
                            x: this.curArgs[0],
                            y: this.curArgs[1]
                        }), _.MOVE_TO === this.curCommandType && (this.curCommandType = _.LINE_TO)) : this.curCommandType === _.CURVE_TO ? i2({
                            type: _.CURVE_TO,
                            relative: this.curCommandRelative,
                            x1: this.curArgs[0],
                            y1: this.curArgs[1],
                            x2: this.curArgs[2],
                            y2: this.curArgs[3],
                            x: this.curArgs[4],
                            y: this.curArgs[5]
                        }) : this.curCommandType === _.SMOOTH_CURVE_TO ? i2({
                            type: _.SMOOTH_CURVE_TO,
                            relative: this.curCommandRelative,
                            x2: this.curArgs[0],
                            y2: this.curArgs[1],
                            x: this.curArgs[2],
                            y: this.curArgs[3]
                        }) : this.curCommandType === _.QUAD_TO ? i2({
                            type: _.QUAD_TO,
                            relative: this.curCommandRelative,
                            x1: this.curArgs[0],
                            y1: this.curArgs[1],
                            x: this.curArgs[2],
                            y: this.curArgs[3]
                        }) : this.curCommandType === _.ARC && i2({
                            type: _.ARC,
                            relative: this.curCommandRelative,
                            rX: this.curArgs[0],
                            rY: this.curArgs[1],
                            xRot: this.curArgs[2],
                            lArcFlag: this.curArgs[3],
                            sweepFlag: this.curArgs[4],
                            x: this.curArgs[5],
                            y: this.curArgs[6]
                        })), this.curNumber = "", this.curNumberHasExpDigits = false, this.curNumberHasExp = false, this.curNumberHasDecimal = false, this.canParseCommandOrComma = true;
                    }
                    if (!T(n2)) if ("," === n2 && this.canParseCommandOrComma) this.canParseCommandOrComma = false;
                    else if ("+" !== n2 && "-" !== n2 && "." !== n2) if (s2) this.curNumber = n2, this.curNumberHasDecimal = false;
                    else {
                        if (0 !== this.curArgs.length) throw new SyntaxError("Unterminated command at index " + a2 + ".");
                        if (!this.canParseCommandOrComma) throw new SyntaxError('Unexpected character "' + n2 + '" at index ' + a2 + ". Command cannot follow comma");
                        if (this.canParseCommandOrComma = false, "z" !== n2 && "Z" !== n2) if ("h" === n2 || "H" === n2) this.curCommandType = _.HORIZ_LINE_TO, this.curCommandRelative = "h" === n2;
                        else if ("v" === n2 || "V" === n2) this.curCommandType = _.VERT_LINE_TO, this.curCommandRelative = "v" === n2;
                        else if ("m" === n2 || "M" === n2) this.curCommandType = _.MOVE_TO, this.curCommandRelative = "m" === n2;
                        else if ("l" === n2 || "L" === n2) this.curCommandType = _.LINE_TO, this.curCommandRelative = "l" === n2;
                        else if ("c" === n2 || "C" === n2) this.curCommandType = _.CURVE_TO, this.curCommandRelative = "c" === n2;
                        else if ("s" === n2 || "S" === n2) this.curCommandType = _.SMOOTH_CURVE_TO, this.curCommandRelative = "s" === n2;
                        else if ("q" === n2 || "Q" === n2) this.curCommandType = _.QUAD_TO, this.curCommandRelative = "q" === n2;
                        else if ("t" === n2 || "T" === n2) this.curCommandType = _.SMOOTH_QUAD_TO, this.curCommandRelative = "t" === n2;
                        else {
                            if ("a" !== n2 && "A" !== n2) throw new SyntaxError('Unexpected character "' + n2 + '" at index ' + a2 + ".");
                            this.curCommandType = _.ARC, this.curCommandRelative = "a" === n2;
                        }
                        else r2.push({
                            type: _.CLOSE_PATH
                        }), this.canParseCommandOrComma = true, this.curCommandType = -1;
                    }
                    else this.curNumber = n2, this.curNumberHasDecimal = "." === n2;
                } else this.curNumber += n2, this.curNumberHasDecimal = true;
                else this.curNumber += n2;
                else this.curNumber += n2, this.curNumberHasExp = true;
                else this.curNumber += n2, this.curNumberHasExpDigits = this.curNumberHasExp;
            }
            return r2;
        }, e2.prototype.transform = function(t3) {
            return Object.create(this, {
                parse: {
                    value: function value(r2, e3) {
                        void 0 === e3 && (e3 = []);
                        for(var i2 = 0, a2 = Object.getPrototypeOf(this).parse.call(this, r2); i2 < a2.length; i2++){
                            var n2 = a2[i2], o2 = t3(n2);
                            Array.isArray(o2) ? e3.push.apply(e3, o2) : e3.push(o2);
                        }
                        return e3;
                    }
                }
            });
        }, e2;
    }(l);
    var _ = function(t2) {
        function i2(r2) {
            var e2 = t2.call(this) || this;
            return e2.commands = "string" == typeof r2 ? i2.parse(r2) : r2, e2;
        }
        return r(i2, t2), i2.prototype.encode = function() {
            return i2.encode(this.commands);
        }, i2.prototype.getBounds = function() {
            var t3 = u.CALCULATE_BOUNDS();
            return this.transform(t3), t3;
        }, i2.prototype.transform = function(t3) {
            for(var r2 = [], e2 = 0, i3 = this.commands; e2 < i3.length; e2++){
                var a2 = t3(i3[e2]);
                Array.isArray(a2) ? r2.push.apply(r2, a2) : r2.push(a2);
            }
            return this.commands = r2, this;
        }, i2.encode = function(t3) {
            return e(t3);
        }, i2.parse = function(t3) {
            var r2 = new f(), e2 = [];
            return r2.parse(t3, e2), r2.finish(e2), e2;
        }, i2.CLOSE_PATH = 1, i2.MOVE_TO = 2, i2.HORIZ_LINE_TO = 4, i2.VERT_LINE_TO = 8, i2.LINE_TO = 16, i2.CURVE_TO = 32, i2.SMOOTH_CURVE_TO = 64, i2.QUAD_TO = 128, i2.SMOOTH_QUAD_TO = 256, i2.ARC = 512, i2.LINE_COMMANDS = i2.LINE_TO | i2.HORIZ_LINE_TO | i2.VERT_LINE_TO, i2.DRAWING_COMMANDS = i2.HORIZ_LINE_TO | i2.VERT_LINE_TO | i2.LINE_TO | i2.CURVE_TO | i2.SMOOTH_CURVE_TO | i2.QUAD_TO | i2.SMOOTH_QUAD_TO | i2.ARC, i2;
    }(l);
    var N = ((O = {})[_.MOVE_TO] = 2, O[_.LINE_TO] = 2, O[_.HORIZ_LINE_TO] = 1, O[_.VERT_LINE_TO] = 1, O[_.CLOSE_PATH] = 0, O[_.QUAD_TO] = 4, O[_.SMOOTH_QUAD_TO] = 2, O[_.CURVE_TO] = 6, O[_.SMOOTH_CURVE_TO] = 4, O[_.ARC] = 7, O);
    // ../svg-to-swiftui-core/src/elementHandlers/pathElementHandler/moveToGenerator.ts
    var generateMoveToSwift = function(data, options) {
        var xy = stringifyRectValues({
            x: data.x / options.viewBox.width,
            y: data.y / options.viewBox.height
        }, options.precision);
        var new_x = clampNormalisedSizeProduct(xy.x, "width");
        var new_y = clampNormalisedSizeProduct(xy.y, "height");
        return [
            "path.move(to: CGPoint(x: ".concat(new_x, ", y: ").concat(new_y, "))")
        ];
    };
    // ../svg-to-swiftui-core/src/elementHandlers/pathElementHandler/lineToGenerator.ts
    var generateLineToSwift = function(data, options) {
        var xy = stringifyRectValues({
            x: data.x / options.viewBox.width,
            y: data.y / options.viewBox.height
        }, options.precision);
        var new_x = clampNormalisedSizeProduct(xy.x, "width");
        var new_y = clampNormalisedSizeProduct(xy.y, "height");
        return [
            "path.addLine(to: CGPoint(x: ".concat(new_x, ", y: ").concat(new_y, "))")
        ];
    };
    // ../svg-to-swiftui-core/src/elementHandlers/pathElementHandler/closePathGenerator.ts
    var generateClosePathSwift = function(_data, _options) {
        return [
            "path.closeSubpath()"
        ];
    };
    // ../svg-to-swiftui-core/src/elementHandlers/pathElementHandler/cubicCurveGenerator.ts
    var generateCubicCurveSwift = function(data, options) {
        var xy1 = stringifyRectValues({
            x: data.x1 / options.viewBox.width,
            y: data.y1 / options.viewBox.height
        }, options.precision);
        var xy2 = stringifyRectValues({
            x: data.x2 / options.viewBox.width,
            y: data.y2 / options.viewBox.height
        }, options.precision);
        var xy = stringifyRectValues({
            x: data.x / options.viewBox.width,
            y: data.y / options.viewBox.height
        }, options.precision);
        var p1x_str = clampNormalisedSizeProduct(xy.x, "width");
        var p1y_str = clampNormalisedSizeProduct(xy.y, "height");
        var p2x_str = clampNormalisedSizeProduct(xy1.x, "width");
        var p2y_str = clampNormalisedSizeProduct(xy1.y, "height");
        var p3x_str = clampNormalisedSizeProduct(xy2.x, "width");
        var p3y_str = clampNormalisedSizeProduct(xy2.y, "height");
        var swiftString = [
            "path.addCurve(to: CGPoint(x: ".concat(p1x_str, ", y: ").concat(p1y_str, "),"),
            "control1: CGPoint(x: ".concat(p2x_str, ", y: ").concat(p2y_str, "),"),
            "control2: CGPoint(x: ".concat(p3x_str, ", y: ").concat(p3y_str, "))")
        ].join(" ");
        return [
            swiftString
        ];
    };
    // ../svg-to-swiftui-core/src/elementHandlers/pathElementHandler/quadCurveGenerator.ts
    var generateQuadCurveSwift = function(data, options) {
        var xy = stringifyRectValues({
            x: data.x / options.viewBox.width,
            y: data.y / options.viewBox.height
        }, options.precision);
        var xy1 = stringifyRectValues({
            x: data.x1 / options.viewBox.width,
            y: data.y1 / options.viewBox.height
        }, options.precision);
        var x_str = clampNormalisedSizeProduct(xy.x, "width");
        var y_str = clampNormalisedSizeProduct(xy.y, "height");
        var x1_str = clampNormalisedSizeProduct(xy1.x, "width");
        var y1_str = clampNormalisedSizeProduct(xy1.y, "height");
        var swiftString = [
            "path.addQuadCurve(to: CGPoint(x: ".concat(x_str, ", y: ").concat(y_str, "),"),
            "control1: CGPoint(x: ".concat(x1_str, ", y: ").concat(y1_str, "))")
        ].join(" ");
        return [
            swiftString
        ];
    };
    var convertPathToSwift = function(data, options) {
        var swiftAccumulator = [];
        for(var i2 = 0; i2 < data.length; i2++){
            var el = data[i2];
            switch(el.type){
                case _.MOVE_TO:
                    {
                        var _swiftAccumulator;
                        var type = el.type, relative = el.relative, d = _objectWithoutProperties(el, [
                            "type",
                            "relative"
                        ]);
                        (_swiftAccumulator = swiftAccumulator).push.apply(_swiftAccumulator, _toConsumableArray(generateMoveToSwift(d, options)));
                        break;
                    }
                case _.LINE_TO:
                    {
                        var _swiftAccumulator1;
                        var type1 = el.type, relative1 = el.relative, d1 = _objectWithoutProperties(el, [
                            "type",
                            "relative"
                        ]);
                        (_swiftAccumulator1 = swiftAccumulator).push.apply(_swiftAccumulator1, _toConsumableArray(generateLineToSwift(d1, options)));
                        break;
                    }
                case _.HORIZ_LINE_TO:
                    {
                        var _swiftAccumulator2;
                        var type2 = el.type, relative2 = el.relative, d2 = _objectWithoutProperties(el, [
                            "type",
                            "relative"
                        ]);
                        var y2 = 0;
                        for(var li = i2 - 1; li >= 0; li--){
                            var prevElement = data[li];
                            if (prevElement.type === _.MOVE_TO || prevElement.type === _.LINE_TO || prevElement.type === _.VERT_LINE_TO || prevElement.type === _.CURVE_TO || prevElement.type === _.SMOOTH_CURVE_TO || prevElement.type === _.QUAD_TO || prevElement.type === _.SMOOTH_QUAD_TO) {
                                y2 = prevElement.y;
                                break;
                            } else if (prevElement.type === _.HORIZ_LINE_TO) {
                                continue;
                            } else {
                                break;
                            }
                        }
                        (_swiftAccumulator2 = swiftAccumulator).push.apply(_swiftAccumulator2, _toConsumableArray(generateLineToSwift({
                            x: d2.x,
                            y: y2
                        }, options)));
                        break;
                    }
                case _.VERT_LINE_TO:
                    {
                        var _swiftAccumulator3;
                        var type3 = el.type, relative3 = el.relative, d3 = _objectWithoutProperties(el, [
                            "type",
                            "relative"
                        ]);
                        var x = 0;
                        for(var li1 = i2 - 1; li1 >= 0; li1--){
                            var prevElement1 = data[li1];
                            if (prevElement1.type === _.MOVE_TO || prevElement1.type === _.LINE_TO || prevElement1.type === _.HORIZ_LINE_TO || prevElement1.type === _.CURVE_TO || prevElement1.type === _.SMOOTH_CURVE_TO || prevElement1.type === _.QUAD_TO || prevElement1.type === _.SMOOTH_QUAD_TO) {
                                x = prevElement1.x;
                                break;
                            } else if (prevElement1.type === _.VERT_LINE_TO) {
                                continue;
                            } else {
                                break;
                            }
                        }
                        (_swiftAccumulator3 = swiftAccumulator).push.apply(_swiftAccumulator3, _toConsumableArray(generateLineToSwift({
                            x: x,
                            y: d3.y
                        }, options)));
                        break;
                    }
                case _.CLOSE_PATH:
                    {
                        var _swiftAccumulator4;
                        (_swiftAccumulator4 = swiftAccumulator).push.apply(_swiftAccumulator4, _toConsumableArray(generateClosePathSwift(null, options)));
                        break;
                    }
                case _.QUAD_TO:
                    {
                        var _swiftAccumulator5;
                        var type4 = el.type, relative4 = el.relative, d4 = _objectWithoutProperties(el, [
                            "type",
                            "relative"
                        ]);
                        (_swiftAccumulator5 = swiftAccumulator).push.apply(_swiftAccumulator5, _toConsumableArray(generateQuadCurveSwift(d4, options)));
                        break;
                    }
                case _.SMOOTH_QUAD_TO:
                    {
                        var _swiftAccumulator6;
                        var type5 = el.type, relative5 = el.relative, d5 = _objectWithoutProperties(el, [
                            "type",
                            "relative"
                        ]);
                        var prevElement2 = data[i2 - 1];
                        var x1 = d5.x;
                        var y1 = d5.y;
                        if (prevElement2.type === _.QUAD_TO) {
                            x1 = prevElement2.x + (prevElement2.x - prevElement2.x1);
                            y1 = prevElement2.y + (prevElement2.y - prevElement2.y1);
                        }
                        (_swiftAccumulator6 = swiftAccumulator).push.apply(_swiftAccumulator6, _toConsumableArray(generateQuadCurveSwift(_objectSpreadProps(_objectSpread({}, d5), {
                            x1: x1,
                            y1: y1
                        }), options)));
                        break;
                    }
                case _.CURVE_TO:
                    {
                        var _swiftAccumulator7;
                        var type6 = el.type, relative6 = el.relative, d6 = _objectWithoutProperties(el, [
                            "type",
                            "relative"
                        ]);
                        (_swiftAccumulator7 = swiftAccumulator).push.apply(_swiftAccumulator7, _toConsumableArray(generateCubicCurveSwift(d6, options)));
                        break;
                    }
                case _.SMOOTH_CURVE_TO:
                    {
                        var _swiftAccumulator8;
                        var type7 = el.type, relative7 = el.relative, d7 = _objectWithoutProperties(el, [
                            "type",
                            "relative"
                        ]);
                        var prevElement3 = data[i2 - 1];
                        var x11 = d7.x;
                        var y11 = d7.y;
                        if (prevElement3.type === _.CURVE_TO || prevElement3.type === _.SMOOTH_CURVE_TO) {
                            x11 = prevElement3.x + (prevElement3.x - prevElement3.x2);
                            y11 = prevElement3.y + (prevElement3.y - prevElement3.y2);
                        }
                        var swiftLines = generateCubicCurveSwift(_objectSpreadProps(_objectSpread({}, d7), {
                            x1: x11,
                            y1: y11
                        }), options);
                        (_swiftAccumulator8 = swiftAccumulator).push.apply(_swiftAccumulator8, _toConsumableArray(swiftLines));
                        break;
                    }
                case _.ARC:
                    {
                        var type8 = el.type, relative8 = el.relative, d8 = _objectWithoutProperties(el, [
                            "type",
                            "relative"
                        ]);
                        console.error("Arc is not supported yet");
                        break;
                    }
            }
        }
        return swiftAccumulator;
    };
    // ../svg-to-swiftui-core/src/constants.ts
    var DEFAULT_CONFIG = {
        structName: "MyCustomShape",
        precision: 8,
        indentationSize: 4
    };
    // src/index.ts
    if (figma.editorType === "dev" && figma.mode === "codegen") {
        figma.codegen.on("generate", function(param) {
            var node = param.node;
            var _node_absoluteBoundingBox, _node_absoluteBoundingBox1, _node_absoluteBoundingBox2, _node_absoluteBoundingBox3;
            if (!node || (node === null || node === void 0 ? void 0 : node.type) !== "VECTOR") {
                return [
                    {
                        title: "SwiftUI Shape",
                        language: "SWIFT",
                        code: "// Please select a vector element and then enter the DEV mode."
                    }
                ];
            }
            var vbx = (_node_absoluteBoundingBox = node.absoluteBoundingBox) === null || _node_absoluteBoundingBox === void 0 ? void 0 : _node_absoluteBoundingBox.x;
            var vby = (_node_absoluteBoundingBox1 = node.absoluteBoundingBox) === null || _node_absoluteBoundingBox1 === void 0 ? void 0 : _node_absoluteBoundingBox1.y;
            var vbWidth = (_node_absoluteBoundingBox2 = node.absoluteBoundingBox) === null || _node_absoluteBoundingBox2 === void 0 ? void 0 : _node_absoluteBoundingBox2.width;
            var vbHeight = (_node_absoluteBoundingBox3 = node.absoluteBoundingBox) === null || _node_absoluteBoundingBox3 === void 0 ? void 0 : _node_absoluteBoundingBox3.height;
            var viewBox = [
                vbx,
                vby,
                vbWidth,
                vbHeight
            ].join(" ");
            var justPaths = node.vectorPaths.map(function(path) {
                return path.data;
            });
            var SVG_TEMPLATE = '<svg viewBox="'.concat(viewBox, '" xmlns="http://www.w3.org/2000/svg">\n      ').concat(justPaths.map(function(p2) {
                return '<path d="'.concat(p2, '" />\n  ');
            }), "\n    </svg>");
            var swiftUI = convert(SVG_TEMPLATE, {
                structName: node.name.replace(/\s/g, "")
            });
            return [
                {
                    title: "SwiftUI Shape",
                    language: "SWIFT",
                    code: swiftUI
                }
            ];
        });
    }
})(); /*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */ 
