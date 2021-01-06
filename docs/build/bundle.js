
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.31.1' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function unwrapExports (x) {
    	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
    }

    function createCommonjsModule(fn, module) {
    	return module = { exports: {} }, fn(module, module.exports), module.exports;
    }

    var svgParser_umd = createCommonjsModule(function (module, exports) {
    (function (global, factory) {
         factory(exports) ;
    }(commonjsGlobal, (function (exports) {
        function getLocator(source, options) {
            if (options === void 0) { options = {}; }
            var offsetLine = options.offsetLine || 0;
            var offsetColumn = options.offsetColumn || 0;
            var originalLines = source.split('\n');
            var start = 0;
            var lineRanges = originalLines.map(function (line, i) {
                var end = start + line.length + 1;
                var range = { start: start, end: end, line: i };
                start = end;
                return range;
            });
            var i = 0;
            function rangeContains(range, index) {
                return range.start <= index && index < range.end;
            }
            function getLocation(range, index) {
                return { line: offsetLine + range.line, column: offsetColumn + index - range.start, character: index };
            }
            function locate(search, startIndex) {
                if (typeof search === 'string') {
                    search = source.indexOf(search, startIndex || 0);
                }
                var range = lineRanges[i];
                var d = search >= range.end ? 1 : -1;
                while (range) {
                    if (rangeContains(range, search))
                        return getLocation(range, search);
                    i += d;
                    range = lineRanges[i];
                }
            }
            return locate;
        }
        function locate(source, search, options) {
            if (typeof options === 'number') {
                throw new Error('locate takes a { startIndex, offsetLine, offsetColumn } object as the third argument');
            }
            return getLocator(source, options)(search, options && options.startIndex);
        }

        var validNameCharacters = /[a-zA-Z0-9:_-]/;
        var whitespace = /[\s\t\r\n]/;
        var quotemark = /['"]/;

        function repeat(str, i) {
        	var result = '';
        	while (i--) { result += str; }
        	return result;
        }

        function parse(source) {
        	var header = '';
        	var stack = [];

        	var state = metadata;
        	var currentElement = null;
        	var root = null;

        	function error(message) {
        		var ref = locate(source, i);
        		var line = ref.line;
        		var column = ref.column;
        		var before = source.slice(0, i);
        		var beforeLine = /(^|\n).*$/.exec(before)[0].replace(/\t/g, '  ');
        		var after = source.slice(i);
        		var afterLine = /.*(\n|$)/.exec(after)[0];

        		var snippet = "" + beforeLine + afterLine + "\n" + (repeat(' ', beforeLine.length)) + "^";

        		throw new Error(
        			(message + " (" + line + ":" + column + "). If this is valid SVG, it's probably a bug in svg-parser. Please raise an issue at https://github.com/Rich-Harris/svg-parser/issues – thanks!\n\n" + snippet)
        		);
        	}

        	function metadata() {
        		while ((i < source.length && source[i] !== '<') || !validNameCharacters.test(source[i + 1])) {
        			header += source[i++];
        		}

        		return neutral();
        	}

        	function neutral() {
        		var text = '';
        		while (i < source.length && source[i] !== '<') { text += source[i++]; }

        		if (/\S/.test(text)) {
        			currentElement.children.push({ type: 'text', value: text });
        		}

        		if (source[i] === '<') {
        			return tag;
        		}

        		return neutral;
        	}

        	function tag() {
        		var char = source[i];

        		if (char === '?') { return neutral; } // <?xml...

        		if (char === '!') {
        			if (source.slice(i + 1, i + 3) === '--') { return comment; }
        			if (source.slice(i + 1, i + 8) === '[CDATA[') { return cdata; }
        			if (/doctype/i.test(source.slice(i + 1, i + 8))) { return neutral; }
        		}

        		if (char === '/') { return closingTag; }

        		var tagName = getName();

        		var element = {
        			type: 'element',
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
        		while (i < source.length && (attribute = getAttribute())) {
        			element.properties[attribute.name] = attribute.value;
        		}

        		var selfClosing = false;

        		if (source[i] === '/') {
        			i += 1;
        			selfClosing = true;
        		}

        		if (source[i] !== '>') {
        			error('Expected >');
        		}

        		if (!selfClosing) {
        			currentElement = element;
        			stack.push(element);
        		}

        		return neutral;
        	}

        	function comment() {
        		var index = source.indexOf('-->', i);
        		if (!~index) { error('expected -->'); }

        		i = index + 2;
        		return neutral;
        	}

        	function cdata() {
        		var index = source.indexOf(']]>', i);
        		if (!~index) { error('expected ]]>'); }

        		currentElement.children.push(source.slice(i + 7, index));

        		i = index + 2;
        		return neutral;
        	}

        	function closingTag() {
        		var tagName = getName();

        		if (!tagName) { error('Expected tag name'); }

        		if (tagName !== currentElement.tagName) {
        			error(("Expected closing tag </" + tagName + "> to match opening tag <" + (currentElement.tagName) + ">"));
        		}

        		allowSpaces();

        		if (source[i] !== '>') {
        			error('Expected >');
        		}

        		stack.pop();
        		currentElement = stack[stack.length - 1];

        		return neutral;
        	}

        	function getName() {
        		var name = '';
        		while (i < source.length && validNameCharacters.test(source[i])) { name += source[i++]; }

        		return name;
        	}

        	function getAttribute() {
        		if (!whitespace.test(source[i])) { return null; }
        		allowSpaces();

        		var name = getName();
        		if (!name) { return null; }

        		var value = true;

        		allowSpaces();
        		if (source[i] === '=') {
        			i += 1;
        			allowSpaces();

        			value = getAttributeValue();
        			if (!isNaN(value) && value.trim() !== '') { value = +value; } // TODO whitelist numeric attributes?
        		}

        		return { name: name, value: value };
        	}

        	function getAttributeValue() {
        		return quotemark.test(source[i]) ? getQuotedAttributeValue() : getUnquotedAttributeValue();
        	}

        	function getUnquotedAttributeValue() {
        		var value = '';
        		do {
        			var char = source[i];
        			if (char === ' ' || char === '>' || char === '/') {
        				return value;
        			}

        			value += char;
        			i += 1;
        		} while (i < source.length);

        		return value;
        	}

        	function getQuotedAttributeValue() {
        		var quotemark = source[i++];

        		var value = '';
        		var escaped = false;

        		while (i < source.length) {
        			var char = source[i++];
        			if (char === quotemark && !escaped) {
        				return value;
        			}

        			if (char === '\\' && !escaped) {
        				escaped = true;
        			}

        			value += escaped ? ("\\" + char) : char;
        			escaped = false;
        		}
        	}

        	function allowSpaces() {
        		while (i < source.length && whitespace.test(source[i])) { i += 1; }
        	}

        	var i = metadata.length;
        	while (i < source.length) {
        		if (!state) { error('Unexpected character'); }
        		state = state();
        		i += 1;
        	}

        	if (state !== neutral) {
        		error('Unexpected end of input');
        	}

        	if (root.tagName === 'svg') { root.metadata = header; }
        	return {
        		type: 'root',
        		children: [root]
        	};
        }

        exports.parse = parse;

        Object.defineProperty(exports, '__esModule', { value: true });

    })));
    //# sourceMappingURL=svg-parser.umd.js.map
    });

    unwrapExports(svgParser_umd);

    var stubs = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.generateSwiftUIShape = void 0;
    const generateSwiftUIShape = (body, config) => {
        const indStr = new Array(config.indentationSize).fill(' ').join('');
        const getInd = (indLevel) => new Array(indLevel).fill(indStr).join('');
        const indentedBody = `${getInd(2)}${body.join(`\n${getInd(2)}`)}`;
        return [
            `struct ${config.structName}: Shape {`,
            `${getInd(1)}func path(in rect: CGRect) -> Path {`,
            `${getInd(2)}var path = Path()`,
            `${getInd(2)}let width = rect.size.width`,
            `${getInd(2)}let height = rect.size.height`,
            indentedBody,
            `${getInd(2)}return path`,
            `${getInd(1)}}`,
            '}',
        ].join('\n');
    };
    exports.generateSwiftUIShape = generateSwiftUIShape;
    //# sourceMappingURL=stubs.js.map
    });

    unwrapExports(stubs);
    var stubs_1 = stubs.generateSwiftUIShape;

    var utils = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.stringifyRectValues = exports.normaliseRectValues = exports.clampNormalisedSizeProduct = exports.getSVGElement = exports.extractSVGProperties = exports.convertToPixels = void 0;
    /**
     * Converts number with unit suffix to pixels.
     * @param number Number with the unit as a string.
     */
    function convertToPixels(num) {
        // If number is provided, just return that number.
        if (typeof num === 'number')
            return num;
        // If the value is a string, handle the conversion.
        const unit = String(num).substr(-2, 2);
        if (unit.search(/^[a-z]{2}$/i) !== -1) {
            switch (unit) {
                case 'em':
                    // TODO: Convert correctly from em.
                    return parseFloat(num);
                case 'ex':
                    // TODO: Convert correctly from ex.
                    return parseFloat(num);
                case 'px':
                    return parseFloat(num);
                case 'pt':
                    // TODO: Convert correctly from pt.
                    return parseFloat(num);
                case 'pc':
                    // TODO: Convert correctly from pc.
                    return parseFloat(num);
                case 'cm':
                    // TODO: Convert correctly from cm.
                    return parseFloat(num);
                case 'mm':
                    // TODO: Convert correctly from mm.
                    return parseFloat(num);
                case 'in':
                    // TODO: Convert correctly from in.
                    return parseFloat(num);
                default:
                    return parseFloat(num);
            }
        }
        else {
            return parseFloat(num);
        }
    }
    exports.convertToPixels = convertToPixels;
    /**
     * Extracts properties of the <svg> node.
     * @param svgJsonTree
     */
    function extractSVGProperties(svg) {
        var _a, _b, _c;
        // Extract needed properties.
        const viewBox = (_a = svg.properties) === null || _a === void 0 ? void 0 : _a.viewBox;
        const width = (_b = svg.properties) === null || _b === void 0 ? void 0 : _b.width;
        const height = (_c = svg.properties) === null || _c === void 0 ? void 0 : _c.height;
        // Throw if required properties are not provided.
        const sizeProvided = width && height;
        const viewBoxProvided = !!viewBox;
        if (!sizeProvided && !viewBoxProvided) {
            throw new Error('Width and height or viewBox must be provided on <svg> element!');
        }
        // Validiate and parse view box.
        const viewBoxElements = String(viewBox)
            .split(' ')
            .map(n => parseFloat(n));
        const [vbx, vby, vbWidth, vbHeight] = viewBoxElements;
        const viewBoxValid = viewBoxElements.every(value => !isNaN(value));
        // Parse width and height with units.
        const widthUnit = convertToPixels(width || vbWidth);
        const heightUnit = convertToPixels(height || vbHeight);
        return {
            width: widthUnit,
            height: heightUnit,
            viewBox: viewBoxValid
                ? { x: vbx, y: vby, width: vbWidth, height: vbHeight } // If view box is provided, use this.
                : { x: 0, y: 0, width: widthUnit, height: heightUnit },
        };
    }
    exports.extractSVGProperties = extractSVGProperties;
    /**
     * Performs Breadth First Search (BFS) to find <svg> element
     * @param rootNode Root node of given by SVG Parser
     */
    function getSVGElement(rootNode) {
        const frontier = [rootNode];
        // Run while there are nodes in the frontier
        while (frontier.length > 0) {
            // Get the first node so there is a FIFO queue.
            const currentNode = frontier.shift();
            // Ignore undefined and string nodes.
            if (currentNode && typeof currentNode !== 'string') {
                if (currentNode.type === 'root') {
                    // Only need children from the root node, so add them
                    // to frontier and continue.
                    frontier.push(...currentNode.children);
                    continue;
                }
                else if (currentNode.type === 'element') {
                    // If the element node is the svg element, return it.
                    if (currentNode.tagName === 'svg')
                        return currentNode;
                    // Otherwise push children to the frontier and continue.
                    frontier.push(...currentNode.children);
                    continue;
                }
                else {
                    continue;
                }
            }
        }
        return undefined;
    }
    exports.getSVGElement = getSVGElement;
    /**
     * This function is used to cleanup expression like this: `0.5*width`.
     * If the expression is `1*width` there is no reason to multiply it by
     * 1, so we can just leave `width`. If the expression is `0*width`
     * then there is no reason to keep `width` around, so it just becomes
     * `0`.
     * @param value Numberic value.
     * @param suffix Variable suffix that is appended to the end (width,
     * height, etc.)
     */
    function clampNormalisedSizeProduct(value, suffix) {
        if (parseFloat(value) === 1) {
            return suffix;
        }
        else if (parseFloat(value) === 0) {
            return '0';
        }
        else {
            return `${value}*${suffix}`;
        }
    }
    exports.clampNormalisedSizeProduct = clampNormalisedSizeProduct;
    /**
     * Normalises the position and size of the provided rectangle to span
     * from 0 to 1 based on the viewBox of the <svg> element. Width and
     * height are optional, so if only the position is required, then you
     * can just provide the x and y values.
     * @param rect ViewBox-like object with width and height being optional.
     * @param viewBox View box of the SVG Element.
     */
    function normaliseRectValues(rect, viewBox) {
        if (rect.width && rect.height) {
            return {
                x: rect.x / viewBox.width,
                y: rect.y / viewBox.height,
                width: rect.width / viewBox.width,
                height: rect.height / viewBox.height,
            };
        }
        else {
            return {
                x: rect.x / viewBox.width,
                y: rect.y / viewBox.height,
            };
        }
    }
    exports.normaliseRectValues = normaliseRectValues;
    function stringifyRectValues(rect, precision) {
        // Function to convert all numbers the same way.
        const toFixed = (value) => {
            return value.toFixed(precision).replace(/0+$/, '');
        };
        if (!rect.width || !rect.height) {
            return {
                x: toFixed(rect.x),
                y: toFixed(rect.y),
            };
        }
        else {
            return {
                x: toFixed(rect.x),
                y: toFixed(rect.y),
                width: toFixed(rect.width),
                height: toFixed(rect.height),
            };
        }
    }
    exports.stringifyRectValues = stringifyRectValues;
    //# sourceMappingURL=utils.js.map
    });

    unwrapExports(utils);
    var utils_1 = utils.stringifyRectValues;
    var utils_2 = utils.normaliseRectValues;
    var utils_3 = utils.clampNormalisedSizeProduct;
    var utils_4 = utils.getSVGElement;
    var utils_5 = utils.extractSVGProperties;
    var utils_6 = utils.convertToPixels;

    var circleElementHandler = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });

    function handleCircleElement(element, options) {
        // TODO: Add styles support
        // const style = {
        //   ...options.parentStyle,
        //   ...extractStyle(element),
        // };
        const props = element.properties;
        if (props) {
            const circleProps = props;
            // Check if required properties are provided.
            if (!circleProps.cx || !circleProps.cy || !circleProps.r) {
                throw new Error('Circle element has to contain cx, cy, and r properties!');
            }
            // Parse numbers from the striings.
            const cx = parseFloat(circleProps.cx);
            const cy = parseFloat(circleProps.cy);
            const r = parseFloat(circleProps.r);
            // Convert center-radius to bounding box.
            const x = cx - r;
            const y = cy - r;
            const width = r * 2;
            const height = r * 2;
            // Normalise all values to be based on fraction of width/height.
            const normalisedRect = utils.normaliseRectValues({ x, y, width, height }, options.viewBox);
            // Stringify values to the fixed precision point.
            const SR = utils.stringifyRectValues(normalisedRect, options.precision);
            // Append the width and height multipliers after normalisation.
            const strX = utils.clampNormalisedSizeProduct(SR.x, 'width');
            const strY = utils.clampNormalisedSizeProduct(SR.y, 'height');
            const strWidth = utils.clampNormalisedSizeProduct(SR.width, 'width');
            const strHeight = utils.clampNormalisedSizeProduct(SR.height, 'height');
            // Generate SwiftUI string.
            const CGRect = `CGRect(x: ${strX}, y: ${strY}, width: ${strWidth}, height: ${strHeight})`;
            return [`path.addEllipse(in: ${CGRect})`];
        }
        else {
            throw new Error('Circle element has to some properties');
        }
    }
    exports.default = handleCircleElement;
    //# sourceMappingURL=circleElementHandler.js.map
    });

    unwrapExports(circleElementHandler);

    var styleUtils = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.StylePropertiesSet = exports.filterStyleProps = exports.parseStyle = exports.extractStyle = void 0;
    /**
     * Extracts
     * @param element Element node which
     * @param options
     */
    function extractStyle(element) {
        const props = element.properties;
        if (props) {
            if (typeof props.style === 'string') {
                return parseStyle(props.style);
            }
            else {
                return filterStyleProps(props);
            }
        }
        else {
            throw new Error(`No properties found on ${element.tagName} node!`);
        }
    }
    exports.extractStyle = extractStyle;
    /**
     * Converts style property value into a map where key is
     * the style rule and value is the value of that rule.
     * @param style Style property string.
     */
    function parseStyle(style) {
        const styleProperties = {};
        // Extract style statements into array of strings.
        const styleArray = style
            .replace(/\s/g, '')
            .split(';')
            .map(el => {
            const [property, value] = el.split(':');
            return { property, value };
        });
        // Remap array of {property, value} objects into a map.
        for (const el of styleArray) {
            styleProperties[el.property] = el.value;
        }
        return styleProperties;
    }
    exports.parseStyle = parseStyle;
    /**
     * Filters out just the properties that are considered
     * style properties, i.e. `fill`, `color`, etc.
     * @param props Any properties from the HAST node.
     */
    function filterStyleProps(props) {
        return Object.keys(props)
            .filter(key => exports.StylePropertiesSet.has(key))
            .reduce((obj, key) => {
            obj[key] = props[key];
            return obj;
        }, {});
    }
    exports.filterStyleProps = filterStyleProps;
    exports.StylePropertiesSet = new Set([
        'alignment-baseline',
        'baseline-shift',
        'clip',
        'clip-path',
        'clip-rule',
        'color',
        'color-interpolation',
        'color-interpolation-filters',
        'color-profile',
        'color-rendering',
        'cursor',
        'direction',
        'display',
        'dominant-baseline',
        'enable-background',
        'fill',
        'fill-opacity',
        'fill-rule',
        'filter',
        'flood-color',
        'flood-opacity',
        'font-family',
        'font-size',
        'font-size-adjust',
        'font-stretch',
        'font-style',
        'font-variant',
        'font-weight',
        'glyph-orientation-horizontal',
        'glyph-orientation-vertical',
        'image-rendering',
        'kerning',
        'letter-spacing',
        'lighting-color',
        'marker-end',
        'marker-mid',
        'marker-start',
        'mask',
        'opacity',
        'overflow',
        'pointer-events',
        'shape-rendering',
        'solid-color',
        'solid-opacity',
        'stop-color',
        'stop-opacity',
        'stroke',
        'stroke-dasharray',
        'stroke-dashoffset',
        'stroke-linecap',
        'stroke-linejoin',
        'stroke-miterlimit',
        'stroke-opacity',
        'stroke-width',
        'text-anchor',
        'text-decoration',
        'text-rendering',
        'transform',
        'unicode-bidi',
        'vector-effect',
        'visibility',
        'word-spacing',
        'writing-mode',
    ]);
    //# sourceMappingURL=styleUtils.js.map
    });

    unwrapExports(styleUtils);
    var styleUtils_1 = styleUtils.StylePropertiesSet;
    var styleUtils_2 = styleUtils.filterStyleProps;
    var styleUtils_3 = styleUtils.parseStyle;
    var styleUtils_4 = styleUtils.extractStyle;

    var groupElementHandler = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });


    /**
     * Transforms SVG group element into SwiftUI Shape by
     * accumulating subcomands of the children.
     * @param element Group element node
     * @param options Transpiler options
     */
    function handleGroupElement(element, options) {
        const { children } = element;
        const style = element.type === 'element' ? styleUtils.extractStyle(element) : {};
        // For each child run the generator, accumulate swift string and return it.
        const acc = [];
        for (const child of children) {
            // TODO: Handle string children properly.
            if (typeof child === 'string')
                continue;
            // TODO: Handle TextNode children properly.
            if (child.type === 'text')
                continue;
            // Append result to the accumulator.
            acc.push(...elementHandlers.handleElement(child, {
                ...options,
                ...style,
            }));
        }
        return acc;
    }
    exports.default = handleGroupElement;
    //# sourceMappingURL=groupElementHandler.js.map
    });

    unwrapExports(groupElementHandler);

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation. All rights reserved.
    Licensed under the Apache License, Version 2.0 (the "License"); you may not use
    this file except in compliance with the License. You may obtain a copy of the
    License at http://www.apache.org/licenses/LICENSE-2.0

    THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
    WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
    MERCHANTABLITY OR NON-INFRINGEMENT.

    See the Apache Version 2.0 License for specific language governing permissions
    and limitations under the License.
    ***************************************************************************** */
    var t=function(r,e){return (t=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(t,r){t.__proto__=r;}||function(t,r){for(var e in r)r.hasOwnProperty(e)&&(t[e]=r[e]);})(r,e)};function r(r,e){function i(){this.constructor=r;}t(r,e),r.prototype=null===e?Object.create(e):(i.prototype=e.prototype,new i);}function e(t){var r="";Array.isArray(t)||(t=[t]);for(var e=0;e<t.length;e++){var i=t[e];if(i.type===f.CLOSE_PATH)r+="z";else if(i.type===f.HORIZ_LINE_TO)r+=(i.relative?"h":"H")+i.x;else if(i.type===f.VERT_LINE_TO)r+=(i.relative?"v":"V")+i.y;else if(i.type===f.MOVE_TO)r+=(i.relative?"m":"M")+i.x+" "+i.y;else if(i.type===f.LINE_TO)r+=(i.relative?"l":"L")+i.x+" "+i.y;else if(i.type===f.CURVE_TO)r+=(i.relative?"c":"C")+i.x1+" "+i.y1+" "+i.x2+" "+i.y2+" "+i.x+" "+i.y;else if(i.type===f.SMOOTH_CURVE_TO)r+=(i.relative?"s":"S")+i.x2+" "+i.y2+" "+i.x+" "+i.y;else if(i.type===f.QUAD_TO)r+=(i.relative?"q":"Q")+i.x1+" "+i.y1+" "+i.x+" "+i.y;else if(i.type===f.SMOOTH_QUAD_TO)r+=(i.relative?"t":"T")+i.x+" "+i.y;else {if(i.type!==f.ARC)throw new Error('Unexpected command type "'+i.type+'" at index '+e+".");r+=(i.relative?"a":"A")+i.rX+" "+i.rY+" "+i.xRot+" "+ +i.lArcFlag+" "+ +i.sweepFlag+" "+i.x+" "+i.y;}}return r}function i(t,r){var e=t[0],i=t[1];return [e*Math.cos(r)-i*Math.sin(r),e*Math.sin(r)+i*Math.cos(r)]}function a(){for(var t=[],r=0;r<arguments.length;r++)t[r]=arguments[r];for(var e=0;e<t.length;e++)if("number"!=typeof t[e])throw new Error("assertNumbers arguments["+e+"] is not a number. "+typeof t[e]+" == typeof "+t[e]);return !0}var n=Math.PI;function o(t,r,e){t.lArcFlag=0===t.lArcFlag?0:1,t.sweepFlag=0===t.sweepFlag?0:1;var a=t.rX,o=t.rY,s=t.x,u=t.y;a=Math.abs(t.rX),o=Math.abs(t.rY);var h=i([(r-s)/2,(e-u)/2],-t.xRot/180*n),c=h[0],y=h[1],p=Math.pow(c,2)/Math.pow(a,2)+Math.pow(y,2)/Math.pow(o,2);1<p&&(a*=Math.sqrt(p),o*=Math.sqrt(p)),t.rX=a,t.rY=o;var m=Math.pow(a,2)*Math.pow(y,2)+Math.pow(o,2)*Math.pow(c,2),O=(t.lArcFlag!==t.sweepFlag?1:-1)*Math.sqrt(Math.max(0,(Math.pow(a,2)*Math.pow(o,2)-m)/m)),T=a*y/o*O,v=-o*c/a*O,l=i([T,v],t.xRot/180*n);t.cX=l[0]+(r+s)/2,t.cY=l[1]+(e+u)/2,t.phi1=Math.atan2((y-v)/o,(c-T)/a),t.phi2=Math.atan2((-y-v)/o,(-c-T)/a),0===t.sweepFlag&&t.phi2>t.phi1&&(t.phi2-=2*n),1===t.sweepFlag&&t.phi2<t.phi1&&(t.phi2+=2*n),t.phi1*=180/n,t.phi2*=180/n;}function s(t,r,e){a(t,r,e);var i=t*t+r*r-e*e;if(0>i)return [];if(0===i)return [[t*e/(t*t+r*r),r*e/(t*t+r*r)]];var n=Math.sqrt(i);return [[(t*e+r*n)/(t*t+r*r),(r*e-t*n)/(t*t+r*r)],[(t*e-r*n)/(t*t+r*r),(r*e+t*n)/(t*t+r*r)]]}var u,h=Math.PI/180;function c(t,r,e){return (1-e)*t+e*r}function y(t,r,e,i){return t+Math.cos(i/180*n)*r+Math.sin(i/180*n)*e}function p(t,r,e,i){var a=r-t,n=e-r,o=3*a+3*(i-e)-6*n,s=6*(n-a),u=3*a;return Math.abs(o)<1e-6?[-u/s]:function(t,r,e){void 0===e&&(e=1e-6);var i=t*t/4-r;if(i<-e)return [];if(i<=e)return [-t/2];var a=Math.sqrt(i);return [-t/2-a,-t/2+a]}(s/o,u/o,1e-6)}function m(t,r,e,i,a){var n=1-a;return t*(n*n*n)+r*(3*n*n*a)+e*(3*n*a*a)+i*(a*a*a)}!function(t){function r(){return u((function(t,r,e){return t.relative&&(void 0!==t.x1&&(t.x1+=r),void 0!==t.y1&&(t.y1+=e),void 0!==t.x2&&(t.x2+=r),void 0!==t.y2&&(t.y2+=e),void 0!==t.x&&(t.x+=r),void 0!==t.y&&(t.y+=e),t.relative=!1),t}))}function e(){var t=NaN,r=NaN,e=NaN,i=NaN;return u((function(a,n,o){return a.type&f.SMOOTH_CURVE_TO&&(a.type=f.CURVE_TO,t=isNaN(t)?n:t,r=isNaN(r)?o:r,a.x1=a.relative?n-t:2*n-t,a.y1=a.relative?o-r:2*o-r),a.type&f.CURVE_TO?(t=a.relative?n+a.x2:a.x2,r=a.relative?o+a.y2:a.y2):(t=NaN,r=NaN),a.type&f.SMOOTH_QUAD_TO&&(a.type=f.QUAD_TO,e=isNaN(e)?n:e,i=isNaN(i)?o:i,a.x1=a.relative?n-e:2*n-e,a.y1=a.relative?o-i:2*o-i),a.type&f.QUAD_TO?(e=a.relative?n+a.x1:a.x1,i=a.relative?o+a.y1:a.y1):(e=NaN,i=NaN),a}))}function n(){var t=NaN,r=NaN;return u((function(e,i,a){if(e.type&f.SMOOTH_QUAD_TO&&(e.type=f.QUAD_TO,t=isNaN(t)?i:t,r=isNaN(r)?a:r,e.x1=e.relative?i-t:2*i-t,e.y1=e.relative?a-r:2*a-r),e.type&f.QUAD_TO){t=e.relative?i+e.x1:e.x1,r=e.relative?a+e.y1:e.y1;var n=e.x1,o=e.y1;e.type=f.CURVE_TO,e.x1=((e.relative?0:i)+2*n)/3,e.y1=((e.relative?0:a)+2*o)/3,e.x2=(e.x+2*n)/3,e.y2=(e.y+2*o)/3;}else t=NaN,r=NaN;return e}))}function u(t){var r=0,e=0,i=NaN,a=NaN;return function(n){if(isNaN(i)&&!(n.type&f.MOVE_TO))throw new Error("path must start with moveto");var o=t(n,r,e,i,a);return n.type&f.CLOSE_PATH&&(r=i,e=a),void 0!==n.x&&(r=n.relative?r+n.x:n.x),void 0!==n.y&&(e=n.relative?e+n.y:n.y),n.type&f.MOVE_TO&&(i=r,a=e),o}}function O(t,r,e,i,n,o){return a(t,r,e,i,n,o),u((function(a,s,u,h){var c=a.x1,y=a.x2,p=a.relative&&!isNaN(h),m=void 0!==a.x?a.x:p?0:s,O=void 0!==a.y?a.y:p?0:u;function T(t){return t*t}a.type&f.HORIZ_LINE_TO&&0!==r&&(a.type=f.LINE_TO,a.y=a.relative?0:u),a.type&f.VERT_LINE_TO&&0!==e&&(a.type=f.LINE_TO,a.x=a.relative?0:s),void 0!==a.x&&(a.x=a.x*t+O*e+(p?0:n)),void 0!==a.y&&(a.y=m*r+a.y*i+(p?0:o)),void 0!==a.x1&&(a.x1=a.x1*t+a.y1*e+(p?0:n)),void 0!==a.y1&&(a.y1=c*r+a.y1*i+(p?0:o)),void 0!==a.x2&&(a.x2=a.x2*t+a.y2*e+(p?0:n)),void 0!==a.y2&&(a.y2=y*r+a.y2*i+(p?0:o));var v=t*i-r*e;if(void 0!==a.xRot&&(1!==t||0!==r||0!==e||1!==i))if(0===v)delete a.rX,delete a.rY,delete a.xRot,delete a.lArcFlag,delete a.sweepFlag,a.type=f.LINE_TO;else {var l=a.xRot*Math.PI/180,_=Math.sin(l),N=Math.cos(l),x=1/T(a.rX),d=1/T(a.rY),A=T(N)*x+T(_)*d,E=2*_*N*(x-d),C=T(_)*x+T(N)*d,M=A*i*i-E*r*i+C*r*r,R=E*(t*i+r*e)-2*(A*e*i+C*t*r),g=A*e*e-E*t*e+C*t*t,I=(Math.atan2(R,M-g)+Math.PI)%Math.PI/2,S=Math.sin(I),L=Math.cos(I);a.rX=Math.abs(v)/Math.sqrt(M*T(L)+R*S*L+g*T(S)),a.rY=Math.abs(v)/Math.sqrt(M*T(S)-R*S*L+g*T(L)),a.xRot=180*I/Math.PI;}return void 0!==a.sweepFlag&&0>v&&(a.sweepFlag=+!a.sweepFlag),a}))}function T(){return function(t){var r={};for(var e in t)r[e]=t[e];return r}}t.ROUND=function(t){function r(r){return Math.round(r*t)/t}return void 0===t&&(t=1e13),a(t),function(t){return void 0!==t.x1&&(t.x1=r(t.x1)),void 0!==t.y1&&(t.y1=r(t.y1)),void 0!==t.x2&&(t.x2=r(t.x2)),void 0!==t.y2&&(t.y2=r(t.y2)),void 0!==t.x&&(t.x=r(t.x)),void 0!==t.y&&(t.y=r(t.y)),void 0!==t.rX&&(t.rX=r(t.rX)),void 0!==t.rY&&(t.rY=r(t.rY)),t}},t.TO_ABS=r,t.TO_REL=function(){return u((function(t,r,e){return t.relative||(void 0!==t.x1&&(t.x1-=r),void 0!==t.y1&&(t.y1-=e),void 0!==t.x2&&(t.x2-=r),void 0!==t.y2&&(t.y2-=e),void 0!==t.x&&(t.x-=r),void 0!==t.y&&(t.y-=e),t.relative=!0),t}))},t.NORMALIZE_HVZ=function(t,r,e){return void 0===t&&(t=!0),void 0===r&&(r=!0),void 0===e&&(e=!0),u((function(i,a,n,o,s){if(isNaN(o)&&!(i.type&f.MOVE_TO))throw new Error("path must start with moveto");return r&&i.type&f.HORIZ_LINE_TO&&(i.type=f.LINE_TO,i.y=i.relative?0:n),e&&i.type&f.VERT_LINE_TO&&(i.type=f.LINE_TO,i.x=i.relative?0:a),t&&i.type&f.CLOSE_PATH&&(i.type=f.LINE_TO,i.x=i.relative?o-a:o,i.y=i.relative?s-n:s),i.type&f.ARC&&(0===i.rX||0===i.rY)&&(i.type=f.LINE_TO,delete i.rX,delete i.rY,delete i.xRot,delete i.lArcFlag,delete i.sweepFlag),i}))},t.NORMALIZE_ST=e,t.QT_TO_C=n,t.INFO=u,t.SANITIZE=function(t){void 0===t&&(t=0),a(t);var r=NaN,e=NaN,i=NaN,n=NaN;return u((function(a,o,s,u,h){var c=Math.abs,y=!1,p=0,m=0;if(a.type&f.SMOOTH_CURVE_TO&&(p=isNaN(r)?0:o-r,m=isNaN(e)?0:s-e),a.type&(f.CURVE_TO|f.SMOOTH_CURVE_TO)?(r=a.relative?o+a.x2:a.x2,e=a.relative?s+a.y2:a.y2):(r=NaN,e=NaN),a.type&f.SMOOTH_QUAD_TO?(i=isNaN(i)?o:2*o-i,n=isNaN(n)?s:2*s-n):a.type&f.QUAD_TO?(i=a.relative?o+a.x1:a.x1,n=a.relative?s+a.y1:a.y2):(i=NaN,n=NaN),a.type&f.LINE_COMMANDS||a.type&f.ARC&&(0===a.rX||0===a.rY||!a.lArcFlag)||a.type&f.CURVE_TO||a.type&f.SMOOTH_CURVE_TO||a.type&f.QUAD_TO||a.type&f.SMOOTH_QUAD_TO){var O=void 0===a.x?0:a.relative?a.x:a.x-o,T=void 0===a.y?0:a.relative?a.y:a.y-s;p=isNaN(i)?void 0===a.x1?p:a.relative?a.x:a.x1-o:i-o,m=isNaN(n)?void 0===a.y1?m:a.relative?a.y:a.y1-s:n-s;var v=void 0===a.x2?0:a.relative?a.x:a.x2-o,l=void 0===a.y2?0:a.relative?a.y:a.y2-s;c(O)<=t&&c(T)<=t&&c(p)<=t&&c(m)<=t&&c(v)<=t&&c(l)<=t&&(y=!0);}return a.type&f.CLOSE_PATH&&c(o-u)<=t&&c(s-h)<=t&&(y=!0),y?[]:a}))},t.MATRIX=O,t.ROTATE=function(t,r,e){void 0===r&&(r=0),void 0===e&&(e=0),a(t,r,e);var i=Math.sin(t),n=Math.cos(t);return O(n,i,-i,n,r-r*n+e*i,e-r*i-e*n)},t.TRANSLATE=function(t,r){return void 0===r&&(r=0),a(t,r),O(1,0,0,1,t,r)},t.SCALE=function(t,r){return void 0===r&&(r=t),a(t,r),O(t,0,0,r,0,0)},t.SKEW_X=function(t){return a(t),O(1,0,Math.atan(t),1,0,0)},t.SKEW_Y=function(t){return a(t),O(1,Math.atan(t),0,1,0,0)},t.X_AXIS_SYMMETRY=function(t){return void 0===t&&(t=0),a(t),O(-1,0,0,1,t,0)},t.Y_AXIS_SYMMETRY=function(t){return void 0===t&&(t=0),a(t),O(1,0,0,-1,0,t)},t.A_TO_C=function(){return u((function(t,r,e){return f.ARC===t.type?function(t,r,e){var a,n,s,u;t.cX||o(t,r,e);for(var y=Math.min(t.phi1,t.phi2),p=Math.max(t.phi1,t.phi2)-y,m=Math.ceil(p/90),O=new Array(m),T=r,v=e,l=0;l<m;l++){var _=c(t.phi1,t.phi2,l/m),N=c(t.phi1,t.phi2,(l+1)/m),x=N-_,d=4/3*Math.tan(x*h/4),A=[Math.cos(_*h)-d*Math.sin(_*h),Math.sin(_*h)+d*Math.cos(_*h)],E=A[0],C=A[1],M=[Math.cos(N*h),Math.sin(N*h)],R=M[0],g=M[1],I=[R+d*Math.sin(N*h),g-d*Math.cos(N*h)],S=I[0],L=I[1];O[l]={relative:t.relative,type:f.CURVE_TO};var H=function(r,e){var a=i([r*t.rX,e*t.rY],t.xRot),n=a[0],o=a[1];return [t.cX+n,t.cY+o]};a=H(E,C),O[l].x1=a[0],O[l].y1=a[1],n=H(S,L),O[l].x2=n[0],O[l].y2=n[1],s=H(R,g),O[l].x=s[0],O[l].y=s[1],t.relative&&(O[l].x1-=T,O[l].y1-=v,O[l].x2-=T,O[l].y2-=v,O[l].x-=T,O[l].y-=v),T=(u=[O[l].x,O[l].y])[0],v=u[1];}return O}(t,t.relative?0:r,t.relative?0:e):t}))},t.ANNOTATE_ARCS=function(){return u((function(t,r,e){return t.relative&&(r=0,e=0),f.ARC===t.type&&o(t,r,e),t}))},t.CLONE=T,t.CALCULATE_BOUNDS=function(){var t=function(t){var r={};for(var e in t)r[e]=t[e];return r},i=r(),a=n(),h=e(),c=u((function(r,e,n){var u=h(a(i(t(r))));function O(t){t>c.maxX&&(c.maxX=t),t<c.minX&&(c.minX=t);}function T(t){t>c.maxY&&(c.maxY=t),t<c.minY&&(c.minY=t);}if(u.type&f.DRAWING_COMMANDS&&(O(e),T(n)),u.type&f.HORIZ_LINE_TO&&O(u.x),u.type&f.VERT_LINE_TO&&T(u.y),u.type&f.LINE_TO&&(O(u.x),T(u.y)),u.type&f.CURVE_TO){O(u.x),T(u.y);for(var v=0,l=p(e,u.x1,u.x2,u.x);v<l.length;v++){0<(w=l[v])&&1>w&&O(m(e,u.x1,u.x2,u.x,w));}for(var _=0,N=p(n,u.y1,u.y2,u.y);_<N.length;_++){0<(w=N[_])&&1>w&&T(m(n,u.y1,u.y2,u.y,w));}}if(u.type&f.ARC){O(u.x),T(u.y),o(u,e,n);for(var x=u.xRot/180*Math.PI,d=Math.cos(x)*u.rX,A=Math.sin(x)*u.rX,E=-Math.sin(x)*u.rY,C=Math.cos(x)*u.rY,M=u.phi1<u.phi2?[u.phi1,u.phi2]:-180>u.phi2?[u.phi2+360,u.phi1+360]:[u.phi2,u.phi1],R=M[0],g=M[1],I=function(t){var r=t[0],e=t[1],i=180*Math.atan2(e,r)/Math.PI;return i<R?i+360:i},S=0,L=s(E,-d,0).map(I);S<L.length;S++){(w=L[S])>R&&w<g&&O(y(u.cX,d,E,w));}for(var H=0,U=s(C,-A,0).map(I);H<U.length;H++){var w;(w=U[H])>R&&w<g&&T(y(u.cY,A,C,w));}}return r}));return c.minX=1/0,c.maxX=-1/0,c.minY=1/0,c.maxY=-1/0,c};}(u||(u={}));var O,T=function(){function t(){}return t.prototype.round=function(t){return this.transform(u.ROUND(t))},t.prototype.toAbs=function(){return this.transform(u.TO_ABS())},t.prototype.toRel=function(){return this.transform(u.TO_REL())},t.prototype.normalizeHVZ=function(t,r,e){return this.transform(u.NORMALIZE_HVZ(t,r,e))},t.prototype.normalizeST=function(){return this.transform(u.NORMALIZE_ST())},t.prototype.qtToC=function(){return this.transform(u.QT_TO_C())},t.prototype.aToC=function(){return this.transform(u.A_TO_C())},t.prototype.sanitize=function(t){return this.transform(u.SANITIZE(t))},t.prototype.translate=function(t,r){return this.transform(u.TRANSLATE(t,r))},t.prototype.scale=function(t,r){return this.transform(u.SCALE(t,r))},t.prototype.rotate=function(t,r,e){return this.transform(u.ROTATE(t,r,e))},t.prototype.matrix=function(t,r,e,i,a,n){return this.transform(u.MATRIX(t,r,e,i,a,n))},t.prototype.skewX=function(t){return this.transform(u.SKEW_X(t))},t.prototype.skewY=function(t){return this.transform(u.SKEW_Y(t))},t.prototype.xSymmetry=function(t){return this.transform(u.X_AXIS_SYMMETRY(t))},t.prototype.ySymmetry=function(t){return this.transform(u.Y_AXIS_SYMMETRY(t))},t.prototype.annotateArcs=function(){return this.transform(u.ANNOTATE_ARCS())},t}(),v=function(t){return " "===t||"\t"===t||"\r"===t||"\n"===t},l=function(t){return "0".charCodeAt(0)<=t.charCodeAt(0)&&t.charCodeAt(0)<="9".charCodeAt(0)},_=function(t){function e(){var r=t.call(this)||this;return r.curNumber="",r.curCommandType=-1,r.curCommandRelative=!1,r.canParseCommandOrComma=!0,r.curNumberHasExp=!1,r.curNumberHasExpDigits=!1,r.curNumberHasDecimal=!1,r.curArgs=[],r}return r(e,t),e.prototype.finish=function(t){if(void 0===t&&(t=[]),this.parse(" ",t),0!==this.curArgs.length||!this.canParseCommandOrComma)throw new SyntaxError("Unterminated command at the path end.");return t},e.prototype.parse=function(t,r){var e=this;void 0===r&&(r=[]);for(var i=function(t){r.push(t),e.curArgs.length=0,e.canParseCommandOrComma=!0;},a=0;a<t.length;a++){var n=t[a],o=!(this.curCommandType!==f.ARC||3!==this.curArgs.length&&4!==this.curArgs.length||1!==this.curNumber.length||"0"!==this.curNumber&&"1"!==this.curNumber),s=l(n)&&("0"===this.curNumber&&"0"===n||o);if(!l(n)||s)if("e"!==n&&"E"!==n)if("-"!==n&&"+"!==n||!this.curNumberHasExp||this.curNumberHasExpDigits)if("."!==n||this.curNumberHasExp||this.curNumberHasDecimal||o){if(this.curNumber&&-1!==this.curCommandType){var u=Number(this.curNumber);if(isNaN(u))throw new SyntaxError("Invalid number ending at "+a);if(this.curCommandType===f.ARC)if(0===this.curArgs.length||1===this.curArgs.length){if(0>u)throw new SyntaxError('Expected positive number, got "'+u+'" at index "'+a+'"')}else if((3===this.curArgs.length||4===this.curArgs.length)&&"0"!==this.curNumber&&"1"!==this.curNumber)throw new SyntaxError('Expected a flag, got "'+this.curNumber+'" at index "'+a+'"');this.curArgs.push(u),this.curArgs.length===N[this.curCommandType]&&(f.HORIZ_LINE_TO===this.curCommandType?i({type:f.HORIZ_LINE_TO,relative:this.curCommandRelative,x:u}):f.VERT_LINE_TO===this.curCommandType?i({type:f.VERT_LINE_TO,relative:this.curCommandRelative,y:u}):this.curCommandType===f.MOVE_TO||this.curCommandType===f.LINE_TO||this.curCommandType===f.SMOOTH_QUAD_TO?(i({type:this.curCommandType,relative:this.curCommandRelative,x:this.curArgs[0],y:this.curArgs[1]}),f.MOVE_TO===this.curCommandType&&(this.curCommandType=f.LINE_TO)):this.curCommandType===f.CURVE_TO?i({type:f.CURVE_TO,relative:this.curCommandRelative,x1:this.curArgs[0],y1:this.curArgs[1],x2:this.curArgs[2],y2:this.curArgs[3],x:this.curArgs[4],y:this.curArgs[5]}):this.curCommandType===f.SMOOTH_CURVE_TO?i({type:f.SMOOTH_CURVE_TO,relative:this.curCommandRelative,x2:this.curArgs[0],y2:this.curArgs[1],x:this.curArgs[2],y:this.curArgs[3]}):this.curCommandType===f.QUAD_TO?i({type:f.QUAD_TO,relative:this.curCommandRelative,x1:this.curArgs[0],y1:this.curArgs[1],x:this.curArgs[2],y:this.curArgs[3]}):this.curCommandType===f.ARC&&i({type:f.ARC,relative:this.curCommandRelative,rX:this.curArgs[0],rY:this.curArgs[1],xRot:this.curArgs[2],lArcFlag:this.curArgs[3],sweepFlag:this.curArgs[4],x:this.curArgs[5],y:this.curArgs[6]})),this.curNumber="",this.curNumberHasExpDigits=!1,this.curNumberHasExp=!1,this.curNumberHasDecimal=!1,this.canParseCommandOrComma=!0;}if(!v(n))if(","===n&&this.canParseCommandOrComma)this.canParseCommandOrComma=!1;else if("+"!==n&&"-"!==n&&"."!==n)if(s)this.curNumber=n,this.curNumberHasDecimal=!1;else {if(0!==this.curArgs.length)throw new SyntaxError("Unterminated command at index "+a+".");if(!this.canParseCommandOrComma)throw new SyntaxError('Unexpected character "'+n+'" at index '+a+". Command cannot follow comma");if(this.canParseCommandOrComma=!1,"z"!==n&&"Z"!==n)if("h"===n||"H"===n)this.curCommandType=f.HORIZ_LINE_TO,this.curCommandRelative="h"===n;else if("v"===n||"V"===n)this.curCommandType=f.VERT_LINE_TO,this.curCommandRelative="v"===n;else if("m"===n||"M"===n)this.curCommandType=f.MOVE_TO,this.curCommandRelative="m"===n;else if("l"===n||"L"===n)this.curCommandType=f.LINE_TO,this.curCommandRelative="l"===n;else if("c"===n||"C"===n)this.curCommandType=f.CURVE_TO,this.curCommandRelative="c"===n;else if("s"===n||"S"===n)this.curCommandType=f.SMOOTH_CURVE_TO,this.curCommandRelative="s"===n;else if("q"===n||"Q"===n)this.curCommandType=f.QUAD_TO,this.curCommandRelative="q"===n;else if("t"===n||"T"===n)this.curCommandType=f.SMOOTH_QUAD_TO,this.curCommandRelative="t"===n;else {if("a"!==n&&"A"!==n)throw new SyntaxError('Unexpected character "'+n+'" at index '+a+".");this.curCommandType=f.ARC,this.curCommandRelative="a"===n;}else r.push({type:f.CLOSE_PATH}),this.canParseCommandOrComma=!0,this.curCommandType=-1;}else this.curNumber=n,this.curNumberHasDecimal="."===n;}else this.curNumber+=n,this.curNumberHasDecimal=!0;else this.curNumber+=n;else this.curNumber+=n,this.curNumberHasExp=!0;else this.curNumber+=n,this.curNumberHasExpDigits=this.curNumberHasExp;}return r},e.prototype.transform=function(t){return Object.create(this,{parse:{value:function(r,e){void 0===e&&(e=[]);for(var i=0,a=Object.getPrototypeOf(this).parse.call(this,r);i<a.length;i++){var n=a[i],o=t(n);Array.isArray(o)?e.push.apply(e,o):e.push(o);}return e}}})},e}(T),f=function(t){function i(r){var e=t.call(this)||this;return e.commands="string"==typeof r?i.parse(r):r,e}return r(i,t),i.prototype.encode=function(){return i.encode(this.commands)},i.prototype.getBounds=function(){var t=u.CALCULATE_BOUNDS();return this.transform(t),t},i.prototype.transform=function(t){for(var r=[],e=0,i=this.commands;e<i.length;e++){var a=t(i[e]);Array.isArray(a)?r.push.apply(r,a):r.push(a);}return this.commands=r,this},i.encode=function(t){return e(t)},i.parse=function(t){var r=new _,e=[];return r.parse(t,e),r.finish(e),e},i.CLOSE_PATH=1,i.MOVE_TO=2,i.HORIZ_LINE_TO=4,i.VERT_LINE_TO=8,i.LINE_TO=16,i.CURVE_TO=32,i.SMOOTH_CURVE_TO=64,i.QUAD_TO=128,i.SMOOTH_QUAD_TO=256,i.ARC=512,i.LINE_COMMANDS=i.LINE_TO|i.HORIZ_LINE_TO|i.VERT_LINE_TO,i.DRAWING_COMMANDS=i.HORIZ_LINE_TO|i.VERT_LINE_TO|i.LINE_TO|i.CURVE_TO|i.SMOOTH_CURVE_TO|i.QUAD_TO|i.SMOOTH_QUAD_TO|i.ARC,i}(T),N=((O={})[f.MOVE_TO]=2,O[f.LINE_TO]=2,O[f.HORIZ_LINE_TO]=1,O[f.VERT_LINE_TO]=1,O[f.CLOSE_PATH]=0,O[f.QUAD_TO]=4,O[f.SMOOTH_QUAD_TO]=2,O[f.CURVE_TO]=6,O[f.SMOOTH_CURVE_TO]=4,O[f.ARC]=7,O);//# sourceMappingURL=SVGPathData.module.js.map

    var SVGPathData_module = /*#__PURE__*/Object.freeze({
        __proto__: null,
        COMMAND_ARG_COUNTS: N,
        SVGPathData: f,
        SVGPathDataParser: _,
        get SVGPathDataTransformer () { return u; },
        encodeSVGPath: e
    });

    var moveToGenerator = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.generateMoveToSwift = void 0;

    const generateMoveToSwift = (data, options) => {
        const xy = utils.stringifyRectValues({
            x: data.x / options.viewBox.width,
            y: data.y / options.viewBox.height,
        }, options.precision);
        const new_x = utils.clampNormalisedSizeProduct(xy.x, 'width');
        const new_y = utils.clampNormalisedSizeProduct(xy.y, 'height');
        return [`path.move(to: CGPoint(x: ${new_x}, y: ${new_y}))`];
    };
    exports.generateMoveToSwift = generateMoveToSwift;
    //# sourceMappingURL=moveToGenerator.js.map
    });

    unwrapExports(moveToGenerator);
    var moveToGenerator_1 = moveToGenerator.generateMoveToSwift;

    var lineToGenerator = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.generateLineToSwift = void 0;

    const generateLineToSwift = (data, options) => {
        const xy = utils.stringifyRectValues({
            x: data.x / options.viewBox.width,
            y: data.y / options.viewBox.height,
        }, options.precision);
        const new_x = utils.clampNormalisedSizeProduct(xy.x, 'width');
        const new_y = utils.clampNormalisedSizeProduct(xy.y, 'height');
        return [`path.addLine(to: CGPoint(x: ${new_x}, y: ${new_y}))`];
    };
    exports.generateLineToSwift = generateLineToSwift;
    //# sourceMappingURL=lineToGenerator.js.map
    });

    unwrapExports(lineToGenerator);
    var lineToGenerator_1 = lineToGenerator.generateLineToSwift;

    var closePathGenerator = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.generateClosePathSwift = void 0;
    const generateClosePathSwift = (_data, _options) => {
        return ['path.closeSubpath()'];
    };
    exports.generateClosePathSwift = generateClosePathSwift;
    //# sourceMappingURL=closePathGenerator.js.map
    });

    unwrapExports(closePathGenerator);
    var closePathGenerator_1 = closePathGenerator.generateClosePathSwift;

    var cubicCurveGenerator = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.generateCubicCurveSwift = void 0;

    const generateCubicCurveSwift = (data, options) => {
        // Convert raw values into width/height relative values.
        const xy1 = utils.stringifyRectValues({
            x: data.x1 / options.viewBox.width,
            y: data.y1 / options.viewBox.height,
        }, options.precision);
        const xy2 = utils.stringifyRectValues({
            x: data.x2 / options.viewBox.width,
            y: data.y2 / options.viewBox.height,
        }, options.precision);
        const xy = utils.stringifyRectValues({
            x: data.x / options.viewBox.width,
            y: data.y / options.viewBox.height,
        }, options.precision);
        // Prepare string values.
        const p1x_str = utils.clampNormalisedSizeProduct(xy.x, 'width');
        const p1y_str = utils.clampNormalisedSizeProduct(xy.y, 'height');
        const p2x_str = utils.clampNormalisedSizeProduct(xy1.x, 'width');
        const p2y_str = utils.clampNormalisedSizeProduct(xy1.y, 'height');
        const p3x_str = utils.clampNormalisedSizeProduct(xy2.x, 'width');
        const p3y_str = utils.clampNormalisedSizeProduct(xy2.y, 'height');
        const swiftString = [
            `path.addCurve(to: CGPoint(x: ${p1x_str}, y: ${p1y_str}),`,
            `control1: CGPoint(x: ${p2x_str}, y: ${p2y_str}),`,
            `control2: CGPoint(x: ${p3x_str}, y: ${p3y_str}))`,
        ].join(' ');
        return [swiftString];
    };
    exports.generateCubicCurveSwift = generateCubicCurveSwift;
    //# sourceMappingURL=cubicCurveGenerator.js.map
    });

    unwrapExports(cubicCurveGenerator);
    var cubicCurveGenerator_1 = cubicCurveGenerator.generateCubicCurveSwift;

    var pathElementHandler = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });





    /**
     * Converts SVG Path element to SwiftUI path string.
     * @param element SVG Path Element
     * @param options Transpiler options
     */
    function handlePathElement(element, options) {
        const properties = element.properties;
        if (properties) {
            const props = properties;
            if (!props.d) {
                throw new Error('Parameter `d` has to be provided on the <path> element!');
            }
            options.lastPathId++;
            console.log('Props', props);
            const pathData = new SVGPathData_module.SVGPathData(props.d).toAbs();
            return convertPathToSwift(pathData.commands, options);
        }
        else {
            throw new Error('Path element does not have any properties!');
        }
    }
    exports.default = handlePathElement;
    /**
     * Converts a list of `SVGCommand`s to SwiftUI Path
     * @param data Path data if SVGCommand[] type.
     * @param options Transpiler options
     */
    const convertPathToSwift = (data, options) => {
        const swiftAccumulator = [];
        console.log('Data points', data);
        for (let i = 0; i < data.length; i++) {
            const el = data[i];
            // Handle data depending on command type.
            switch (el.type) {
                // Command M
                case SVGPathData_module.SVGPathData.MOVE_TO: {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { type, relative, ...d } = el;
                    swiftAccumulator.push(...moveToGenerator.generateMoveToSwift(d, options));
                    break;
                }
                // Command L
                case SVGPathData_module.SVGPathData.LINE_TO: {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { type, relative, ...d } = el;
                    swiftAccumulator.push(...lineToGenerator.generateLineToSwift(d, options));
                    break;
                }
                // Command H
                case SVGPathData_module.SVGPathData.HORIZ_LINE_TO: {
                    console.error('Horizontal line is not supported yet');
                    break;
                }
                // Command V
                case SVGPathData_module.SVGPathData.VERT_LINE_TO: {
                    // TODO: Implement this commend
                    console.error('Vertical line is not supported yet');
                    break;
                }
                // Command Z
                case SVGPathData_module.SVGPathData.CLOSE_PATH: {
                    swiftAccumulator.push(...closePathGenerator.generateClosePathSwift(null, options));
                    break;
                }
                // Command Q
                case SVGPathData_module.SVGPathData.QUAD_TO: {
                    // TODO: Implement this commend
                    console.error('Quad curve is not supported yet');
                    break;
                }
                // Command T
                case SVGPathData_module.SVGPathData.SMOOTH_QUAD_TO: {
                    // TODO: Implement this commend
                    console.error('Smooth quad is not supported yet');
                    break;
                }
                // Command C
                case SVGPathData_module.SVGPathData.CURVE_TO: {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { type, relative, ...d } = el;
                    swiftAccumulator.push(...cubicCurveGenerator.generateCubicCurveSwift(d, options));
                    break;
                }
                // Command S
                case SVGPathData_module.SVGPathData.SMOOTH_CURVE_TO: {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { type, relative, ...d } = el;
                    const prevElement = data[i - 1];
                    // Setup first control point
                    let x1 = d.x;
                    let y1 = d.y;
                    if (prevElement.type === SVGPathData_module.SVGPathData.CURVE_TO ||
                        prevElement.type === SVGPathData_module.SVGPathData.SMOOTH_CURVE_TO) {
                        x1 = prevElement.x + (prevElement.x - prevElement.x2);
                        y1 = prevElement.y + (prevElement.y - prevElement.y2);
                    }
                    const swiftLines = cubicCurveGenerator.generateCubicCurveSwift({ ...d, x1, y1 }, options);
                    swiftAccumulator.push(...swiftLines);
                    break;
                }
                // Command A
                case SVGPathData_module.SVGPathData.ARC: {
                    // TODO: Implement this commend
                    console.error('Arc is not supported yet');
                    break;
                }
            }
        }
        return swiftAccumulator;
    };
    //# sourceMappingURL=pathElementHandler.js.map
    });

    unwrapExports(pathElementHandler);

    var rectElementHandler = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });

    function handleRectElement(element, options) {
        // TODO: Add style support
        // const style = {
        //   ...options.parentStyle,
        //   ...extractStyle(element),
        // };
        const props = element.properties;
        if (props) {
            const circleProps = props;
            // Set default values
            circleProps.x = circleProps.x || '0';
            circleProps.y = circleProps.y || '0';
            // Check if required properties are provided.
            if (!circleProps.width || !circleProps.height) {
                throw new Error('Rectangle has to have width and height properties!');
            }
            // Parse numbers from the striings.
            const x = parseFloat(circleProps.x);
            const y = parseFloat(circleProps.y);
            const width = parseFloat(circleProps.width);
            const height = parseFloat(circleProps.height);
            // Normalise all values to be based on fraction of width/height.
            const normalisedRect = utils.normaliseRectValues({ x, y, width, height }, options.viewBox);
            // Stringify values to the fixed precision point.
            const SR = utils.stringifyRectValues(normalisedRect, options.precision);
            // Append the width and height multipliers after normalisation.
            const strX = utils.clampNormalisedSizeProduct(SR.x, 'width');
            const strY = utils.clampNormalisedSizeProduct(SR.y, 'height');
            const strWidth = utils.clampNormalisedSizeProduct(SR.width, 'width');
            const strHeight = utils.clampNormalisedSizeProduct(SR.height, 'height');
            // Generate SwiftUI string.
            const CGRect = `CGRect(x: ${strX}, y: ${strY}, width: ${strWidth}, height: ${strHeight})`;
            return [`path.addRect(${CGRect})`];
        }
        else {
            throw new Error('Circle element has to some properties');
        }
    }
    exports.default = handleRectElement;
    //# sourceMappingURL=rectElementHandler.js.map
    });

    unwrapExports(rectElementHandler);

    var elementHandlers = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.handleElement = void 0;




    function handleElement(element, options) {
        switch (element.tagName) {
            case 'g':
                return groupElementHandler.default(element, options);
            case 'svg':
                return groupElementHandler.default(element, options);
            case 'path':
                return pathElementHandler.default(element, options);
            case 'circle':
                return circleElementHandler.default(element, options);
            case 'rect':
                return rectElementHandler.default(element, options);
            default:
                console.error([
                    `Element <${element.tagName}> is not supported!`,
                    'Please open a Github issue for this or send a PR with the implementation!',
                ].join('\n'));
                return [];
        }
    }
    exports.handleElement = handleElement;
    //# sourceMappingURL=index.js.map
    });

    unwrapExports(elementHandlers);
    var elementHandlers_1 = elementHandlers.handleElement;

    var constants = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DEFAULT_CONFIG = void 0;
    exports.DEFAULT_CONFIG = {
        structName: 'MyCustomShape',
        precision: 8,
        indentationSize: 4,
    };
    //# sourceMappingURL=constants.js.map
    });

    unwrapExports(constants);
    var constants_1 = constants.DEFAULT_CONFIG;

    var src = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.convert = void 0;





    /**
     * This function converts SVG string into SwiftUI
     * Shape structure which is returned as a string.
     * @param rawSVGString SVG code as a raw string.
     * @param config Optional configuration object.
     */
    function convert(rawSVGString, config) {
        const AST = svgParser_umd.parse(rawSVGString);
        const svgElement = utils.getSVGElement(AST);
        if (svgElement) {
            return swiftUIGenerator(svgElement, config);
        }
        else {
            throw new Error('Could not find SVG element, please provide full SVG source!');
        }
    }
    exports.convert = convert;
    /**
     * Generates SwiftUI Shape string from SVG HAST (Abstract Syntax Tree).
     * @param svgElement Parsed SVG Abstract Syntax Tree.
     * @param config Optional configuration object.
     */
    function swiftUIGenerator(svgElement, config) {
        const svgProperties = utils.extractSVGProperties(svgElement);
        // The initial options passed to the first element.
        const rootTranspilerOptions = {
            ...svgProperties,
            precision: (config === null || config === void 0 ? void 0 : config.precision) || 10,
            lastPathId: 0,
            indentationSize: (config === null || config === void 0 ? void 0 : config.indentationSize) || 4,
            currentIndentationLevel: 0,
            parentStyle: {},
        };
        // Generate SwiftUI Shape body.
        const generatedBody = elementHandlers.handleElement(svgElement, rootTranspilerOptions);
        // Inject generated body into the Shape struct template.
        const fullSwiftUIShape = stubs.generateSwiftUIShape(generatedBody, {
            ...constants.DEFAULT_CONFIG,
            ...config,
        });
        return fullSwiftUIShape;
    }
    //# sourceMappingURL=index.js.map
    });

    unwrapExports(src);
    var src_1 = src.convert;

    /* src/App.svelte generated by Svelte v3.31.1 */
    const file = "src/App.svelte";

    // (73:2) {#if settingsShown}
    function create_if_block(ctx) {
    	let ul;
    	let li0;
    	let label0;
    	let t1;
    	let input0;
    	let t2;
    	let li1;
    	let label1;
    	let t4;
    	let input1;
    	let t5;
    	let li2;
    	let label2;
    	let t7;
    	let input2;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			ul = element("ul");
    			li0 = element("li");
    			label0 = element("label");
    			label0.textContent = "Indentation Spaces:";
    			t1 = space();
    			input0 = element("input");
    			t2 = space();
    			li1 = element("li");
    			label1 = element("label");
    			label1.textContent = "Round to decimal points:";
    			t4 = space();
    			input1 = element("input");
    			t5 = space();
    			li2 = element("li");
    			label2 = element("label");
    			label2.textContent = "Struct name:";
    			t7 = space();
    			input2 = element("input");
    			attr_dev(label0, "for", "indentation-input");
    			add_location(label0, file, 75, 8, 1812);
    			attr_dev(input0, "id", "indentation-input");
    			attr_dev(input0, "type", "number");
    			attr_dev(input0, "min", "0");
    			attr_dev(input0, "max", "12");
    			add_location(input0, file, 76, 8, 1879);
    			add_location(li0, file, 74, 6, 1799);
    			attr_dev(label1, "for", "precision-input");
    			add_location(label1, file, 84, 8, 2061);
    			attr_dev(input1, "id", "precision-input");
    			attr_dev(input1, "type", "number");
    			attr_dev(input1, "min", "0");
    			attr_dev(input1, "max", "10");
    			add_location(input1, file, 85, 8, 2131);
    			add_location(li1, file, 83, 6, 2048);
    			attr_dev(label2, "for", "name-input");
    			add_location(label2, file, 93, 8, 2305);
    			attr_dev(input2, "id", "name-input");
    			attr_dev(input2, "type", "text");
    			add_location(input2, file, 94, 8, 2358);
    			add_location(li2, file, 92, 6, 2292);
    			add_location(ul, file, 73, 4, 1788);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, ul, anchor);
    			append_dev(ul, li0);
    			append_dev(li0, label0);
    			append_dev(li0, t1);
    			append_dev(li0, input0);
    			set_input_value(input0, /*options*/ ctx[3].indentationSize);
    			append_dev(ul, t2);
    			append_dev(ul, li1);
    			append_dev(li1, label1);
    			append_dev(li1, t4);
    			append_dev(li1, input1);
    			set_input_value(input1, /*options*/ ctx[3].precision);
    			append_dev(ul, t5);
    			append_dev(ul, li2);
    			append_dev(li2, label2);
    			append_dev(li2, t7);
    			append_dev(li2, input2);
    			set_input_value(input2, /*options*/ ctx[3].structName);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[6]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[7]),
    					listen_dev(input2, "input", /*input2_input_handler*/ ctx[8])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*options*/ 8 && to_number(input0.value) !== /*options*/ ctx[3].indentationSize) {
    				set_input_value(input0, /*options*/ ctx[3].indentationSize);
    			}

    			if (dirty & /*options*/ 8 && to_number(input1.value) !== /*options*/ ctx[3].precision) {
    				set_input_value(input1, /*options*/ ctx[3].precision);
    			}

    			if (dirty & /*options*/ 8 && input2.value !== /*options*/ ctx[3].structName) {
    				set_input_value(input2, /*options*/ ctx[3].structName);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(ul);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(73:2) {#if settingsShown}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let h1;
    	let t1;
    	let div0;
    	let iframe0;
    	let iframe0_src_value;
    	let t2;
    	let iframe1;
    	let iframe1_src_value;
    	let t3;
    	let div1;
    	let i;
    	let t4;
    	let a;
    	let t6;
    	let div2;
    	let h20;
    	let t8;
    	let img;
    	let img_src_value;
    	let img_title_value;
    	let t9;
    	let t10;
    	let div3;
    	let textarea0;
    	let t11;
    	let button;
    	let t13;
    	let h21;
    	let t15;
    	let div4;
    	let textarea1;
    	let mounted;
    	let dispose;
    	let if_block = /*settingsShown*/ ctx[2] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			h1 = element("h1");
    			h1.textContent = "Welcome!";
    			t1 = space();
    			div0 = element("div");
    			iframe0 = element("iframe");
    			t2 = space();
    			iframe1 = element("iframe");
    			t3 = space();
    			div1 = element("div");
    			i = element("i");
    			t4 = text("Functionality is limited for now, feel free to contribute on\n      ");
    			a = element("a");
    			a.textContent = "Github";
    			t6 = space();
    			div2 = element("div");
    			h20 = element("h2");
    			h20.textContent = "Paste SVG code below";
    			t8 = space();
    			img = element("img");
    			t9 = space();
    			if (if_block) if_block.c();
    			t10 = space();
    			div3 = element("div");
    			textarea0 = element("textarea");
    			t11 = space();
    			button = element("button");
    			button.textContent = "Convert to SwiftUI Shape!";
    			t13 = space();
    			h21 = element("h2");
    			h21.textContent = "Swift code will be shown below:";
    			t15 = space();
    			div4 = element("div");
    			textarea1 = element("textarea");
    			add_location(h1, file, 36, 2, 709);
    			if (iframe0.src !== (iframe0_src_value = "https://ghbtns.com/github-btn.html?user=quassummanus&repo=SVG-to-SwiftUI&type=star&count=true&v=2")) attr_dev(iframe0, "src", iframe0_src_value);
    			attr_dev(iframe0, "frameborder", "0");
    			attr_dev(iframe0, "scrolling", "0");
    			attr_dev(iframe0, "width", "90");
    			attr_dev(iframe0, "height", "20");
    			attr_dev(iframe0, "title", "GitHub");
    			attr_dev(iframe0, "class", "svelte-19o4juq");
    			add_location(iframe0, file, 38, 4, 761);
    			if (iframe1.src !== (iframe1_src_value = "https://github.com/sponsors/bring-shrubbery/button")) attr_dev(iframe1, "src", iframe1_src_value);
    			attr_dev(iframe1, "title", "Sponsor bring-shrubbery");
    			attr_dev(iframe1, "height", "35");
    			attr_dev(iframe1, "width", "116");
    			set_style(iframe1, "border", "0");
    			attr_dev(iframe1, "class", "svelte-19o4juq");
    			add_location(iframe1, file, 45, 4, 984);
    			attr_dev(div0, "id", "external-buttons");
    			attr_dev(div0, "class", "svelte-19o4juq");
    			add_location(div0, file, 37, 2, 729);
    			attr_dev(a, "href", "https://github.com/quassummanus/SVG-to-SwiftUI");
    			attr_dev(a, "alt", "link to GitHub");
    			add_location(a, file, 55, 6, 1280);
    			add_location(i, file, 53, 4, 1203);
    			set_style(div1, "margin", "8px auto");
    			add_location(div1, file, 52, 2, 1168);
    			set_style(h20, "display", "inline");
    			add_location(h20, file, 63, 4, 1454);
    			attr_dev(img, "id", "settings-button");
    			if (img.src !== (img_src_value = "https://img.icons8.com/ios-filled/50/000000/settings.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "settings icon");
    			attr_dev(img, "width", "16px");
    			attr_dev(img, "title", img_title_value = `${/*settingsShown*/ ctx[2] ? "Hide" : "Show"} settings`);
    			add_location(img, file, 64, 4, 1512);
    			set_style(div2, "margin", "16px 0");
    			add_location(div2, file, 62, 2, 1421);
    			attr_dev(textarea0, "placeholder", "Paste SVG Code here");
    			add_location(textarea0, file, 99, 4, 2470);
    			add_location(div3, file, 98, 2, 2460);
    			add_location(button, file, 101, 2, 2550);
    			add_location(h21, file, 102, 2, 2624);
    			textarea1.value = /*swiftOutput*/ ctx[1];
    			attr_dev(textarea1, "id", "swift-output-area");
    			add_location(textarea1, file, 104, 4, 2677);
    			add_location(div4, file, 103, 2, 2667);
    			add_location(main, file, 35, 0, 700);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h1);
    			append_dev(main, t1);
    			append_dev(main, div0);
    			append_dev(div0, iframe0);
    			append_dev(div0, t2);
    			append_dev(div0, iframe1);
    			append_dev(main, t3);
    			append_dev(main, div1);
    			append_dev(div1, i);
    			append_dev(i, t4);
    			append_dev(i, a);
    			append_dev(main, t6);
    			append_dev(main, div2);
    			append_dev(div2, h20);
    			append_dev(div2, t8);
    			append_dev(div2, img);
    			append_dev(main, t9);
    			if (if_block) if_block.m(main, null);
    			append_dev(main, t10);
    			append_dev(main, div3);
    			append_dev(div3, textarea0);
    			set_input_value(textarea0, /*svgInput*/ ctx[0]);
    			append_dev(main, t11);
    			append_dev(main, button);
    			append_dev(main, t13);
    			append_dev(main, h21);
    			append_dev(main, t15);
    			append_dev(main, div4);
    			append_dev(div4, textarea1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(img, "click", /*toggleSettings*/ ctx[4], false, false, false),
    					listen_dev(textarea0, "input", /*textarea0_input_handler*/ ctx[9]),
    					listen_dev(button, "click", /*generateSwiftCode*/ ctx[5], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*settingsShown*/ 4 && img_title_value !== (img_title_value = `${/*settingsShown*/ ctx[2] ? "Hide" : "Show"} settings`)) {
    				attr_dev(img, "title", img_title_value);
    			}

    			if (/*settingsShown*/ ctx[2]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(main, t10);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*svgInput*/ 1) {
    				set_input_value(textarea0, /*svgInput*/ ctx[0]);
    			}

    			if (dirty & /*swiftOutput*/ 2) {
    				prop_dev(textarea1, "value", /*swiftOutput*/ ctx[1]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if (if_block) if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	let svgInput = "";
    	let swiftOutput = "";
    	let settingsShown = false;
    	const toggleSettings = () => $$invalidate(2, settingsShown = !settingsShown);

    	let options = {
    		structName: "MyCustomShape",
    		precision: 5,
    		indentationSize: 4
    	};

    	const generateSwiftCode = () => {
    		try {
    			$$invalidate(1, swiftOutput = src_1(svgInput, options));
    		} catch(e) {
    			alert(e);
    		}
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		options.indentationSize = to_number(this.value);
    		$$invalidate(3, options);
    	}

    	function input1_input_handler() {
    		options.precision = to_number(this.value);
    		$$invalidate(3, options);
    	}

    	function input2_input_handler() {
    		options.structName = this.value;
    		$$invalidate(3, options);
    	}

    	function textarea0_input_handler() {
    		svgInput = this.value;
    		$$invalidate(0, svgInput);
    	}

    	$$self.$capture_state = () => ({
    		convert: src_1,
    		svgInput,
    		swiftOutput,
    		settingsShown,
    		toggleSettings,
    		options,
    		generateSwiftCode
    	});

    	$$self.$inject_state = $$props => {
    		if ("svgInput" in $$props) $$invalidate(0, svgInput = $$props.svgInput);
    		if ("swiftOutput" in $$props) $$invalidate(1, swiftOutput = $$props.swiftOutput);
    		if ("settingsShown" in $$props) $$invalidate(2, settingsShown = $$props.settingsShown);
    		if ("options" in $$props) $$invalidate(3, options = $$props.options);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		svgInput,
    		swiftOutput,
    		settingsShown,
    		options,
    		toggleSettings,
    		generateSwiftCode,
    		input0_input_handler,
    		input1_input_handler,
    		input2_input_handler,
    		textarea0_input_handler
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
        target: document.body,
    });
    //# sourceMappingURL=main.js.map

    return app;

}());
//# sourceMappingURL=bundle.js.map
