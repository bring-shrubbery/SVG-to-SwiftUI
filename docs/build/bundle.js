
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
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        if (value != null || input.value) {
            input.value = value;
        }
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
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
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
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.22.2' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev("SvelteDOMSetProperty", { node, property, value });
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

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
    //# sourceMappingURL=svg-parser.esm.js.map

    var zwitch = factory;

    var noop$1 = Function.prototype;
    var own = {}.hasOwnProperty;

    // Handle values based on a property.
    function factory(key, options) {
      var settings = options || {};

      function one(value) {
        var fn = one.invalid;
        var handlers = one.handlers;

        if (value && own.call(value, key)) {
          fn = own.call(handlers, value[key]) ? handlers[value[key]] : one.unknown;
        }

        return (fn || noop$1).apply(this, arguments)
      }

      one.handlers = settings.handlers || {};
      one.invalid = settings.invalid;
      one.unknown = settings.unknown;

      return one
    }

    var immutable = extend;

    var hasOwnProperty = Object.prototype.hasOwnProperty;

    function extend() {
        var target = {};

        for (var i = 0; i < arguments.length; i++) {
            var source = arguments[i];

            for (var key in source) {
                if (hasOwnProperty.call(source, key)) {
                    target[key] = source[key];
                }
            }
        }

        return target
    }

    var schema = Schema;

    var proto = Schema.prototype;

    proto.space = null;
    proto.normal = {};
    proto.property = {};

    function Schema(property, normal, space) {
      this.property = property;
      this.normal = normal;

      if (space) {
        this.space = space;
      }
    }

    var merge_1 = merge;

    function merge(definitions) {
      var length = definitions.length;
      var property = [];
      var normal = [];
      var index = -1;
      var info;
      var space;

      while (++index < length) {
        info = definitions[index];
        property.push(info.property);
        normal.push(info.normal);
        space = info.space;
      }

      return new schema(
        immutable.apply(null, property),
        immutable.apply(null, normal),
        space
      )
    }

    var normalize_1 = normalize;

    function normalize(value) {
      return value.toLowerCase()
    }

    var info = Info;

    var proto$1 = Info.prototype;

    proto$1.space = null;
    proto$1.attribute = null;
    proto$1.property = null;
    proto$1.boolean = false;
    proto$1.booleanish = false;
    proto$1.overloadedBoolean = false;
    proto$1.number = false;
    proto$1.commaSeparated = false;
    proto$1.spaceSeparated = false;
    proto$1.commaOrSpaceSeparated = false;
    proto$1.mustUseProperty = false;
    proto$1.defined = false;

    function Info(property, attribute) {
      this.property = property;
      this.attribute = attribute;
    }

    var powers = 0;

    var boolean_1 = increment();
    var booleanish = increment();
    var overloadedBoolean = increment();
    var number = increment();
    var spaceSeparated = increment();
    var commaSeparated = increment();
    var commaOrSpaceSeparated = increment();

    function increment() {
      return Math.pow(2, ++powers)
    }

    var types = {
    	boolean: boolean_1,
    	booleanish: booleanish,
    	overloadedBoolean: overloadedBoolean,
    	number: number,
    	spaceSeparated: spaceSeparated,
    	commaSeparated: commaSeparated,
    	commaOrSpaceSeparated: commaOrSpaceSeparated
    };

    var definedInfo = DefinedInfo;

    DefinedInfo.prototype = new info();
    DefinedInfo.prototype.defined = true;

    var checks = [
      'boolean',
      'booleanish',
      'overloadedBoolean',
      'number',
      'commaSeparated',
      'spaceSeparated',
      'commaOrSpaceSeparated'
    ];
    var checksLength = checks.length;

    function DefinedInfo(property, attribute, mask, space) {
      var index = -1;
      var check;

      mark(this, 'space', space);

      info.call(this, property, attribute);

      while (++index < checksLength) {
        check = checks[index];
        mark(this, check, (mask & types[check]) === types[check]);
      }
    }

    function mark(values, key, value) {
      if (value) {
        values[key] = value;
      }
    }

    var create_1 = create;

    function create(definition) {
      var space = definition.space;
      var mustUseProperty = definition.mustUseProperty || [];
      var attributes = definition.attributes || {};
      var props = definition.properties;
      var transform = definition.transform;
      var property = {};
      var normal = {};
      var prop;
      var info;

      for (prop in props) {
        info = new definedInfo(
          prop,
          transform(attributes, prop),
          props[prop],
          space
        );

        if (mustUseProperty.indexOf(prop) !== -1) {
          info.mustUseProperty = true;
        }

        property[prop] = info;

        normal[normalize_1(prop)] = prop;
        normal[normalize_1(info.attribute)] = prop;
      }

      return new schema(property, normal, space)
    }

    var xlink = create_1({
      space: 'xlink',
      transform: xlinkTransform,
      properties: {
        xLinkActuate: null,
        xLinkArcRole: null,
        xLinkHref: null,
        xLinkRole: null,
        xLinkShow: null,
        xLinkTitle: null,
        xLinkType: null
      }
    });

    function xlinkTransform(_, prop) {
      return 'xlink:' + prop.slice(5).toLowerCase()
    }

    var xml = create_1({
      space: 'xml',
      transform: xmlTransform,
      properties: {
        xmlLang: null,
        xmlBase: null,
        xmlSpace: null
      }
    });

    function xmlTransform(_, prop) {
      return 'xml:' + prop.slice(3).toLowerCase()
    }

    var caseSensitiveTransform_1 = caseSensitiveTransform;

    function caseSensitiveTransform(attributes, attribute) {
      return attribute in attributes ? attributes[attribute] : attribute
    }

    var caseInsensitiveTransform_1 = caseInsensitiveTransform;

    function caseInsensitiveTransform(attributes, property) {
      return caseSensitiveTransform_1(attributes, property.toLowerCase())
    }

    var xmlns = create_1({
      space: 'xmlns',
      attributes: {
        xmlnsxlink: 'xmlns:xlink'
      },
      transform: caseInsensitiveTransform_1,
      properties: {
        xmlns: null,
        xmlnsXLink: null
      }
    });

    var booleanish$1 = types.booleanish;
    var number$1 = types.number;
    var spaceSeparated$1 = types.spaceSeparated;

    var aria = create_1({
      transform: ariaTransform,
      properties: {
        ariaActiveDescendant: null,
        ariaAtomic: booleanish$1,
        ariaAutoComplete: null,
        ariaBusy: booleanish$1,
        ariaChecked: booleanish$1,
        ariaColCount: number$1,
        ariaColIndex: number$1,
        ariaColSpan: number$1,
        ariaControls: spaceSeparated$1,
        ariaCurrent: null,
        ariaDescribedBy: spaceSeparated$1,
        ariaDetails: null,
        ariaDisabled: booleanish$1,
        ariaDropEffect: spaceSeparated$1,
        ariaErrorMessage: null,
        ariaExpanded: booleanish$1,
        ariaFlowTo: spaceSeparated$1,
        ariaGrabbed: booleanish$1,
        ariaHasPopup: null,
        ariaHidden: booleanish$1,
        ariaInvalid: null,
        ariaKeyShortcuts: null,
        ariaLabel: null,
        ariaLabelledBy: spaceSeparated$1,
        ariaLevel: number$1,
        ariaLive: null,
        ariaModal: booleanish$1,
        ariaMultiLine: booleanish$1,
        ariaMultiSelectable: booleanish$1,
        ariaOrientation: null,
        ariaOwns: spaceSeparated$1,
        ariaPlaceholder: null,
        ariaPosInSet: number$1,
        ariaPressed: booleanish$1,
        ariaReadOnly: booleanish$1,
        ariaRelevant: null,
        ariaRequired: booleanish$1,
        ariaRoleDescription: spaceSeparated$1,
        ariaRowCount: number$1,
        ariaRowIndex: number$1,
        ariaRowSpan: number$1,
        ariaSelected: booleanish$1,
        ariaSetSize: number$1,
        ariaSort: null,
        ariaValueMax: number$1,
        ariaValueMin: number$1,
        ariaValueNow: number$1,
        ariaValueText: null,
        role: null
      }
    });

    function ariaTransform(_, prop) {
      return prop === 'role' ? prop : 'aria-' + prop.slice(4).toLowerCase()
    }

    var boolean = types.boolean;
    var overloadedBoolean$1 = types.overloadedBoolean;
    var booleanish$2 = types.booleanish;
    var number$2 = types.number;
    var spaceSeparated$2 = types.spaceSeparated;
    var commaSeparated$1 = types.commaSeparated;

    var html = create_1({
      space: 'html',
      attributes: {
        acceptcharset: 'accept-charset',
        classname: 'class',
        htmlfor: 'for',
        httpequiv: 'http-equiv'
      },
      transform: caseInsensitiveTransform_1,
      mustUseProperty: ['checked', 'multiple', 'muted', 'selected'],
      properties: {
        // Standard Properties.
        abbr: null,
        accept: commaSeparated$1,
        acceptCharset: spaceSeparated$2,
        accessKey: spaceSeparated$2,
        action: null,
        allow: null,
        allowFullScreen: boolean,
        allowPaymentRequest: boolean,
        allowUserMedia: boolean,
        alt: null,
        as: null,
        async: boolean,
        autoCapitalize: null,
        autoComplete: spaceSeparated$2,
        autoFocus: boolean,
        autoPlay: boolean,
        capture: boolean,
        charSet: null,
        checked: boolean,
        cite: null,
        className: spaceSeparated$2,
        cols: number$2,
        colSpan: null,
        content: null,
        contentEditable: booleanish$2,
        controls: boolean,
        controlsList: spaceSeparated$2,
        coords: number$2 | commaSeparated$1,
        crossOrigin: null,
        data: null,
        dateTime: null,
        decoding: null,
        default: boolean,
        defer: boolean,
        dir: null,
        dirName: null,
        disabled: boolean,
        download: overloadedBoolean$1,
        draggable: booleanish$2,
        encType: null,
        enterKeyHint: null,
        form: null,
        formAction: null,
        formEncType: null,
        formMethod: null,
        formNoValidate: boolean,
        formTarget: null,
        headers: spaceSeparated$2,
        height: number$2,
        hidden: boolean,
        high: number$2,
        href: null,
        hrefLang: null,
        htmlFor: spaceSeparated$2,
        httpEquiv: spaceSeparated$2,
        id: null,
        imageSizes: null,
        imageSrcSet: commaSeparated$1,
        inputMode: null,
        integrity: null,
        is: null,
        isMap: boolean,
        itemId: null,
        itemProp: spaceSeparated$2,
        itemRef: spaceSeparated$2,
        itemScope: boolean,
        itemType: spaceSeparated$2,
        kind: null,
        label: null,
        lang: null,
        language: null,
        list: null,
        loop: boolean,
        low: number$2,
        manifest: null,
        max: null,
        maxLength: number$2,
        media: null,
        method: null,
        min: null,
        minLength: number$2,
        multiple: boolean,
        muted: boolean,
        name: null,
        nonce: null,
        noModule: boolean,
        noValidate: boolean,
        onAbort: null,
        onAfterPrint: null,
        onAuxClick: null,
        onBeforePrint: null,
        onBeforeUnload: null,
        onBlur: null,
        onCancel: null,
        onCanPlay: null,
        onCanPlayThrough: null,
        onChange: null,
        onClick: null,
        onClose: null,
        onContextMenu: null,
        onCopy: null,
        onCueChange: null,
        onCut: null,
        onDblClick: null,
        onDrag: null,
        onDragEnd: null,
        onDragEnter: null,
        onDragExit: null,
        onDragLeave: null,
        onDragOver: null,
        onDragStart: null,
        onDrop: null,
        onDurationChange: null,
        onEmptied: null,
        onEnded: null,
        onError: null,
        onFocus: null,
        onFormData: null,
        onHashChange: null,
        onInput: null,
        onInvalid: null,
        onKeyDown: null,
        onKeyPress: null,
        onKeyUp: null,
        onLanguageChange: null,
        onLoad: null,
        onLoadedData: null,
        onLoadedMetadata: null,
        onLoadEnd: null,
        onLoadStart: null,
        onMessage: null,
        onMessageError: null,
        onMouseDown: null,
        onMouseEnter: null,
        onMouseLeave: null,
        onMouseMove: null,
        onMouseOut: null,
        onMouseOver: null,
        onMouseUp: null,
        onOffline: null,
        onOnline: null,
        onPageHide: null,
        onPageShow: null,
        onPaste: null,
        onPause: null,
        onPlay: null,
        onPlaying: null,
        onPopState: null,
        onProgress: null,
        onRateChange: null,
        onRejectionHandled: null,
        onReset: null,
        onResize: null,
        onScroll: null,
        onSecurityPolicyViolation: null,
        onSeeked: null,
        onSeeking: null,
        onSelect: null,
        onSlotChange: null,
        onStalled: null,
        onStorage: null,
        onSubmit: null,
        onSuspend: null,
        onTimeUpdate: null,
        onToggle: null,
        onUnhandledRejection: null,
        onUnload: null,
        onVolumeChange: null,
        onWaiting: null,
        onWheel: null,
        open: boolean,
        optimum: number$2,
        pattern: null,
        ping: spaceSeparated$2,
        placeholder: null,
        playsInline: boolean,
        poster: null,
        preload: null,
        readOnly: boolean,
        referrerPolicy: null,
        rel: spaceSeparated$2,
        required: boolean,
        reversed: boolean,
        rows: number$2,
        rowSpan: number$2,
        sandbox: spaceSeparated$2,
        scope: null,
        scoped: boolean,
        seamless: boolean,
        selected: boolean,
        shape: null,
        size: number$2,
        sizes: null,
        slot: null,
        span: number$2,
        spellCheck: booleanish$2,
        src: null,
        srcDoc: null,
        srcLang: null,
        srcSet: commaSeparated$1,
        start: number$2,
        step: null,
        style: null,
        tabIndex: number$2,
        target: null,
        title: null,
        translate: null,
        type: null,
        typeMustMatch: boolean,
        useMap: null,
        value: booleanish$2,
        width: number$2,
        wrap: null,

        // Legacy.
        // See: https://html.spec.whatwg.org/#other-elements,-attributes-and-apis
        align: null, // Several. Use CSS `text-align` instead,
        aLink: null, // `<body>`. Use CSS `a:active {color}` instead
        archive: spaceSeparated$2, // `<object>`. List of URIs to archives
        axis: null, // `<td>` and `<th>`. Use `scope` on `<th>`
        background: null, // `<body>`. Use CSS `background-image` instead
        bgColor: null, // `<body>` and table elements. Use CSS `background-color` instead
        border: number$2, // `<table>`. Use CSS `border-width` instead,
        borderColor: null, // `<table>`. Use CSS `border-color` instead,
        bottomMargin: number$2, // `<body>`
        cellPadding: null, // `<table>`
        cellSpacing: null, // `<table>`
        char: null, // Several table elements. When `align=char`, sets the character to align on
        charOff: null, // Several table elements. When `char`, offsets the alignment
        classId: null, // `<object>`
        clear: null, // `<br>`. Use CSS `clear` instead
        code: null, // `<object>`
        codeBase: null, // `<object>`
        codeType: null, // `<object>`
        color: null, // `<font>` and `<hr>`. Use CSS instead
        compact: boolean, // Lists. Use CSS to reduce space between items instead
        declare: boolean, // `<object>`
        event: null, // `<script>`
        face: null, // `<font>`. Use CSS instead
        frame: null, // `<table>`
        frameBorder: null, // `<iframe>`. Use CSS `border` instead
        hSpace: number$2, // `<img>` and `<object>`
        leftMargin: number$2, // `<body>`
        link: null, // `<body>`. Use CSS `a:link {color: *}` instead
        longDesc: null, // `<frame>`, `<iframe>`, and `<img>`. Use an `<a>`
        lowSrc: null, // `<img>`. Use a `<picture>`
        marginHeight: number$2, // `<body>`
        marginWidth: number$2, // `<body>`
        noResize: boolean, // `<frame>`
        noHref: boolean, // `<area>`. Use no href instead of an explicit `nohref`
        noShade: boolean, // `<hr>`. Use background-color and height instead of borders
        noWrap: boolean, // `<td>` and `<th>`
        object: null, // `<applet>`
        profile: null, // `<head>`
        prompt: null, // `<isindex>`
        rev: null, // `<link>`
        rightMargin: number$2, // `<body>`
        rules: null, // `<table>`
        scheme: null, // `<meta>`
        scrolling: booleanish$2, // `<frame>`. Use overflow in the child context
        standby: null, // `<object>`
        summary: null, // `<table>`
        text: null, // `<body>`. Use CSS `color` instead
        topMargin: number$2, // `<body>`
        valueType: null, // `<param>`
        version: null, // `<html>`. Use a doctype.
        vAlign: null, // Several. Use CSS `vertical-align` instead
        vLink: null, // `<body>`. Use CSS `a:visited {color}` instead
        vSpace: number$2, // `<img>` and `<object>`

        // Non-standard Properties.
        allowTransparency: null,
        autoCorrect: null,
        autoSave: null,
        disablePictureInPicture: boolean,
        disableRemotePlayback: boolean,
        prefix: null,
        property: null,
        results: number$2,
        security: null,
        unselectable: null
      }
    });

    var html_1 = merge_1([xml, xlink, xmlns, aria, html]);

    var boolean$1 = types.boolean;
    var number$3 = types.number;
    var spaceSeparated$3 = types.spaceSeparated;
    var commaSeparated$2 = types.commaSeparated;
    var commaOrSpaceSeparated$1 = types.commaOrSpaceSeparated;

    var svg = create_1({
      space: 'svg',
      attributes: {
        accentHeight: 'accent-height',
        alignmentBaseline: 'alignment-baseline',
        arabicForm: 'arabic-form',
        baselineShift: 'baseline-shift',
        capHeight: 'cap-height',
        className: 'class',
        clipPath: 'clip-path',
        clipRule: 'clip-rule',
        colorInterpolation: 'color-interpolation',
        colorInterpolationFilters: 'color-interpolation-filters',
        colorProfile: 'color-profile',
        colorRendering: 'color-rendering',
        crossOrigin: 'crossorigin',
        dataType: 'datatype',
        dominantBaseline: 'dominant-baseline',
        enableBackground: 'enable-background',
        fillOpacity: 'fill-opacity',
        fillRule: 'fill-rule',
        floodColor: 'flood-color',
        floodOpacity: 'flood-opacity',
        fontFamily: 'font-family',
        fontSize: 'font-size',
        fontSizeAdjust: 'font-size-adjust',
        fontStretch: 'font-stretch',
        fontStyle: 'font-style',
        fontVariant: 'font-variant',
        fontWeight: 'font-weight',
        glyphName: 'glyph-name',
        glyphOrientationHorizontal: 'glyph-orientation-horizontal',
        glyphOrientationVertical: 'glyph-orientation-vertical',
        hrefLang: 'hreflang',
        horizAdvX: 'horiz-adv-x',
        horizOriginX: 'horiz-origin-x',
        horizOriginY: 'horiz-origin-y',
        imageRendering: 'image-rendering',
        letterSpacing: 'letter-spacing',
        lightingColor: 'lighting-color',
        markerEnd: 'marker-end',
        markerMid: 'marker-mid',
        markerStart: 'marker-start',
        navDown: 'nav-down',
        navDownLeft: 'nav-down-left',
        navDownRight: 'nav-down-right',
        navLeft: 'nav-left',
        navNext: 'nav-next',
        navPrev: 'nav-prev',
        navRight: 'nav-right',
        navUp: 'nav-up',
        navUpLeft: 'nav-up-left',
        navUpRight: 'nav-up-right',
        onAbort: 'onabort',
        onActivate: 'onactivate',
        onAfterPrint: 'onafterprint',
        onBeforePrint: 'onbeforeprint',
        onBegin: 'onbegin',
        onCancel: 'oncancel',
        onCanPlay: 'oncanplay',
        onCanPlayThrough: 'oncanplaythrough',
        onChange: 'onchange',
        onClick: 'onclick',
        onClose: 'onclose',
        onCopy: 'oncopy',
        onCueChange: 'oncuechange',
        onCut: 'oncut',
        onDblClick: 'ondblclick',
        onDrag: 'ondrag',
        onDragEnd: 'ondragend',
        onDragEnter: 'ondragenter',
        onDragExit: 'ondragexit',
        onDragLeave: 'ondragleave',
        onDragOver: 'ondragover',
        onDragStart: 'ondragstart',
        onDrop: 'ondrop',
        onDurationChange: 'ondurationchange',
        onEmptied: 'onemptied',
        onEnd: 'onend',
        onEnded: 'onended',
        onError: 'onerror',
        onFocus: 'onfocus',
        onFocusIn: 'onfocusin',
        onFocusOut: 'onfocusout',
        onHashChange: 'onhashchange',
        onInput: 'oninput',
        onInvalid: 'oninvalid',
        onKeyDown: 'onkeydown',
        onKeyPress: 'onkeypress',
        onKeyUp: 'onkeyup',
        onLoad: 'onload',
        onLoadedData: 'onloadeddata',
        onLoadedMetadata: 'onloadedmetadata',
        onLoadStart: 'onloadstart',
        onMessage: 'onmessage',
        onMouseDown: 'onmousedown',
        onMouseEnter: 'onmouseenter',
        onMouseLeave: 'onmouseleave',
        onMouseMove: 'onmousemove',
        onMouseOut: 'onmouseout',
        onMouseOver: 'onmouseover',
        onMouseUp: 'onmouseup',
        onMouseWheel: 'onmousewheel',
        onOffline: 'onoffline',
        onOnline: 'ononline',
        onPageHide: 'onpagehide',
        onPageShow: 'onpageshow',
        onPaste: 'onpaste',
        onPause: 'onpause',
        onPlay: 'onplay',
        onPlaying: 'onplaying',
        onPopState: 'onpopstate',
        onProgress: 'onprogress',
        onRateChange: 'onratechange',
        onRepeat: 'onrepeat',
        onReset: 'onreset',
        onResize: 'onresize',
        onScroll: 'onscroll',
        onSeeked: 'onseeked',
        onSeeking: 'onseeking',
        onSelect: 'onselect',
        onShow: 'onshow',
        onStalled: 'onstalled',
        onStorage: 'onstorage',
        onSubmit: 'onsubmit',
        onSuspend: 'onsuspend',
        onTimeUpdate: 'ontimeupdate',
        onToggle: 'ontoggle',
        onUnload: 'onunload',
        onVolumeChange: 'onvolumechange',
        onWaiting: 'onwaiting',
        onZoom: 'onzoom',
        overlinePosition: 'overline-position',
        overlineThickness: 'overline-thickness',
        paintOrder: 'paint-order',
        panose1: 'panose-1',
        pointerEvents: 'pointer-events',
        referrerPolicy: 'referrerpolicy',
        renderingIntent: 'rendering-intent',
        shapeRendering: 'shape-rendering',
        stopColor: 'stop-color',
        stopOpacity: 'stop-opacity',
        strikethroughPosition: 'strikethrough-position',
        strikethroughThickness: 'strikethrough-thickness',
        strokeDashArray: 'stroke-dasharray',
        strokeDashOffset: 'stroke-dashoffset',
        strokeLineCap: 'stroke-linecap',
        strokeLineJoin: 'stroke-linejoin',
        strokeMiterLimit: 'stroke-miterlimit',
        strokeOpacity: 'stroke-opacity',
        strokeWidth: 'stroke-width',
        tabIndex: 'tabindex',
        textAnchor: 'text-anchor',
        textDecoration: 'text-decoration',
        textRendering: 'text-rendering',
        typeOf: 'typeof',
        underlinePosition: 'underline-position',
        underlineThickness: 'underline-thickness',
        unicodeBidi: 'unicode-bidi',
        unicodeRange: 'unicode-range',
        unitsPerEm: 'units-per-em',
        vAlphabetic: 'v-alphabetic',
        vHanging: 'v-hanging',
        vIdeographic: 'v-ideographic',
        vMathematical: 'v-mathematical',
        vectorEffect: 'vector-effect',
        vertAdvY: 'vert-adv-y',
        vertOriginX: 'vert-origin-x',
        vertOriginY: 'vert-origin-y',
        wordSpacing: 'word-spacing',
        writingMode: 'writing-mode',
        xHeight: 'x-height',
        // These were camelcased in Tiny. Now lowercased in SVG 2
        playbackOrder: 'playbackorder',
        timelineBegin: 'timelinebegin'
      },
      transform: caseSensitiveTransform_1,
      properties: {
        about: commaOrSpaceSeparated$1,
        accentHeight: number$3,
        accumulate: null,
        additive: null,
        alignmentBaseline: null,
        alphabetic: number$3,
        amplitude: number$3,
        arabicForm: null,
        ascent: number$3,
        attributeName: null,
        attributeType: null,
        azimuth: number$3,
        bandwidth: null,
        baselineShift: null,
        baseFrequency: null,
        baseProfile: null,
        bbox: null,
        begin: null,
        bias: number$3,
        by: null,
        calcMode: null,
        capHeight: number$3,
        className: spaceSeparated$3,
        clip: null,
        clipPath: null,
        clipPathUnits: null,
        clipRule: null,
        color: null,
        colorInterpolation: null,
        colorInterpolationFilters: null,
        colorProfile: null,
        colorRendering: null,
        content: null,
        contentScriptType: null,
        contentStyleType: null,
        crossOrigin: null,
        cursor: null,
        cx: null,
        cy: null,
        d: null,
        dataType: null,
        defaultAction: null,
        descent: number$3,
        diffuseConstant: number$3,
        direction: null,
        display: null,
        dur: null,
        divisor: number$3,
        dominantBaseline: null,
        download: boolean$1,
        dx: null,
        dy: null,
        edgeMode: null,
        editable: null,
        elevation: number$3,
        enableBackground: null,
        end: null,
        event: null,
        exponent: number$3,
        externalResourcesRequired: null,
        fill: null,
        fillOpacity: number$3,
        fillRule: null,
        filter: null,
        filterRes: null,
        filterUnits: null,
        floodColor: null,
        floodOpacity: null,
        focusable: null,
        focusHighlight: null,
        fontFamily: null,
        fontSize: null,
        fontSizeAdjust: null,
        fontStretch: null,
        fontStyle: null,
        fontVariant: null,
        fontWeight: null,
        format: null,
        fr: null,
        from: null,
        fx: null,
        fy: null,
        g1: commaSeparated$2,
        g2: commaSeparated$2,
        glyphName: commaSeparated$2,
        glyphOrientationHorizontal: null,
        glyphOrientationVertical: null,
        glyphRef: null,
        gradientTransform: null,
        gradientUnits: null,
        handler: null,
        hanging: number$3,
        hatchContentUnits: null,
        hatchUnits: null,
        height: null,
        href: null,
        hrefLang: null,
        horizAdvX: number$3,
        horizOriginX: number$3,
        horizOriginY: number$3,
        id: null,
        ideographic: number$3,
        imageRendering: null,
        initialVisibility: null,
        in: null,
        in2: null,
        intercept: number$3,
        k: number$3,
        k1: number$3,
        k2: number$3,
        k3: number$3,
        k4: number$3,
        kernelMatrix: commaOrSpaceSeparated$1,
        kernelUnitLength: null,
        keyPoints: null, // SEMI_COLON_SEPARATED
        keySplines: null, // SEMI_COLON_SEPARATED
        keyTimes: null, // SEMI_COLON_SEPARATED
        kerning: null,
        lang: null,
        lengthAdjust: null,
        letterSpacing: null,
        lightingColor: null,
        limitingConeAngle: number$3,
        local: null,
        markerEnd: null,
        markerMid: null,
        markerStart: null,
        markerHeight: null,
        markerUnits: null,
        markerWidth: null,
        mask: null,
        maskContentUnits: null,
        maskUnits: null,
        mathematical: null,
        max: null,
        media: null,
        mediaCharacterEncoding: null,
        mediaContentEncodings: null,
        mediaSize: number$3,
        mediaTime: null,
        method: null,
        min: null,
        mode: null,
        name: null,
        navDown: null,
        navDownLeft: null,
        navDownRight: null,
        navLeft: null,
        navNext: null,
        navPrev: null,
        navRight: null,
        navUp: null,
        navUpLeft: null,
        navUpRight: null,
        numOctaves: null,
        observer: null,
        offset: null,
        onAbort: null,
        onActivate: null,
        onAfterPrint: null,
        onBeforePrint: null,
        onBegin: null,
        onCancel: null,
        onCanPlay: null,
        onCanPlayThrough: null,
        onChange: null,
        onClick: null,
        onClose: null,
        onCopy: null,
        onCueChange: null,
        onCut: null,
        onDblClick: null,
        onDrag: null,
        onDragEnd: null,
        onDragEnter: null,
        onDragExit: null,
        onDragLeave: null,
        onDragOver: null,
        onDragStart: null,
        onDrop: null,
        onDurationChange: null,
        onEmptied: null,
        onEnd: null,
        onEnded: null,
        onError: null,
        onFocus: null,
        onFocusIn: null,
        onFocusOut: null,
        onHashChange: null,
        onInput: null,
        onInvalid: null,
        onKeyDown: null,
        onKeyPress: null,
        onKeyUp: null,
        onLoad: null,
        onLoadedData: null,
        onLoadedMetadata: null,
        onLoadStart: null,
        onMessage: null,
        onMouseDown: null,
        onMouseEnter: null,
        onMouseLeave: null,
        onMouseMove: null,
        onMouseOut: null,
        onMouseOver: null,
        onMouseUp: null,
        onMouseWheel: null,
        onOffline: null,
        onOnline: null,
        onPageHide: null,
        onPageShow: null,
        onPaste: null,
        onPause: null,
        onPlay: null,
        onPlaying: null,
        onPopState: null,
        onProgress: null,
        onRateChange: null,
        onRepeat: null,
        onReset: null,
        onResize: null,
        onScroll: null,
        onSeeked: null,
        onSeeking: null,
        onSelect: null,
        onShow: null,
        onStalled: null,
        onStorage: null,
        onSubmit: null,
        onSuspend: null,
        onTimeUpdate: null,
        onToggle: null,
        onUnload: null,
        onVolumeChange: null,
        onWaiting: null,
        onZoom: null,
        opacity: null,
        operator: null,
        order: null,
        orient: null,
        orientation: null,
        origin: null,
        overflow: null,
        overlay: null,
        overlinePosition: number$3,
        overlineThickness: number$3,
        paintOrder: null,
        panose1: null,
        path: null,
        pathLength: number$3,
        patternContentUnits: null,
        patternTransform: null,
        patternUnits: null,
        phase: null,
        ping: spaceSeparated$3,
        pitch: null,
        playbackOrder: null,
        pointerEvents: null,
        points: null,
        pointsAtX: number$3,
        pointsAtY: number$3,
        pointsAtZ: number$3,
        preserveAlpha: null,
        preserveAspectRatio: null,
        primitiveUnits: null,
        propagate: null,
        property: commaOrSpaceSeparated$1,
        r: null,
        radius: null,
        referrerPolicy: null,
        refX: null,
        refY: null,
        rel: commaOrSpaceSeparated$1,
        rev: commaOrSpaceSeparated$1,
        renderingIntent: null,
        repeatCount: null,
        repeatDur: null,
        requiredExtensions: commaOrSpaceSeparated$1,
        requiredFeatures: commaOrSpaceSeparated$1,
        requiredFonts: commaOrSpaceSeparated$1,
        requiredFormats: commaOrSpaceSeparated$1,
        resource: null,
        restart: null,
        result: null,
        rotate: null,
        rx: null,
        ry: null,
        scale: null,
        seed: null,
        shapeRendering: null,
        side: null,
        slope: null,
        snapshotTime: null,
        specularConstant: number$3,
        specularExponent: number$3,
        spreadMethod: null,
        spacing: null,
        startOffset: null,
        stdDeviation: null,
        stemh: null,
        stemv: null,
        stitchTiles: null,
        stopColor: null,
        stopOpacity: null,
        strikethroughPosition: number$3,
        strikethroughThickness: number$3,
        string: null,
        stroke: null,
        strokeDashArray: commaOrSpaceSeparated$1,
        strokeDashOffset: null,
        strokeLineCap: null,
        strokeLineJoin: null,
        strokeMiterLimit: number$3,
        strokeOpacity: number$3,
        strokeWidth: null,
        style: null,
        surfaceScale: number$3,
        syncBehavior: null,
        syncBehaviorDefault: null,
        syncMaster: null,
        syncTolerance: null,
        syncToleranceDefault: null,
        systemLanguage: commaOrSpaceSeparated$1,
        tabIndex: number$3,
        tableValues: null,
        target: null,
        targetX: number$3,
        targetY: number$3,
        textAnchor: null,
        textDecoration: null,
        textRendering: null,
        textLength: null,
        timelineBegin: null,
        title: null,
        transformBehavior: null,
        type: null,
        typeOf: commaOrSpaceSeparated$1,
        to: null,
        transform: null,
        u1: null,
        u2: null,
        underlinePosition: number$3,
        underlineThickness: number$3,
        unicode: null,
        unicodeBidi: null,
        unicodeRange: null,
        unitsPerEm: number$3,
        values: null,
        vAlphabetic: number$3,
        vMathematical: number$3,
        vectorEffect: null,
        vHanging: number$3,
        vIdeographic: number$3,
        version: null,
        vertAdvY: number$3,
        vertOriginX: number$3,
        vertOriginY: number$3,
        viewBox: null,
        viewTarget: null,
        visibility: null,
        width: null,
        widths: null,
        wordSpacing: null,
        writingMode: null,
        x: null,
        x1: null,
        x2: null,
        xChannelSelector: null,
        xHeight: number$3,
        y: null,
        y1: null,
        y2: null,
        yChannelSelector: null,
        z: null,
        zoomAndPan: null
      }
    });

    var svg_1 = merge_1([xml, xlink, xmlns, aria, svg]);

    var parse_1 = parse$1;
    var stringify_1 = stringify;

    var comma = ',';
    var space$1 = ' ';
    var empty = '';

    // Parse comma-separated tokens to an array.
    function parse$1(value) {
      var values = [];
      var input = String(value || empty);
      var index = input.indexOf(comma);
      var lastIndex = 0;
      var end = false;
      var val;

      while (!end) {
        if (index === -1) {
          index = input.length;
          end = true;
        }

        val = input.slice(lastIndex, index).trim();

        if (val || !end) {
          values.push(val);
        }

        lastIndex = index + 1;
        index = input.indexOf(comma, lastIndex);
      }

      return values
    }

    // Compile an array to comma-separated tokens.
    // `options.padLeft` (default: `true`) pads a space left of each token, and
    // `options.padRight` (default: `false`) pads a space to the right of each token.
    function stringify(values, options) {
      var settings = options || {};
      var left = settings.padLeft === false ? empty : space$1;
      var right = settings.padRight ? space$1 : empty;

      // Ensure the last empty entry is seen.
      if (values[values.length - 1] === empty) {
        values = values.concat(empty);
      }

      return values.join(right + comma + left).trim()
    }

    var commaSeparatedTokens = {
    	parse: parse_1,
    	stringify: stringify_1
    };

    // See https://tools.ietf.org/html/rfc4647#section-3.1
    // for more information on the algorithms.

    var dash = '-';
    var asterisk = '*';

    var basicFilter = factory$1(basic, true);
    var extendedFilter = factory$1(extended, true);
    var lookup_1 = factory$1(lookup);

    // Basic Filtering (Section 3.3.1) matches a language priority list consisting
    // of basic language ranges (Section 2.1) to sets of language tags.
    function basic(tag, range) {
      tag = lower(tag);
      range = lower(range);
      return range === asterisk || tag === range || tag.indexOf(range + dash) !== -1
    }

    // Extended Filtering (Section 3.3.2) matches a language priority list
    // consisting of extended language ranges (Section 2.2) to sets of language
    // tags.
    function extended(tag, range) {
      // 3.3.2.1
      var tags = lower(tag).split(dash);
      var ranges = lower(range).split(dash);
      var length = ranges.length;
      var rangeIndex = -1;
      var tagIndex = -1;

      tag = tags[++tagIndex];
      range = ranges[++rangeIndex];

      // 3.3.2.2
      if (range !== asterisk && range !== tag) {
        return false
      }

      tag = tags[++tagIndex];
      range = ranges[++rangeIndex];

      // 3.3.2.3
      while (rangeIndex < length) {
        // 3.3.2.3.A
        if (range === asterisk) {
          range = ranges[++rangeIndex];
          continue
        }

        // 3.3.2.3.B
        if (!tag) {
          return false
        }

        // 3.3.2.3.C
        if (tag === range) {
          tag = tags[++tagIndex];
          range = ranges[++rangeIndex];
          continue
        }

        // 3.3.2.3.D
        if (tag.length === 1) {
          return false
        }

        // 3.3.2.3.E
        tag = tags[++tagIndex];
      }

      // 3.3.2.4
      return true
    }

    // Lookup (Section 3.4) matches a language priority list consisting of basic
    // language ranges to sets of language tags to find the one exact language tag
    // that best matches the range.
    function lookup(tag, range) {
      var pos;

      tag = lower(tag);
      range = lower(range);

      /* eslint-disable no-constant-condition */
      while (true) {
        /* eslint-enable no-constant-condition */
        if (range === asterisk || tag === range) {
          return true
        }

        pos = range.lastIndexOf(dash);

        if (pos === -1) {
          return false
        }

        if (pos > 3 && range.charAt(pos - 2) === dash) {
          pos -= 2;
        }

        range = range.slice(0, pos);
      }
    }

    // Factory to perform a filter or a lookup.
    // This factory creates a function that accepts a list of tags and a list of
    // ranges, and contains logic to exit early for lookups.
    // `check` just has to deal with one tag and one range.
    // This match function iterates over ranges, and for each range,
    // iterates over tags.  That way, earlier ranges matching any tag have
    // precedence over later ranges.
    function factory$1(check, filter) {
      return match

      function match(tags, ranges) {
        var values = normalize$1(tags, ranges);
        var result = [];
        var next;
        var tagIndex;
        var tagLength;
        var tag;
        var rangeIndex;
        var rangeLength;
        var range;
        var matches;

        tags = values.tags;
        ranges = values.ranges;
        rangeLength = ranges.length;
        rangeIndex = -1;

        while (++rangeIndex < rangeLength) {
          range = ranges[rangeIndex];

          // Ignore wildcards in lookup mode.
          if (!filter && range === asterisk) {
            continue
          }

          tagLength = tags.length;
          tagIndex = -1;
          next = [];

          while (++tagIndex < tagLength) {
            tag = tags[tagIndex];
            matches = check(tag, range)
            ;(matches ? result : next).push(tag);

            // Exit if this is a lookup and we have a match.
            if (!filter && matches) {
              return tag
            }
          }

          tags = next;
        }

        // If this is a filter, return the list.  If it’s a lookup, we didn’t find
        // a match, so return `undefined`.
        return filter ? result : undefined
      }
    }

    // Normalize options.
    function normalize$1(tags, ranges) {
      ranges = ranges === undefined || ranges === null ? asterisk : ranges;

      return {tags: cast(tags, 'tag'), ranges: cast(ranges, 'range')}
    }

    // Validate tags or ranges, and cast them to arrays.
    function cast(values, name) {
      var value = values && typeof values === 'string' ? [values] : values;

      if (!value || typeof value !== 'object' || !('length' in value)) {
        throw new Error(
          'Invalid ' + name + ' `' + value + '`, expected non-empty string'
        )
      }

      return value
    }

    function lower(value) {
      return value.toLowerCase()
    }

    var bcp47Match = {
    	basicFilter: basicFilter,
    	extendedFilter: extendedFilter,
    	lookup: lookup_1
    };

    var not_1 = not;

    function not(f) {
        return negation

        function negation() {
            return !f.apply(this, arguments)
        }
    }

    var hastUtilIsElement = isElement;

    // Check if if `node` is an `element` and, if `tagNames` is given, `node`
    // matches them `tagNames`.
    function isElement(node, tagNames) {
      var name;

      if (
        !(
          tagNames === null ||
          tagNames === undefined ||
          typeof tagNames === 'string' ||
          (typeof tagNames === 'object' && tagNames.length !== 0)
        )
      ) {
        throw new Error(
          'Expected `string` or `Array.<string>` for `tagNames`, not `' +
            tagNames +
            '`'
        )
      }

      if (
        !node ||
        typeof node !== 'object' ||
        node.type !== 'element' ||
        typeof node.tagName !== 'string'
      ) {
        return false
      }

      if (tagNames === null || tagNames === undefined) {
        return true
      }

      name = node.tagName;

      if (typeof tagNames === 'string') {
        return name === tagNames
      }

      return tagNames.indexOf(name) !== -1
    }

    var own$1 = {}.hasOwnProperty;

    var hastUtilHasProperty = hasProperty;

    // Check if `node` has a set `name` property.
    function hasProperty(node, name) {
      var props;
      var value;

      if (!node || !name || typeof node !== 'object' || node.type !== 'element') {
        return false
      }

      props = node.properties;
      value = props && own$1.call(props, name) && props[name];

      return value !== null && value !== undefined && value !== false
    }

    var hastUtilWhitespace = interElementWhiteSpace;

    // HTML white-space expression.
    // See <https://html.spec.whatwg.org/#space-character>.
    var re = /[ \t\n\f\r]/g;

    function interElementWhiteSpace(node) {
      var value;

      if (node && typeof node === 'object' && node.type === 'text') {
        value = node.value || '';
      } else if (typeof node === 'string') {
        value = node;
      } else {
        return false
      }

      return value.replace(re, '') === ''
    }

    var pseudo = match;

    var commaSeparated$3 = commaSeparatedTokens.parse;
    var filter = bcp47Match.extendedFilter;






    match.needsIndex = [
      'first-child',
      'first-of-type',
      'last-child',
      'last-of-type',
      'nth-child',
      'nth-last-child',
      'nth-of-type',
      'nth-last-of-type',
      'only-child',
      'only-of-type'
    ];



    var handle = zwitch('name');
    var handlers = handle.handlers;

    var roots = {html: 'html', svg: 'svg'};
    var disableable = [
      'button',
      'input',
      'select',
      'textarea',
      'optgroup',
      'option',
      'menuitem',
      'fieldset'
    ];
    var linkable = ['a', 'area', 'link'];
    var requirable = ['input', 'textarea', 'select'];

    handle.unknown = unknownPseudo;
    handle.invalid = invalidPseudo;
    handlers.any = matches;
    handlers['any-link'] = anyLink;
    handlers.blank = blank;
    handlers.checked = checked;
    handlers.dir = dir;
    handlers.disabled = disabled;
    handlers.empty = empty$1;
    handlers.enabled = not_1(disabled);
    handlers['first-child'] = firstChild;
    handlers['first-of-type'] = firstOfType;
    handlers.has = hasSelector;
    handlers.lang = lang;
    handlers['last-child'] = lastChild;
    handlers['last-of-type'] = lastOfType;
    handlers.matches = matches;
    handlers.not = not_1(matches);
    handlers['nth-child'] = nthChild;
    handlers['nth-last-child'] = nthLastChild;
    handlers['nth-of-type'] = nthOfType;
    handlers['nth-last-of-type'] = nthLastOfType;
    handlers['only-child'] = onlyChild;
    handlers['only-of-type'] = onlyOfType;
    handlers.optional = not_1(required);
    handlers['read-only'] = not_1(readWrite);
    handlers['read-write'] = readWrite;
    handlers.required = required;
    handlers.root = root;
    handlers.scope = scope;

    function match(query, node, index, parent, state) {
      var pseudos = query.pseudos;
      var length = pseudos.length;
      var offset = -1;

      while (++offset < length) {
        if (!handle(pseudos[offset], node, index, parent, state)) {
          return false
        }
      }

      return true
    }

    function matches(query, node, index, parent, state) {
      var shallow = state.shallow;
      var one = state.one;
      var result;

      state.shallow = true;
      state.one = true;

      result = any(query.value, node, state)[0] === node;

      state.shallow = shallow;
      state.one = one;

      return result
    }

    function anyLink(query, node) {
      return hastUtilIsElement(node, linkable) && hastUtilHasProperty(node, 'href')
    }

    function checked(query, node) {
      var type = node.properties.type;

      if (
        hastUtilIsElement(node, ['input', 'menuitem']) &&
        (type === 'checkbox' || type === 'radio')
      ) {
        return hastUtilHasProperty(node, 'checked')
      }

      if (hastUtilIsElement(node, 'option')) {
        return hastUtilHasProperty(node, 'selected')
      }

      return false
    }

    function dir(query, node, index, parent, state) {
      return state.direction === query.value
    }

    function disabled(query, node) {
      return hastUtilIsElement(node, disableable) && hastUtilHasProperty(node, 'disabled')
    }

    function required(query, node) {
      return hastUtilIsElement(node, requirable) && hastUtilHasProperty(node, 'required')
    }

    function readWrite(query, node, index, parent, state) {
      var inputOrArea = hastUtilIsElement(node, ['input', 'textarea']);

      return (
        (inputOrArea && !hastUtilHasProperty(node, 'readOnly') && !hastUtilHasProperty(node, 'disabled')) ||
        (!inputOrArea && state.editableOrEditingHost)
      )
    }

    function root(query, node, index, parent, state) {
      var space = state.schema.space;
      return (
        (!parent || parent.type === 'root') &&
        space in roots &&
        hastUtilIsElement(node, roots[space])
      )
    }

    function scope(query, node, index, parent, state) {
      return hastUtilIsElement(node) && state.scopeElements.indexOf(node) !== -1
    }

    function empty$1(query, node) {
      return !someChildren(node, check)

      function check(child) {
        return child.type === 'element' || child.type === 'text'
      }
    }

    function blank(query, node) {
      return !someChildren(node, check)

      function check(child) {
        return (
          child.type === 'element' || (child.type === 'text' && !hastUtilWhitespace(child))
        )
      }
    }

    function firstChild(query, node, index, parent, state) {
      assertDeep(state, query);
      return state.elementIndex === 0
    }

    function lang(query, node, index, parent, state) {
      return (
        state.language !== '' &&
        state.language !== undefined &&
        filter(state.language, commaSeparated$3(query.value)).length !== 0
      )
    }

    function lastChild(query, node, index, parent, state) {
      assertDeep(state, query);
      return state.elementIndex === state.elementCount - 1
    }

    function onlyChild(query, node, index, parent, state) {
      assertDeep(state, query);
      return state.elementCount === 1
    }

    function nthChild(query, node, index, parent, state) {
      assertDeep(state, query);
      return query.value(state.elementIndex)
    }

    function nthLastChild(query, node, index, parent, state) {
      assertDeep(state, query);
      return query.value(state.elementCount - state.elementIndex - 1)
    }

    function nthOfType(query, node, index, parent, state) {
      assertDeep(state, query);
      return query.value(state.typeIndex)
    }

    function nthLastOfType(query, node, index, parent, state) {
      assertDeep(state, query);
      return query.value(state.typeCount - 1 - state.typeIndex)
    }

    function firstOfType(query, node, index, parent, state) {
      assertDeep(state, query);
      return state.typeIndex === 0
    }

    function lastOfType(query, node, index, parent, state) {
      assertDeep(state, query);
      return state.typeIndex === state.typeCount - 1
    }

    function onlyOfType(query, node, index, parent, state) {
      assertDeep(state, query);
      return state.typeCount === 1
    }

    function someChildren(node, check) {
      var children = node && node.children;
      var length = children && children.length;
      var index = -1;

      while (++index < length) {
        if (check(children[index])) {
          return true
        }
      }

      return false
    }

    /* istanbul ignore next - Shouldn’t be invoked, parser gives correct data. */
    function invalidPseudo() {
      throw new Error('Invalid pseudo-selector')
    }

    function unknownPseudo(query) {
      if (query.name) {
        throw new Error('Unknown pseudo-selector `' + query.name + '`')
      }

      throw new Error('Unexpected pseudo-element or empty pseudo-class')
    }

    function assertDeep(state, query) {
      if (state.shallow) {
        throw new Error('Cannot use `:' + query.name + '` without parent')
      }
    }

    function hasSelector(query, node, index, parent, state) {
      var shallow = state.shallow;
      var one = state.one;
      var scopeElements = state.scopeElements;
      var value = appendScope(query.value);
      var result;

      state.shallow = false;
      state.one = true;
      state.scopeElements = [node];

      result = any(value, node, state)[0];

      state.shallow = shallow;
      state.one = one;
      state.scopeElements = scopeElements;

      return result
    }

    function appendScope(selector) {
      var selectors;
      var length;
      var index;
      var rule;

      if (selector.type === 'ruleSet') {
        selector = {type: 'selectors', selectors: [selector]};
      }

      selectors = selector.selectors;
      length = selectors.length;
      index = -1;

      while (++index < length) {
        rule = selectors[index].rule;
        rule.nestingOperator = null;

        if (
          !rule.pseudos ||
          rule.pseudos.length !== 1 ||
          rule.pseudos[0].name !== 'scope'
        ) {
          rule = {type: 'rule', rule: rule, pseudos: [{name: 'scope'}]};
        }

        selectors[index] = rule;
      }

      return selector
    }

    var name = match$1;

    function match$1(query, node) {
      return query.tagName === '*' || query.tagName === node.tagName
    }

    var data = 'data';

    var find_1 = find;

    var valid = /^data[-\w.:]+$/i;
    var dash$1 = /-[a-z]/g;
    var cap = /[A-Z]/g;

    function find(schema, value) {
      var normal = normalize_1(value);
      var prop = value;
      var Type = info;

      if (normal in schema.normal) {
        return schema.property[schema.normal[normal]]
      }

      if (normal.length > 4 && normal.slice(0, 4) === data && valid.test(value)) {
        // Attribute or property.
        if (value.charAt(4) === '-') {
          prop = datasetToProperty(value);
        } else {
          value = datasetToAttribute(value);
        }

        Type = definedInfo;
      }

      return new Type(prop, value)
    }

    function datasetToProperty(attribute) {
      var value = attribute.slice(5).replace(dash$1, camelcase);
      return data + value.charAt(0).toUpperCase() + value.slice(1)
    }

    function datasetToAttribute(property) {
      var value = property.slice(4);

      if (dash$1.test(value)) {
        return property
      }

      value = value.replace(cap, kebab);

      if (value.charAt(0) !== '-') {
        value = '-' + value;
      }

      return data + value
    }

    function kebab($0) {
      return '-' + $0.toLowerCase()
    }

    function camelcase($0) {
      return $0.charAt(1).toUpperCase()
    }

    var parse_1$1 = parse$2;
    var stringify_1$1 = stringify$1;

    var empty$2 = '';
    var space$2 = ' ';
    var whiteSpace = /[ \t\n\r\f]+/g;

    function parse$2(value) {
      var input = String(value || empty$2).trim();
      return input === empty$2 ? [] : input.split(whiteSpace)
    }

    function stringify$1(values) {
      return values.join(space$2).trim()
    }

    var spaceSeparatedTokens = {
    	parse: parse_1$1,
    	stringify: stringify_1$1
    };

    var attribute = match$2;




    var spaceSeparated$4 = spaceSeparatedTokens.stringify;
    var commaSeparated$4 = commaSeparatedTokens.stringify;

    var handle$1 = zwitch('operator');
    var handlers$1 = handle$1.handlers;

    handle$1.unknown = unknownOperator;
    handle$1.invalid = exists;
    handlers$1['='] = exact;
    handlers$1['~='] = spaceSeparatedList;
    handlers$1['|='] = exactOrPrefix;
    handlers$1['^='] = begins;
    handlers$1['$='] = ends;
    handlers$1['*='] = contains;

    function match$2(query, node, schema) {
      var attrs = query.attrs;
      var length = attrs.length;
      var index = -1;
      var info;
      var attr;

      while (++index < length) {
        attr = attrs[index];
        info = find_1(schema, attr.name);

        if (!handle$1(attr, node, info)) {
          return false
        }
      }

      return true
    }

    // `[attr]`
    function exists(query, node, info) {
      return hastUtilHasProperty(node, info.property)
    }

    // `[attr=value]`
    function exact(query, node, info) {
      if (!hastUtilHasProperty(node, info.property)) {
        return false
      }

      return normalizeValue(node.properties[info.property], info) === query.value
    }

    // `[attr~=value]`
    function spaceSeparatedList(query, node, info) {
      var val;

      if (!hastUtilHasProperty(node, info.property)) {
        return false
      }

      val = node.properties[info.property];

      // If this is a comma-separated list, and the query is contained in it, return
      // true.
      if (
        typeof val === 'object' &&
        !info.commaSeparated &&
        val.indexOf(query.value) !== -1
      ) {
        return true
      }

      // For all other values (including comma-separated lists), return whether this
      // is an exact match.
      return normalizeValue(val, info) === query.value
    }

    // `[attr|=value]`
    function exactOrPrefix(query, node, info) {
      var value;

      if (!hastUtilHasProperty(node, info.property)) {
        return false
      }

      value = normalizeValue(node.properties[info.property], info);

      return Boolean(
        value === query.value ||
          (value.slice(0, query.value.length) === query.value &&
            value.charAt(query.value.length) === '-')
      )
    }

    // `[attr^=value]`
    function begins(query, node, info) {
      var value;

      if (!hastUtilHasProperty(node, info.property)) {
        return false
      }

      value = normalizeValue(node.properties[info.property], info);

      return value.slice(0, query.value.length) === query.value
    }

    // `[attr$=value]`
    function ends(query, node, info) {
      if (!hastUtilHasProperty(node, info.property)) {
        return false
      }

      return (
        normalizeValue(node.properties[info.property], info).slice(
          -query.value.length
        ) === query.value
      )
    }

    // `[attr*=value]`
    function contains(query, node, info) {
      if (!hastUtilHasProperty(node, info.property)) {
        return false
      }

      return (
        normalizeValue(node.properties[info.property], info).indexOf(
          query.value
        ) !== -1
      )
    }

    /* istanbul ignore next - Shouldn’t be invoked, Parser throws an error instead. */
    function unknownOperator(query) {
      throw new Error('Unknown operator `' + query.operator + '`')
    }

    // Stringify a hast value back to its HTML form.
    function normalizeValue(value, info) {
      if (typeof value === 'number') {
        value = String(value);
      } else if (typeof value === 'boolean') {
        value = info.attribute;
      } else if (typeof value === 'object' && 'length' in value) {
        value = (info.commaSeparated ? commaSeparated$4 : spaceSeparated$4)(value);
      }

      return value
    }

    var className = match$3;

    function match$3(query, node) {
      var prop = node.properties.className || [];
      var classNames = query.classNames;
      var length = classNames.length;
      var index = -1;

      while (++index < length) {
        if (prop.indexOf(classNames[index]) === -1) {
          return false
        }
      }

      return true
    }

    var id = match$4;

    function match$4(query, node) {
      return node.properties.id === query.id
    }

    var test_1 = test;







    function test(query, node, index, parent, state) {
      return Boolean(
        node &&
          node.type === 'element' &&
          (!query.tagName || name(query, node)) &&
          (!query.classNames || className(query, node)) &&
          (!query.id || id(query, node)) &&
          (!query.attrs || attribute(query, node, state.schema)) &&
          (!query.pseudos || pseudo(query, node, index, parent, state))
      )
    }

    var direction_1 = direction;

    var RTL = '\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC';
    var LTR =
      'A-Za-z\u00C0-\u00D6\u00D8-\u00F6' +
      '\u00F8-\u02B8\u0300-\u0590\u0800-\u1FFF\u200E\u2C00-\uFB1C' +
      '\uFE00-\uFE6F\uFEFD-\uFFFF';

    var rtl = new RegExp('^[^' + LTR + ']*[' + RTL + ']');
    var ltr = new RegExp('^[^' + RTL + ']*[' + LTR + ']');

    function direction(value) {
      value = String(value || '');

      if (rtl.test(value)) {
        return 'rtl'
      }

      if (ltr.test(value)) {
        return 'ltr'
      }

      return 'neutral'
    }

    var convert_1 = convert;

    function convert(test) {
      if (typeof test === 'string') {
        return typeFactory(test)
      }

      if (test === null || test === undefined) {
        return ok
      }

      if (typeof test === 'object') {
        return ('length' in test ? anyFactory : matchesFactory)(test)
      }

      if (typeof test === 'function') {
        return test
      }

      throw new Error('Expected function, string, or object as test')
    }

    function convertAll(tests) {
      var results = [];
      var length = tests.length;
      var index = -1;

      while (++index < length) {
        results[index] = convert(tests[index]);
      }

      return results
    }

    // Utility assert each property in `test` is represented in `node`, and each
    // values are strictly equal.
    function matchesFactory(test) {
      return matches

      function matches(node) {
        var key;

        for (key in test) {
          if (node[key] !== test[key]) {
            return false
          }
        }

        return true
      }
    }

    function anyFactory(tests) {
      var checks = convertAll(tests);
      var length = checks.length;

      return matches

      function matches() {
        var index = -1;

        while (++index < length) {
          if (checks[index].apply(this, arguments)) {
            return true
          }
        }

        return false
      }
    }

    // Utility to convert a string into a function which checks a given node’s type
    // for said string.
    function typeFactory(test) {
      return type

      function type(node) {
        return Boolean(node && node.type === test)
      }
    }

    // Utility to return true.
    function ok() {
      return true
    }

    var unistUtilVisitParents = visitParents;



    var CONTINUE = true;
    var SKIP = 'skip';
    var EXIT = false;

    visitParents.CONTINUE = CONTINUE;
    visitParents.SKIP = SKIP;
    visitParents.EXIT = EXIT;

    function visitParents(tree, test, visitor, reverse) {
      var is;

      if (typeof test === 'function' && typeof visitor !== 'function') {
        reverse = visitor;
        visitor = test;
        test = null;
      }

      is = convert_1(test);

      one(tree, null, []);

      // Visit a single node.
      function one(node, index, parents) {
        var result = [];
        var subresult;

        if (!test || is(node, index, parents[parents.length - 1] || null)) {
          result = toResult(visitor(node, parents));

          if (result[0] === EXIT) {
            return result
          }
        }

        if (node.children && result[0] !== SKIP) {
          subresult = toResult(all(node.children, parents.concat(node)));
          return subresult[0] === EXIT ? subresult : result
        }

        return result
      }

      // Visit children in `parent`.
      function all(children, parents) {
        var min = -1;
        var step = reverse ? -1 : 1;
        var index = (reverse ? children.length : min) + step;
        var result;

        while (index > min && index < children.length) {
          result = one(children[index], index, parents);

          if (result[0] === EXIT) {
            return result
          }

          index = typeof result[1] === 'number' ? result[1] : index + step;
        }
      }
    }

    function toResult(value) {
      if (value !== null && typeof value === 'object' && 'length' in value) {
        return value
      }

      if (typeof value === 'number') {
        return [CONTINUE, value]
      }

      return [value]
    }

    var unistUtilVisit = visit;



    var CONTINUE$1 = unistUtilVisitParents.CONTINUE;
    var SKIP$1 = unistUtilVisitParents.SKIP;
    var EXIT$1 = unistUtilVisitParents.EXIT;

    visit.CONTINUE = CONTINUE$1;
    visit.SKIP = SKIP$1;
    visit.EXIT = EXIT$1;

    function visit(tree, test, visitor, reverse) {
      if (typeof test === 'function' && typeof visitor !== 'function') {
        reverse = visitor;
        visitor = test;
        test = null;
      }

      unistUtilVisitParents(tree, test, overload, reverse);

      function overload(node, parents) {
        var parent = parents[parents.length - 1];
        var index = parent ? parent.children.indexOf(node) : null;
        return visitor(node, index, parent)
      }
    }

    /**
     * @fileoverview
     *   Get the plain-text value of a hast node.
     * @longdescription
     *   ## Use
     *
     *   ```js
     *   var h = require('hastscript')
     *   var toString = require('hast-util-to-string')
     *
     *   toString(h('p', 'Alpha'))
     *   //=> 'Alpha'
     *   toString(h('div', [h('b', 'Bold'), ' and ', h('i', 'italic'), '.']))
     *   //=> 'Bold and italic.'
     *   ```
     *
     *   ## API
     *
     *   ### `toString(node)`
     *
     *   Transform a node to a string.
     */

    var hastUtilToString = toString;

    function toString(node) {
      // “The concatenation of data of all the Text node descendants of the context
      // object, in tree order.”
      if ('children' in node) {
        return all(node)
      }

      // “Context object’s data.”
      return 'value' in node ? node.value : ''
    }

    function one(node) {
      if (node.type === 'text') {
        return node.value
      }

      return node.children ? all(node) : ''
    }

    function all(node) {
      var children = node.children;
      var length = children.length;
      var index = -1;
      var result = [];

      while (++index < length) {
        result[index] = one(children[index]);
      }

      return result.join('')
    }

    var enterState = enter;







    var ltr$1 = 'ltr';
    var rtl$1 = 'rtl';
    var auto = 'auto';
    var valueTypes = ['text', 'search', 'tel', 'url', 'email'];
    var validDirections = [ltr$1, rtl$1, auto];
    var ignoreElements = ['bdi', 'script', 'style', 'textare'];

    // eslint-disable-next-line complexity
    function enter(state, node) {
      var schema = state.schema;
      var space = schema.space;
      var language = state.language;
      var currentDirection = state.direction;
      var editableOrEditingHost = state.editableOrEditingHost;
      var props = node.properties;
      var dirInferred;
      var type;
      var found;
      var lang;
      var dir;

      if (node.type === 'element') {
        lang = props.xmlLang || props.lang;
        type = props.type || 'text';
        dir = dirProperty(node);

        if (lang !== undefined && lang !== null) {
          state.language = lang;
          found = true;
        }

        // Turn off editing mode in non-HTML spaces.
        if (space !== 'html' && state.editableOrEditingHost) {
          state.editableOrEditingHost = false;
          found = true;
        }

        if (space === 'html') {
          if (props.contentEditable === 'true') {
            state.editableOrEditingHost = true;
            found = true;
          }

          if (hastUtilIsElement(node, 'svg')) {
            state.schema = svg_1;
            space = 'svg';
            found = true;
          }

          // See: <https://html.spec.whatwg.org/#the-directionality>.
          // Explicit `[dir=rtl]`.
          if (dir === rtl$1) {
            dirInferred = dir;
          } else if (
            // Explicit `[dir=ltr]`.
            dir === ltr$1 ||
            // HTML with an invalid or no `[dir]`.
            (dir !== auto && hastUtilIsElement(node, 'html')) ||
            // `input[type=tel]` with an invalid or no `[dir]`.
            (dir !== auto && hastUtilIsElement(node, 'input') && props.type === 'tel')
          ) {
            dirInferred = ltr$1;
            // `[dir=auto]` or `bdi` with an invalid or no `[dir]`.
          } else if (dir === auto || hastUtilIsElement(node, 'bdi')) {
            if (hastUtilIsElement(node, 'textarea')) {
              // Check contents of `<textarea>`.
              dirInferred = dirBidi(hastUtilToString(node));
            } else if (hastUtilIsElement(node, 'input') && valueTypes.indexOf(type) !== -1) {
              // Check value of `<input>`.
              dirInferred = props.value ? dirBidi(props.value) : ltr$1;
            } else {
              // Check text nodes in `node`.
              unistUtilVisit(node, inferDirectionality);
            }
          }

          if (dirInferred) {
            state.direction = dirInferred;
            found = true;
          }
        }
      }

      return found ? reset : noop$2

      function reset() {
        state.schema = schema;
        state.language = language;
        state.direction = currentDirection;
        state.editableOrEditingHost = editableOrEditingHost;
      }

      function inferDirectionality(child) {
        if (child.type === 'text') {
          dirInferred = dirBidi(child.value);
          return dirInferred ? unistUtilVisit.EXIT : null
        }

        if (child !== node && (hastUtilIsElement(child, ignoreElements) || dirProperty(child))) {
          return unistUtilVisit.SKIP
        }
      }
    }

    function dirBidi(value) {
      var val = direction_1(value);
      return val === 'neutral' ? null : val
    }

    function dirProperty(node) {
      var val = node.properties.dir;
      val = typeof val === 'string' ? val.toLowerCase() : null;
      return validDirections.indexOf(val) === -1 ? null : val
    }

    function noop$2() {}

    var nest = match$5;




    var own$2 = {}.hasOwnProperty;
    var slice = [].slice;

    var handle$2 = zwitch('nestingOperator');
    var handlers$2 = handle$2.handlers;

    handle$2.unknown = unknownNesting;
    handle$2.invalid = topScan; // `undefined` is the top query selector.
    handlers$2.null = descendant; // `null` is the descendant combinator.
    handlers$2['>'] = child;
    handlers$2['+'] = nextSibling;
    handlers$2['~'] = subsequentSibling;

    function match$5(query, node, index, parent, state) {
      return handle$2(query, node, index, parent, state)
    }

    /* istanbul ignore next - Shouldn’t be invoked, parser gives correct data. */
    function unknownNesting(query) {
      throw new Error('Unexpected nesting `' + query.nestingOperator + '`')
    }

    function topScan(query, node, index, parent, state) {
      /* istanbul ignore if - Shouldn’t happen. */
      if (parent) {
        throw new Error('topScan is supposed to be called from the root node')
      }

      state.iterator.apply(null, arguments);

      if (!state.shallow) {
        descendant.apply(this, arguments);
      }
    }

    function descendant(query, node, index, parent, state) {
      var prev = state.iterator;

      state.iterator = iterator;

      child.apply(this, arguments);

      function iterator() {
        state.iterator = prev;
        prev.apply(this, arguments);
        state.iterator = iterator;

        if (state.one && state.found) {
          return
        }

        child.apply(this, [query].concat(slice.call(arguments, 1)));
      }
    }

    function child(query, node, index, parent, state) {
      if (!node.children || node.children.length === 0) {
        return
      }

      indexedSearch(query, node, state);
    }

    function nextSibling(query, node, index, parent, state) {
      /* istanbul ignore if - Shouldn’t happen. */
      if (!parent) {
        return
      }

      indexedSearch(query, parent, state, index + 1, true);
    }

    function subsequentSibling(query, node, index, parent, state) {
      /* istanbul ignore if - Shouldn’t happen. */
      if (!parent) {
        return
      }

      indexedSearch(query, parent, state, index + 1);
    }

    // Handles `typeIndex` and `typeCount` properties for every walker.
    function indexedSearch(query, parent, state, from, firstElementOnly) {
      var needsIndex = state.index;
      var children = parent.children;
      var length = children.length;
      var delayed = [];
      var index = 0;
      var types = {};
      var elements = 0;
      var handle = needsIndex ? delay : add;
      var child;

      // Start looking at `from`
      if (from === undefined) {
        from = 0;
      }

      // Exit if there are no further nodes.
      if (from >= length) {
        return
      }

      // If we need to index for types, do so for all elements before `from`.
      if (needsIndex) {
        while (index < from) {
          child = children[index];

          if (child.type === 'element') {
            count(child.tagName);
          }

          index++;
        }
      }

      index = from;

      while (index < length) {
        child = children[index];

        // Only check elements.
        // Check either all elements, or only check the first sibling
        if (child.type === 'element') {
          handle(child, index);

          // Stop if we’re looking for one node and it’s already found.
          if (state.one && state.found) {
            return
          }

          if (firstElementOnly) {
            break
          }
        }

        index++;
      }

      if (needsIndex) {
        index = -1;
        length = delayed.length;

        while (++index < length) {
          delayed[index]();

          // Stop if we’re looking for one node and it’s already found.
          if (state.one && state.found) {
            // To do: maybe return?
            return
          }
        }
      }

      function delay(node, childIndex) {
        var name = node.tagName;
        var elementsBefore = elements;
        var elementsByTypeBefore = own$2.call(types, name) ? types[name] : 0;

        count(name);

        delayed.push(fn);

        function fn() {
          // Before counting further elements:
          state.elementIndex = elementsBefore;
          state.typeIndex = elementsByTypeBefore;

          // After counting all elements.
          state.elementCount = elements;
          state.typeCount = types[name];

          add(node, childIndex);
        }
      }

      function add(node, childIndex) {
        var exit = enterState(state, node);
        state.iterator(query, node, childIndex, parent, state);
        exit();
      }

      function count(name) {
        if (!own$2.call(types, name)) {
          types[name] = 0;
        }

        elements++;
        types[name]++;
      }
    }

    var any = match$6;




    var needsIndex = pseudo.needsIndex;




    var type = zwitch('type');
    var handlers$3 = type.handlers;

    type.unknown = unknownType;
    type.invalid = invalidType;
    handlers$3.selectors = selectors;
    handlers$3.ruleSet = ruleSet;
    handlers$3.rule = rule;

    function match$6(query, node, state) {
      return query && node ? type(query, node, state) : []
    }

    function selectors(query, node, state) {
      var collect = collector(state.one);
      var ruleSets = query.selectors;
      var length = ruleSets.length;
      var index = -1;

      while (++index < length) {
        collect(ruleSet(ruleSets[index], node, state));
      }

      return collect.result
    }

    function ruleSet(query, node, state) {
      return rule(query.rule, node, state)
    }

    function rule(query, tree, state) {
      var collect = collector(state.one);
      var opts = {
        schema: state.space === 'svg' ? svg_1 : html_1,
        language: undefined,
        direction: 'ltr',
        editableOrEditingHost: false,
        scopeElements: tree.type === 'root' ? tree.children : [tree],
        iterator: match,
        one: state.one,
        shallow: state.shallow
      };

      if (state.shallow && query.rule) {
        throw new Error('Expected selector without nesting')
      }

      nest(query, tree, 0, null, configure(query, opts));

      return collect.result

      function match(query, node, index, parent, state) {
        var exit = enterState(state, node);

        if (test_1(query, node, index, parent, state)) {
          if (query.rule) {
            nest(query.rule, node, index, parent, configure(query.rule, state));
          } else {
            collect(node);
            state.found = true;
          }
        }

        exit();
      }

      function configure(query, state) {
        var pseudos = query.pseudos;
        var length = pseudos && pseudos.length;
        var index = -1;

        while (++index < length) {
          if (needsIndex.indexOf(pseudos[index].name) !== -1) {
            state.index = true;
            break
          }
        }

        return state
      }
    }

    /* istanbul ignore next - Shouldn’t be invoked, all data is handled. */
    function unknownType(query) {
      throw new Error('Unknown type `' + query.type + '`')
    }

    /* istanbul ignore next - Shouldn’t be invoked, parser gives correct data. */
    function invalidType() {
      throw new Error('Invalid type')
    }

    function collector(one) {
      var result = [];
      var found;

      collect.result = result;

      return collect

      // Append elements to array, filtering out duplicates.
      function collect(source) {
        if ('length' in source) {
          collectAll();
        } else {
          collectOne(source);
        }

        function collectAll() {
          var length = source.length;
          var index = -1;

          while (++index < length) {
            collectOne(source[index]);
          }
        }

        function collectOne(element) {
          if (one) {
            /* istanbul ignore if - shouldn’t happen, safeguards performance problems. */
            if (found) {
              throw new Error('Cannot collect multiple nodes')
            }

            found = true;
          }

          if (result.indexOf(element) === -1) {
            result.push(element);
          }
        }
      }
    }

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function unwrapExports (x) {
    	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
    }

    function createCommonjsModule(fn, module) {
    	return module = { exports: {} }, fn(module, module.exports), module.exports;
    }

    var utils = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    function isIdentStart(c) {
        return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c === '-') || (c === '_');
    }
    exports.isIdentStart = isIdentStart;
    function isIdent(c) {
        return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c === '-' || c === '_';
    }
    exports.isIdent = isIdent;
    function isHex(c) {
        return (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F') || (c >= '0' && c <= '9');
    }
    exports.isHex = isHex;
    function escapeIdentifier(s) {
        var len = s.length;
        var result = '';
        var i = 0;
        while (i < len) {
            var chr = s.charAt(i);
            if (exports.identSpecialChars[chr]) {
                result += '\\' + chr;
            }
            else {
                if (!(chr === '_' || chr === '-' ||
                    (chr >= 'A' && chr <= 'Z') ||
                    (chr >= 'a' && chr <= 'z') ||
                    (i !== 0 && chr >= '0' && chr <= '9'))) {
                    var charCode = chr.charCodeAt(0);
                    if ((charCode & 0xF800) === 0xD800) {
                        var extraCharCode = s.charCodeAt(i++);
                        if ((charCode & 0xFC00) !== 0xD800 || (extraCharCode & 0xFC00) !== 0xDC00) {
                            throw Error('UCS-2(decode): illegal sequence');
                        }
                        charCode = ((charCode & 0x3FF) << 10) + (extraCharCode & 0x3FF) + 0x10000;
                    }
                    result += '\\' + charCode.toString(16) + ' ';
                }
                else {
                    result += chr;
                }
            }
            i++;
        }
        return result;
    }
    exports.escapeIdentifier = escapeIdentifier;
    function escapeStr(s) {
        var len = s.length;
        var result = '';
        var i = 0;
        var replacement;
        while (i < len) {
            var chr = s.charAt(i);
            if (chr === '"') {
                chr = '\\"';
            }
            else if (chr === '\\') {
                chr = '\\\\';
            }
            else if ((replacement = exports.strReplacementsRev[chr]) !== undefined) {
                chr = replacement;
            }
            result += chr;
            i++;
        }
        return "\"" + result + "\"";
    }
    exports.escapeStr = escapeStr;
    exports.identSpecialChars = {
        '!': true,
        '"': true,
        '#': true,
        '$': true,
        '%': true,
        '&': true,
        '\'': true,
        '(': true,
        ')': true,
        '*': true,
        '+': true,
        ',': true,
        '.': true,
        '/': true,
        ';': true,
        '<': true,
        '=': true,
        '>': true,
        '?': true,
        '@': true,
        '[': true,
        '\\': true,
        ']': true,
        '^': true,
        '`': true,
        '{': true,
        '|': true,
        '}': true,
        '~': true
    };
    exports.strReplacementsRev = {
        '\n': '\\n',
        '\r': '\\r',
        '\t': '\\t',
        '\f': '\\f',
        '\v': '\\v'
    };
    exports.singleQuoteEscapeChars = {
        n: '\n',
        r: '\r',
        t: '\t',
        f: '\f',
        '\\': '\\',
        '\'': '\''
    };
    exports.doubleQuotesEscapeChars = {
        n: '\n',
        r: '\r',
        t: '\t',
        f: '\f',
        '\\': '\\',
        '"': '"'
    };
    });

    unwrapExports(utils);
    var utils_1 = utils.isIdentStart;
    var utils_2 = utils.isIdent;
    var utils_3 = utils.isHex;
    var utils_4 = utils.escapeIdentifier;
    var utils_5 = utils.escapeStr;
    var utils_6 = utils.identSpecialChars;
    var utils_7 = utils.strReplacementsRev;
    var utils_8 = utils.singleQuoteEscapeChars;
    var utils_9 = utils.doubleQuotesEscapeChars;

    var parserContext = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });

    function parseCssSelector(str, pos, pseudos, attrEqualityMods, ruleNestingOperators, substitutesEnabled) {
        var l = str.length;
        var chr = '';
        function getStr(quote, escapeTable) {
            var result = '';
            pos++;
            chr = str.charAt(pos);
            while (pos < l) {
                if (chr === quote) {
                    pos++;
                    return result;
                }
                else if (chr === '\\') {
                    pos++;
                    chr = str.charAt(pos);
                    var esc = void 0;
                    if (chr === quote) {
                        result += quote;
                    }
                    else if ((esc = escapeTable[chr]) !== undefined) {
                        result += esc;
                    }
                    else if (utils.isHex(chr)) {
                        var hex = chr;
                        pos++;
                        chr = str.charAt(pos);
                        while (utils.isHex(chr)) {
                            hex += chr;
                            pos++;
                            chr = str.charAt(pos);
                        }
                        if (chr === ' ') {
                            pos++;
                            chr = str.charAt(pos);
                        }
                        result += String.fromCharCode(parseInt(hex, 16));
                        continue;
                    }
                    else {
                        result += chr;
                    }
                }
                else {
                    result += chr;
                }
                pos++;
                chr = str.charAt(pos);
            }
            return result;
        }
        function getIdent() {
            var result = '';
            chr = str.charAt(pos);
            while (pos < l) {
                if (utils.isIdent(chr)) {
                    result += chr;
                }
                else if (chr === '\\') {
                    pos++;
                    if (pos >= l) {
                        throw Error('Expected symbol but end of file reached.');
                    }
                    chr = str.charAt(pos);
                    if (utils.identSpecialChars[chr]) {
                        result += chr;
                    }
                    else if (utils.isHex(chr)) {
                        var hex = chr;
                        pos++;
                        chr = str.charAt(pos);
                        while (utils.isHex(chr)) {
                            hex += chr;
                            pos++;
                            chr = str.charAt(pos);
                        }
                        if (chr === ' ') {
                            pos++;
                            chr = str.charAt(pos);
                        }
                        result += String.fromCharCode(parseInt(hex, 16));
                        continue;
                    }
                    else {
                        result += chr;
                    }
                }
                else {
                    return result;
                }
                pos++;
                chr = str.charAt(pos);
            }
            return result;
        }
        function skipWhitespace() {
            chr = str.charAt(pos);
            var result = false;
            while (chr === ' ' || chr === "\t" || chr === "\n" || chr === "\r" || chr === "\f") {
                result = true;
                pos++;
                chr = str.charAt(pos);
            }
            return result;
        }
        function parse() {
            var res = parseSelector();
            if (pos < l) {
                throw Error('Rule expected but "' + str.charAt(pos) + '" found.');
            }
            return res;
        }
        function parseSelector() {
            var selector = parseSingleSelector();
            if (!selector) {
                return null;
            }
            var res = selector;
            chr = str.charAt(pos);
            while (chr === ',') {
                pos++;
                skipWhitespace();
                if (res.type !== 'selectors') {
                    res = {
                        type: 'selectors',
                        selectors: [selector]
                    };
                }
                selector = parseSingleSelector();
                if (!selector) {
                    throw Error('Rule expected after ",".');
                }
                res.selectors.push(selector);
            }
            return res;
        }
        function parseSingleSelector() {
            skipWhitespace();
            var selector = {
                type: 'ruleSet'
            };
            var rule = parseRule();
            if (!rule) {
                return null;
            }
            var currentRule = selector;
            while (rule) {
                rule.type = 'rule';
                currentRule.rule = rule;
                currentRule = rule;
                skipWhitespace();
                chr = str.charAt(pos);
                if (pos >= l || chr === ',' || chr === ')') {
                    break;
                }
                if (ruleNestingOperators[chr]) {
                    var op = chr;
                    pos++;
                    skipWhitespace();
                    rule = parseRule();
                    if (!rule) {
                        throw Error('Rule expected after "' + op + '".');
                    }
                    rule.nestingOperator = op;
                }
                else {
                    rule = parseRule();
                    if (rule) {
                        rule.nestingOperator = null;
                    }
                }
            }
            return selector;
        }
        // @ts-ignore no-overlap
        function parseRule() {
            var rule = null;
            while (pos < l) {
                chr = str.charAt(pos);
                if (chr === '*') {
                    pos++;
                    (rule = rule || {}).tagName = '*';
                }
                else if (utils.isIdentStart(chr) || chr === '\\') {
                    (rule = rule || {}).tagName = getIdent();
                }
                else if (chr === '.') {
                    pos++;
                    rule = rule || {};
                    (rule.classNames = rule.classNames || []).push(getIdent());
                }
                else if (chr === '#') {
                    pos++;
                    (rule = rule || {}).id = getIdent();
                }
                else if (chr === '[') {
                    pos++;
                    skipWhitespace();
                    var attr = {
                        name: getIdent()
                    };
                    skipWhitespace();
                    // @ts-ignore
                    if (chr === ']') {
                        pos++;
                    }
                    else {
                        var operator = '';
                        if (attrEqualityMods[chr]) {
                            operator = chr;
                            pos++;
                            chr = str.charAt(pos);
                        }
                        if (pos >= l) {
                            throw Error('Expected "=" but end of file reached.');
                        }
                        if (chr !== '=') {
                            throw Error('Expected "=" but "' + chr + '" found.');
                        }
                        attr.operator = operator + '=';
                        pos++;
                        skipWhitespace();
                        var attrValue = '';
                        attr.valueType = 'string';
                        // @ts-ignore
                        if (chr === '"') {
                            attrValue = getStr('"', utils.doubleQuotesEscapeChars);
                            // @ts-ignore
                        }
                        else if (chr === '\'') {
                            attrValue = getStr('\'', utils.singleQuoteEscapeChars);
                            // @ts-ignore
                        }
                        else if (substitutesEnabled && chr === '$') {
                            pos++;
                            attrValue = getIdent();
                            attr.valueType = 'substitute';
                        }
                        else {
                            while (pos < l) {
                                if (chr === ']') {
                                    break;
                                }
                                attrValue += chr;
                                pos++;
                                chr = str.charAt(pos);
                            }
                            attrValue = attrValue.trim();
                        }
                        skipWhitespace();
                        if (pos >= l) {
                            throw Error('Expected "]" but end of file reached.');
                        }
                        if (chr !== ']') {
                            throw Error('Expected "]" but "' + chr + '" found.');
                        }
                        pos++;
                        attr.value = attrValue;
                    }
                    rule = rule || {};
                    (rule.attrs = rule.attrs || []).push(attr);
                }
                else if (chr === ':') {
                    pos++;
                    var pseudoName = getIdent();
                    var pseudo = {
                        name: pseudoName
                    };
                    // @ts-ignore
                    if (chr === '(') {
                        pos++;
                        var value = '';
                        skipWhitespace();
                        if (pseudos[pseudoName] === 'selector') {
                            pseudo.valueType = 'selector';
                            value = parseSelector();
                        }
                        else {
                            pseudo.valueType = pseudos[pseudoName] || 'string';
                            // @ts-ignore
                            if (chr === '"') {
                                value = getStr('"', utils.doubleQuotesEscapeChars);
                                // @ts-ignore
                            }
                            else if (chr === '\'') {
                                value = getStr('\'', utils.singleQuoteEscapeChars);
                                // @ts-ignore
                            }
                            else if (substitutesEnabled && chr === '$') {
                                pos++;
                                value = getIdent();
                                pseudo.valueType = 'substitute';
                            }
                            else {
                                while (pos < l) {
                                    if (chr === ')') {
                                        break;
                                    }
                                    value += chr;
                                    pos++;
                                    chr = str.charAt(pos);
                                }
                                value = value.trim();
                            }
                            skipWhitespace();
                        }
                        if (pos >= l) {
                            throw Error('Expected ")" but end of file reached.');
                        }
                        if (chr !== ')') {
                            throw Error('Expected ")" but "' + chr + '" found.');
                        }
                        pos++;
                        pseudo.value = value;
                    }
                    rule = rule || {};
                    (rule.pseudos = rule.pseudos || []).push(pseudo);
                }
                else {
                    break;
                }
            }
            return rule;
        }
        return parse();
    }
    exports.parseCssSelector = parseCssSelector;
    });

    unwrapExports(parserContext);
    var parserContext_1 = parserContext.parseCssSelector;

    var render = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });

    function renderEntity(entity) {
        var res = '';
        switch (entity.type) {
            case 'ruleSet':
                var currentEntity = entity.rule;
                var parts = [];
                while (currentEntity) {
                    if (currentEntity.nestingOperator) {
                        parts.push(currentEntity.nestingOperator);
                    }
                    parts.push(renderEntity(currentEntity));
                    currentEntity = currentEntity.rule;
                }
                res = parts.join(' ');
                break;
            case 'selectors':
                res = entity.selectors.map(renderEntity).join(', ');
                break;
            case 'rule':
                if (entity.tagName) {
                    if (entity.tagName === '*') {
                        res = '*';
                    }
                    else {
                        res = utils.escapeIdentifier(entity.tagName);
                    }
                }
                if (entity.id) {
                    res += "#" + utils.escapeIdentifier(entity.id);
                }
                if (entity.classNames) {
                    res += entity.classNames.map(function (cn) {
                        return "." + (utils.escapeIdentifier(cn));
                    }).join('');
                }
                if (entity.attrs) {
                    res += entity.attrs.map(function (attr) {
                        if ('operator' in attr) {
                            if (attr.valueType === 'substitute') {
                                return "[" + utils.escapeIdentifier(attr.name) + attr.operator + "$" + attr.value + "]";
                            }
                            else {
                                return "[" + utils.escapeIdentifier(attr.name) + attr.operator + utils.escapeStr(attr.value) + "]";
                            }
                        }
                        else {
                            return "[" + utils.escapeIdentifier(attr.name) + "]";
                        }
                    }).join('');
                }
                if (entity.pseudos) {
                    res += entity.pseudos.map(function (pseudo) {
                        if (pseudo.valueType) {
                            if (pseudo.valueType === 'selector') {
                                return ":" + utils.escapeIdentifier(pseudo.name) + "(" + renderEntity(pseudo.value) + ")";
                            }
                            else if (pseudo.valueType === 'substitute') {
                                return ":" + utils.escapeIdentifier(pseudo.name) + "($" + pseudo.value + ")";
                            }
                            else if (pseudo.valueType === 'numeric') {
                                return ":" + utils.escapeIdentifier(pseudo.name) + "(" + pseudo.value + ")";
                            }
                            else {
                                return (":" + utils.escapeIdentifier(pseudo.name) +
                                    "(" + utils.escapeIdentifier(pseudo.value) + ")");
                            }
                        }
                        else {
                            return ":" + utils.escapeIdentifier(pseudo.name);
                        }
                    }).join('');
                }
                break;
            default:
                throw Error('Unknown entity type: "' + entity.type + '".');
        }
        return res;
    }
    exports.renderEntity = renderEntity;
    });

    unwrapExports(render);
    var render_1 = render.renderEntity;

    var lib = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });


    var CssSelectorParser = /** @class */ (function () {
        function CssSelectorParser() {
            this.pseudos = {};
            this.attrEqualityMods = {};
            this.ruleNestingOperators = {};
            this.substitutesEnabled = false;
        }
        CssSelectorParser.prototype.registerSelectorPseudos = function () {
            var pseudos = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                pseudos[_i] = arguments[_i];
            }
            for (var _a = 0, pseudos_1 = pseudos; _a < pseudos_1.length; _a++) {
                var pseudo = pseudos_1[_a];
                this.pseudos[pseudo] = 'selector';
            }
            return this;
        };
        CssSelectorParser.prototype.unregisterSelectorPseudos = function () {
            var pseudos = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                pseudos[_i] = arguments[_i];
            }
            for (var _a = 0, pseudos_2 = pseudos; _a < pseudos_2.length; _a++) {
                var pseudo = pseudos_2[_a];
                delete this.pseudos[pseudo];
            }
            return this;
        };
        CssSelectorParser.prototype.registerNumericPseudos = function () {
            var pseudos = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                pseudos[_i] = arguments[_i];
            }
            for (var _a = 0, pseudos_3 = pseudos; _a < pseudos_3.length; _a++) {
                var pseudo = pseudos_3[_a];
                this.pseudos[pseudo] = 'numeric';
            }
            return this;
        };
        CssSelectorParser.prototype.unregisterNumericPseudos = function () {
            var pseudos = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                pseudos[_i] = arguments[_i];
            }
            for (var _a = 0, pseudos_4 = pseudos; _a < pseudos_4.length; _a++) {
                var pseudo = pseudos_4[_a];
                delete this.pseudos[pseudo];
            }
            return this;
        };
        CssSelectorParser.prototype.registerNestingOperators = function () {
            var operators = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                operators[_i] = arguments[_i];
            }
            for (var _a = 0, operators_1 = operators; _a < operators_1.length; _a++) {
                var operator = operators_1[_a];
                this.ruleNestingOperators[operator] = true;
            }
            return this;
        };
        CssSelectorParser.prototype.unregisterNestingOperators = function () {
            var operators = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                operators[_i] = arguments[_i];
            }
            for (var _a = 0, operators_2 = operators; _a < operators_2.length; _a++) {
                var operator = operators_2[_a];
                delete this.ruleNestingOperators[operator];
            }
            return this;
        };
        CssSelectorParser.prototype.registerAttrEqualityMods = function () {
            var mods = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                mods[_i] = arguments[_i];
            }
            for (var _a = 0, mods_1 = mods; _a < mods_1.length; _a++) {
                var mod = mods_1[_a];
                this.attrEqualityMods[mod] = true;
            }
            return this;
        };
        CssSelectorParser.prototype.unregisterAttrEqualityMods = function () {
            var mods = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                mods[_i] = arguments[_i];
            }
            for (var _a = 0, mods_2 = mods; _a < mods_2.length; _a++) {
                var mod = mods_2[_a];
                delete this.attrEqualityMods[mod];
            }
            return this;
        };
        CssSelectorParser.prototype.enableSubstitutes = function () {
            this.substitutesEnabled = true;
            return this;
        };
        CssSelectorParser.prototype.disableSubstitutes = function () {
            this.substitutesEnabled = false;
            return this;
        };
        CssSelectorParser.prototype.parse = function (str) {
            return parserContext.parseCssSelector(str, 0, this.pseudos, this.attrEqualityMods, this.ruleNestingOperators, this.substitutesEnabled);
        };
        CssSelectorParser.prototype.render = function (path) {
            return render.renderEntity(path).trim();
        };
        return CssSelectorParser;
    }());
    exports.CssSelectorParser = CssSelectorParser;
    });

    unwrapExports(lib);
    var lib_1 = lib.CssSelectorParser;

    var parse_1$2 = parse$3;

    //following http://www.w3.org/TR/css3-selectors/#nth-child-pseudo

    //[ ['-'|'+']? INTEGER? {N} [ S* ['-'|'+'] S* INTEGER ]?
    var re_nthElement = /^([+\-]?\d*n)?\s*(?:([+\-]?)\s*(\d+))?$/;

    /*
    	parses a nth-check formula, returns an array of two numbers
    */
    function parse$3(formula){
    	formula = formula.trim().toLowerCase();

    	if(formula === "even"){
    		return [2, 0];
    	} else if(formula === "odd"){
    		return [2, 1];
    	} else {
    		var parsed = formula.match(re_nthElement);

    		if(!parsed){
    			throw new SyntaxError("n-th rule couldn't be parsed ('" + formula + "')");
    		}

    		var a;

    		if(parsed[1]){
    			a = parseInt(parsed[1], 10);
    			if(isNaN(a)){
    				if(parsed[1].charAt(0) === "-") a = -1;
    				else a = 1;
    			}
    		} else a = 0;

    		return [
    			a,
    			parsed[3] ? parseInt((parsed[2] || "") + parsed[3], 10) : 0
    		];
    	}
    }

    var boolbase = {
    	trueFunc: function trueFunc(){
    		return true;
    	},
    	falseFunc: function falseFunc(){
    		return false;
    	}
    };

    var compile_1 = compile;

    var trueFunc  = boolbase.trueFunc,
        falseFunc = boolbase.falseFunc;

    /*
    	returns a function that checks if an elements index matches the given rule
    	highly optimized to return the fastest solution
    */
    function compile(parsed){
    	var a = parsed[0],
    	    b = parsed[1] - 1;

    	//when b <= 0, a*n won't be possible for any matches when a < 0
    	//besides, the specification says that no element is matched when a and b are 0
    	if(b < 0 && a <= 0) return falseFunc;

    	//when a is in the range -1..1, it matches any element (so only b is checked)
    	if(a ===-1) return function(pos){ return pos <= b; };
    	if(a === 0) return function(pos){ return pos === b; };
    	//when b <= 0 and a === 1, they match any element
    	if(a === 1) return b < 0 ? trueFunc : function(pos){ return pos >= b; };

    	//when a > 0, modulo can be used to check if there is a match
    	var bMod = b % a;
    	if(bMod < 0) bMod += a;

    	if(a > 1){
    		return function(pos){
    			return pos >= b && pos % a === bMod;
    		};
    	}

    	a *= -1; //make `a` positive

    	return function(pos){
    		return pos <= b && pos % a === bMod;
    	};
    }

    var nthCheck = function nthCheck(formula){
    	return compile_1(parse_1$2(formula));
    };

    var parse_1$3 = parse_1$2;
    var compile_1$1 = compile_1;
    nthCheck.parse = parse_1$3;
    nthCheck.compile = compile_1$1;

    var parse_1$4 = parse$4;

    var Parser = lib.CssSelectorParser;



    var nth = ['nth-child', 'nth-last-child', 'nth-of-type', 'nth-last-of-type'];

    var parser = new Parser();
    var compile$1 = zwitch('type');
    var handlers$4 = compile$1.handlers;

    parser.registerAttrEqualityMods('~', '|', '^', '$', '*');
    parser.registerSelectorPseudos('any', 'matches', 'not', 'has');
    parser.registerNestingOperators('>', '+', '~');

    handlers$4.selectors = selectors$1;
    handlers$4.ruleSet = ruleSet$1;
    handlers$4.rule = rule$1;

    function parse$4(selector) {
      if (typeof selector !== 'string') {
        throw new Error('Expected `string` as selector, not `' + selector + '`')
      }

      return compile$1(parser.parse(selector))
    }

    function selectors$1(query) {
      var selectors = query.selectors;
      var length = selectors.length;
      var index = -1;

      while (++index < length) {
        compile$1(selectors[index]);
      }

      return query
    }

    function ruleSet$1(query) {
      return rule$1(query.rule)
    }

    function rule$1(query) {
      var pseudos = query.pseudos;
      var length = pseudos && pseudos.length;
      var index = -1;
      var pseudo;

      while (++index < length) {
        pseudo = pseudos[index];

        if (nth.indexOf(pseudo.name) !== -1) {
          pseudo.value = nthCheck(pseudo.value);
          pseudo.valueType = 'function';
        }
      }

      compile$1(query.rule);

      return query
    }

    var select_1 = select;

    function select(selector, node, space) {
      return any(parse_1$4(selector), node, {space: space, one: true})[0] || null
    }

    function extractProps(element, options) {
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

    function parseStyle(style) {
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

    // Handles 'g' svg element, returns generated swift string.
    function handleGroupElement(element, options) {
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

    var DEFAULT_CONFIG = {
      // minimum relative difference between two compared values,
      // used by all comparison functions
      epsilon: 1e-12,
      // type of default matrix output. Choose 'matrix' (default) or 'array'
      matrix: 'Matrix',
      // type of default number output. Choose 'number' (default) 'BigNumber', or 'Fraction
      number: 'number',
      // number of significant digits in BigNumbers
      precision: 64,
      // predictable output type of functions. When true, output type depends only
      // on the input types. When false (default), output type can vary depending
      // on input values. For example `math.sqrt(-4)` returns `complex('2i')` when
      // predictable is false, and returns `NaN` when true.
      predictable: false,
      // random seed for seeded pseudo random number generation
      // null = randomly seed
      randomSeed: null
    };

    function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

    // type checks for all known types
    //
    // note that:
    //
    // - check by duck-typing on a property like `isUnit`, instead of checking instanceof.
    //   instanceof cannot be used because that would not allow to pass data from
    //   one instance of math.js to another since each has it's own instance of Unit.
    // - check the `isUnit` property via the constructor, so there will be no
    //   matches for "fake" instances like plain objects with a property `isUnit`.
    //   That is important for security reasons.
    // - It must not be possible to override the type checks used internally,
    //   for security reasons, so these functions are not exposed in the expression
    //   parser.
    function isNumber(x) {
      return typeof x === 'number';
    }
    function isBigNumber(x) {
      return x && x.constructor.prototype.isBigNumber === true || false;
    }
    function isComplex(x) {
      return x && _typeof(x) === 'object' && Object.getPrototypeOf(x).isComplex === true || false;
    }
    function isFraction(x) {
      return x && _typeof(x) === 'object' && Object.getPrototypeOf(x).isFraction === true || false;
    }
    function isUnit(x) {
      return x && x.constructor.prototype.isUnit === true || false;
    }
    function isString(x) {
      return typeof x === 'string';
    }
    var isArray = Array.isArray;
    function isMatrix(x) {
      return x && x.constructor.prototype.isMatrix === true || false;
    }
    function isDenseMatrix(x) {
      return x && x.isDenseMatrix && x.constructor.prototype.isMatrix === true || false;
    }
    function isSparseMatrix(x) {
      return x && x.isSparseMatrix && x.constructor.prototype.isMatrix === true || false;
    }
    function isRange(x) {
      return x && x.constructor.prototype.isRange === true || false;
    }
    function isIndex(x) {
      return x && x.constructor.prototype.isIndex === true || false;
    }
    function isBoolean(x) {
      return typeof x === 'boolean';
    }
    function isResultSet(x) {
      return x && x.constructor.prototype.isResultSet === true || false;
    }
    function isHelp(x) {
      return x && x.constructor.prototype.isHelp === true || false;
    }
    function isFunction(x) {
      return typeof x === 'function';
    }
    function isDate(x) {
      return x instanceof Date;
    }
    function isRegExp(x) {
      return x instanceof RegExp;
    }
    function isObject(x) {
      return !!(x && _typeof(x) === 'object' && x.constructor === Object && !isComplex(x) && !isFraction(x));
    }
    function isNull(x) {
      return x === null;
    }
    function isUndefined(x) {
      return x === undefined;
    }
    function isAccessorNode(x) {
      return x && x.isAccessorNode === true && x.constructor.prototype.isNode === true || false;
    }
    function isArrayNode(x) {
      return x && x.isArrayNode === true && x.constructor.prototype.isNode === true || false;
    }
    function isAssignmentNode(x) {
      return x && x.isAssignmentNode === true && x.constructor.prototype.isNode === true || false;
    }
    function isBlockNode(x) {
      return x && x.isBlockNode === true && x.constructor.prototype.isNode === true || false;
    }
    function isConditionalNode(x) {
      return x && x.isConditionalNode === true && x.constructor.prototype.isNode === true || false;
    }
    function isConstantNode(x) {
      return x && x.isConstantNode === true && x.constructor.prototype.isNode === true || false;
    }
    function isFunctionAssignmentNode(x) {
      return x && x.isFunctionAssignmentNode === true && x.constructor.prototype.isNode === true || false;
    }
    function isFunctionNode(x) {
      return x && x.isFunctionNode === true && x.constructor.prototype.isNode === true || false;
    }
    function isIndexNode(x) {
      return x && x.isIndexNode === true && x.constructor.prototype.isNode === true || false;
    }
    function isNode(x) {
      return x && x.isNode === true && x.constructor.prototype.isNode === true || false;
    }
    function isObjectNode(x) {
      return x && x.isObjectNode === true && x.constructor.prototype.isNode === true || false;
    }
    function isOperatorNode(x) {
      return x && x.isOperatorNode === true && x.constructor.prototype.isNode === true || false;
    }
    function isParenthesisNode(x) {
      return x && x.isParenthesisNode === true && x.constructor.prototype.isNode === true || false;
    }
    function isRangeNode(x) {
      return x && x.isRangeNode === true && x.constructor.prototype.isNode === true || false;
    }
    function isSymbolNode(x) {
      return x && x.isSymbolNode === true && x.constructor.prototype.isNode === true || false;
    }
    function isChain(x) {
      return x && x.constructor.prototype.isChain === true || false;
    }
    function typeOf(x) {
      var t = _typeof(x);

      if (t === 'object') {
        // JavaScript types
        if (x === null) return 'null';
        if (Array.isArray(x)) return 'Array';
        if (x instanceof Date) return 'Date';
        if (x instanceof RegExp) return 'RegExp'; // math.js types

        if (isBigNumber(x)) return 'BigNumber';
        if (isComplex(x)) return 'Complex';
        if (isFraction(x)) return 'Fraction';
        if (isMatrix(x)) return 'Matrix';
        if (isUnit(x)) return 'Unit';
        if (isIndex(x)) return 'Index';
        if (isRange(x)) return 'Range';
        if (isResultSet(x)) return 'ResultSet';
        if (isNode(x)) return x.type;
        if (isChain(x)) return 'Chain';
        if (isHelp(x)) return 'Help';
        return 'Object';
      }

      if (t === 'function') return 'Function';
      return t; // can be 'string', 'number', 'boolean', ...
    }

    function _typeof$1(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof$1 = function _typeof(obj) { return typeof obj; }; } else { _typeof$1 = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof$1(obj); }
    /**
     * Clone an object
     *
     *     clone(x)
     *
     * Can clone any primitive type, array, and object.
     * If x has a function clone, this function will be invoked to clone the object.
     *
     * @param {*} x
     * @return {*} clone
     */

    function clone(x) {
      var type = _typeof$1(x); // immutable primitive types


      if (type === 'number' || type === 'string' || type === 'boolean' || x === null || x === undefined) {
        return x;
      } // use clone function of the object when available


      if (typeof x.clone === 'function') {
        return x.clone();
      } // array


      if (Array.isArray(x)) {
        return x.map(function (value) {
          return clone(value);
        });
      }

      if (x instanceof Date) return new Date(x.valueOf());
      if (isBigNumber(x)) return x; // bignumbers are immutable

      if (x instanceof RegExp) throw new TypeError('Cannot clone ' + x); // TODO: clone a RegExp
      // object

      return mapObject(x, clone);
    }
    /**
     * Apply map to all properties of an object
     * @param {Object} object
     * @param {function} callback
     * @return {Object} Returns a copy of the object with mapped properties
     */

    function mapObject(object, callback) {
      var clone = {};

      for (var key in object) {
        if (hasOwnProperty$1(object, key)) {
          clone[key] = callback(object[key]);
        }
      }

      return clone;
    }
    /**
     * Deep test equality of all fields in two pairs of arrays or objects.
     * Compares values and functions strictly (ie. 2 is not the same as '2').
     * @param {Array | Object} a
     * @param {Array | Object} b
     * @returns {boolean}
     */

    function deepStrictEqual(a, b) {
      var prop, i, len;

      if (Array.isArray(a)) {
        if (!Array.isArray(b)) {
          return false;
        }

        if (a.length !== b.length) {
          return false;
        }

        for (i = 0, len = a.length; i < len; i++) {
          if (!deepStrictEqual(a[i], b[i])) {
            return false;
          }
        }

        return true;
      } else if (typeof a === 'function') {
        return a === b;
      } else if (a instanceof Object) {
        if (Array.isArray(b) || !(b instanceof Object)) {
          return false;
        }

        for (prop in a) {
          // noinspection JSUnfilteredForInLoop
          if (!(prop in b) || !deepStrictEqual(a[prop], b[prop])) {
            return false;
          }
        }

        for (prop in b) {
          // noinspection JSUnfilteredForInLoop
          if (!(prop in a) || !deepStrictEqual(a[prop], b[prop])) {
            return false;
          }
        }

        return true;
      } else {
        return a === b;
      }
    }
    /**
     * A safe hasOwnProperty
     * @param {Object} object
     * @param {string} property
     */

    function hasOwnProperty$1(object, property) {
      return object && Object.hasOwnProperty.call(object, property);
    }
    /**
     * Shallow version of pick, creating an object composed of the picked object properties
     * but not for nested properties
     * @param {Object} object
     * @param {string[]} properties
     * @return {Object}
     */

    function pickShallow(object, properties) {
      var copy = {};

      for (var i = 0; i < properties.length; i++) {
        var key = properties[i];
        var value = object[key];

        if (value !== undefined) {
          copy[key] = value;
        }
      }

      return copy;
    }

    var MATRIX_OPTIONS = ['Matrix', 'Array']; // valid values for option matrix

    var NUMBER_OPTIONS = ['number', 'BigNumber', 'Fraction']; // valid values for option number

    function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

    var config = /* #__PURE__ */function config(options) {
      if (options) {
        throw new Error('The global config is readonly. \n' + 'Please create a mathjs instance if you want to change the default configuration. \n' + 'Example:\n' + '\n' + '  import { create, all } from \'mathjs\';\n' + '  const mathjs = create(all);\n' + '  mathjs.config({ number: \'BigNumber\' });\n');
      }

      return Object.freeze(DEFAULT_CONFIG);
    };

    _extends(config, DEFAULT_CONFIG, {
      MATRIX_OPTIONS: MATRIX_OPTIONS,
      NUMBER_OPTIONS: NUMBER_OPTIONS
    });

    var typedFunction = createCommonjsModule(function (module, exports) {

    (function (root, factory) {
      {
        // OldNode. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like OldNode.
        module.exports = factory();
      }
    }(commonjsGlobal, function () {

      function ok () {
        return true;
      }

      function notOk () {
        return false;
      }

      function undef () {
        return undefined;
      }

      /**
       * @typedef {{
       *   params: Param[],
       *   fn: function
       * }} Signature
       *
       * @typedef {{
       *   types: Type[],
       *   restParam: boolean
       * }} Param
       *
       * @typedef {{
       *   name: string,
       *   typeIndex: number,
       *   test: function,
       *   conversion?: ConversionDef,
       *   conversionIndex: number,
       * }} Type
       *
       * @typedef {{
       *   from: string,
       *   to: string,
       *   convert: function (*) : *
       * }} ConversionDef
       *
       * @typedef {{
       *   name: string,
       *   test: function(*) : boolean
       * }} TypeDef
       */

      // create a new instance of typed-function
      function create () {
        // data type tests
        var _types = [
          { name: 'number',    test: function (x) { return typeof x === 'number' } },
          { name: 'string',    test: function (x) { return typeof x === 'string' } },
          { name: 'boolean',   test: function (x) { return typeof x === 'boolean' } },
          { name: 'Function',  test: function (x) { return typeof x === 'function'} },
          { name: 'Array',     test: Array.isArray },
          { name: 'Date',      test: function (x) { return x instanceof Date } },
          { name: 'RegExp',    test: function (x) { return x instanceof RegExp } },
          { name: 'Object',    test: function (x) {
            return typeof x === 'object' && x !== null && x.constructor === Object
          }},
          { name: 'null',      test: function (x) { return x === null } },
          { name: 'undefined', test: function (x) { return x === undefined } }
        ];

        var anyType = {
          name: 'any',
          test: ok
        };

        // types which need to be ignored
        var _ignore = [];

        // type conversions
        var _conversions = [];

        // This is a temporary object, will be replaced with a typed function at the end
        var typed = {
          types: _types,
          conversions: _conversions,
          ignore: _ignore
        };

        /**
         * Find the test function for a type
         * @param {String} typeName
         * @return {TypeDef} Returns the type definition when found,
         *                    Throws a TypeError otherwise
         */
        function findTypeByName (typeName) {
          var entry = findInArray(typed.types, function (entry) {
            return entry.name === typeName;
          });

          if (entry) {
            return entry;
          }

          if (typeName === 'any') { // special baked-in case 'any'
            return anyType;
          }

          var hint = findInArray(typed.types, function (entry) {
            return entry.name.toLowerCase() === typeName.toLowerCase();
          });

          throw new TypeError('Unknown type "' + typeName + '"' +
              (hint ? ('. Did you mean "' + hint.name + '"?') : ''));
        }

        /**
         * Find the index of a type definition. Handles special case 'any'
         * @param {TypeDef} type
         * @return {number}
         */
        function findTypeIndex(type) {
          if (type === anyType) {
            return 999;
          }

          return typed.types.indexOf(type);
        }

        /**
         * Find a type that matches a value.
         * @param {*} value
         * @return {string} Returns the name of the first type for which
         *                  the type test matches the value.
         */
        function findTypeName(value) {
          var entry = findInArray(typed.types, function (entry) {
            return entry.test(value);
          });

          if (entry) {
            return entry.name;
          }

          throw new TypeError('Value has unknown type. Value: ' + value);
        }

        /**
         * Find a specific signature from a (composed) typed function, for example:
         *
         *   typed.find(fn, ['number', 'string'])
         *   typed.find(fn, 'number, string')
         *
         * Function find only only works for exact matches.
         *
         * @param {Function} fn                   A typed-function
         * @param {string | string[]} signature   Signature to be found, can be
         *                                        an array or a comma separated string.
         * @return {Function}                     Returns the matching signature, or
         *                                        throws an error when no signature
         *                                        is found.
         */
        function find (fn, signature) {
          if (!fn.signatures) {
            throw new TypeError('Function is no typed-function');
          }

          // normalize input
          var arr;
          if (typeof signature === 'string') {
            arr = signature.split(',');
            for (var i = 0; i < arr.length; i++) {
              arr[i] = arr[i].trim();
            }
          }
          else if (Array.isArray(signature)) {
            arr = signature;
          }
          else {
            throw new TypeError('String array or a comma separated string expected');
          }

          var str = arr.join(',');

          // find an exact match
          var match = fn.signatures[str];
          if (match) {
            return match;
          }

          // TODO: extend find to match non-exact signatures

          throw new TypeError('Signature not found (signature: ' + (fn.name || 'unnamed') + '(' + arr.join(', ') + '))');
        }

        /**
         * Convert a given value to another data type.
         * @param {*} value
         * @param {string} type
         */
        function convert (value, type) {
          var from = findTypeName(value);

          // check conversion is needed
          if (type === from) {
            return value;
          }

          for (var i = 0; i < typed.conversions.length; i++) {
            var conversion = typed.conversions[i];
            if (conversion.from === from && conversion.to === type) {
              return conversion.convert(value);
            }
          }

          throw new Error('Cannot convert from ' + from + ' to ' + type);
        }
        
        /**
         * Stringify parameters in a normalized way
         * @param {Param[]} params
         * @return {string}
         */
        function stringifyParams (params) {
          return params
              .map(function (param) {
                var typeNames = param.types.map(getTypeName);

                return (param.restParam ? '...' : '') + typeNames.join('|');
              })
              .join(',');
        }

        /**
         * Parse a parameter, like "...number | boolean"
         * @param {string} param
         * @param {ConversionDef[]} conversions
         * @return {Param} param
         */
        function parseParam (param, conversions) {
          var restParam = param.indexOf('...') === 0;
          var types = (!restParam)
              ? param
              : (param.length > 3)
                  ? param.slice(3)
                  : 'any';

          var typeNames = types.split('|').map(trim)
              .filter(notEmpty)
              .filter(notIgnore);

          var matchingConversions = filterConversions(conversions, typeNames);

          var exactTypes = typeNames.map(function (typeName) {
            var type = findTypeByName(typeName);

            return {
              name: typeName,
              typeIndex: findTypeIndex(type),
              test: type.test,
              conversion: null,
              conversionIndex: -1
            };
          });

          var convertibleTypes = matchingConversions.map(function (conversion) {
            var type = findTypeByName(conversion.from);

            return {
              name: conversion.from,
              typeIndex: findTypeIndex(type),
              test: type.test,
              conversion: conversion,
              conversionIndex: conversions.indexOf(conversion)
            };
          });

          return {
            types: exactTypes.concat(convertibleTypes),
            restParam: restParam
          };
        }

        /**
         * Parse a signature with comma separated parameters,
         * like "number | boolean, ...string"
         * @param {string} signature
         * @param {function} fn
         * @param {ConversionDef[]} conversions
         * @return {Signature | null} signature
         */
        function parseSignature (signature, fn, conversions) {
          var params = [];

          if (signature.trim() !== '') {
            params = signature
                .split(',')
                .map(trim)
                .map(function (param, index, array) {
                  var parsedParam = parseParam(param, conversions);

                  if (parsedParam.restParam && (index !== array.length - 1)) {
                    throw new SyntaxError('Unexpected rest parameter "' + param + '": ' +
                        'only allowed for the last parameter');
                  }

                  return parsedParam;
              });
          }

          if (params.some(isInvalidParam)) {
            // invalid signature: at least one parameter has no types
            // (they may have been filtered)
            return null;
          }

          return {
            params: params,
            fn: fn
          };
        }

        /**
         * Test whether a set of params contains a restParam
         * @param {Param[]} params
         * @return {boolean} Returns true when the last parameter is a restParam
         */
        function hasRestParam(params) {
          var param = last(params);
          return param ? param.restParam : false;
        }

        /**
         * Test whether a parameter contains conversions
         * @param {Param} param
         * @return {boolean} Returns true when at least one of the parameters
         *                   contains a conversion.
         */
        function hasConversions(param) {
          return param.types.some(function (type) {
            return type.conversion != null;
          });
        }

        /**
         * Create a type test for a single parameter, which can have one or multiple
         * types.
         * @param {Param} param
         * @return {function(x: *) : boolean} Returns a test function
         */
        function compileTest(param) {
          if (!param || param.types.length === 0) {
            // nothing to do
            return ok;
          }
          else if (param.types.length === 1) {
            return findTypeByName(param.types[0].name).test;
          }
          else if (param.types.length === 2) {
            var test0 = findTypeByName(param.types[0].name).test;
            var test1 = findTypeByName(param.types[1].name).test;
            return function or(x) {
              return test0(x) || test1(x);
            }
          }
          else { // param.types.length > 2
            var tests = param.types.map(function (type) {
              return findTypeByName(type.name).test;
            });
            return function or(x) {
              for (var i = 0; i < tests.length; i++) {
                if (tests[i](x)) {
                  return true;
                }
              }
              return false;
            }
          }
        }

        /**
         * Create a test for all parameters of a signature
         * @param {Param[]} params
         * @return {function(args: Array<*>) : boolean}
         */
        function compileTests(params) {
          var tests, test0, test1;

          if (hasRestParam(params)) {
            // variable arguments like '...number'
            tests = initial(params).map(compileTest);
            var varIndex = tests.length;
            var lastTest = compileTest(last(params));
            var testRestParam = function (args) {
              for (var i = varIndex; i < args.length; i++) {
                if (!lastTest(args[i])) {
                  return false;
                }
              }
              return true;
            };

            return function testArgs(args) {
              for (var i = 0; i < tests.length; i++) {
                if (!tests[i](args[i])) {
                  return false;
                }
              }
              return testRestParam(args) && (args.length >= varIndex + 1);
            };
          }
          else {
            // no variable arguments
            if (params.length === 0) {
              return function testArgs(args) {
                return args.length === 0;
              };
            }
            else if (params.length === 1) {
              test0 = compileTest(params[0]);
              return function testArgs(args) {
                return test0(args[0]) && args.length === 1;
              };
            }
            else if (params.length === 2) {
              test0 = compileTest(params[0]);
              test1 = compileTest(params[1]);
              return function testArgs(args) {
                return test0(args[0]) && test1(args[1]) && args.length === 2;
              };
            }
            else { // arguments.length > 2
              tests = params.map(compileTest);
              return function testArgs(args) {
                for (var i = 0; i < tests.length; i++) {
                  if (!tests[i](args[i])) {
                    return false;
                  }
                }
                return args.length === tests.length;
              };
            }
          }
        }

        /**
         * Find the parameter at a specific index of a signature.
         * Handles rest parameters.
         * @param {Signature} signature
         * @param {number} index
         * @return {Param | null} Returns the matching parameter when found,
         *                        null otherwise.
         */
        function getParamAtIndex(signature, index) {
          return index < signature.params.length
              ? signature.params[index]
              : hasRestParam(signature.params)
                  ? last(signature.params)
                  : null
        }

        /**
         * Get all type names of a parameter
         * @param {Signature} signature
         * @param {number} index
         * @param {boolean} excludeConversions
         * @return {string[]} Returns an array with type names
         */
        function getExpectedTypeNames (signature, index, excludeConversions) {
          var param = getParamAtIndex(signature, index);
          var types = param
              ? excludeConversions
                      ? param.types.filter(isExactType)
                      : param.types
              : [];

          return types.map(getTypeName);
        }

        /**
         * Returns the name of a type
         * @param {Type} type
         * @return {string} Returns the type name
         */
        function getTypeName(type) {
          return type.name;
        }

        /**
         * Test whether a type is an exact type or conversion
         * @param {Type} type
         * @return {boolean} Returns true when
         */
        function isExactType(type) {
          return type.conversion === null || type.conversion === undefined;
        }

        /**
         * Helper function for creating error messages: create an array with
         * all available types on a specific argument index.
         * @param {Signature[]} signatures
         * @param {number} index
         * @return {string[]} Returns an array with available types
         */
        function mergeExpectedParams(signatures, index) {
          var typeNames = uniq(flatMap(signatures, function (signature) {
            return getExpectedTypeNames(signature, index, false);
          }));

          return (typeNames.indexOf('any') !== -1) ? ['any'] : typeNames;
        }

        /**
         * Create
         * @param {string} name             The name of the function
         * @param {array.<*>} args          The actual arguments passed to the function
         * @param {Signature[]} signatures  A list with available signatures
         * @return {TypeError} Returns a type error with additional data
         *                     attached to it in the property `data`
         */
        function createError(name, args, signatures) {
          var err, expected;
          var _name = name || 'unnamed';

          // test for wrong type at some index
          var matchingSignatures = signatures;
          var index;
          for (index = 0; index < args.length; index++) {
            var nextMatchingDefs = matchingSignatures.filter(function (signature) {
              var test = compileTest(getParamAtIndex(signature, index));
              return (index < signature.params.length || hasRestParam(signature.params)) &&
                  test(args[index]);
            });

            if (nextMatchingDefs.length === 0) {
              // no matching signatures anymore, throw error "wrong type"
              expected = mergeExpectedParams(matchingSignatures, index);
              if (expected.length > 0) {
                var actualType = findTypeName(args[index]);

                err = new TypeError('Unexpected type of argument in function ' + _name +
                    ' (expected: ' + expected.join(' or ') +
                    ', actual: ' + actualType + ', index: ' + index + ')');
                err.data = {
                  category: 'wrongType',
                  fn: _name,
                  index: index,
                  actual: actualType,
                  expected: expected
                };
                return err;
              }
            }
            else {
              matchingSignatures = nextMatchingDefs;
            }
          }

          // test for too few arguments
          var lengths = matchingSignatures.map(function (signature) {
            return hasRestParam(signature.params) ? Infinity : signature.params.length;
          });
          if (args.length < Math.min.apply(null, lengths)) {
            expected = mergeExpectedParams(matchingSignatures, index);
            err = new TypeError('Too few arguments in function ' + _name +
                ' (expected: ' + expected.join(' or ') +
                ', index: ' + args.length + ')');
            err.data = {
              category: 'tooFewArgs',
              fn: _name,
              index: args.length,
              expected: expected
            };
            return err;
          }

          // test for too many arguments
          var maxLength = Math.max.apply(null, lengths);
          if (args.length > maxLength) {
            err = new TypeError('Too many arguments in function ' + _name +
                ' (expected: ' + maxLength + ', actual: ' + args.length + ')');
            err.data = {
              category: 'tooManyArgs',
              fn: _name,
              index: args.length,
              expectedLength: maxLength
            };
            return err;
          }

          err = new TypeError('Arguments of type "' + args.join(', ') +
              '" do not match any of the defined signatures of function ' + _name + '.');
          err.data = {
            category: 'mismatch',
            actual: args.map(findTypeName)
          };
          return err;
        }

        /**
         * Find the lowest index of all exact types of a parameter (no conversions)
         * @param {Param} param
         * @return {number} Returns the index of the lowest type in typed.types
         */
        function getLowestTypeIndex (param) {
          var min = 999;

          for (var i = 0; i < param.types.length; i++) {
            if (isExactType(param.types[i])) {
              min = Math.min(min, param.types[i].typeIndex);
            }
          }

          return min;
        }

        /**
         * Find the lowest index of the conversion of all types of the parameter
         * having a conversion
         * @param {Param} param
         * @return {number} Returns the lowest index of the conversions of this type
         */
        function getLowestConversionIndex (param) {
          var min = 999;

          for (var i = 0; i < param.types.length; i++) {
            if (!isExactType(param.types[i])) {
              min = Math.min(min, param.types[i].conversionIndex);
            }
          }

          return min;
        }

        /**
         * Compare two params
         * @param {Param} param1
         * @param {Param} param2
         * @return {number} returns a negative number when param1 must get a lower
         *                  index than param2, a positive number when the opposite,
         *                  or zero when both are equal
         */
        function compareParams (param1, param2) {
          var c;

          // compare having a rest parameter or not
          c = param1.restParam - param2.restParam;
          if (c !== 0) {
            return c;
          }

          // compare having conversions or not
          c = hasConversions(param1) - hasConversions(param2);
          if (c !== 0) {
            return c;
          }

          // compare the index of the types
          c = getLowestTypeIndex(param1) - getLowestTypeIndex(param2);
          if (c !== 0) {
            return c;
          }

          // compare the index of any conversion
          return getLowestConversionIndex(param1) - getLowestConversionIndex(param2);
        }

        /**
         * Compare two signatures
         * @param {Signature} signature1
         * @param {Signature} signature2
         * @return {number} returns a negative number when param1 must get a lower
         *                  index than param2, a positive number when the opposite,
         *                  or zero when both are equal
         */
        function compareSignatures (signature1, signature2) {
          var len = Math.min(signature1.params.length, signature2.params.length);
          var i;
          var c;

          // compare whether the params have conversions at all or not
          c = signature1.params.some(hasConversions) - signature2.params.some(hasConversions);
          if (c !== 0) {
            return c;
          }

          // next compare whether the params have conversions one by one
          for (i = 0; i < len; i++) {
            c = hasConversions(signature1.params[i]) - hasConversions(signature2.params[i]);
            if (c !== 0) {
              return c;
            }
          }

          // compare the types of the params one by one
          for (i = 0; i < len; i++) {
            c = compareParams(signature1.params[i], signature2.params[i]);
            if (c !== 0) {
              return c;
            }
          }

          // compare the number of params
          return signature1.params.length - signature2.params.length;
        }

        /**
         * Get params containing all types that can be converted to the defined types.
         *
         * @param {ConversionDef[]} conversions
         * @param {string[]} typeNames
         * @return {ConversionDef[]} Returns the conversions that are available
         *                        for every type (if any)
         */
        function filterConversions(conversions, typeNames) {
          var matches = {};

          conversions.forEach(function (conversion) {
            if (typeNames.indexOf(conversion.from) === -1 &&
                typeNames.indexOf(conversion.to) !== -1 &&
                !matches[conversion.from]) {
              matches[conversion.from] = conversion;
            }
          });

          return Object.keys(matches).map(function (from) {
            return matches[from];
          });
        }

        /**
         * Preprocess arguments before calling the original function:
         * - if needed convert the parameters
         * - in case of rest parameters, move the rest parameters into an Array
         * @param {Param[]} params
         * @param {function} fn
         * @return {function} Returns a wrapped function
         */
        function compileArgsPreprocessing(params, fn) {
          var fnConvert = fn;

          // TODO: can we make this wrapper function smarter/simpler?

          if (params.some(hasConversions)) {
            var restParam = hasRestParam(params);
            var compiledConversions = params.map(compileArgConversion);

            fnConvert = function convertArgs() {
              var args = [];
              var last = restParam ? arguments.length - 1 : arguments.length;
              for (var i = 0; i < last; i++) {
                args[i] = compiledConversions[i](arguments[i]);
              }
              if (restParam) {
                args[last] = arguments[last].map(compiledConversions[last]);
              }

              return fn.apply(null, args);
            };
          }

          var fnPreprocess = fnConvert;
          if (hasRestParam(params)) {
            var offset = params.length - 1;

            fnPreprocess = function preprocessRestParams () {
              return fnConvert.apply(null,
                  slice(arguments, 0, offset).concat([slice(arguments, offset)]));
            };
          }

          return fnPreprocess;
        }

        /**
         * Compile conversion for a parameter to the right type
         * @param {Param} param
         * @return {function} Returns the wrapped function that will convert arguments
         *
         */
        function compileArgConversion(param) {
          var test0, test1, conversion0, conversion1;
          var tests = [];
          var conversions = [];

          param.types.forEach(function (type) {
            if (type.conversion) {
              tests.push(findTypeByName(type.conversion.from).test);
              conversions.push(type.conversion.convert);
            }
          });

          // create optimized conversion functions depending on the number of conversions
          switch (conversions.length) {
            case 0:
              return function convertArg(arg) {
                return arg;
              }

            case 1:
              test0 = tests[0];
              conversion0 = conversions[0];
              return function convertArg(arg) {
                if (test0(arg)) {
                  return conversion0(arg)
                }
                return arg;
              }

            case 2:
              test0 = tests[0];
              test1 = tests[1];
              conversion0 = conversions[0];
              conversion1 = conversions[1];
              return function convertArg(arg) {
                if (test0(arg)) {
                  return conversion0(arg)
                }
                if (test1(arg)) {
                  return conversion1(arg)
                }
                return arg;
              }

            default:
              return function convertArg(arg) {
                for (var i = 0; i < conversions.length; i++) {
                  if (tests[i](arg)) {
                    return conversions[i](arg);
                  }
                }
                return arg;
              }
          }
        }

        /**
         * Convert an array with signatures into a map with signatures,
         * where signatures with union types are split into separate signatures
         *
         * Throws an error when there are conflicting types
         *
         * @param {Signature[]} signatures
         * @return {Object.<string, function>}  Returns a map with signatures
         *                                      as key and the original function
         *                                      of this signature as value.
         */
        function createSignaturesMap(signatures) {
          var signaturesMap = {};
          signatures.forEach(function (signature) {
            if (!signature.params.some(hasConversions)) {
              splitParams(signature.params, true).forEach(function (params) {
                signaturesMap[stringifyParams(params)] = signature.fn;
              });
            }
          });

          return signaturesMap;
        }

        /**
         * Split params with union types in to separate params.
         *
         * For example:
         *
         *     splitParams([['Array', 'Object'], ['string', 'RegExp'])
         *     // returns:
         *     // [
         *     //   ['Array', 'string'],
         *     //   ['Array', 'RegExp'],
         *     //   ['Object', 'string'],
         *     //   ['Object', 'RegExp']
         *     // ]
         *
         * @param {Param[]} params
         * @param {boolean} ignoreConversionTypes
         * @return {Param[]}
         */
        function splitParams(params, ignoreConversionTypes) {
          function _splitParams(params, index, types) {
            if (index < params.length) {
              var param = params[index];
              var filteredTypes = ignoreConversionTypes
                  ? param.types.filter(isExactType)
                  : param.types;
              var typeGroups;

              if (param.restParam) {
                // split the types of a rest parameter in two:
                // one with only exact types, and one with exact types and conversions
                var exactTypes = filteredTypes.filter(isExactType);
                typeGroups = exactTypes.length < filteredTypes.length
                    ? [exactTypes, filteredTypes]
                    : [filteredTypes];

              }
              else {
                // split all the types of a regular parameter into one type per group
                typeGroups = filteredTypes.map(function (type) {
                  return [type]
                });
              }

              // recurse over the groups with types
              return flatMap(typeGroups, function (typeGroup) {
                return _splitParams(params, index + 1, types.concat([typeGroup]));
              });

            }
            else {
              // we've reached the end of the parameters. Now build a new Param
              var splittedParams = types.map(function (type, typeIndex) {
                return {
                  types: type,
                  restParam: (typeIndex === params.length - 1) && hasRestParam(params)
                }
              });

              return [splittedParams];
            }
          }

          return _splitParams(params, 0, []);
        }

        /**
         * Test whether two signatures have a conflicting signature
         * @param {Signature} signature1
         * @param {Signature} signature2
         * @return {boolean} Returns true when the signatures conflict, false otherwise.
         */
        function hasConflictingParams(signature1, signature2) {
          var ii = Math.max(signature1.params.length, signature2.params.length);

          for (var i = 0; i < ii; i++) {
            var typesNames1 = getExpectedTypeNames(signature1, i, true);
            var typesNames2 = getExpectedTypeNames(signature2, i, true);

            if (!hasOverlap(typesNames1, typesNames2)) {
              return false;
            }
          }

          var len1 = signature1.params.length;
          var len2 = signature2.params.length;
          var restParam1 = hasRestParam(signature1.params);
          var restParam2 = hasRestParam(signature2.params);

          return restParam1
              ? restParam2 ? (len1 === len2) : (len2 >= len1)
              : restParam2 ? (len1 >= len2)  : (len1 === len2)
        }

        /**
         * Create a typed function
         * @param {String} name               The name for the typed function
         * @param {Object.<string, function>} signaturesMap
         *                                    An object with one or
         *                                    multiple signatures as key, and the
         *                                    function corresponding to the
         *                                    signature as value.
         * @return {function}  Returns the created typed function.
         */
        function createTypedFunction(name, signaturesMap) {
          if (Object.keys(signaturesMap).length === 0) {
            throw new SyntaxError('No signatures provided');
          }

          // parse the signatures, and check for conflicts
          var parsedSignatures = [];
          Object.keys(signaturesMap)
              .map(function (signature) {
                return parseSignature(signature, signaturesMap[signature], typed.conversions);
              })
              .filter(notNull)
              .forEach(function (parsedSignature) {
                // check whether this parameter conflicts with already parsed signatures
                var conflictingSignature = findInArray(parsedSignatures, function (s) {
                  return hasConflictingParams(s, parsedSignature)
                });
                if (conflictingSignature) {
                  throw new TypeError('Conflicting signatures "' +
                      stringifyParams(conflictingSignature.params) + '" and "' +
                      stringifyParams(parsedSignature.params) + '".');
                }

                parsedSignatures.push(parsedSignature);
              });

          // split and filter the types of the signatures, and then order them
          var signatures = flatMap(parsedSignatures, function (parsedSignature) {
            var params = parsedSignature ? splitParams(parsedSignature.params, false) : [];

            return params.map(function (params) {
              return {
                params: params,
                fn: parsedSignature.fn
              };
            });
          }).filter(notNull);

          signatures.sort(compareSignatures);

          // we create a highly optimized checks for the first couple of signatures with max 2 arguments
          var ok0 = signatures[0] && signatures[0].params.length <= 2 && !hasRestParam(signatures[0].params);
          var ok1 = signatures[1] && signatures[1].params.length <= 2 && !hasRestParam(signatures[1].params);
          var ok2 = signatures[2] && signatures[2].params.length <= 2 && !hasRestParam(signatures[2].params);
          var ok3 = signatures[3] && signatures[3].params.length <= 2 && !hasRestParam(signatures[3].params);
          var ok4 = signatures[4] && signatures[4].params.length <= 2 && !hasRestParam(signatures[4].params);
          var ok5 = signatures[5] && signatures[5].params.length <= 2 && !hasRestParam(signatures[5].params);
          var allOk = ok0 && ok1 && ok2 && ok3 && ok4 && ok5;

          // compile the tests
          var tests = signatures.map(function (signature) {
            return compileTests(signature.params);
          });

          var test00 = ok0 ? compileTest(signatures[0].params[0]) : notOk;
          var test10 = ok1 ? compileTest(signatures[1].params[0]) : notOk;
          var test20 = ok2 ? compileTest(signatures[2].params[0]) : notOk;
          var test30 = ok3 ? compileTest(signatures[3].params[0]) : notOk;
          var test40 = ok4 ? compileTest(signatures[4].params[0]) : notOk;
          var test50 = ok5 ? compileTest(signatures[5].params[0]) : notOk;

          var test01 = ok0 ? compileTest(signatures[0].params[1]) : notOk;
          var test11 = ok1 ? compileTest(signatures[1].params[1]) : notOk;
          var test21 = ok2 ? compileTest(signatures[2].params[1]) : notOk;
          var test31 = ok3 ? compileTest(signatures[3].params[1]) : notOk;
          var test41 = ok4 ? compileTest(signatures[4].params[1]) : notOk;
          var test51 = ok5 ? compileTest(signatures[5].params[1]) : notOk;

          // compile the functions
          var fns = signatures.map(function(signature) {
            return compileArgsPreprocessing(signature.params, signature.fn)
          });

          var fn0 = ok0 ? fns[0] : undef;
          var fn1 = ok1 ? fns[1] : undef;
          var fn2 = ok2 ? fns[2] : undef;
          var fn3 = ok3 ? fns[3] : undef;
          var fn4 = ok4 ? fns[4] : undef;
          var fn5 = ok5 ? fns[5] : undef;

          var len0 = ok0 ? signatures[0].params.length : -1;
          var len1 = ok1 ? signatures[1].params.length : -1;
          var len2 = ok2 ? signatures[2].params.length : -1;
          var len3 = ok3 ? signatures[3].params.length : -1;
          var len4 = ok4 ? signatures[4].params.length : -1;
          var len5 = ok5 ? signatures[5].params.length : -1;

          // simple and generic, but also slow
          var iStart = allOk ? 6 : 0;
          var iEnd = signatures.length;
          var generic = function generic() {

            for (var i = iStart; i < iEnd; i++) {
              if (tests[i](arguments)) {
                return fns[i].apply(null, arguments);
              }
            }

            throw createError(name, arguments, signatures);
          };

          // create the typed function
          // fast, specialized version. Falls back to the slower, generic one if needed
          var fn = function fn(arg0, arg1) {

            if (arguments.length === len0 && test00(arg0) && test01(arg1)) { return fn0.apply(null, arguments); }
            if (arguments.length === len1 && test10(arg0) && test11(arg1)) { return fn1.apply(null, arguments); }
            if (arguments.length === len2 && test20(arg0) && test21(arg1)) { return fn2.apply(null, arguments); }
            if (arguments.length === len3 && test30(arg0) && test31(arg1)) { return fn3.apply(null, arguments); }
            if (arguments.length === len4 && test40(arg0) && test41(arg1)) { return fn4.apply(null, arguments); }
            if (arguments.length === len5 && test50(arg0) && test51(arg1)) { return fn5.apply(null, arguments); }

            return generic.apply(null, arguments);
          };

          // attach name the typed function
          try {
            Object.defineProperty(fn, 'name', {value: name});
          }
          catch (err) {
            // old browsers do not support Object.defineProperty and some don't support setting the name property
            // the function name is not essential for the functioning, it's mostly useful for debugging,
            // so it's fine to have unnamed functions.
          }

          // attach signatures to the function
          fn.signatures = createSignaturesMap(signatures);

          return fn;
        }

        /**
         * Test whether a type should be NOT be ignored
         * @param {string} typeName
         * @return {boolean}
         */
        function notIgnore(typeName) {
          return typed.ignore.indexOf(typeName) === -1;
        }

        /**
         * trim a string
         * @param {string} str
         * @return {string}
         */
        function trim(str) {
          return str.trim();
        }

        /**
         * Test whether a string is not empty
         * @param {string} str
         * @return {boolean}
         */
        function notEmpty(str) {
          return !!str;
        }

        /**
         * test whether a value is not strict equal to null
         * @param {*} value
         * @return {boolean}
         */
        function notNull(value) {
          return value !== null;
        }

        /**
         * Test whether a parameter has no types defined
         * @param {Param} param
         * @return {boolean}
         */
        function isInvalidParam (param) {
          return param.types.length === 0;
        }

        /**
         * Return all but the last items of an array
         * @param {Array} arr
         * @return {Array}
         */
        function initial(arr) {
          return arr.slice(0, arr.length - 1);
        }

        /**
         * return the last item of an array
         * @param {Array} arr
         * @return {*}
         */
        function last(arr) {
          return arr[arr.length - 1];
        }

        /**
         * Slice an array or function Arguments
         * @param {Array | Arguments | IArguments} arr
         * @param {number} start
         * @param {number} [end]
         * @return {Array}
         */
        function slice(arr, start, end) {
          return Array.prototype.slice.call(arr, start, end);
        }

        /**
         * Test whether an array contains some item
         * @param {Array} array
         * @param {*} item
         * @return {boolean} Returns true if array contains item, false if not.
         */
        function contains(array, item) {
          return array.indexOf(item) !== -1;
        }

        /**
         * Test whether two arrays have overlapping items
         * @param {Array} array1
         * @param {Array} array2
         * @return {boolean} Returns true when at least one item exists in both arrays
         */
        function hasOverlap(array1, array2) {
          for (var i = 0; i < array1.length; i++) {
            if (contains(array2, array1[i])) {
              return true;
            }
          }

          return false;
        }

        /**
         * Return the first item from an array for which test(arr[i]) returns true
         * @param {Array} arr
         * @param {function} test
         * @return {* | undefined} Returns the first matching item
         *                         or undefined when there is no match
         */
        function findInArray(arr, test) {
          for (var i = 0; i < arr.length; i++) {
            if (test(arr[i])) {
              return arr[i];
            }
          }
          return undefined;
        }

        /**
         * Filter unique items of an array with strings
         * @param {string[]} arr
         * @return {string[]}
         */
        function uniq(arr) {
          var entries = {};
          for (var i = 0; i < arr.length; i++) {
            entries[arr[i]] = true;
          }
          return Object.keys(entries);
        }

        /**
         * Flat map the result invoking a callback for every item in an array.
         * https://gist.github.com/samgiles/762ee337dff48623e729
         * @param {Array} arr
         * @param {function} callback
         * @return {Array}
         */
        function flatMap(arr, callback) {
          return Array.prototype.concat.apply([], arr.map(callback));
        }

        /**
         * Retrieve the function name from a set of typed functions,
         * and check whether the name of all functions match (if given)
         * @param {function[]} fns
         */
        function getName (fns) {
          var name = '';

          for (var i = 0; i < fns.length; i++) {
            var fn = fns[i];

            // check whether the names are the same when defined
            if ((typeof fn.signatures === 'object' || typeof fn.signature === 'string') && fn.name !== '') {
              if (name === '') {
                name = fn.name;
              }
              else if (name !== fn.name) {
                var err = new Error('Function names do not match (expected: ' + name + ', actual: ' + fn.name + ')');
                err.data = {
                  actual: fn.name,
                  expected: name
                };
                throw err;
              }
            }
          }

          return name;
        }

        // extract and merge all signatures of a list with typed functions
        function extractSignatures(fns) {
          var err;
          var signaturesMap = {};

          function validateUnique(_signature, _fn) {
            if (signaturesMap.hasOwnProperty(_signature) && _fn !== signaturesMap[_signature]) {
              err = new Error('Signature "' + _signature + '" is defined twice');
              err.data = {signature: _signature};
              throw err;
              // else: both signatures point to the same function, that's fine
            }
          }

          for (var i = 0; i < fns.length; i++) {
            var fn = fns[i];

            // test whether this is a typed-function
            if (typeof fn.signatures === 'object') {
              // merge the signatures
              for (var signature in fn.signatures) {
                if (fn.signatures.hasOwnProperty(signature)) {
                  validateUnique(signature, fn.signatures[signature]);
                  signaturesMap[signature] = fn.signatures[signature];
                }
              }
            }
            else if (typeof fn.signature === 'string') {
              validateUnique(fn.signature, fn);
              signaturesMap[fn.signature] = fn;
            }
            else {
              err = new TypeError('Function is no typed-function (index: ' + i + ')');
              err.data = {index: i};
              throw err;
            }
          }

          return signaturesMap;
        }

        typed = createTypedFunction('typed', {
          'string, Object': createTypedFunction,
          'Object': function (signaturesMap) {
            // find existing name
            var fns = [];
            for (var signature in signaturesMap) {
              if (signaturesMap.hasOwnProperty(signature)) {
                fns.push(signaturesMap[signature]);
              }
            }
            var name = getName(fns);
            return createTypedFunction(name, signaturesMap);
          },
          '...Function': function (fns) {
            return createTypedFunction(getName(fns), extractSignatures(fns));
          },
          'string, ...Function': function (name, fns) {
            return createTypedFunction(name, extractSignatures(fns));
          }
        });

        typed.create = create;
        typed.types = _types;
        typed.conversions = _conversions;
        typed.ignore = _ignore;
        typed.convert = convert;
        typed.find = find;

        /**
         * add a type
         * @param {{name: string, test: function}} type
         * @param {boolean} [beforeObjectTest=true]
         *                          If true, the new test will be inserted before
         *                          the test with name 'Object' (if any), since
         *                          tests for Object match Array and classes too.
         */
        typed.addType = function (type, beforeObjectTest) {
          if (!type || typeof type.name !== 'string' || typeof type.test !== 'function') {
            throw new TypeError('Object with properties {name: string, test: function} expected');
          }

          if (beforeObjectTest !== false) {
            for (var i = 0; i < typed.types.length; i++) {
              if (typed.types[i].name === 'Object') {
                typed.types.splice(i, 0, type);
                return
              }
            }
          }

          typed.types.push(type);
        };

        // add a conversion
        typed.addConversion = function (conversion) {
          if (!conversion
              || typeof conversion.from !== 'string'
              || typeof conversion.to !== 'string'
              || typeof conversion.convert !== 'function') {
            throw new TypeError('Object with properties {from: string, to: string, convert: function} expected');
          }

          typed.conversions.push(conversion);
        };

        return typed;
      }

      return create();
    }));
    });

    /**
     * @typedef {{sign: '+' | '-' | '', coefficients: number[], exponent: number}} SplitValue
     */

    /**
     * Check if a number is integer
     * @param {number | boolean} value
     * @return {boolean} isInteger
     */

    function isInteger(value) {
      if (typeof value === 'boolean') {
        return true;
      }

      return isFinite(value) ? value === Math.round(value) : false; // Note: we use ==, not ===, as we can have Booleans as well
    }
    /**
     * Convert a number to a formatted string representation.
     *
     * Syntax:
     *
     *    format(value)
     *    format(value, options)
     *    format(value, precision)
     *    format(value, fn)
     *
     * Where:
     *
     *    {number} value   The value to be formatted
     *    {Object} options An object with formatting options. Available options:
     *                     {string} notation
     *                         Number notation. Choose from:
     *                         'fixed'          Always use regular number notation.
     *                                          For example '123.40' and '14000000'
     *                         'exponential'    Always use exponential notation.
     *                                          For example '1.234e+2' and '1.4e+7'
     *                         'engineering'    Always use engineering notation.
     *                                          For example '123.4e+0' and '14.0e+6'
     *                         'auto' (default) Regular number notation for numbers
     *                                          having an absolute value between
     *                                          `lowerExp` and `upperExp` bounds, and
     *                                          uses exponential notation elsewhere.
     *                                          Lower bound is included, upper bound
     *                                          is excluded.
     *                                          For example '123.4' and '1.4e7'.
     *                     {number} precision   A number between 0 and 16 to round
     *                                          the digits of the number.
     *                                          In case of notations 'exponential',
     *                                          'engineering', and 'auto',
     *                                          `precision` defines the total
     *                                          number of significant digits returned.
     *                                          In case of notation 'fixed',
     *                                          `precision` defines the number of
     *                                          significant digits after the decimal
     *                                          point.
     *                                          `precision` is undefined by default,
     *                                          not rounding any digits.
     *                     {number} lowerExp    Exponent determining the lower boundary
     *                                          for formatting a value with an exponent
     *                                          when `notation='auto`.
     *                                          Default value is `-3`.
     *                     {number} upperExp    Exponent determining the upper boundary
     *                                          for formatting a value with an exponent
     *                                          when `notation='auto`.
     *                                          Default value is `5`.
     *    {Function} fn    A custom formatting function. Can be used to override the
     *                     built-in notations. Function `fn` is called with `value` as
     *                     parameter and must return a string. Is useful for example to
     *                     format all values inside a matrix in a particular way.
     *
     * Examples:
     *
     *    format(6.4)                                        // '6.4'
     *    format(1240000)                                    // '1.24e6'
     *    format(1/3)                                        // '0.3333333333333333'
     *    format(1/3, 3)                                     // '0.333'
     *    format(21385, 2)                                   // '21000'
     *    format(12.071, {notation: 'fixed'})                // '12'
     *    format(2.3,    {notation: 'fixed', precision: 2})  // '2.30'
     *    format(52.8,   {notation: 'exponential'})          // '5.28e+1'
     *    format(12345678, {notation: 'engineering'})        // '12.345678e+6'
     *
     * @param {number} value
     * @param {Object | Function | number} [options]
     * @return {string} str The formatted value
     */

    function format(value, options) {
      if (typeof options === 'function') {
        // handle format(value, fn)
        return options(value);
      } // handle special cases


      if (value === Infinity) {
        return 'Infinity';
      } else if (value === -Infinity) {
        return '-Infinity';
      } else if (isNaN(value)) {
        return 'NaN';
      } // default values for options


      var notation = 'auto';
      var precision;

      if (options) {
        // determine notation from options
        if (options.notation) {
          notation = options.notation;
        } // determine precision from options


        if (isNumber(options)) {
          precision = options;
        } else if (isNumber(options.precision)) {
          precision = options.precision;
        }
      } // handle the various notations


      switch (notation) {
        case 'fixed':
          return toFixed(value, precision);

        case 'exponential':
          return toExponential(value, precision);

        case 'engineering':
          return toEngineering(value, precision);

        case 'auto':
          // remove trailing zeros after the decimal point
          return toPrecision(value, precision, options && options).replace(/((\.\d*?)(0+))($|e)/, function () {
            var digits = arguments[2];
            var e = arguments[4];
            return digits !== '.' ? digits + e : e;
          });

        default:
          throw new Error('Unknown notation "' + notation + '". ' + 'Choose "auto", "exponential", or "fixed".');
      }
    }
    /**
     * Split a number into sign, coefficients, and exponent
     * @param {number | string} value
     * @return {SplitValue}
     *              Returns an object containing sign, coefficients, and exponent
     */

    function splitNumber(value) {
      // parse the input value
      var match = String(value).toLowerCase().match(/^0*?(-?)(\d+\.?\d*)(e([+-]?\d+))?$/);

      if (!match) {
        throw new SyntaxError('Invalid number ' + value);
      }

      var sign = match[1];
      var digits = match[2];
      var exponent = parseFloat(match[4] || '0');
      var dot = digits.indexOf('.');
      exponent += dot !== -1 ? dot - 1 : digits.length - 1;
      var coefficients = digits.replace('.', '') // remove the dot (must be removed before removing leading zeros)
      .replace(/^0*/, function (zeros) {
        // remove leading zeros, add their count to the exponent
        exponent -= zeros.length;
        return '';
      }).replace(/0*$/, '') // remove trailing zeros
      .split('').map(function (d) {
        return parseInt(d);
      });

      if (coefficients.length === 0) {
        coefficients.push(0);
        exponent++;
      }

      return {
        sign: sign,
        coefficients: coefficients,
        exponent: exponent
      };
    }
    /**
     * Format a number in engineering notation. Like '1.23e+6', '2.3e+0', '3.500e-3'
     * @param {number | string} value
     * @param {number} [precision]        Optional number of significant figures to return.
     */

    function toEngineering(value, precision) {
      if (isNaN(value) || !isFinite(value)) {
        return String(value);
      }

      var split = splitNumber(value);
      var rounded = roundDigits(split, precision);
      var e = rounded.exponent;
      var c = rounded.coefficients; // find nearest lower multiple of 3 for exponent

      var newExp = e % 3 === 0 ? e : e < 0 ? e - 3 - e % 3 : e - e % 3;

      if (isNumber(precision)) {
        // add zeroes to give correct sig figs
        while (precision > c.length || e - newExp + 1 > c.length) {
          c.push(0);
        }
      } else {
        // concatenate coefficients with necessary zeros
        // add zeros if necessary (for example: 1e+8 -> 100e+6)
        var missingZeros = Math.abs(e - newExp) - (c.length - 1);

        for (var i = 0; i < missingZeros; i++) {
          c.push(0);
        }
      } // find difference in exponents


      var expDiff = Math.abs(e - newExp);
      var decimalIdx = 1; // push decimal index over by expDiff times

      while (expDiff > 0) {
        decimalIdx++;
        expDiff--;
      } // if all coefficient values are zero after the decimal point and precision is unset, don't add a decimal value.
      // otherwise concat with the rest of the coefficients


      var decimals = c.slice(decimalIdx).join('');
      var decimalVal = isNumber(precision) && decimals.length || decimals.match(/[1-9]/) ? '.' + decimals : '';
      var str = c.slice(0, decimalIdx).join('') + decimalVal + 'e' + (e >= 0 ? '+' : '') + newExp.toString();
      return rounded.sign + str;
    }
    /**
     * Format a number with fixed notation.
     * @param {number | string} value
     * @param {number} [precision=undefined]  Optional number of decimals after the
     *                                        decimal point. null by default.
     */

    function toFixed(value, precision) {
      if (isNaN(value) || !isFinite(value)) {
        return String(value);
      }

      var splitValue = splitNumber(value);
      var rounded = typeof precision === 'number' ? roundDigits(splitValue, splitValue.exponent + 1 + precision) : splitValue;
      var c = rounded.coefficients;
      var p = rounded.exponent + 1; // exponent may have changed
      // append zeros if needed

      var pp = p + (precision || 0);

      if (c.length < pp) {
        c = c.concat(zeros(pp - c.length));
      } // prepend zeros if needed


      if (p < 0) {
        c = zeros(-p + 1).concat(c);
        p = 1;
      } // insert a dot if needed


      if (p < c.length) {
        c.splice(p, 0, p === 0 ? '0.' : '.');
      }

      return rounded.sign + c.join('');
    }
    /**
     * Format a number in exponential notation. Like '1.23e+5', '2.3e+0', '3.500e-3'
     * @param {number | string} value
     * @param {number} [precision]  Number of digits in formatted output.
     *                              If not provided, the maximum available digits
     *                              is used.
     */

    function toExponential(value, precision) {
      if (isNaN(value) || !isFinite(value)) {
        return String(value);
      } // round if needed, else create a clone


      var split = splitNumber(value);
      var rounded = precision ? roundDigits(split, precision) : split;
      var c = rounded.coefficients;
      var e = rounded.exponent; // append zeros if needed

      if (c.length < precision) {
        c = c.concat(zeros(precision - c.length));
      } // format as `C.CCCe+EEE` or `C.CCCe-EEE`


      var first = c.shift();
      return rounded.sign + first + (c.length > 0 ? '.' + c.join('') : '') + 'e' + (e >= 0 ? '+' : '') + e;
    }
    /**
     * Format a number with a certain precision
     * @param {number | string} value
     * @param {number} [precision=undefined] Optional number of digits.
     * @param {{lowerExp: number | undefined, upperExp: number | undefined}} [options]
     *                                       By default:
     *                                         lowerExp = -3 (incl)
     *                                         upper = +5 (excl)
     * @return {string}
     */

    function toPrecision(value, precision, options) {
      if (isNaN(value) || !isFinite(value)) {
        return String(value);
      } // determine lower and upper bound for exponential notation.


      var lowerExp = options && options.lowerExp !== undefined ? options.lowerExp : -3;
      var upperExp = options && options.upperExp !== undefined ? options.upperExp : 5;
      var split = splitNumber(value);
      var rounded = precision ? roundDigits(split, precision) : split;

      if (rounded.exponent < lowerExp || rounded.exponent >= upperExp) {
        // exponential notation
        return toExponential(value, precision);
      } else {
        var c = rounded.coefficients;
        var e = rounded.exponent; // append trailing zeros

        if (c.length < precision) {
          c = c.concat(zeros(precision - c.length));
        } // append trailing zeros
        // TODO: simplify the next statement


        c = c.concat(zeros(e - c.length + 1 + (c.length < precision ? precision - c.length : 0))); // prepend zeros

        c = zeros(-e).concat(c);
        var dot = e > 0 ? e : 0;

        if (dot < c.length - 1) {
          c.splice(dot + 1, 0, '.');
        }

        return rounded.sign + c.join('');
      }
    }
    /**
     * Round the number of digits of a number *
     * @param {SplitValue} split       A value split with .splitNumber(value)
     * @param {number} precision  A positive integer
     * @return {SplitValue}
     *              Returns an object containing sign, coefficients, and exponent
     *              with rounded digits
     */

    function roundDigits(split, precision) {
      // create a clone
      var rounded = {
        sign: split.sign,
        coefficients: split.coefficients,
        exponent: split.exponent
      };
      var c = rounded.coefficients; // prepend zeros if needed

      while (precision <= 0) {
        c.unshift(0);
        rounded.exponent++;
        precision++;
      }

      if (c.length > precision) {
        var removed = c.splice(precision, c.length - precision);

        if (removed[0] >= 5) {
          var i = precision - 1;
          c[i]++;

          while (c[i] === 10) {
            c.pop();

            if (i === 0) {
              c.unshift(0);
              rounded.exponent++;
              i++;
            }

            i--;
            c[i]++;
          }
        }
      }

      return rounded;
    }
    /**
     * Create an array filled with zeros.
     * @param {number} length
     * @return {Array}
     */

    function zeros(length) {
      var arr = [];

      for (var i = 0; i < length; i++) {
        arr.push(0);
      }

      return arr;
    }
    /**
     * Count the number of significant digits of a number.
     *
     * For example:
     *   2.34 returns 3
     *   0.0034 returns 2
     *   120.5e+30 returns 4
     *
     * @param {number} value
     * @return {number} digits   Number of significant digits
     */


    function digits(value) {
      return value.toExponential().replace(/e.*$/, '') // remove exponential notation
      .replace(/^0\.?0*|\./, '') // remove decimal point and leading zeros
      .length;
    }

    /**
     * Convert a BigNumber to a formatted string representation.
     *
     * Syntax:
     *
     *    format(value)
     *    format(value, options)
     *    format(value, precision)
     *    format(value, fn)
     *
     * Where:
     *
     *    {number} value   The value to be formatted
     *    {Object} options An object with formatting options. Available options:
     *                     {string} notation
     *                         Number notation. Choose from:
     *                         'fixed'          Always use regular number notation.
     *                                          For example '123.40' and '14000000'
     *                         'exponential'    Always use exponential notation.
     *                                          For example '1.234e+2' and '1.4e+7'
     *                         'auto' (default) Regular number notation for numbers
     *                                          having an absolute value between
     *                                          `lower` and `upper` bounds, and uses
     *                                          exponential notation elsewhere.
     *                                          Lower bound is included, upper bound
     *                                          is excluded.
     *                                          For example '123.4' and '1.4e7'.
     *                     {number} precision   A number between 0 and 16 to round
     *                                          the digits of the number.
     *                                          In case of notations 'exponential',
     *                                          'engineering', and 'auto',
     *                                          `precision` defines the total
     *                                          number of significant digits returned.
     *                                          In case of notation 'fixed',
     *                                          `precision` defines the number of
     *                                          significant digits after the decimal
     *                                          point.
     *                                          `precision` is undefined by default.
     *                     {number} lowerExp    Exponent determining the lower boundary
     *                                          for formatting a value with an exponent
     *                                          when `notation='auto`.
     *                                          Default value is `-3`.
     *                     {number} upperExp    Exponent determining the upper boundary
     *                                          for formatting a value with an exponent
     *                                          when `notation='auto`.
     *                                          Default value is `5`.
     *    {Function} fn    A custom formatting function. Can be used to override the
     *                     built-in notations. Function `fn` is called with `value` as
     *                     parameter and must return a string. Is useful for example to
     *                     format all values inside a matrix in a particular way.
     *
     * Examples:
     *
     *    format(6.4)                                        // '6.4'
     *    format(1240000)                                    // '1.24e6'
     *    format(1/3)                                        // '0.3333333333333333'
     *    format(1/3, 3)                                     // '0.333'
     *    format(21385, 2)                                   // '21000'
     *    format(12e8, {notation: 'fixed'})                  // returns '1200000000'
     *    format(2.3,    {notation: 'fixed', precision: 4})  // returns '2.3000'
     *    format(52.8,   {notation: 'exponential'})          // returns '5.28e+1'
     *    format(12400,  {notation: 'engineering'})          // returns '12.400e+3'
     *
     * @param {BigNumber} value
     * @param {Object | Function | number} [options]
     * @return {string} str The formatted value
     */
    function format$1(value, options) {
      if (typeof options === 'function') {
        // handle format(value, fn)
        return options(value);
      } // handle special cases


      if (!value.isFinite()) {
        return value.isNaN() ? 'NaN' : value.gt(0) ? 'Infinity' : '-Infinity';
      } // default values for options


      var notation = 'auto';
      var precision;

      if (options !== undefined) {
        // determine notation from options
        if (options.notation) {
          notation = options.notation;
        } // determine precision from options


        if (typeof options === 'number') {
          precision = options;
        } else if (options.precision) {
          precision = options.precision;
        }
      } // handle the various notations


      switch (notation) {
        case 'fixed':
          return toFixed$1(value, precision);

        case 'exponential':
          return toExponential$1(value, precision);

        case 'engineering':
          return toEngineering$1(value, precision);

        case 'auto':
          {
            // determine lower and upper bound for exponential notation.
            // TODO: implement support for upper and lower to be BigNumbers themselves
            var lowerExp = options && options.lowerExp !== undefined ? options.lowerExp : -3;
            var upperExp = options && options.upperExp !== undefined ? options.upperExp : 5; // handle special case zero

            if (value.isZero()) return '0'; // determine whether or not to output exponential notation

            var str;
            var rounded = value.toSignificantDigits(precision);
            var exp = rounded.e;

            if (exp >= lowerExp && exp < upperExp) {
              // normal number notation
              str = rounded.toFixed();
            } else {
              // exponential notation
              str = toExponential$1(value, precision);
            } // remove trailing zeros after the decimal point


            return str.replace(/((\.\d*?)(0+))($|e)/, function () {
              var digits = arguments[2];
              var e = arguments[4];
              return digits !== '.' ? digits + e : e;
            });
          }

        default:
          throw new Error('Unknown notation "' + notation + '". ' + 'Choose "auto", "exponential", or "fixed".');
      }
    }
    /**
     * Format a BigNumber in engineering notation. Like '1.23e+6', '2.3e+0', '3.500e-3'
     * @param {BigNumber | string} value
     * @param {number} [precision]        Optional number of significant figures to return.
     */

    function toEngineering$1(value, precision) {
      // find nearest lower multiple of 3 for exponent
      var e = value.e;
      var newExp = e % 3 === 0 ? e : e < 0 ? e - 3 - e % 3 : e - e % 3; // find difference in exponents, and calculate the value without exponent

      var valueWithoutExp = value.mul(Math.pow(10, -newExp));
      var valueStr = valueWithoutExp.toPrecision(precision);

      if (valueStr.indexOf('e') !== -1) {
        valueStr = valueWithoutExp.toString();
      }

      return valueStr + 'e' + (e >= 0 ? '+' : '') + newExp.toString();
    }
    /**
     * Format a number in exponential notation. Like '1.23e+5', '2.3e+0', '3.500e-3'
     * @param {BigNumber} value
     * @param {number} [precision]  Number of digits in formatted output.
     *                              If not provided, the maximum available digits
     *                              is used.
     * @returns {string} str
     */

    function toExponential$1(value, precision) {
      if (precision !== undefined) {
        return value.toExponential(precision - 1); // Note the offset of one
      } else {
        return value.toExponential();
      }
    }
    /**
     * Format a number with fixed notation.
     * @param {BigNumber} value
     * @param {number} [precision=undefined] Optional number of decimals after the
     *                                       decimal point. Undefined by default.
     */

    function toFixed$1(value, precision) {
      return value.toFixed(precision);
    }

    function _typeof$2(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof$2 = function _typeof(obj) { return typeof obj; }; } else { _typeof$2 = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof$2(obj); }
    /**
     * Format a value of any type into a string.
     *
     * Usage:
     *     math.format(value)
     *     math.format(value, precision)
     *
     * When value is a function:
     *
     * - When the function has a property `syntax`, it returns this
     *   syntax description.
     * - In other cases, a string `'function'` is returned.
     *
     * When `value` is an Object:
     *
     * - When the object contains a property `format` being a function, this
     *   function is invoked as `value.format(options)` and the result is returned.
     * - When the object has its own `toString` method, this method is invoked
     *   and the result is returned.
     * - In other cases the function will loop over all object properties and
     *   return JSON object notation like '{"a": 2, "b": 3}'.
     *
     * Example usage:
     *     math.format(2/7)                // '0.2857142857142857'
     *     math.format(math.pi, 3)         // '3.14'
     *     math.format(new Complex(2, 3))  // '2 + 3i'
     *     math.format('hello')            // '"hello"'
     *
     * @param {*} value             Value to be stringified
     * @param {Object | number | Function} [options]  Formatting options. See
     *                                                lib/utils/number:format for a
     *                                                description of the available
     *                                                options.
     * @return {string} str
     */

    function format$2(value, options) {
      if (typeof value === 'number') {
        return format(value, options);
      }

      if (isBigNumber(value)) {
        return format$1(value, options);
      } // note: we use unsafe duck-typing here to check for Fractions, this is
      // ok here since we're only invoking toString or concatenating its values


      if (looksLikeFraction(value)) {
        if (!options || options.fraction !== 'decimal') {
          // output as ratio, like '1/3'
          return value.s * value.n + '/' + value.d;
        } else {
          // output as decimal, like '0.(3)'
          return value.toString();
        }
      }

      if (Array.isArray(value)) {
        return formatArray(value, options);
      }

      if (isString(value)) {
        return '"' + value + '"';
      }

      if (typeof value === 'function') {
        return value.syntax ? String(value.syntax) : 'function';
      }

      if (value && _typeof$2(value) === 'object') {
        if (typeof value.format === 'function') {
          return value.format(options);
        } else if (value && value.toString(options) !== {}.toString()) {
          // this object has a non-native toString method, use that one
          return value.toString(options);
        } else {
          var entries = Object.keys(value).map(function (key) {
            return '"' + key + '": ' + format$2(value[key], options);
          });
          return '{' + entries.join(', ') + '}';
        }
      }

      return String(value);
    }
    /**
     * Recursively format an n-dimensional matrix
     * Example output: "[[1, 2], [3, 4]]"
     * @param {Array} array
     * @param {Object | number | Function} [options]  Formatting options. See
     *                                                lib/utils/number:format for a
     *                                                description of the available
     *                                                options.
     * @returns {string} str
     */

    function formatArray(array, options) {
      if (Array.isArray(array)) {
        var str = '[';
        var len = array.length;

        for (var i = 0; i < len; i++) {
          if (i !== 0) {
            str += ', ';
          }

          str += formatArray(array[i], options);
        }

        str += ']';
        return str;
      } else {
        return format$2(array, options);
      }
    }
    /**
     * Check whether a value looks like a Fraction (unsafe duck-type check)
     * @param {*} value
     * @return {boolean}
     */


    function looksLikeFraction(value) {
      return value && _typeof$2(value) === 'object' && typeof value.s === 'number' && typeof value.n === 'number' && typeof value.d === 'number' || false;
    }

    /**
     * Create a range error with the message:
     *     'Dimension mismatch (<actual size> != <expected size>)'
     * @param {number | number[]} actual        The actual size
     * @param {number | number[]} expected      The expected size
     * @param {string} [relation='!=']          Optional relation between actual
     *                                          and expected size: '!=', '<', etc.
     * @extends RangeError
     */
    function DimensionError(actual, expected, relation) {
      if (!(this instanceof DimensionError)) {
        throw new SyntaxError('Constructor must be called with the new operator');
      }

      this.actual = actual;
      this.expected = expected;
      this.relation = relation;
      this.message = 'Dimension mismatch (' + (Array.isArray(actual) ? '[' + actual.join(', ') + ']' : actual) + ' ' + (this.relation || '!=') + ' ' + (Array.isArray(expected) ? '[' + expected.join(', ') + ']' : expected) + ')';
      this.stack = new Error().stack;
    }
    DimensionError.prototype = new RangeError();
    DimensionError.prototype.constructor = RangeError;
    DimensionError.prototype.name = 'DimensionError';
    DimensionError.prototype.isDimensionError = true;

    /**
     * Create a range error with the message:
     *     'Index out of range (index < min)'
     *     'Index out of range (index < max)'
     *
     * @param {number} index     The actual index
     * @param {number} [min=0]   Minimum index (included)
     * @param {number} [max]     Maximum index (excluded)
     * @extends RangeError
     */
    function IndexError(index, min, max) {
      if (!(this instanceof IndexError)) {
        throw new SyntaxError('Constructor must be called with the new operator');
      }

      this.index = index;

      if (arguments.length < 3) {
        this.min = 0;
        this.max = min;
      } else {
        this.min = min;
        this.max = max;
      }

      if (this.min !== undefined && this.index < this.min) {
        this.message = 'Index out of range (' + this.index + ' < ' + this.min + ')';
      } else if (this.max !== undefined && this.index >= this.max) {
        this.message = 'Index out of range (' + this.index + ' > ' + (this.max - 1) + ')';
      } else {
        this.message = 'Index out of range (' + this.index + ')';
      }

      this.stack = new Error().stack;
    }
    IndexError.prototype = new RangeError();
    IndexError.prototype.constructor = RangeError;
    IndexError.prototype.name = 'IndexError';
    IndexError.prototype.isIndexError = true;

    /**
     * Calculate the size of a multi dimensional array.
     * This function checks the size of the first entry, it does not validate
     * whether all dimensions match. (use function `validate` for that)
     * @param {Array} x
     * @Return {Number[]} size
     */

    function arraySize(x) {
      var s = [];

      while (Array.isArray(x)) {
        s.push(x.length);
        x = x[0];
      }

      return s;
    }
    /**
     * Recursively validate whether each element in a multi dimensional array
     * has a size corresponding to the provided size array.
     * @param {Array} array    Array to be validated
     * @param {number[]} size  Array with the size of each dimension
     * @param {number} dim   Current dimension
     * @throws DimensionError
     * @private
     */

    function _validate(array, size, dim) {
      var i;
      var len = array.length;

      if (len !== size[dim]) {
        throw new DimensionError(len, size[dim]);
      }

      if (dim < size.length - 1) {
        // recursively validate each child array
        var dimNext = dim + 1;

        for (i = 0; i < len; i++) {
          var child = array[i];

          if (!Array.isArray(child)) {
            throw new DimensionError(size.length - 1, size.length, '<');
          }

          _validate(array[i], size, dimNext);
        }
      } else {
        // last dimension. none of the childs may be an array
        for (i = 0; i < len; i++) {
          if (Array.isArray(array[i])) {
            throw new DimensionError(size.length + 1, size.length, '>');
          }
        }
      }
    }
    /**
     * Validate whether each element in a multi dimensional array has
     * a size corresponding to the provided size array.
     * @param {Array} array    Array to be validated
     * @param {number[]} size  Array with the size of each dimension
     * @throws DimensionError
     */


    function validate(array, size) {
      var isScalar = size.length === 0;

      if (isScalar) {
        // scalar
        if (Array.isArray(array)) {
          throw new DimensionError(array.length, 0);
        }
      } else {
        // array
        _validate(array, size, 0);
      }
    }
    /**
     * Test whether index is an integer number with index >= 0 and index < length
     * when length is provided
     * @param {number} index    Zero-based index
     * @param {number} [length] Length of the array
     */

    function validateIndex(index, length) {
      if (!isNumber(index) || !isInteger(index)) {
        throw new TypeError('Index must be an integer (value: ' + index + ')');
      }

      if (index < 0 || typeof length === 'number' && index >= length) {
        throw new IndexError(index, length);
      }
    }
    /**
     * Resize a multi dimensional array. The resized array is returned.
     * @param {Array} array         Array to be resized
     * @param {Array.<number>} size Array with the size of each dimension
     * @param {*} [defaultValue=0]  Value to be filled in in new entries,
     *                              zero by default. Specify for example `null`,
     *                              to clearly see entries that are not explicitly
     *                              set.
     * @return {Array} array         The resized array
     */

    function resize(array, size, defaultValue) {
      // TODO: add support for scalars, having size=[] ?
      // check the type of the arguments
      if (!Array.isArray(array) || !Array.isArray(size)) {
        throw new TypeError('Array expected');
      }

      if (size.length === 0) {
        throw new Error('Resizing to scalar is not supported');
      } // check whether size contains positive integers


      size.forEach(function (value) {
        if (!isNumber(value) || !isInteger(value) || value < 0) {
          throw new TypeError('Invalid size, must contain positive integers ' + '(size: ' + format$2(size) + ')');
        }
      }); // recursively resize the array

      var _defaultValue = defaultValue !== undefined ? defaultValue : 0;

      _resize(array, size, 0, _defaultValue);

      return array;
    }
    /**
     * Recursively resize a multi dimensional array
     * @param {Array} array         Array to be resized
     * @param {number[]} size       Array with the size of each dimension
     * @param {number} dim          Current dimension
     * @param {*} [defaultValue]    Value to be filled in in new entries,
     *                              undefined by default.
     * @private
     */

    function _resize(array, size, dim, defaultValue) {
      var i;
      var elem;
      var oldLen = array.length;
      var newLen = size[dim];
      var minLen = Math.min(oldLen, newLen); // apply new length

      array.length = newLen;

      if (dim < size.length - 1) {
        // non-last dimension
        var dimNext = dim + 1; // resize existing child arrays

        for (i = 0; i < minLen; i++) {
          // resize child array
          elem = array[i];

          if (!Array.isArray(elem)) {
            elem = [elem]; // add a dimension

            array[i] = elem;
          }

          _resize(elem, size, dimNext, defaultValue);
        } // create new child arrays


        for (i = minLen; i < newLen; i++) {
          // get child array
          elem = [];
          array[i] = elem; // resize new child array

          _resize(elem, size, dimNext, defaultValue);
        }
      } else {
        // last dimension
        // remove dimensions of existing values
        for (i = 0; i < minLen; i++) {
          while (Array.isArray(array[i])) {
            array[i] = array[i][0];
          }
        } // fill new elements with the default value


        for (i = minLen; i < newLen; i++) {
          array[i] = defaultValue;
        }
      }
    }
    /**
     * Re-shape a multi dimensional array to fit the specified dimensions
     * @param {Array} array           Array to be reshaped
     * @param {Array.<number>} sizes  List of sizes for each dimension
     * @returns {Array}               Array whose data has been formatted to fit the
     *                                specified dimensions
     *
     * @throws {DimensionError}       If the product of the new dimension sizes does
     *                                not equal that of the old ones
     */


    function reshape(array, sizes) {
      var flatArray = flatten(array);
      var newArray;

      function product(arr) {
        return arr.reduce(function (prev, curr) {
          return prev * curr;
        });
      }

      if (!Array.isArray(array) || !Array.isArray(sizes)) {
        throw new TypeError('Array expected');
      }

      if (sizes.length === 0) {
        throw new DimensionError(0, product(arraySize(array)), '!=');
      }

      var totalSize = 1;

      for (var sizeIndex = 0; sizeIndex < sizes.length; sizeIndex++) {
        totalSize *= sizes[sizeIndex];
      }

      if (flatArray.length !== totalSize) {
        throw new DimensionError(product(sizes), product(arraySize(array)), '!=');
      }

      try {
        newArray = _reshape(flatArray, sizes);
      } catch (e) {
        if (e instanceof DimensionError) {
          throw new DimensionError(product(sizes), product(arraySize(array)), '!=');
        }

        throw e;
      }

      return newArray;
    }
    /**
     * Iteratively re-shape a multi dimensional array to fit the specified dimensions
     * @param {Array} array           Array to be reshaped
     * @param {Array.<number>} sizes  List of sizes for each dimension
     * @returns {Array}               Array whose data has been formatted to fit the
     *                                specified dimensions
     */

    function _reshape(array, sizes) {
      // testing if there are enough elements for the requested shape
      var tmpArray = array;
      var tmpArray2; // for each dimensions starting by the last one and ignoring the first one

      for (var sizeIndex = sizes.length - 1; sizeIndex > 0; sizeIndex--) {
        var size = sizes[sizeIndex];
        tmpArray2 = []; // aggregate the elements of the current tmpArray in elements of the requested size

        var length = tmpArray.length / size;

        for (var i = 0; i < length; i++) {
          tmpArray2.push(tmpArray.slice(i * size, (i + 1) * size));
        } // set it as the new tmpArray for the next loop turn or for return


        tmpArray = tmpArray2;
      }

      return tmpArray;
    }
    /**
     * Unsqueeze a multi dimensional array: add dimensions when missing
     *
     * Paramter `size` will be mutated to match the new, unqueezed matrix size.
     *
     * @param {Array} array
     * @param {number} dims       Desired number of dimensions of the array
     * @param {number} [outer]    Number of outer dimensions to be added
     * @param {Array} [size] Current size of array.
     * @returns {Array} returns the array itself
     * @private
     */


    function unsqueeze(array, dims, outer, size) {
      var s = size || arraySize(array); // unsqueeze outer dimensions

      if (outer) {
        for (var i = 0; i < outer; i++) {
          array = [array];
          s.unshift(1);
        }
      } // unsqueeze inner dimensions


      array = _unsqueeze(array, dims, 0);

      while (s.length < dims) {
        s.push(1);
      }

      return array;
    }
    /**
     * Recursively unsqueeze a multi dimensional array
     * @param {Array} array
     * @param {number} dims Required number of dimensions
     * @param {number} dim  Current dimension
     * @returns {Array | *} Returns the squeezed array
     * @private
     */

    function _unsqueeze(array, dims, dim) {
      var i, ii;

      if (Array.isArray(array)) {
        var next = dim + 1;

        for (i = 0, ii = array.length; i < ii; i++) {
          array[i] = _unsqueeze(array[i], dims, next);
        }
      } else {
        for (var d = dim; d < dims; d++) {
          array = [array];
        }
      }

      return array;
    }
    /**
     * Flatten a multi dimensional array, put all elements in a one dimensional
     * array
     * @param {Array} array   A multi dimensional array
     * @return {Array}        The flattened array (1 dimensional)
     */


    function flatten(array) {
      if (!Array.isArray(array)) {
        // if not an array, return as is
        return array;
      }

      var flat = [];
      array.forEach(function callback(value) {
        if (Array.isArray(value)) {
          value.forEach(callback); // traverse through sub-arrays recursively
        } else {
          flat.push(value);
        }
      });
      return flat;
    }
    /**
     * Check the datatype of a given object
     * This is a low level implementation that should only be used by
     * parent Matrix classes such as SparseMatrix or DenseMatrix
     * This method does not validate Array Matrix shape
     * @param {Array} array
     * @param {function} typeOf   Callback function to use to determine the type of a value
     * @return string
     */

    function getArrayDataType(array, typeOf) {
      var type; // to hold type info

      var length = 0; // to hold length value to ensure it has consistent sizes

      for (var i = 0; i < array.length; i++) {
        var item = array[i];
        var isArray = Array.isArray(item); // Saving the target matrix row size

        if (i === 0 && isArray) {
          length = item.length;
        } // If the current item is an array but the length does not equal the targetVectorSize


        if (isArray && item.length !== length) {
          return undefined;
        }

        var itemType = isArray ? getArrayDataType(item, typeOf) // recurse into a nested array
        : typeOf(item);

        if (type === undefined) {
          type = itemType; // first item
        } else if (type !== itemType) {
          return 'mixed';
        }
      }

      return type;
    }

    /**
     * Create a factory function, which can be used to inject dependencies.
     *
     * The created functions are memoized, a consecutive call of the factory
     * with the exact same inputs will return the same function instance.
     * The memoized cache is exposed on `factory.cache` and can be cleared
     * if needed.
     *
     * Example:
     *
     *     const name = 'log'
     *     const dependencies = ['config', 'typed', 'divideScalar', 'Complex']
     *
     *     export const createLog = factory(name, dependencies, ({ typed, config, divideScalar, Complex }) => {
     *       // ... create the function log here and return it
     *     }
     *
     * @param {string} name           Name of the function to be created
     * @param {string[]} dependencies The names of all required dependencies
     * @param {function} create       Callback function called with an object with all dependencies
     * @param {Object} [meta]         Optional object with meta information that will be attached
     *                                to the created factory function as property `meta`.
     * @returns {function}
     */

    function factory$2(name, dependencies, create, meta) {
      function assertAndCreate(scope) {
        // we only pass the requested dependencies to the factory function
        // to prevent functions to rely on dependencies that are not explicitly
        // requested.
        var deps = pickShallow(scope, dependencies.map(stripOptionalNotation));
        assertDependencies(name, dependencies, scope);
        return create(deps);
      }

      assertAndCreate.isFactory = true;
      assertAndCreate.fn = name;
      assertAndCreate.dependencies = dependencies.slice().sort();

      if (meta) {
        assertAndCreate.meta = meta;
      }

      return assertAndCreate;
    }
    /**
     * Assert that all dependencies of a list with dependencies are available in the provided scope.
     *
     * Will throw an exception when there are dependencies missing.
     *
     * @param {string} name   Name for the function to be created. Used to generate a useful error message
     * @param {string[]} dependencies
     * @param {Object} scope
     */

    function assertDependencies(name, dependencies, scope) {
      var allDefined = dependencies.filter(function (dependency) {
        return !isOptionalDependency(dependency);
      }) // filter optionals
      .every(function (dependency) {
        return scope[dependency] !== undefined;
      });

      if (!allDefined) {
        var missingDependencies = dependencies.filter(function (dependency) {
          return scope[dependency] === undefined;
        }); // TODO: create a custom error class for this, a MathjsError or something like that

        throw new Error("Cannot create function \"".concat(name, "\", ") + "some dependencies are missing: ".concat(missingDependencies.map(function (d) {
          return "\"".concat(d, "\"");
        }).join(', '), "."));
      }
    }
    function isOptionalDependency(dependency) {
      return dependency && dependency[0] === '?';
    }
    function stripOptionalNotation(dependency) {
      return dependency && dependency[0] === '?' ? dependency.slice(1) : dependency;
    }

    /**
     * Create a typed-function which checks the types of the arguments and
     * can match them against multiple provided signatures. The typed-function
     * automatically converts inputs in order to find a matching signature.
     * Typed functions throw informative errors in case of wrong input arguments.
     *
     * See the library [typed-function](https://github.com/josdejong/typed-function)
     * for detailed documentation.
     *
     * Syntax:
     *
     *     math.typed(name, signatures) : function
     *     math.typed(signatures) : function
     *
     * Examples:
     *
     *     // create a typed function with multiple types per argument (type union)
     *     const fn2 = typed({
     *       'number | boolean': function (b) {
     *         return 'b is a number or boolean'
     *       },
     *       'string, number | boolean': function (a, b) {
     *         return 'a is a string, b is a number or boolean'
     *       }
     *     })
     *
     *     // create a typed function with an any type argument
     *     const log = typed({
     *       'string, any': function (event, data) {
     *         console.log('event: ' + event + ', data: ' + JSON.stringify(data))
     *       }
     *     })
     *
     * @param {string} [name]                          Optional name for the typed-function
     * @param {Object<string, function>} signatures   Object with one or multiple function signatures
     * @returns {function} The created typed-function.
     */

    var _createTyped2 = function _createTyped() {
      // initially, return the original instance of typed-function
      // consecutively, return a new instance from typed.create.
      _createTyped2 = typedFunction.create;
      return typedFunction;
    };

    var dependencies = ['?BigNumber', '?Complex', '?DenseMatrix', '?Fraction'];
    /**
     * Factory function for creating a new typed instance
     * @param {Object} dependencies   Object with data types like Complex and BigNumber
     * @returns {Function}
     */

    var createTyped = /* #__PURE__ */factory$2('typed', dependencies, function createTyped(_ref) {
      var BigNumber = _ref.BigNumber,
          Complex = _ref.Complex,
          DenseMatrix = _ref.DenseMatrix,
          Fraction = _ref.Fraction;

      // TODO: typed-function must be able to silently ignore signatures with unknown data types
      // get a new instance of typed-function
      var typed = _createTyped2(); // define all types. The order of the types determines in which order function
      // arguments are type-checked (so for performance it's important to put the
      // most used types first).


      typed.types = [{
        name: 'number',
        test: isNumber
      }, {
        name: 'Complex',
        test: isComplex
      }, {
        name: 'BigNumber',
        test: isBigNumber
      }, {
        name: 'Fraction',
        test: isFraction
      }, {
        name: 'Unit',
        test: isUnit
      }, {
        name: 'string',
        test: isString
      }, {
        name: 'Chain',
        test: isChain
      }, {
        name: 'Array',
        test: isArray
      }, {
        name: 'Matrix',
        test: isMatrix
      }, {
        name: 'DenseMatrix',
        test: isDenseMatrix
      }, {
        name: 'SparseMatrix',
        test: isSparseMatrix
      }, {
        name: 'Range',
        test: isRange
      }, {
        name: 'Index',
        test: isIndex
      }, {
        name: 'boolean',
        test: isBoolean
      }, {
        name: 'ResultSet',
        test: isResultSet
      }, {
        name: 'Help',
        test: isHelp
      }, {
        name: 'function',
        test: isFunction
      }, {
        name: 'Date',
        test: isDate
      }, {
        name: 'RegExp',
        test: isRegExp
      }, {
        name: 'null',
        test: isNull
      }, {
        name: 'undefined',
        test: isUndefined
      }, {
        name: 'AccessorNode',
        test: isAccessorNode
      }, {
        name: 'ArrayNode',
        test: isArrayNode
      }, {
        name: 'AssignmentNode',
        test: isAssignmentNode
      }, {
        name: 'BlockNode',
        test: isBlockNode
      }, {
        name: 'ConditionalNode',
        test: isConditionalNode
      }, {
        name: 'ConstantNode',
        test: isConstantNode
      }, {
        name: 'FunctionNode',
        test: isFunctionNode
      }, {
        name: 'FunctionAssignmentNode',
        test: isFunctionAssignmentNode
      }, {
        name: 'IndexNode',
        test: isIndexNode
      }, {
        name: 'Node',
        test: isNode
      }, {
        name: 'ObjectNode',
        test: isObjectNode
      }, {
        name: 'OperatorNode',
        test: isOperatorNode
      }, {
        name: 'ParenthesisNode',
        test: isParenthesisNode
      }, {
        name: 'RangeNode',
        test: isRangeNode
      }, {
        name: 'SymbolNode',
        test: isSymbolNode
      }, {
        name: 'Object',
        test: isObject
      } // order 'Object' last, it matches on other classes too
      ];
      typed.conversions = [{
        from: 'number',
        to: 'BigNumber',
        convert: function convert(x) {
          if (!BigNumber) {
            throwNoBignumber(x);
          } // note: conversion from number to BigNumber can fail if x has >15 digits


          if (digits(x) > 15) {
            throw new TypeError('Cannot implicitly convert a number with >15 significant digits to BigNumber ' + '(value: ' + x + '). ' + 'Use function bignumber(x) to convert to BigNumber.');
          }

          return new BigNumber(x);
        }
      }, {
        from: 'number',
        to: 'Complex',
        convert: function convert(x) {
          if (!Complex) {
            throwNoComplex(x);
          }

          return new Complex(x, 0);
        }
      }, {
        from: 'number',
        to: 'string',
        convert: function convert(x) {
          return x + '';
        }
      }, {
        from: 'BigNumber',
        to: 'Complex',
        convert: function convert(x) {
          if (!Complex) {
            throwNoComplex(x);
          }

          return new Complex(x.toNumber(), 0);
        }
      }, {
        from: 'Fraction',
        to: 'BigNumber',
        convert: function convert(x) {
          throw new TypeError('Cannot implicitly convert a Fraction to BigNumber or vice versa. ' + 'Use function bignumber(x) to convert to BigNumber or fraction(x) to convert to Fraction.');
        }
      }, {
        from: 'Fraction',
        to: 'Complex',
        convert: function convert(x) {
          if (!Complex) {
            throwNoComplex(x);
          }

          return new Complex(x.valueOf(), 0);
        }
      }, {
        from: 'number',
        to: 'Fraction',
        convert: function convert(x) {
          if (!Fraction) {
            throwNoFraction(x);
          }

          var f = new Fraction(x);

          if (f.valueOf() !== x) {
            throw new TypeError('Cannot implicitly convert a number to a Fraction when there will be a loss of precision ' + '(value: ' + x + '). ' + 'Use function fraction(x) to convert to Fraction.');
          }

          return f;
        }
      }, {
        // FIXME: add conversion from Fraction to number, for example for `sqrt(fraction(1,3))`
        //  from: 'Fraction',
        //  to: 'number',
        //  convert: function (x) {
        //    return x.valueOf()
        //  }
        // }, {
        from: 'string',
        to: 'number',
        convert: function convert(x) {
          var n = Number(x);

          if (isNaN(n)) {
            throw new Error('Cannot convert "' + x + '" to a number');
          }

          return n;
        }
      }, {
        from: 'string',
        to: 'BigNumber',
        convert: function convert(x) {
          if (!BigNumber) {
            throwNoBignumber(x);
          }

          try {
            return new BigNumber(x);
          } catch (err) {
            throw new Error('Cannot convert "' + x + '" to BigNumber');
          }
        }
      }, {
        from: 'string',
        to: 'Fraction',
        convert: function convert(x) {
          if (!Fraction) {
            throwNoFraction(x);
          }

          try {
            return new Fraction(x);
          } catch (err) {
            throw new Error('Cannot convert "' + x + '" to Fraction');
          }
        }
      }, {
        from: 'string',
        to: 'Complex',
        convert: function convert(x) {
          if (!Complex) {
            throwNoComplex(x);
          }

          try {
            return new Complex(x);
          } catch (err) {
            throw new Error('Cannot convert "' + x + '" to Complex');
          }
        }
      }, {
        from: 'boolean',
        to: 'number',
        convert: function convert(x) {
          return +x;
        }
      }, {
        from: 'boolean',
        to: 'BigNumber',
        convert: function convert(x) {
          if (!BigNumber) {
            throwNoBignumber(x);
          }

          return new BigNumber(+x);
        }
      }, {
        from: 'boolean',
        to: 'Fraction',
        convert: function convert(x) {
          if (!Fraction) {
            throwNoFraction(x);
          }

          return new Fraction(+x);
        }
      }, {
        from: 'boolean',
        to: 'string',
        convert: function convert(x) {
          return String(x);
        }
      }, {
        from: 'Array',
        to: 'Matrix',
        convert: function convert(array) {
          if (!DenseMatrix) {
            throwNoMatrix();
          }

          return new DenseMatrix(array);
        }
      }, {
        from: 'Matrix',
        to: 'Array',
        convert: function convert(matrix) {
          return matrix.valueOf();
        }
      }];
      return typed;
    });

    function throwNoBignumber(x) {
      throw new Error("Cannot convert value ".concat(x, " into a BigNumber: no class 'BigNumber' provided"));
    }

    function throwNoComplex(x) {
      throw new Error("Cannot convert value ".concat(x, " into a Complex number: no class 'Complex' provided"));
    }

    function throwNoMatrix() {
      throw new Error('Cannot convert array into a Matrix: no class \'DenseMatrix\' provided');
    }

    function throwNoFraction(x) {
      throw new Error("Cannot convert value ".concat(x, " into a Fraction, no class 'Fraction' provided."));
    }

    var decimal = createCommonjsModule(function (module) {
    (function (globalScope) {


      /*
       *  decimal.js v10.2.0
       *  An arbitrary-precision Decimal type for JavaScript.
       *  https://github.com/MikeMcl/decimal.js
       *  Copyright (c) 2019 Michael Mclaughlin <M8ch88l@gmail.com>
       *  MIT Licence
       */


      // -----------------------------------  EDITABLE DEFAULTS  ------------------------------------ //


        // The maximum exponent magnitude.
        // The limit on the value of `toExpNeg`, `toExpPos`, `minE` and `maxE`.
      var EXP_LIMIT = 9e15,                      // 0 to 9e15

        // The limit on the value of `precision`, and on the value of the first argument to
        // `toDecimalPlaces`, `toExponential`, `toFixed`, `toPrecision` and `toSignificantDigits`.
        MAX_DIGITS = 1e9,                        // 0 to 1e9

        // Base conversion alphabet.
        NUMERALS = '0123456789abcdef',

        // The natural logarithm of 10 (1025 digits).
        LN10 = '2.3025850929940456840179914546843642076011014886287729760333279009675726096773524802359972050895982983419677840422862486334095254650828067566662873690987816894829072083255546808437998948262331985283935053089653777326288461633662222876982198867465436674744042432743651550489343149393914796194044002221051017141748003688084012647080685567743216228355220114804663715659121373450747856947683463616792101806445070648000277502684916746550586856935673420670581136429224554405758925724208241314695689016758940256776311356919292033376587141660230105703089634572075440370847469940168269282808481184289314848524948644871927809676271275775397027668605952496716674183485704422507197965004714951050492214776567636938662976979522110718264549734772662425709429322582798502585509785265383207606726317164309505995087807523710333101197857547331541421808427543863591778117054309827482385045648019095610299291824318237525357709750539565187697510374970888692180205189339507238539205144634197265287286965110862571492198849978748873771345686209167058',

        // Pi (1025 digits).
        PI = '3.1415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679821480865132823066470938446095505822317253594081284811174502841027019385211055596446229489549303819644288109756659334461284756482337867831652712019091456485669234603486104543266482133936072602491412737245870066063155881748815209209628292540917153643678925903600113305305488204665213841469519415116094330572703657595919530921861173819326117931051185480744623799627495673518857527248912279381830119491298336733624406566430860213949463952247371907021798609437027705392171762931767523846748184676694051320005681271452635608277857713427577896091736371787214684409012249534301465495853710507922796892589235420199561121290219608640344181598136297747713099605187072113499999983729780499510597317328160963185950244594553469083026425223082533446850352619311881710100031378387528865875332083814206171776691473035982534904287554687311595628638823537875937519577818577805321712268066130019278766111959092164201989380952572010654858632789',


        // The initial configuration properties of the Decimal constructor.
        DEFAULTS = {

          // These values must be integers within the stated ranges (inclusive).
          // Most of these values can be changed at run-time using the `Decimal.config` method.

          // The maximum number of significant digits of the result of a calculation or base conversion.
          // E.g. `Decimal.config({ precision: 20 });`
          precision: 20,                         // 1 to MAX_DIGITS

          // The rounding mode used when rounding to `precision`.
          //
          // ROUND_UP         0 Away from zero.
          // ROUND_DOWN       1 Towards zero.
          // ROUND_CEIL       2 Towards +Infinity.
          // ROUND_FLOOR      3 Towards -Infinity.
          // ROUND_HALF_UP    4 Towards nearest neighbour. If equidistant, up.
          // ROUND_HALF_DOWN  5 Towards nearest neighbour. If equidistant, down.
          // ROUND_HALF_EVEN  6 Towards nearest neighbour. If equidistant, towards even neighbour.
          // ROUND_HALF_CEIL  7 Towards nearest neighbour. If equidistant, towards +Infinity.
          // ROUND_HALF_FLOOR 8 Towards nearest neighbour. If equidistant, towards -Infinity.
          //
          // E.g.
          // `Decimal.rounding = 4;`
          // `Decimal.rounding = Decimal.ROUND_HALF_UP;`
          rounding: 4,                           // 0 to 8

          // The modulo mode used when calculating the modulus: a mod n.
          // The quotient (q = a / n) is calculated according to the corresponding rounding mode.
          // The remainder (r) is calculated as: r = a - n * q.
          //
          // UP         0 The remainder is positive if the dividend is negative, else is negative.
          // DOWN       1 The remainder has the same sign as the dividend (JavaScript %).
          // FLOOR      3 The remainder has the same sign as the divisor (Python %).
          // HALF_EVEN  6 The IEEE 754 remainder function.
          // EUCLID     9 Euclidian division. q = sign(n) * floor(a / abs(n)). Always positive.
          //
          // Truncated division (1), floored division (3), the IEEE 754 remainder (6), and Euclidian
          // division (9) are commonly used for the modulus operation. The other rounding modes can also
          // be used, but they may not give useful results.
          modulo: 1,                             // 0 to 9

          // The exponent value at and beneath which `toString` returns exponential notation.
          // JavaScript numbers: -7
          toExpNeg: -7,                          // 0 to -EXP_LIMIT

          // The exponent value at and above which `toString` returns exponential notation.
          // JavaScript numbers: 21
          toExpPos:  21,                         // 0 to EXP_LIMIT

          // The minimum exponent value, beneath which underflow to zero occurs.
          // JavaScript numbers: -324  (5e-324)
          minE: -EXP_LIMIT,                      // -1 to -EXP_LIMIT

          // The maximum exponent value, above which overflow to Infinity occurs.
          // JavaScript numbers: 308  (1.7976931348623157e+308)
          maxE: EXP_LIMIT,                       // 1 to EXP_LIMIT

          // Whether to use cryptographically-secure random number generation, if available.
          crypto: false                          // true/false
        },


      // ----------------------------------- END OF EDITABLE DEFAULTS ------------------------------- //


        Decimal, inexact, noConflict, quadrant,
        external = true,

        decimalError = '[DecimalError] ',
        invalidArgument = decimalError + 'Invalid argument: ',
        precisionLimitExceeded = decimalError + 'Precision limit exceeded',
        cryptoUnavailable = decimalError + 'crypto unavailable',

        mathfloor = Math.floor,
        mathpow = Math.pow,

        isBinary = /^0b([01]+(\.[01]*)?|\.[01]+)(p[+-]?\d+)?$/i,
        isHex = /^0x([0-9a-f]+(\.[0-9a-f]*)?|\.[0-9a-f]+)(p[+-]?\d+)?$/i,
        isOctal = /^0o([0-7]+(\.[0-7]*)?|\.[0-7]+)(p[+-]?\d+)?$/i,
        isDecimal = /^(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i,

        BASE = 1e7,
        LOG_BASE = 7,
        MAX_SAFE_INTEGER = 9007199254740991,

        LN10_PRECISION = LN10.length - 1,
        PI_PRECISION = PI.length - 1,

        // Decimal.prototype object
        P = { name: '[object Decimal]' };


      // Decimal prototype methods


      /*
       *  absoluteValue             abs
       *  ceil
       *  comparedTo                cmp
       *  cosine                    cos
       *  cubeRoot                  cbrt
       *  decimalPlaces             dp
       *  dividedBy                 div
       *  dividedToIntegerBy        divToInt
       *  equals                    eq
       *  floor
       *  greaterThan               gt
       *  greaterThanOrEqualTo      gte
       *  hyperbolicCosine          cosh
       *  hyperbolicSine            sinh
       *  hyperbolicTangent         tanh
       *  inverseCosine             acos
       *  inverseHyperbolicCosine   acosh
       *  inverseHyperbolicSine     asinh
       *  inverseHyperbolicTangent  atanh
       *  inverseSine               asin
       *  inverseTangent            atan
       *  isFinite
       *  isInteger                 isInt
       *  isNaN
       *  isNegative                isNeg
       *  isPositive                isPos
       *  isZero
       *  lessThan                  lt
       *  lessThanOrEqualTo         lte
       *  logarithm                 log
       *  [maximum]                 [max]
       *  [minimum]                 [min]
       *  minus                     sub
       *  modulo                    mod
       *  naturalExponential        exp
       *  naturalLogarithm          ln
       *  negated                   neg
       *  plus                      add
       *  precision                 sd
       *  round
       *  sine                      sin
       *  squareRoot                sqrt
       *  tangent                   tan
       *  times                     mul
       *  toBinary
       *  toDecimalPlaces           toDP
       *  toExponential
       *  toFixed
       *  toFraction
       *  toHexadecimal             toHex
       *  toNearest
       *  toNumber
       *  toOctal
       *  toPower                   pow
       *  toPrecision
       *  toSignificantDigits       toSD
       *  toString
       *  truncated                 trunc
       *  valueOf                   toJSON
       */


      /*
       * Return a new Decimal whose value is the absolute value of this Decimal.
       *
       */
      P.absoluteValue = P.abs = function () {
        var x = new this.constructor(this);
        if (x.s < 0) x.s = 1;
        return finalise(x);
      };


      /*
       * Return a new Decimal whose value is the value of this Decimal rounded to a whole number in the
       * direction of positive Infinity.
       *
       */
      P.ceil = function () {
        return finalise(new this.constructor(this), this.e + 1, 2);
      };


      /*
       * Return
       *   1    if the value of this Decimal is greater than the value of `y`,
       *  -1    if the value of this Decimal is less than the value of `y`,
       *   0    if they have the same value,
       *   NaN  if the value of either Decimal is NaN.
       *
       */
      P.comparedTo = P.cmp = function (y) {
        var i, j, xdL, ydL,
          x = this,
          xd = x.d,
          yd = (y = new x.constructor(y)).d,
          xs = x.s,
          ys = y.s;

        // Either NaN or ±Infinity?
        if (!xd || !yd) {
          return !xs || !ys ? NaN : xs !== ys ? xs : xd === yd ? 0 : !xd ^ xs < 0 ? 1 : -1;
        }

        // Either zero?
        if (!xd[0] || !yd[0]) return xd[0] ? xs : yd[0] ? -ys : 0;

        // Signs differ?
        if (xs !== ys) return xs;

        // Compare exponents.
        if (x.e !== y.e) return x.e > y.e ^ xs < 0 ? 1 : -1;

        xdL = xd.length;
        ydL = yd.length;

        // Compare digit by digit.
        for (i = 0, j = xdL < ydL ? xdL : ydL; i < j; ++i) {
          if (xd[i] !== yd[i]) return xd[i] > yd[i] ^ xs < 0 ? 1 : -1;
        }

        // Compare lengths.
        return xdL === ydL ? 0 : xdL > ydL ^ xs < 0 ? 1 : -1;
      };


      /*
       * Return a new Decimal whose value is the cosine of the value in radians of this Decimal.
       *
       * Domain: [-Infinity, Infinity]
       * Range: [-1, 1]
       *
       * cos(0)         = 1
       * cos(-0)        = 1
       * cos(Infinity)  = NaN
       * cos(-Infinity) = NaN
       * cos(NaN)       = NaN
       *
       */
      P.cosine = P.cos = function () {
        var pr, rm,
          x = this,
          Ctor = x.constructor;

        if (!x.d) return new Ctor(NaN);

        // cos(0) = cos(-0) = 1
        if (!x.d[0]) return new Ctor(1);

        pr = Ctor.precision;
        rm = Ctor.rounding;
        Ctor.precision = pr + Math.max(x.e, x.sd()) + LOG_BASE;
        Ctor.rounding = 1;

        x = cosine(Ctor, toLessThanHalfPi(Ctor, x));

        Ctor.precision = pr;
        Ctor.rounding = rm;

        return finalise(quadrant == 2 || quadrant == 3 ? x.neg() : x, pr, rm, true);
      };


      /*
       *
       * Return a new Decimal whose value is the cube root of the value of this Decimal, rounded to
       * `precision` significant digits using rounding mode `rounding`.
       *
       *  cbrt(0)  =  0
       *  cbrt(-0) = -0
       *  cbrt(1)  =  1
       *  cbrt(-1) = -1
       *  cbrt(N)  =  N
       *  cbrt(-I) = -I
       *  cbrt(I)  =  I
       *
       * Math.cbrt(x) = (x < 0 ? -Math.pow(-x, 1/3) : Math.pow(x, 1/3))
       *
       */
      P.cubeRoot = P.cbrt = function () {
        var e, m, n, r, rep, s, sd, t, t3, t3plusx,
          x = this,
          Ctor = x.constructor;

        if (!x.isFinite() || x.isZero()) return new Ctor(x);
        external = false;

        // Initial estimate.
        s = x.s * mathpow(x.s * x, 1 / 3);

         // Math.cbrt underflow/overflow?
         // Pass x to Math.pow as integer, then adjust the exponent of the result.
        if (!s || Math.abs(s) == 1 / 0) {
          n = digitsToString(x.d);
          e = x.e;

          // Adjust n exponent so it is a multiple of 3 away from x exponent.
          if (s = (e - n.length + 1) % 3) n += (s == 1 || s == -2 ? '0' : '00');
          s = mathpow(n, 1 / 3);

          // Rarely, e may be one less than the result exponent value.
          e = mathfloor((e + 1) / 3) - (e % 3 == (e < 0 ? -1 : 2));

          if (s == 1 / 0) {
            n = '5e' + e;
          } else {
            n = s.toExponential();
            n = n.slice(0, n.indexOf('e') + 1) + e;
          }

          r = new Ctor(n);
          r.s = x.s;
        } else {
          r = new Ctor(s.toString());
        }

        sd = (e = Ctor.precision) + 3;

        // Halley's method.
        // TODO? Compare Newton's method.
        for (;;) {
          t = r;
          t3 = t.times(t).times(t);
          t3plusx = t3.plus(x);
          r = divide(t3plusx.plus(x).times(t), t3plusx.plus(t3), sd + 2, 1);

          // TODO? Replace with for-loop and checkRoundingDigits.
          if (digitsToString(t.d).slice(0, sd) === (n = digitsToString(r.d)).slice(0, sd)) {
            n = n.slice(sd - 3, sd + 1);

            // The 4th rounding digit may be in error by -1 so if the 4 rounding digits are 9999 or 4999
            // , i.e. approaching a rounding boundary, continue the iteration.
            if (n == '9999' || !rep && n == '4999') {

              // On the first iteration only, check to see if rounding up gives the exact result as the
              // nines may infinitely repeat.
              if (!rep) {
                finalise(t, e + 1, 0);

                if (t.times(t).times(t).eq(x)) {
                  r = t;
                  break;
                }
              }

              sd += 4;
              rep = 1;
            } else {

              // If the rounding digits are null, 0{0,4} or 50{0,3}, check for an exact result.
              // If not, then there are further digits and m will be truthy.
              if (!+n || !+n.slice(1) && n.charAt(0) == '5') {

                // Truncate to the first rounding digit.
                finalise(r, e + 1, 1);
                m = !r.times(r).times(r).eq(x);
              }

              break;
            }
          }
        }

        external = true;

        return finalise(r, e, Ctor.rounding, m);
      };


      /*
       * Return the number of decimal places of the value of this Decimal.
       *
       */
      P.decimalPlaces = P.dp = function () {
        var w,
          d = this.d,
          n = NaN;

        if (d) {
          w = d.length - 1;
          n = (w - mathfloor(this.e / LOG_BASE)) * LOG_BASE;

          // Subtract the number of trailing zeros of the last word.
          w = d[w];
          if (w) for (; w % 10 == 0; w /= 10) n--;
          if (n < 0) n = 0;
        }

        return n;
      };


      /*
       *  n / 0 = I
       *  n / N = N
       *  n / I = 0
       *  0 / n = 0
       *  0 / 0 = N
       *  0 / N = N
       *  0 / I = 0
       *  N / n = N
       *  N / 0 = N
       *  N / N = N
       *  N / I = N
       *  I / n = I
       *  I / 0 = I
       *  I / N = N
       *  I / I = N
       *
       * Return a new Decimal whose value is the value of this Decimal divided by `y`, rounded to
       * `precision` significant digits using rounding mode `rounding`.
       *
       */
      P.dividedBy = P.div = function (y) {
        return divide(this, new this.constructor(y));
      };


      /*
       * Return a new Decimal whose value is the integer part of dividing the value of this Decimal
       * by the value of `y`, rounded to `precision` significant digits using rounding mode `rounding`.
       *
       */
      P.dividedToIntegerBy = P.divToInt = function (y) {
        var x = this,
          Ctor = x.constructor;
        return finalise(divide(x, new Ctor(y), 0, 1, 1), Ctor.precision, Ctor.rounding);
      };


      /*
       * Return true if the value of this Decimal is equal to the value of `y`, otherwise return false.
       *
       */
      P.equals = P.eq = function (y) {
        return this.cmp(y) === 0;
      };


      /*
       * Return a new Decimal whose value is the value of this Decimal rounded to a whole number in the
       * direction of negative Infinity.
       *
       */
      P.floor = function () {
        return finalise(new this.constructor(this), this.e + 1, 3);
      };


      /*
       * Return true if the value of this Decimal is greater than the value of `y`, otherwise return
       * false.
       *
       */
      P.greaterThan = P.gt = function (y) {
        return this.cmp(y) > 0;
      };


      /*
       * Return true if the value of this Decimal is greater than or equal to the value of `y`,
       * otherwise return false.
       *
       */
      P.greaterThanOrEqualTo = P.gte = function (y) {
        var k = this.cmp(y);
        return k == 1 || k === 0;
      };


      /*
       * Return a new Decimal whose value is the hyperbolic cosine of the value in radians of this
       * Decimal.
       *
       * Domain: [-Infinity, Infinity]
       * Range: [1, Infinity]
       *
       * cosh(x) = 1 + x^2/2! + x^4/4! + x^6/6! + ...
       *
       * cosh(0)         = 1
       * cosh(-0)        = 1
       * cosh(Infinity)  = Infinity
       * cosh(-Infinity) = Infinity
       * cosh(NaN)       = NaN
       *
       *  x        time taken (ms)   result
       * 1000      9                 9.8503555700852349694e+433
       * 10000     25                4.4034091128314607936e+4342
       * 100000    171               1.4033316802130615897e+43429
       * 1000000   3817              1.5166076984010437725e+434294
       * 10000000  abandoned after 2 minute wait
       *
       * TODO? Compare performance of cosh(x) = 0.5 * (exp(x) + exp(-x))
       *
       */
      P.hyperbolicCosine = P.cosh = function () {
        var k, n, pr, rm, len,
          x = this,
          Ctor = x.constructor,
          one = new Ctor(1);

        if (!x.isFinite()) return new Ctor(x.s ? 1 / 0 : NaN);
        if (x.isZero()) return one;

        pr = Ctor.precision;
        rm = Ctor.rounding;
        Ctor.precision = pr + Math.max(x.e, x.sd()) + 4;
        Ctor.rounding = 1;
        len = x.d.length;

        // Argument reduction: cos(4x) = 1 - 8cos^2(x) + 8cos^4(x) + 1
        // i.e. cos(x) = 1 - cos^2(x/4)(8 - 8cos^2(x/4))

        // Estimate the optimum number of times to use the argument reduction.
        // TODO? Estimation reused from cosine() and may not be optimal here.
        if (len < 32) {
          k = Math.ceil(len / 3);
          n = (1 / tinyPow(4, k)).toString();
        } else {
          k = 16;
          n = '2.3283064365386962890625e-10';
        }

        x = taylorSeries(Ctor, 1, x.times(n), new Ctor(1), true);

        // Reverse argument reduction
        var cosh2_x,
          i = k,
          d8 = new Ctor(8);
        for (; i--;) {
          cosh2_x = x.times(x);
          x = one.minus(cosh2_x.times(d8.minus(cosh2_x.times(d8))));
        }

        return finalise(x, Ctor.precision = pr, Ctor.rounding = rm, true);
      };


      /*
       * Return a new Decimal whose value is the hyperbolic sine of the value in radians of this
       * Decimal.
       *
       * Domain: [-Infinity, Infinity]
       * Range: [-Infinity, Infinity]
       *
       * sinh(x) = x + x^3/3! + x^5/5! + x^7/7! + ...
       *
       * sinh(0)         = 0
       * sinh(-0)        = -0
       * sinh(Infinity)  = Infinity
       * sinh(-Infinity) = -Infinity
       * sinh(NaN)       = NaN
       *
       * x        time taken (ms)
       * 10       2 ms
       * 100      5 ms
       * 1000     14 ms
       * 10000    82 ms
       * 100000   886 ms            1.4033316802130615897e+43429
       * 200000   2613 ms
       * 300000   5407 ms
       * 400000   8824 ms
       * 500000   13026 ms          8.7080643612718084129e+217146
       * 1000000  48543 ms
       *
       * TODO? Compare performance of sinh(x) = 0.5 * (exp(x) - exp(-x))
       *
       */
      P.hyperbolicSine = P.sinh = function () {
        var k, pr, rm, len,
          x = this,
          Ctor = x.constructor;

        if (!x.isFinite() || x.isZero()) return new Ctor(x);

        pr = Ctor.precision;
        rm = Ctor.rounding;
        Ctor.precision = pr + Math.max(x.e, x.sd()) + 4;
        Ctor.rounding = 1;
        len = x.d.length;

        if (len < 3) {
          x = taylorSeries(Ctor, 2, x, x, true);
        } else {

          // Alternative argument reduction: sinh(3x) = sinh(x)(3 + 4sinh^2(x))
          // i.e. sinh(x) = sinh(x/3)(3 + 4sinh^2(x/3))
          // 3 multiplications and 1 addition

          // Argument reduction: sinh(5x) = sinh(x)(5 + sinh^2(x)(20 + 16sinh^2(x)))
          // i.e. sinh(x) = sinh(x/5)(5 + sinh^2(x/5)(20 + 16sinh^2(x/5)))
          // 4 multiplications and 2 additions

          // Estimate the optimum number of times to use the argument reduction.
          k = 1.4 * Math.sqrt(len);
          k = k > 16 ? 16 : k | 0;

          x = x.times(1 / tinyPow(5, k));
          x = taylorSeries(Ctor, 2, x, x, true);

          // Reverse argument reduction
          var sinh2_x,
            d5 = new Ctor(5),
            d16 = new Ctor(16),
            d20 = new Ctor(20);
          for (; k--;) {
            sinh2_x = x.times(x);
            x = x.times(d5.plus(sinh2_x.times(d16.times(sinh2_x).plus(d20))));
          }
        }

        Ctor.precision = pr;
        Ctor.rounding = rm;

        return finalise(x, pr, rm, true);
      };


      /*
       * Return a new Decimal whose value is the hyperbolic tangent of the value in radians of this
       * Decimal.
       *
       * Domain: [-Infinity, Infinity]
       * Range: [-1, 1]
       *
       * tanh(x) = sinh(x) / cosh(x)
       *
       * tanh(0)         = 0
       * tanh(-0)        = -0
       * tanh(Infinity)  = 1
       * tanh(-Infinity) = -1
       * tanh(NaN)       = NaN
       *
       */
      P.hyperbolicTangent = P.tanh = function () {
        var pr, rm,
          x = this,
          Ctor = x.constructor;

        if (!x.isFinite()) return new Ctor(x.s);
        if (x.isZero()) return new Ctor(x);

        pr = Ctor.precision;
        rm = Ctor.rounding;
        Ctor.precision = pr + 7;
        Ctor.rounding = 1;

        return divide(x.sinh(), x.cosh(), Ctor.precision = pr, Ctor.rounding = rm);
      };


      /*
       * Return a new Decimal whose value is the arccosine (inverse cosine) in radians of the value of
       * this Decimal.
       *
       * Domain: [-1, 1]
       * Range: [0, pi]
       *
       * acos(x) = pi/2 - asin(x)
       *
       * acos(0)       = pi/2
       * acos(-0)      = pi/2
       * acos(1)       = 0
       * acos(-1)      = pi
       * acos(1/2)     = pi/3
       * acos(-1/2)    = 2*pi/3
       * acos(|x| > 1) = NaN
       * acos(NaN)     = NaN
       *
       */
      P.inverseCosine = P.acos = function () {
        var halfPi,
          x = this,
          Ctor = x.constructor,
          k = x.abs().cmp(1),
          pr = Ctor.precision,
          rm = Ctor.rounding;

        if (k !== -1) {
          return k === 0
            // |x| is 1
            ? x.isNeg() ? getPi(Ctor, pr, rm) : new Ctor(0)
            // |x| > 1 or x is NaN
            : new Ctor(NaN);
        }

        if (x.isZero()) return getPi(Ctor, pr + 4, rm).times(0.5);

        // TODO? Special case acos(0.5) = pi/3 and acos(-0.5) = 2*pi/3

        Ctor.precision = pr + 6;
        Ctor.rounding = 1;

        x = x.asin();
        halfPi = getPi(Ctor, pr + 4, rm).times(0.5);

        Ctor.precision = pr;
        Ctor.rounding = rm;

        return halfPi.minus(x);
      };


      /*
       * Return a new Decimal whose value is the inverse of the hyperbolic cosine in radians of the
       * value of this Decimal.
       *
       * Domain: [1, Infinity]
       * Range: [0, Infinity]
       *
       * acosh(x) = ln(x + sqrt(x^2 - 1))
       *
       * acosh(x < 1)     = NaN
       * acosh(NaN)       = NaN
       * acosh(Infinity)  = Infinity
       * acosh(-Infinity) = NaN
       * acosh(0)         = NaN
       * acosh(-0)        = NaN
       * acosh(1)         = 0
       * acosh(-1)        = NaN
       *
       */
      P.inverseHyperbolicCosine = P.acosh = function () {
        var pr, rm,
          x = this,
          Ctor = x.constructor;

        if (x.lte(1)) return new Ctor(x.eq(1) ? 0 : NaN);
        if (!x.isFinite()) return new Ctor(x);

        pr = Ctor.precision;
        rm = Ctor.rounding;
        Ctor.precision = pr + Math.max(Math.abs(x.e), x.sd()) + 4;
        Ctor.rounding = 1;
        external = false;

        x = x.times(x).minus(1).sqrt().plus(x);

        external = true;
        Ctor.precision = pr;
        Ctor.rounding = rm;

        return x.ln();
      };


      /*
       * Return a new Decimal whose value is the inverse of the hyperbolic sine in radians of the value
       * of this Decimal.
       *
       * Domain: [-Infinity, Infinity]
       * Range: [-Infinity, Infinity]
       *
       * asinh(x) = ln(x + sqrt(x^2 + 1))
       *
       * asinh(NaN)       = NaN
       * asinh(Infinity)  = Infinity
       * asinh(-Infinity) = -Infinity
       * asinh(0)         = 0
       * asinh(-0)        = -0
       *
       */
      P.inverseHyperbolicSine = P.asinh = function () {
        var pr, rm,
          x = this,
          Ctor = x.constructor;

        if (!x.isFinite() || x.isZero()) return new Ctor(x);

        pr = Ctor.precision;
        rm = Ctor.rounding;
        Ctor.precision = pr + 2 * Math.max(Math.abs(x.e), x.sd()) + 6;
        Ctor.rounding = 1;
        external = false;

        x = x.times(x).plus(1).sqrt().plus(x);

        external = true;
        Ctor.precision = pr;
        Ctor.rounding = rm;

        return x.ln();
      };


      /*
       * Return a new Decimal whose value is the inverse of the hyperbolic tangent in radians of the
       * value of this Decimal.
       *
       * Domain: [-1, 1]
       * Range: [-Infinity, Infinity]
       *
       * atanh(x) = 0.5 * ln((1 + x) / (1 - x))
       *
       * atanh(|x| > 1)   = NaN
       * atanh(NaN)       = NaN
       * atanh(Infinity)  = NaN
       * atanh(-Infinity) = NaN
       * atanh(0)         = 0
       * atanh(-0)        = -0
       * atanh(1)         = Infinity
       * atanh(-1)        = -Infinity
       *
       */
      P.inverseHyperbolicTangent = P.atanh = function () {
        var pr, rm, wpr, xsd,
          x = this,
          Ctor = x.constructor;

        if (!x.isFinite()) return new Ctor(NaN);
        if (x.e >= 0) return new Ctor(x.abs().eq(1) ? x.s / 0 : x.isZero() ? x : NaN);

        pr = Ctor.precision;
        rm = Ctor.rounding;
        xsd = x.sd();

        if (Math.max(xsd, pr) < 2 * -x.e - 1) return finalise(new Ctor(x), pr, rm, true);

        Ctor.precision = wpr = xsd - x.e;

        x = divide(x.plus(1), new Ctor(1).minus(x), wpr + pr, 1);

        Ctor.precision = pr + 4;
        Ctor.rounding = 1;

        x = x.ln();

        Ctor.precision = pr;
        Ctor.rounding = rm;

        return x.times(0.5);
      };


      /*
       * Return a new Decimal whose value is the arcsine (inverse sine) in radians of the value of this
       * Decimal.
       *
       * Domain: [-Infinity, Infinity]
       * Range: [-pi/2, pi/2]
       *
       * asin(x) = 2*atan(x/(1 + sqrt(1 - x^2)))
       *
       * asin(0)       = 0
       * asin(-0)      = -0
       * asin(1/2)     = pi/6
       * asin(-1/2)    = -pi/6
       * asin(1)       = pi/2
       * asin(-1)      = -pi/2
       * asin(|x| > 1) = NaN
       * asin(NaN)     = NaN
       *
       * TODO? Compare performance of Taylor series.
       *
       */
      P.inverseSine = P.asin = function () {
        var halfPi, k,
          pr, rm,
          x = this,
          Ctor = x.constructor;

        if (x.isZero()) return new Ctor(x);

        k = x.abs().cmp(1);
        pr = Ctor.precision;
        rm = Ctor.rounding;

        if (k !== -1) {

          // |x| is 1
          if (k === 0) {
            halfPi = getPi(Ctor, pr + 4, rm).times(0.5);
            halfPi.s = x.s;
            return halfPi;
          }

          // |x| > 1 or x is NaN
          return new Ctor(NaN);
        }

        // TODO? Special case asin(1/2) = pi/6 and asin(-1/2) = -pi/6

        Ctor.precision = pr + 6;
        Ctor.rounding = 1;

        x = x.div(new Ctor(1).minus(x.times(x)).sqrt().plus(1)).atan();

        Ctor.precision = pr;
        Ctor.rounding = rm;

        return x.times(2);
      };


      /*
       * Return a new Decimal whose value is the arctangent (inverse tangent) in radians of the value
       * of this Decimal.
       *
       * Domain: [-Infinity, Infinity]
       * Range: [-pi/2, pi/2]
       *
       * atan(x) = x - x^3/3 + x^5/5 - x^7/7 + ...
       *
       * atan(0)         = 0
       * atan(-0)        = -0
       * atan(1)         = pi/4
       * atan(-1)        = -pi/4
       * atan(Infinity)  = pi/2
       * atan(-Infinity) = -pi/2
       * atan(NaN)       = NaN
       *
       */
      P.inverseTangent = P.atan = function () {
        var i, j, k, n, px, t, r, wpr, x2,
          x = this,
          Ctor = x.constructor,
          pr = Ctor.precision,
          rm = Ctor.rounding;

        if (!x.isFinite()) {
          if (!x.s) return new Ctor(NaN);
          if (pr + 4 <= PI_PRECISION) {
            r = getPi(Ctor, pr + 4, rm).times(0.5);
            r.s = x.s;
            return r;
          }
        } else if (x.isZero()) {
          return new Ctor(x);
        } else if (x.abs().eq(1) && pr + 4 <= PI_PRECISION) {
          r = getPi(Ctor, pr + 4, rm).times(0.25);
          r.s = x.s;
          return r;
        }

        Ctor.precision = wpr = pr + 10;
        Ctor.rounding = 1;

        // TODO? if (x >= 1 && pr <= PI_PRECISION) atan(x) = halfPi * x.s - atan(1 / x);

        // Argument reduction
        // Ensure |x| < 0.42
        // atan(x) = 2 * atan(x / (1 + sqrt(1 + x^2)))

        k = Math.min(28, wpr / LOG_BASE + 2 | 0);

        for (i = k; i; --i) x = x.div(x.times(x).plus(1).sqrt().plus(1));

        external = false;

        j = Math.ceil(wpr / LOG_BASE);
        n = 1;
        x2 = x.times(x);
        r = new Ctor(x);
        px = x;

        // atan(x) = x - x^3/3 + x^5/5 - x^7/7 + ...
        for (; i !== -1;) {
          px = px.times(x2);
          t = r.minus(px.div(n += 2));

          px = px.times(x2);
          r = t.plus(px.div(n += 2));

          if (r.d[j] !== void 0) for (i = j; r.d[i] === t.d[i] && i--;);
        }

        if (k) r = r.times(2 << (k - 1));

        external = true;

        return finalise(r, Ctor.precision = pr, Ctor.rounding = rm, true);
      };


      /*
       * Return true if the value of this Decimal is a finite number, otherwise return false.
       *
       */
      P.isFinite = function () {
        return !!this.d;
      };


      /*
       * Return true if the value of this Decimal is an integer, otherwise return false.
       *
       */
      P.isInteger = P.isInt = function () {
        return !!this.d && mathfloor(this.e / LOG_BASE) > this.d.length - 2;
      };


      /*
       * Return true if the value of this Decimal is NaN, otherwise return false.
       *
       */
      P.isNaN = function () {
        return !this.s;
      };


      /*
       * Return true if the value of this Decimal is negative, otherwise return false.
       *
       */
      P.isNegative = P.isNeg = function () {
        return this.s < 0;
      };


      /*
       * Return true if the value of this Decimal is positive, otherwise return false.
       *
       */
      P.isPositive = P.isPos = function () {
        return this.s > 0;
      };


      /*
       * Return true if the value of this Decimal is 0 or -0, otherwise return false.
       *
       */
      P.isZero = function () {
        return !!this.d && this.d[0] === 0;
      };


      /*
       * Return true if the value of this Decimal is less than `y`, otherwise return false.
       *
       */
      P.lessThan = P.lt = function (y) {
        return this.cmp(y) < 0;
      };


      /*
       * Return true if the value of this Decimal is less than or equal to `y`, otherwise return false.
       *
       */
      P.lessThanOrEqualTo = P.lte = function (y) {
        return this.cmp(y) < 1;
      };


      /*
       * Return the logarithm of the value of this Decimal to the specified base, rounded to `precision`
       * significant digits using rounding mode `rounding`.
       *
       * If no base is specified, return log[10](arg).
       *
       * log[base](arg) = ln(arg) / ln(base)
       *
       * The result will always be correctly rounded if the base of the log is 10, and 'almost always'
       * otherwise:
       *
       * Depending on the rounding mode, the result may be incorrectly rounded if the first fifteen
       * rounding digits are [49]99999999999999 or [50]00000000000000. In that case, the maximum error
       * between the result and the correctly rounded result will be one ulp (unit in the last place).
       *
       * log[-b](a)       = NaN
       * log[0](a)        = NaN
       * log[1](a)        = NaN
       * log[NaN](a)      = NaN
       * log[Infinity](a) = NaN
       * log[b](0)        = -Infinity
       * log[b](-0)       = -Infinity
       * log[b](-a)       = NaN
       * log[b](1)        = 0
       * log[b](Infinity) = Infinity
       * log[b](NaN)      = NaN
       *
       * [base] {number|string|Decimal} The base of the logarithm.
       *
       */
      P.logarithm = P.log = function (base) {
        var isBase10, d, denominator, k, inf, num, sd, r,
          arg = this,
          Ctor = arg.constructor,
          pr = Ctor.precision,
          rm = Ctor.rounding,
          guard = 5;

        // Default base is 10.
        if (base == null) {
          base = new Ctor(10);
          isBase10 = true;
        } else {
          base = new Ctor(base);
          d = base.d;

          // Return NaN if base is negative, or non-finite, or is 0 or 1.
          if (base.s < 0 || !d || !d[0] || base.eq(1)) return new Ctor(NaN);

          isBase10 = base.eq(10);
        }

        d = arg.d;

        // Is arg negative, non-finite, 0 or 1?
        if (arg.s < 0 || !d || !d[0] || arg.eq(1)) {
          return new Ctor(d && !d[0] ? -1 / 0 : arg.s != 1 ? NaN : d ? 0 : 1 / 0);
        }

        // The result will have a non-terminating decimal expansion if base is 10 and arg is not an
        // integer power of 10.
        if (isBase10) {
          if (d.length > 1) {
            inf = true;
          } else {
            for (k = d[0]; k % 10 === 0;) k /= 10;
            inf = k !== 1;
          }
        }

        external = false;
        sd = pr + guard;
        num = naturalLogarithm(arg, sd);
        denominator = isBase10 ? getLn10(Ctor, sd + 10) : naturalLogarithm(base, sd);

        // The result will have 5 rounding digits.
        r = divide(num, denominator, sd, 1);

        // If at a rounding boundary, i.e. the result's rounding digits are [49]9999 or [50]0000,
        // calculate 10 further digits.
        //
        // If the result is known to have an infinite decimal expansion, repeat this until it is clear
        // that the result is above or below the boundary. Otherwise, if after calculating the 10
        // further digits, the last 14 are nines, round up and assume the result is exact.
        // Also assume the result is exact if the last 14 are zero.
        //
        // Example of a result that will be incorrectly rounded:
        // log[1048576](4503599627370502) = 2.60000000000000009610279511444746...
        // The above result correctly rounded using ROUND_CEIL to 1 decimal place should be 2.7, but it
        // will be given as 2.6 as there are 15 zeros immediately after the requested decimal place, so
        // the exact result would be assumed to be 2.6, which rounded using ROUND_CEIL to 1 decimal
        // place is still 2.6.
        if (checkRoundingDigits(r.d, k = pr, rm)) {

          do {
            sd += 10;
            num = naturalLogarithm(arg, sd);
            denominator = isBase10 ? getLn10(Ctor, sd + 10) : naturalLogarithm(base, sd);
            r = divide(num, denominator, sd, 1);

            if (!inf) {

              // Check for 14 nines from the 2nd rounding digit, as the first may be 4.
              if (+digitsToString(r.d).slice(k + 1, k + 15) + 1 == 1e14) {
                r = finalise(r, pr + 1, 0);
              }

              break;
            }
          } while (checkRoundingDigits(r.d, k += 10, rm));
        }

        external = true;

        return finalise(r, pr, rm);
      };


      /*
       * Return a new Decimal whose value is the maximum of the arguments and the value of this Decimal.
       *
       * arguments {number|string|Decimal}
       *
      P.max = function () {
        Array.prototype.push.call(arguments, this);
        return maxOrMin(this.constructor, arguments, 'lt');
      };
       */


      /*
       * Return a new Decimal whose value is the minimum of the arguments and the value of this Decimal.
       *
       * arguments {number|string|Decimal}
       *
      P.min = function () {
        Array.prototype.push.call(arguments, this);
        return maxOrMin(this.constructor, arguments, 'gt');
      };
       */


      /*
       *  n - 0 = n
       *  n - N = N
       *  n - I = -I
       *  0 - n = -n
       *  0 - 0 = 0
       *  0 - N = N
       *  0 - I = -I
       *  N - n = N
       *  N - 0 = N
       *  N - N = N
       *  N - I = N
       *  I - n = I
       *  I - 0 = I
       *  I - N = N
       *  I - I = N
       *
       * Return a new Decimal whose value is the value of this Decimal minus `y`, rounded to `precision`
       * significant digits using rounding mode `rounding`.
       *
       */
      P.minus = P.sub = function (y) {
        var d, e, i, j, k, len, pr, rm, xd, xe, xLTy, yd,
          x = this,
          Ctor = x.constructor;

        y = new Ctor(y);

        // If either is not finite...
        if (!x.d || !y.d) {

          // Return NaN if either is NaN.
          if (!x.s || !y.s) y = new Ctor(NaN);

          // Return y negated if x is finite and y is ±Infinity.
          else if (x.d) y.s = -y.s;

          // Return x if y is finite and x is ±Infinity.
          // Return x if both are ±Infinity with different signs.
          // Return NaN if both are ±Infinity with the same sign.
          else y = new Ctor(y.d || x.s !== y.s ? x : NaN);

          return y;
        }

        // If signs differ...
        if (x.s != y.s) {
          y.s = -y.s;
          return x.plus(y);
        }

        xd = x.d;
        yd = y.d;
        pr = Ctor.precision;
        rm = Ctor.rounding;

        // If either is zero...
        if (!xd[0] || !yd[0]) {

          // Return y negated if x is zero and y is non-zero.
          if (yd[0]) y.s = -y.s;

          // Return x if y is zero and x is non-zero.
          else if (xd[0]) y = new Ctor(x);

          // Return zero if both are zero.
          // From IEEE 754 (2008) 6.3: 0 - 0 = -0 - -0 = -0 when rounding to -Infinity.
          else return new Ctor(rm === 3 ? -0 : 0);

          return external ? finalise(y, pr, rm) : y;
        }

        // x and y are finite, non-zero numbers with the same sign.

        // Calculate base 1e7 exponents.
        e = mathfloor(y.e / LOG_BASE);
        xe = mathfloor(x.e / LOG_BASE);

        xd = xd.slice();
        k = xe - e;

        // If base 1e7 exponents differ...
        if (k) {
          xLTy = k < 0;

          if (xLTy) {
            d = xd;
            k = -k;
            len = yd.length;
          } else {
            d = yd;
            e = xe;
            len = xd.length;
          }

          // Numbers with massively different exponents would result in a very high number of
          // zeros needing to be prepended, but this can be avoided while still ensuring correct
          // rounding by limiting the number of zeros to `Math.ceil(pr / LOG_BASE) + 2`.
          i = Math.max(Math.ceil(pr / LOG_BASE), len) + 2;

          if (k > i) {
            k = i;
            d.length = 1;
          }

          // Prepend zeros to equalise exponents.
          d.reverse();
          for (i = k; i--;) d.push(0);
          d.reverse();

        // Base 1e7 exponents equal.
        } else {

          // Check digits to determine which is the bigger number.

          i = xd.length;
          len = yd.length;
          xLTy = i < len;
          if (xLTy) len = i;

          for (i = 0; i < len; i++) {
            if (xd[i] != yd[i]) {
              xLTy = xd[i] < yd[i];
              break;
            }
          }

          k = 0;
        }

        if (xLTy) {
          d = xd;
          xd = yd;
          yd = d;
          y.s = -y.s;
        }

        len = xd.length;

        // Append zeros to `xd` if shorter.
        // Don't add zeros to `yd` if shorter as subtraction only needs to start at `yd` length.
        for (i = yd.length - len; i > 0; --i) xd[len++] = 0;

        // Subtract yd from xd.
        for (i = yd.length; i > k;) {

          if (xd[--i] < yd[i]) {
            for (j = i; j && xd[--j] === 0;) xd[j] = BASE - 1;
            --xd[j];
            xd[i] += BASE;
          }

          xd[i] -= yd[i];
        }

        // Remove trailing zeros.
        for (; xd[--len] === 0;) xd.pop();

        // Remove leading zeros and adjust exponent accordingly.
        for (; xd[0] === 0; xd.shift()) --e;

        // Zero?
        if (!xd[0]) return new Ctor(rm === 3 ? -0 : 0);

        y.d = xd;
        y.e = getBase10Exponent(xd, e);

        return external ? finalise(y, pr, rm) : y;
      };


      /*
       *   n % 0 =  N
       *   n % N =  N
       *   n % I =  n
       *   0 % n =  0
       *  -0 % n = -0
       *   0 % 0 =  N
       *   0 % N =  N
       *   0 % I =  0
       *   N % n =  N
       *   N % 0 =  N
       *   N % N =  N
       *   N % I =  N
       *   I % n =  N
       *   I % 0 =  N
       *   I % N =  N
       *   I % I =  N
       *
       * Return a new Decimal whose value is the value of this Decimal modulo `y`, rounded to
       * `precision` significant digits using rounding mode `rounding`.
       *
       * The result depends on the modulo mode.
       *
       */
      P.modulo = P.mod = function (y) {
        var q,
          x = this,
          Ctor = x.constructor;

        y = new Ctor(y);

        // Return NaN if x is ±Infinity or NaN, or y is NaN or ±0.
        if (!x.d || !y.s || y.d && !y.d[0]) return new Ctor(NaN);

        // Return x if y is ±Infinity or x is ±0.
        if (!y.d || x.d && !x.d[0]) {
          return finalise(new Ctor(x), Ctor.precision, Ctor.rounding);
        }

        // Prevent rounding of intermediate calculations.
        external = false;

        if (Ctor.modulo == 9) {

          // Euclidian division: q = sign(y) * floor(x / abs(y))
          // result = x - q * y    where  0 <= result < abs(y)
          q = divide(x, y.abs(), 0, 3, 1);
          q.s *= y.s;
        } else {
          q = divide(x, y, 0, Ctor.modulo, 1);
        }

        q = q.times(y);

        external = true;

        return x.minus(q);
      };


      /*
       * Return a new Decimal whose value is the natural exponential of the value of this Decimal,
       * i.e. the base e raised to the power the value of this Decimal, rounded to `precision`
       * significant digits using rounding mode `rounding`.
       *
       */
      P.naturalExponential = P.exp = function () {
        return naturalExponential(this);
      };


      /*
       * Return a new Decimal whose value is the natural logarithm of the value of this Decimal,
       * rounded to `precision` significant digits using rounding mode `rounding`.
       *
       */
      P.naturalLogarithm = P.ln = function () {
        return naturalLogarithm(this);
      };


      /*
       * Return a new Decimal whose value is the value of this Decimal negated, i.e. as if multiplied by
       * -1.
       *
       */
      P.negated = P.neg = function () {
        var x = new this.constructor(this);
        x.s = -x.s;
        return finalise(x);
      };


      /*
       *  n + 0 = n
       *  n + N = N
       *  n + I = I
       *  0 + n = n
       *  0 + 0 = 0
       *  0 + N = N
       *  0 + I = I
       *  N + n = N
       *  N + 0 = N
       *  N + N = N
       *  N + I = N
       *  I + n = I
       *  I + 0 = I
       *  I + N = N
       *  I + I = I
       *
       * Return a new Decimal whose value is the value of this Decimal plus `y`, rounded to `precision`
       * significant digits using rounding mode `rounding`.
       *
       */
      P.plus = P.add = function (y) {
        var carry, d, e, i, k, len, pr, rm, xd, yd,
          x = this,
          Ctor = x.constructor;

        y = new Ctor(y);

        // If either is not finite...
        if (!x.d || !y.d) {

          // Return NaN if either is NaN.
          if (!x.s || !y.s) y = new Ctor(NaN);

          // Return x if y is finite and x is ±Infinity.
          // Return x if both are ±Infinity with the same sign.
          // Return NaN if both are ±Infinity with different signs.
          // Return y if x is finite and y is ±Infinity.
          else if (!x.d) y = new Ctor(y.d || x.s === y.s ? x : NaN);

          return y;
        }

         // If signs differ...
        if (x.s != y.s) {
          y.s = -y.s;
          return x.minus(y);
        }

        xd = x.d;
        yd = y.d;
        pr = Ctor.precision;
        rm = Ctor.rounding;

        // If either is zero...
        if (!xd[0] || !yd[0]) {

          // Return x if y is zero.
          // Return y if y is non-zero.
          if (!yd[0]) y = new Ctor(x);

          return external ? finalise(y, pr, rm) : y;
        }

        // x and y are finite, non-zero numbers with the same sign.

        // Calculate base 1e7 exponents.
        k = mathfloor(x.e / LOG_BASE);
        e = mathfloor(y.e / LOG_BASE);

        xd = xd.slice();
        i = k - e;

        // If base 1e7 exponents differ...
        if (i) {

          if (i < 0) {
            d = xd;
            i = -i;
            len = yd.length;
          } else {
            d = yd;
            e = k;
            len = xd.length;
          }

          // Limit number of zeros prepended to max(ceil(pr / LOG_BASE), len) + 1.
          k = Math.ceil(pr / LOG_BASE);
          len = k > len ? k + 1 : len + 1;

          if (i > len) {
            i = len;
            d.length = 1;
          }

          // Prepend zeros to equalise exponents. Note: Faster to use reverse then do unshifts.
          d.reverse();
          for (; i--;) d.push(0);
          d.reverse();
        }

        len = xd.length;
        i = yd.length;

        // If yd is longer than xd, swap xd and yd so xd points to the longer array.
        if (len - i < 0) {
          i = len;
          d = yd;
          yd = xd;
          xd = d;
        }

        // Only start adding at yd.length - 1 as the further digits of xd can be left as they are.
        for (carry = 0; i;) {
          carry = (xd[--i] = xd[i] + yd[i] + carry) / BASE | 0;
          xd[i] %= BASE;
        }

        if (carry) {
          xd.unshift(carry);
          ++e;
        }

        // Remove trailing zeros.
        // No need to check for zero, as +x + +y != 0 && -x + -y != 0
        for (len = xd.length; xd[--len] == 0;) xd.pop();

        y.d = xd;
        y.e = getBase10Exponent(xd, e);

        return external ? finalise(y, pr, rm) : y;
      };


      /*
       * Return the number of significant digits of the value of this Decimal.
       *
       * [z] {boolean|number} Whether to count integer-part trailing zeros: true, false, 1 or 0.
       *
       */
      P.precision = P.sd = function (z) {
        var k,
          x = this;

        if (z !== void 0 && z !== !!z && z !== 1 && z !== 0) throw Error(invalidArgument + z);

        if (x.d) {
          k = getPrecision(x.d);
          if (z && x.e + 1 > k) k = x.e + 1;
        } else {
          k = NaN;
        }

        return k;
      };


      /*
       * Return a new Decimal whose value is the value of this Decimal rounded to a whole number using
       * rounding mode `rounding`.
       *
       */
      P.round = function () {
        var x = this,
          Ctor = x.constructor;

        return finalise(new Ctor(x), x.e + 1, Ctor.rounding);
      };


      /*
       * Return a new Decimal whose value is the sine of the value in radians of this Decimal.
       *
       * Domain: [-Infinity, Infinity]
       * Range: [-1, 1]
       *
       * sin(x) = x - x^3/3! + x^5/5! - ...
       *
       * sin(0)         = 0
       * sin(-0)        = -0
       * sin(Infinity)  = NaN
       * sin(-Infinity) = NaN
       * sin(NaN)       = NaN
       *
       */
      P.sine = P.sin = function () {
        var pr, rm,
          x = this,
          Ctor = x.constructor;

        if (!x.isFinite()) return new Ctor(NaN);
        if (x.isZero()) return new Ctor(x);

        pr = Ctor.precision;
        rm = Ctor.rounding;
        Ctor.precision = pr + Math.max(x.e, x.sd()) + LOG_BASE;
        Ctor.rounding = 1;

        x = sine(Ctor, toLessThanHalfPi(Ctor, x));

        Ctor.precision = pr;
        Ctor.rounding = rm;

        return finalise(quadrant > 2 ? x.neg() : x, pr, rm, true);
      };


      /*
       * Return a new Decimal whose value is the square root of this Decimal, rounded to `precision`
       * significant digits using rounding mode `rounding`.
       *
       *  sqrt(-n) =  N
       *  sqrt(N)  =  N
       *  sqrt(-I) =  N
       *  sqrt(I)  =  I
       *  sqrt(0)  =  0
       *  sqrt(-0) = -0
       *
       */
      P.squareRoot = P.sqrt = function () {
        var m, n, sd, r, rep, t,
          x = this,
          d = x.d,
          e = x.e,
          s = x.s,
          Ctor = x.constructor;

        // Negative/NaN/Infinity/zero?
        if (s !== 1 || !d || !d[0]) {
          return new Ctor(!s || s < 0 && (!d || d[0]) ? NaN : d ? x : 1 / 0);
        }

        external = false;

        // Initial estimate.
        s = Math.sqrt(+x);

        // Math.sqrt underflow/overflow?
        // Pass x to Math.sqrt as integer, then adjust the exponent of the result.
        if (s == 0 || s == 1 / 0) {
          n = digitsToString(d);

          if ((n.length + e) % 2 == 0) n += '0';
          s = Math.sqrt(n);
          e = mathfloor((e + 1) / 2) - (e < 0 || e % 2);

          if (s == 1 / 0) {
            n = '1e' + e;
          } else {
            n = s.toExponential();
            n = n.slice(0, n.indexOf('e') + 1) + e;
          }

          r = new Ctor(n);
        } else {
          r = new Ctor(s.toString());
        }

        sd = (e = Ctor.precision) + 3;

        // Newton-Raphson iteration.
        for (;;) {
          t = r;
          r = t.plus(divide(x, t, sd + 2, 1)).times(0.5);

          // TODO? Replace with for-loop and checkRoundingDigits.
          if (digitsToString(t.d).slice(0, sd) === (n = digitsToString(r.d)).slice(0, sd)) {
            n = n.slice(sd - 3, sd + 1);

            // The 4th rounding digit may be in error by -1 so if the 4 rounding digits are 9999 or
            // 4999, i.e. approaching a rounding boundary, continue the iteration.
            if (n == '9999' || !rep && n == '4999') {

              // On the first iteration only, check to see if rounding up gives the exact result as the
              // nines may infinitely repeat.
              if (!rep) {
                finalise(t, e + 1, 0);

                if (t.times(t).eq(x)) {
                  r = t;
                  break;
                }
              }

              sd += 4;
              rep = 1;
            } else {

              // If the rounding digits are null, 0{0,4} or 50{0,3}, check for an exact result.
              // If not, then there are further digits and m will be truthy.
              if (!+n || !+n.slice(1) && n.charAt(0) == '5') {

                // Truncate to the first rounding digit.
                finalise(r, e + 1, 1);
                m = !r.times(r).eq(x);
              }

              break;
            }
          }
        }

        external = true;

        return finalise(r, e, Ctor.rounding, m);
      };


      /*
       * Return a new Decimal whose value is the tangent of the value in radians of this Decimal.
       *
       * Domain: [-Infinity, Infinity]
       * Range: [-Infinity, Infinity]
       *
       * tan(0)         = 0
       * tan(-0)        = -0
       * tan(Infinity)  = NaN
       * tan(-Infinity) = NaN
       * tan(NaN)       = NaN
       *
       */
      P.tangent = P.tan = function () {
        var pr, rm,
          x = this,
          Ctor = x.constructor;

        if (!x.isFinite()) return new Ctor(NaN);
        if (x.isZero()) return new Ctor(x);

        pr = Ctor.precision;
        rm = Ctor.rounding;
        Ctor.precision = pr + 10;
        Ctor.rounding = 1;

        x = x.sin();
        x.s = 1;
        x = divide(x, new Ctor(1).minus(x.times(x)).sqrt(), pr + 10, 0);

        Ctor.precision = pr;
        Ctor.rounding = rm;

        return finalise(quadrant == 2 || quadrant == 4 ? x.neg() : x, pr, rm, true);
      };


      /*
       *  n * 0 = 0
       *  n * N = N
       *  n * I = I
       *  0 * n = 0
       *  0 * 0 = 0
       *  0 * N = N
       *  0 * I = N
       *  N * n = N
       *  N * 0 = N
       *  N * N = N
       *  N * I = N
       *  I * n = I
       *  I * 0 = N
       *  I * N = N
       *  I * I = I
       *
       * Return a new Decimal whose value is this Decimal times `y`, rounded to `precision` significant
       * digits using rounding mode `rounding`.
       *
       */
      P.times = P.mul = function (y) {
        var carry, e, i, k, r, rL, t, xdL, ydL,
          x = this,
          Ctor = x.constructor,
          xd = x.d,
          yd = (y = new Ctor(y)).d;

        y.s *= x.s;

         // If either is NaN, ±Infinity or ±0...
        if (!xd || !xd[0] || !yd || !yd[0]) {

          return new Ctor(!y.s || xd && !xd[0] && !yd || yd && !yd[0] && !xd

            // Return NaN if either is NaN.
            // Return NaN if x is ±0 and y is ±Infinity, or y is ±0 and x is ±Infinity.
            ? NaN

            // Return ±Infinity if either is ±Infinity.
            // Return ±0 if either is ±0.
            : !xd || !yd ? y.s / 0 : y.s * 0);
        }

        e = mathfloor(x.e / LOG_BASE) + mathfloor(y.e / LOG_BASE);
        xdL = xd.length;
        ydL = yd.length;

        // Ensure xd points to the longer array.
        if (xdL < ydL) {
          r = xd;
          xd = yd;
          yd = r;
          rL = xdL;
          xdL = ydL;
          ydL = rL;
        }

        // Initialise the result array with zeros.
        r = [];
        rL = xdL + ydL;
        for (i = rL; i--;) r.push(0);

        // Multiply!
        for (i = ydL; --i >= 0;) {
          carry = 0;
          for (k = xdL + i; k > i;) {
            t = r[k] + yd[i] * xd[k - i - 1] + carry;
            r[k--] = t % BASE | 0;
            carry = t / BASE | 0;
          }

          r[k] = (r[k] + carry) % BASE | 0;
        }

        // Remove trailing zeros.
        for (; !r[--rL];) r.pop();

        if (carry) ++e;
        else r.shift();

        y.d = r;
        y.e = getBase10Exponent(r, e);

        return external ? finalise(y, Ctor.precision, Ctor.rounding) : y;
      };


      /*
       * Return a string representing the value of this Decimal in base 2, round to `sd` significant
       * digits using rounding mode `rm`.
       *
       * If the optional `sd` argument is present then return binary exponential notation.
       *
       * [sd] {number} Significant digits. Integer, 1 to MAX_DIGITS inclusive.
       * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
       *
       */
      P.toBinary = function (sd, rm) {
        return toStringBinary(this, 2, sd, rm);
      };


      /*
       * Return a new Decimal whose value is the value of this Decimal rounded to a maximum of `dp`
       * decimal places using rounding mode `rm` or `rounding` if `rm` is omitted.
       *
       * If `dp` is omitted, return a new Decimal whose value is the value of this Decimal.
       *
       * [dp] {number} Decimal places. Integer, 0 to MAX_DIGITS inclusive.
       * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
       *
       */
      P.toDecimalPlaces = P.toDP = function (dp, rm) {
        var x = this,
          Ctor = x.constructor;

        x = new Ctor(x);
        if (dp === void 0) return x;

        checkInt32(dp, 0, MAX_DIGITS);

        if (rm === void 0) rm = Ctor.rounding;
        else checkInt32(rm, 0, 8);

        return finalise(x, dp + x.e + 1, rm);
      };


      /*
       * Return a string representing the value of this Decimal in exponential notation rounded to
       * `dp` fixed decimal places using rounding mode `rounding`.
       *
       * [dp] {number} Decimal places. Integer, 0 to MAX_DIGITS inclusive.
       * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
       *
       */
      P.toExponential = function (dp, rm) {
        var str,
          x = this,
          Ctor = x.constructor;

        if (dp === void 0) {
          str = finiteToString(x, true);
        } else {
          checkInt32(dp, 0, MAX_DIGITS);

          if (rm === void 0) rm = Ctor.rounding;
          else checkInt32(rm, 0, 8);

          x = finalise(new Ctor(x), dp + 1, rm);
          str = finiteToString(x, true, dp + 1);
        }

        return x.isNeg() && !x.isZero() ? '-' + str : str;
      };


      /*
       * Return a string representing the value of this Decimal in normal (fixed-point) notation to
       * `dp` fixed decimal places and rounded using rounding mode `rm` or `rounding` if `rm` is
       * omitted.
       *
       * As with JavaScript numbers, (-0).toFixed(0) is '0', but e.g. (-0.00001).toFixed(0) is '-0'.
       *
       * [dp] {number} Decimal places. Integer, 0 to MAX_DIGITS inclusive.
       * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
       *
       * (-0).toFixed(0) is '0', but (-0.1).toFixed(0) is '-0'.
       * (-0).toFixed(1) is '0.0', but (-0.01).toFixed(1) is '-0.0'.
       * (-0).toFixed(3) is '0.000'.
       * (-0.5).toFixed(0) is '-0'.
       *
       */
      P.toFixed = function (dp, rm) {
        var str, y,
          x = this,
          Ctor = x.constructor;

        if (dp === void 0) {
          str = finiteToString(x);
        } else {
          checkInt32(dp, 0, MAX_DIGITS);

          if (rm === void 0) rm = Ctor.rounding;
          else checkInt32(rm, 0, 8);

          y = finalise(new Ctor(x), dp + x.e + 1, rm);
          str = finiteToString(y, false, dp + y.e + 1);
        }

        // To determine whether to add the minus sign look at the value before it was rounded,
        // i.e. look at `x` rather than `y`.
        return x.isNeg() && !x.isZero() ? '-' + str : str;
      };


      /*
       * Return an array representing the value of this Decimal as a simple fraction with an integer
       * numerator and an integer denominator.
       *
       * The denominator will be a positive non-zero value less than or equal to the specified maximum
       * denominator. If a maximum denominator is not specified, the denominator will be the lowest
       * value necessary to represent the number exactly.
       *
       * [maxD] {number|string|Decimal} Maximum denominator. Integer >= 1 and < Infinity.
       *
       */
      P.toFraction = function (maxD) {
        var d, d0, d1, d2, e, k, n, n0, n1, pr, q, r,
          x = this,
          xd = x.d,
          Ctor = x.constructor;

        if (!xd) return new Ctor(x);

        n1 = d0 = new Ctor(1);
        d1 = n0 = new Ctor(0);

        d = new Ctor(d1);
        e = d.e = getPrecision(xd) - x.e - 1;
        k = e % LOG_BASE;
        d.d[0] = mathpow(10, k < 0 ? LOG_BASE + k : k);

        if (maxD == null) {

          // d is 10**e, the minimum max-denominator needed.
          maxD = e > 0 ? d : n1;
        } else {
          n = new Ctor(maxD);
          if (!n.isInt() || n.lt(n1)) throw Error(invalidArgument + n);
          maxD = n.gt(d) ? (e > 0 ? d : n1) : n;
        }

        external = false;
        n = new Ctor(digitsToString(xd));
        pr = Ctor.precision;
        Ctor.precision = e = xd.length * LOG_BASE * 2;

        for (;;)  {
          q = divide(n, d, 0, 1, 1);
          d2 = d0.plus(q.times(d1));
          if (d2.cmp(maxD) == 1) break;
          d0 = d1;
          d1 = d2;
          d2 = n1;
          n1 = n0.plus(q.times(d2));
          n0 = d2;
          d2 = d;
          d = n.minus(q.times(d2));
          n = d2;
        }

        d2 = divide(maxD.minus(d0), d1, 0, 1, 1);
        n0 = n0.plus(d2.times(n1));
        d0 = d0.plus(d2.times(d1));
        n0.s = n1.s = x.s;

        // Determine which fraction is closer to x, n0/d0 or n1/d1?
        r = divide(n1, d1, e, 1).minus(x).abs().cmp(divide(n0, d0, e, 1).minus(x).abs()) < 1
            ? [n1, d1] : [n0, d0];

        Ctor.precision = pr;
        external = true;

        return r;
      };


      /*
       * Return a string representing the value of this Decimal in base 16, round to `sd` significant
       * digits using rounding mode `rm`.
       *
       * If the optional `sd` argument is present then return binary exponential notation.
       *
       * [sd] {number} Significant digits. Integer, 1 to MAX_DIGITS inclusive.
       * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
       *
       */
      P.toHexadecimal = P.toHex = function (sd, rm) {
        return toStringBinary(this, 16, sd, rm);
      };


      /*
       * Returns a new Decimal whose value is the nearest multiple of `y` in the direction of rounding
       * mode `rm`, or `Decimal.rounding` if `rm` is omitted, to the value of this Decimal.
       *
       * The return value will always have the same sign as this Decimal, unless either this Decimal
       * or `y` is NaN, in which case the return value will be also be NaN.
       *
       * The return value is not affected by the value of `precision`.
       *
       * y {number|string|Decimal} The magnitude to round to a multiple of.
       * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
       *
       * 'toNearest() rounding mode not an integer: {rm}'
       * 'toNearest() rounding mode out of range: {rm}'
       *
       */
      P.toNearest = function (y, rm) {
        var x = this,
          Ctor = x.constructor;

        x = new Ctor(x);

        if (y == null) {

          // If x is not finite, return x.
          if (!x.d) return x;

          y = new Ctor(1);
          rm = Ctor.rounding;
        } else {
          y = new Ctor(y);
          if (rm === void 0) {
            rm = Ctor.rounding;
          } else {
            checkInt32(rm, 0, 8);
          }

          // If x is not finite, return x if y is not NaN, else NaN.
          if (!x.d) return y.s ? x : y;

          // If y is not finite, return Infinity with the sign of x if y is Infinity, else NaN.
          if (!y.d) {
            if (y.s) y.s = x.s;
            return y;
          }
        }

        // If y is not zero, calculate the nearest multiple of y to x.
        if (y.d[0]) {
          external = false;
          x = divide(x, y, 0, rm, 1).times(y);
          external = true;
          finalise(x);

        // If y is zero, return zero with the sign of x.
        } else {
          y.s = x.s;
          x = y;
        }

        return x;
      };


      /*
       * Return the value of this Decimal converted to a number primitive.
       * Zero keeps its sign.
       *
       */
      P.toNumber = function () {
        return +this;
      };


      /*
       * Return a string representing the value of this Decimal in base 8, round to `sd` significant
       * digits using rounding mode `rm`.
       *
       * If the optional `sd` argument is present then return binary exponential notation.
       *
       * [sd] {number} Significant digits. Integer, 1 to MAX_DIGITS inclusive.
       * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
       *
       */
      P.toOctal = function (sd, rm) {
        return toStringBinary(this, 8, sd, rm);
      };


      /*
       * Return a new Decimal whose value is the value of this Decimal raised to the power `y`, rounded
       * to `precision` significant digits using rounding mode `rounding`.
       *
       * ECMAScript compliant.
       *
       *   pow(x, NaN)                           = NaN
       *   pow(x, ±0)                            = 1

       *   pow(NaN, non-zero)                    = NaN
       *   pow(abs(x) > 1, +Infinity)            = +Infinity
       *   pow(abs(x) > 1, -Infinity)            = +0
       *   pow(abs(x) == 1, ±Infinity)           = NaN
       *   pow(abs(x) < 1, +Infinity)            = +0
       *   pow(abs(x) < 1, -Infinity)            = +Infinity
       *   pow(+Infinity, y > 0)                 = +Infinity
       *   pow(+Infinity, y < 0)                 = +0
       *   pow(-Infinity, odd integer > 0)       = -Infinity
       *   pow(-Infinity, even integer > 0)      = +Infinity
       *   pow(-Infinity, odd integer < 0)       = -0
       *   pow(-Infinity, even integer < 0)      = +0
       *   pow(+0, y > 0)                        = +0
       *   pow(+0, y < 0)                        = +Infinity
       *   pow(-0, odd integer > 0)              = -0
       *   pow(-0, even integer > 0)             = +0
       *   pow(-0, odd integer < 0)              = -Infinity
       *   pow(-0, even integer < 0)             = +Infinity
       *   pow(finite x < 0, finite non-integer) = NaN
       *
       * For non-integer or very large exponents pow(x, y) is calculated using
       *
       *   x^y = exp(y*ln(x))
       *
       * Assuming the first 15 rounding digits are each equally likely to be any digit 0-9, the
       * probability of an incorrectly rounded result
       * P([49]9{14} | [50]0{14}) = 2 * 0.2 * 10^-14 = 4e-15 = 1/2.5e+14
       * i.e. 1 in 250,000,000,000,000
       *
       * If a result is incorrectly rounded the maximum error will be 1 ulp (unit in last place).
       *
       * y {number|string|Decimal} The power to which to raise this Decimal.
       *
       */
      P.toPower = P.pow = function (y) {
        var e, k, pr, r, rm, s,
          x = this,
          Ctor = x.constructor,
          yn = +(y = new Ctor(y));

        // Either ±Infinity, NaN or ±0?
        if (!x.d || !y.d || !x.d[0] || !y.d[0]) return new Ctor(mathpow(+x, yn));

        x = new Ctor(x);

        if (x.eq(1)) return x;

        pr = Ctor.precision;
        rm = Ctor.rounding;

        if (y.eq(1)) return finalise(x, pr, rm);

        // y exponent
        e = mathfloor(y.e / LOG_BASE);

        // If y is a small integer use the 'exponentiation by squaring' algorithm.
        if (e >= y.d.length - 1 && (k = yn < 0 ? -yn : yn) <= MAX_SAFE_INTEGER) {
          r = intPow(Ctor, x, k, pr);
          return y.s < 0 ? new Ctor(1).div(r) : finalise(r, pr, rm);
        }

        s = x.s;

        // if x is negative
        if (s < 0) {

          // if y is not an integer
          if (e < y.d.length - 1) return new Ctor(NaN);

          // Result is positive if x is negative and the last digit of integer y is even.
          if ((y.d[e] & 1) == 0) s = 1;

          // if x.eq(-1)
          if (x.e == 0 && x.d[0] == 1 && x.d.length == 1) {
            x.s = s;
            return x;
          }
        }

        // Estimate result exponent.
        // x^y = 10^e,  where e = y * log10(x)
        // log10(x) = log10(x_significand) + x_exponent
        // log10(x_significand) = ln(x_significand) / ln(10)
        k = mathpow(+x, yn);
        e = k == 0 || !isFinite(k)
          ? mathfloor(yn * (Math.log('0.' + digitsToString(x.d)) / Math.LN10 + x.e + 1))
          : new Ctor(k + '').e;

        // Exponent estimate may be incorrect e.g. x: 0.999999999999999999, y: 2.29, e: 0, r.e: -1.

        // Overflow/underflow?
        if (e > Ctor.maxE + 1 || e < Ctor.minE - 1) return new Ctor(e > 0 ? s / 0 : 0);

        external = false;
        Ctor.rounding = x.s = 1;

        // Estimate the extra guard digits needed to ensure five correct rounding digits from
        // naturalLogarithm(x). Example of failure without these extra digits (precision: 10):
        // new Decimal(2.32456).pow('2087987436534566.46411')
        // should be 1.162377823e+764914905173815, but is 1.162355823e+764914905173815
        k = Math.min(12, (e + '').length);

        // r = x^y = exp(y*ln(x))
        r = naturalExponential(y.times(naturalLogarithm(x, pr + k)), pr);

        // r may be Infinity, e.g. (0.9999999999999999).pow(-1e+40)
        if (r.d) {

          // Truncate to the required precision plus five rounding digits.
          r = finalise(r, pr + 5, 1);

          // If the rounding digits are [49]9999 or [50]0000 increase the precision by 10 and recalculate
          // the result.
          if (checkRoundingDigits(r.d, pr, rm)) {
            e = pr + 10;

            // Truncate to the increased precision plus five rounding digits.
            r = finalise(naturalExponential(y.times(naturalLogarithm(x, e + k)), e), e + 5, 1);

            // Check for 14 nines from the 2nd rounding digit (the first rounding digit may be 4 or 9).
            if (+digitsToString(r.d).slice(pr + 1, pr + 15) + 1 == 1e14) {
              r = finalise(r, pr + 1, 0);
            }
          }
        }

        r.s = s;
        external = true;
        Ctor.rounding = rm;

        return finalise(r, pr, rm);
      };


      /*
       * Return a string representing the value of this Decimal rounded to `sd` significant digits
       * using rounding mode `rounding`.
       *
       * Return exponential notation if `sd` is less than the number of digits necessary to represent
       * the integer part of the value in normal notation.
       *
       * [sd] {number} Significant digits. Integer, 1 to MAX_DIGITS inclusive.
       * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
       *
       */
      P.toPrecision = function (sd, rm) {
        var str,
          x = this,
          Ctor = x.constructor;

        if (sd === void 0) {
          str = finiteToString(x, x.e <= Ctor.toExpNeg || x.e >= Ctor.toExpPos);
        } else {
          checkInt32(sd, 1, MAX_DIGITS);

          if (rm === void 0) rm = Ctor.rounding;
          else checkInt32(rm, 0, 8);

          x = finalise(new Ctor(x), sd, rm);
          str = finiteToString(x, sd <= x.e || x.e <= Ctor.toExpNeg, sd);
        }

        return x.isNeg() && !x.isZero() ? '-' + str : str;
      };


      /*
       * Return a new Decimal whose value is the value of this Decimal rounded to a maximum of `sd`
       * significant digits using rounding mode `rm`, or to `precision` and `rounding` respectively if
       * omitted.
       *
       * [sd] {number} Significant digits. Integer, 1 to MAX_DIGITS inclusive.
       * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
       *
       * 'toSD() digits out of range: {sd}'
       * 'toSD() digits not an integer: {sd}'
       * 'toSD() rounding mode not an integer: {rm}'
       * 'toSD() rounding mode out of range: {rm}'
       *
       */
      P.toSignificantDigits = P.toSD = function (sd, rm) {
        var x = this,
          Ctor = x.constructor;

        if (sd === void 0) {
          sd = Ctor.precision;
          rm = Ctor.rounding;
        } else {
          checkInt32(sd, 1, MAX_DIGITS);

          if (rm === void 0) rm = Ctor.rounding;
          else checkInt32(rm, 0, 8);
        }

        return finalise(new Ctor(x), sd, rm);
      };


      /*
       * Return a string representing the value of this Decimal.
       *
       * Return exponential notation if this Decimal has a positive exponent equal to or greater than
       * `toExpPos`, or a negative exponent equal to or less than `toExpNeg`.
       *
       */
      P.toString = function () {
        var x = this,
          Ctor = x.constructor,
          str = finiteToString(x, x.e <= Ctor.toExpNeg || x.e >= Ctor.toExpPos);

        return x.isNeg() && !x.isZero() ? '-' + str : str;
      };


      /*
       * Return a new Decimal whose value is the value of this Decimal truncated to a whole number.
       *
       */
      P.truncated = P.trunc = function () {
        return finalise(new this.constructor(this), this.e + 1, 1);
      };


      /*
       * Return a string representing the value of this Decimal.
       * Unlike `toString`, negative zero will include the minus sign.
       *
       */
      P.valueOf = P.toJSON = function () {
        var x = this,
          Ctor = x.constructor,
          str = finiteToString(x, x.e <= Ctor.toExpNeg || x.e >= Ctor.toExpPos);

        return x.isNeg() ? '-' + str : str;
      };


      /*
      // Add aliases to match BigDecimal method names.
      // P.add = P.plus;
      P.subtract = P.minus;
      P.multiply = P.times;
      P.divide = P.div;
      P.remainder = P.mod;
      P.compareTo = P.cmp;
      P.negate = P.neg;
       */


      // Helper functions for Decimal.prototype (P) and/or Decimal methods, and their callers.


      /*
       *  digitsToString           P.cubeRoot, P.logarithm, P.squareRoot, P.toFraction, P.toPower,
       *                           finiteToString, naturalExponential, naturalLogarithm
       *  checkInt32               P.toDecimalPlaces, P.toExponential, P.toFixed, P.toNearest,
       *                           P.toPrecision, P.toSignificantDigits, toStringBinary, random
       *  checkRoundingDigits      P.logarithm, P.toPower, naturalExponential, naturalLogarithm
       *  convertBase              toStringBinary, parseOther
       *  cos                      P.cos
       *  divide                   P.atanh, P.cubeRoot, P.dividedBy, P.dividedToIntegerBy,
       *                           P.logarithm, P.modulo, P.squareRoot, P.tan, P.tanh, P.toFraction,
       *                           P.toNearest, toStringBinary, naturalExponential, naturalLogarithm,
       *                           taylorSeries, atan2, parseOther
       *  finalise                 P.absoluteValue, P.atan, P.atanh, P.ceil, P.cos, P.cosh,
       *                           P.cubeRoot, P.dividedToIntegerBy, P.floor, P.logarithm, P.minus,
       *                           P.modulo, P.negated, P.plus, P.round, P.sin, P.sinh, P.squareRoot,
       *                           P.tan, P.times, P.toDecimalPlaces, P.toExponential, P.toFixed,
       *                           P.toNearest, P.toPower, P.toPrecision, P.toSignificantDigits,
       *                           P.truncated, divide, getLn10, getPi, naturalExponential,
       *                           naturalLogarithm, ceil, floor, round, trunc
       *  finiteToString           P.toExponential, P.toFixed, P.toPrecision, P.toString, P.valueOf,
       *                           toStringBinary
       *  getBase10Exponent        P.minus, P.plus, P.times, parseOther
       *  getLn10                  P.logarithm, naturalLogarithm
       *  getPi                    P.acos, P.asin, P.atan, toLessThanHalfPi, atan2
       *  getPrecision             P.precision, P.toFraction
       *  getZeroString            digitsToString, finiteToString
       *  intPow                   P.toPower, parseOther
       *  isOdd                    toLessThanHalfPi
       *  maxOrMin                 max, min
       *  naturalExponential       P.naturalExponential, P.toPower
       *  naturalLogarithm         P.acosh, P.asinh, P.atanh, P.logarithm, P.naturalLogarithm,
       *                           P.toPower, naturalExponential
       *  nonFiniteToString        finiteToString, toStringBinary
       *  parseDecimal             Decimal
       *  parseOther               Decimal
       *  sin                      P.sin
       *  taylorSeries             P.cosh, P.sinh, cos, sin
       *  toLessThanHalfPi         P.cos, P.sin
       *  toStringBinary           P.toBinary, P.toHexadecimal, P.toOctal
       *  truncate                 intPow
       *
       *  Throws:                  P.logarithm, P.precision, P.toFraction, checkInt32, getLn10, getPi,
       *                           naturalLogarithm, config, parseOther, random, Decimal
       */


      function digitsToString(d) {
        var i, k, ws,
          indexOfLastWord = d.length - 1,
          str = '',
          w = d[0];

        if (indexOfLastWord > 0) {
          str += w;
          for (i = 1; i < indexOfLastWord; i++) {
            ws = d[i] + '';
            k = LOG_BASE - ws.length;
            if (k) str += getZeroString(k);
            str += ws;
          }

          w = d[i];
          ws = w + '';
          k = LOG_BASE - ws.length;
          if (k) str += getZeroString(k);
        } else if (w === 0) {
          return '0';
        }

        // Remove trailing zeros of last w.
        for (; w % 10 === 0;) w /= 10;

        return str + w;
      }


      function checkInt32(i, min, max) {
        if (i !== ~~i || i < min || i > max) {
          throw Error(invalidArgument + i);
        }
      }


      /*
       * Check 5 rounding digits if `repeating` is null, 4 otherwise.
       * `repeating == null` if caller is `log` or `pow`,
       * `repeating != null` if caller is `naturalLogarithm` or `naturalExponential`.
       */
      function checkRoundingDigits(d, i, rm, repeating) {
        var di, k, r, rd;

        // Get the length of the first word of the array d.
        for (k = d[0]; k >= 10; k /= 10) --i;

        // Is the rounding digit in the first word of d?
        if (--i < 0) {
          i += LOG_BASE;
          di = 0;
        } else {
          di = Math.ceil((i + 1) / LOG_BASE);
          i %= LOG_BASE;
        }

        // i is the index (0 - 6) of the rounding digit.
        // E.g. if within the word 3487563 the first rounding digit is 5,
        // then i = 4, k = 1000, rd = 3487563 % 1000 = 563
        k = mathpow(10, LOG_BASE - i);
        rd = d[di] % k | 0;

        if (repeating == null) {
          if (i < 3) {
            if (i == 0) rd = rd / 100 | 0;
            else if (i == 1) rd = rd / 10 | 0;
            r = rm < 4 && rd == 99999 || rm > 3 && rd == 49999 || rd == 50000 || rd == 0;
          } else {
            r = (rm < 4 && rd + 1 == k || rm > 3 && rd + 1 == k / 2) &&
              (d[di + 1] / k / 100 | 0) == mathpow(10, i - 2) - 1 ||
                (rd == k / 2 || rd == 0) && (d[di + 1] / k / 100 | 0) == 0;
          }
        } else {
          if (i < 4) {
            if (i == 0) rd = rd / 1000 | 0;
            else if (i == 1) rd = rd / 100 | 0;
            else if (i == 2) rd = rd / 10 | 0;
            r = (repeating || rm < 4) && rd == 9999 || !repeating && rm > 3 && rd == 4999;
          } else {
            r = ((repeating || rm < 4) && rd + 1 == k ||
            (!repeating && rm > 3) && rd + 1 == k / 2) &&
              (d[di + 1] / k / 1000 | 0) == mathpow(10, i - 3) - 1;
          }
        }

        return r;
      }


      // Convert string of `baseIn` to an array of numbers of `baseOut`.
      // Eg. convertBase('255', 10, 16) returns [15, 15].
      // Eg. convertBase('ff', 16, 10) returns [2, 5, 5].
      function convertBase(str, baseIn, baseOut) {
        var j,
          arr = [0],
          arrL,
          i = 0,
          strL = str.length;

        for (; i < strL;) {
          for (arrL = arr.length; arrL--;) arr[arrL] *= baseIn;
          arr[0] += NUMERALS.indexOf(str.charAt(i++));
          for (j = 0; j < arr.length; j++) {
            if (arr[j] > baseOut - 1) {
              if (arr[j + 1] === void 0) arr[j + 1] = 0;
              arr[j + 1] += arr[j] / baseOut | 0;
              arr[j] %= baseOut;
            }
          }
        }

        return arr.reverse();
      }


      /*
       * cos(x) = 1 - x^2/2! + x^4/4! - ...
       * |x| < pi/2
       *
       */
      function cosine(Ctor, x) {
        var k, y,
          len = x.d.length;

        // Argument reduction: cos(4x) = 8*(cos^4(x) - cos^2(x)) + 1
        // i.e. cos(x) = 8*(cos^4(x/4) - cos^2(x/4)) + 1

        // Estimate the optimum number of times to use the argument reduction.
        if (len < 32) {
          k = Math.ceil(len / 3);
          y = (1 / tinyPow(4, k)).toString();
        } else {
          k = 16;
          y = '2.3283064365386962890625e-10';
        }

        Ctor.precision += k;

        x = taylorSeries(Ctor, 1, x.times(y), new Ctor(1));

        // Reverse argument reduction
        for (var i = k; i--;) {
          var cos2x = x.times(x);
          x = cos2x.times(cos2x).minus(cos2x).times(8).plus(1);
        }

        Ctor.precision -= k;

        return x;
      }


      /*
       * Perform division in the specified base.
       */
      var divide = (function () {

        // Assumes non-zero x and k, and hence non-zero result.
        function multiplyInteger(x, k, base) {
          var temp,
            carry = 0,
            i = x.length;

          for (x = x.slice(); i--;) {
            temp = x[i] * k + carry;
            x[i] = temp % base | 0;
            carry = temp / base | 0;
          }

          if (carry) x.unshift(carry);

          return x;
        }

        function compare(a, b, aL, bL) {
          var i, r;

          if (aL != bL) {
            r = aL > bL ? 1 : -1;
          } else {
            for (i = r = 0; i < aL; i++) {
              if (a[i] != b[i]) {
                r = a[i] > b[i] ? 1 : -1;
                break;
              }
            }
          }

          return r;
        }

        function subtract(a, b, aL, base) {
          var i = 0;

          // Subtract b from a.
          for (; aL--;) {
            a[aL] -= i;
            i = a[aL] < b[aL] ? 1 : 0;
            a[aL] = i * base + a[aL] - b[aL];
          }

          // Remove leading zeros.
          for (; !a[0] && a.length > 1;) a.shift();
        }

        return function (x, y, pr, rm, dp, base) {
          var cmp, e, i, k, logBase, more, prod, prodL, q, qd, rem, remL, rem0, sd, t, xi, xL, yd0,
            yL, yz,
            Ctor = x.constructor,
            sign = x.s == y.s ? 1 : -1,
            xd = x.d,
            yd = y.d;

          // Either NaN, Infinity or 0?
          if (!xd || !xd[0] || !yd || !yd[0]) {

            return new Ctor(// Return NaN if either NaN, or both Infinity or 0.
              !x.s || !y.s || (xd ? yd && xd[0] == yd[0] : !yd) ? NaN :

              // Return ±0 if x is 0 or y is ±Infinity, or return ±Infinity as y is 0.
              xd && xd[0] == 0 || !yd ? sign * 0 : sign / 0);
          }

          if (base) {
            logBase = 1;
            e = x.e - y.e;
          } else {
            base = BASE;
            logBase = LOG_BASE;
            e = mathfloor(x.e / logBase) - mathfloor(y.e / logBase);
          }

          yL = yd.length;
          xL = xd.length;
          q = new Ctor(sign);
          qd = q.d = [];

          // Result exponent may be one less than e.
          // The digit array of a Decimal from toStringBinary may have trailing zeros.
          for (i = 0; yd[i] == (xd[i] || 0); i++);

          if (yd[i] > (xd[i] || 0)) e--;

          if (pr == null) {
            sd = pr = Ctor.precision;
            rm = Ctor.rounding;
          } else if (dp) {
            sd = pr + (x.e - y.e) + 1;
          } else {
            sd = pr;
          }

          if (sd < 0) {
            qd.push(1);
            more = true;
          } else {

            // Convert precision in number of base 10 digits to base 1e7 digits.
            sd = sd / logBase + 2 | 0;
            i = 0;

            // divisor < 1e7
            if (yL == 1) {
              k = 0;
              yd = yd[0];
              sd++;

              // k is the carry.
              for (; (i < xL || k) && sd--; i++) {
                t = k * base + (xd[i] || 0);
                qd[i] = t / yd | 0;
                k = t % yd | 0;
              }

              more = k || i < xL;

            // divisor >= 1e7
            } else {

              // Normalise xd and yd so highest order digit of yd is >= base/2
              k = base / (yd[0] + 1) | 0;

              if (k > 1) {
                yd = multiplyInteger(yd, k, base);
                xd = multiplyInteger(xd, k, base);
                yL = yd.length;
                xL = xd.length;
              }

              xi = yL;
              rem = xd.slice(0, yL);
              remL = rem.length;

              // Add zeros to make remainder as long as divisor.
              for (; remL < yL;) rem[remL++] = 0;

              yz = yd.slice();
              yz.unshift(0);
              yd0 = yd[0];

              if (yd[1] >= base / 2) ++yd0;

              do {
                k = 0;

                // Compare divisor and remainder.
                cmp = compare(yd, rem, yL, remL);

                // If divisor < remainder.
                if (cmp < 0) {

                  // Calculate trial digit, k.
                  rem0 = rem[0];
                  if (yL != remL) rem0 = rem0 * base + (rem[1] || 0);

                  // k will be how many times the divisor goes into the current remainder.
                  k = rem0 / yd0 | 0;

                  //  Algorithm:
                  //  1. product = divisor * trial digit (k)
                  //  2. if product > remainder: product -= divisor, k--
                  //  3. remainder -= product
                  //  4. if product was < remainder at 2:
                  //    5. compare new remainder and divisor
                  //    6. If remainder > divisor: remainder -= divisor, k++

                  if (k > 1) {
                    if (k >= base) k = base - 1;

                    // product = divisor * trial digit.
                    prod = multiplyInteger(yd, k, base);
                    prodL = prod.length;
                    remL = rem.length;

                    // Compare product and remainder.
                    cmp = compare(prod, rem, prodL, remL);

                    // product > remainder.
                    if (cmp == 1) {
                      k--;

                      // Subtract divisor from product.
                      subtract(prod, yL < prodL ? yz : yd, prodL, base);
                    }
                  } else {

                    // cmp is -1.
                    // If k is 0, there is no need to compare yd and rem again below, so change cmp to 1
                    // to avoid it. If k is 1 there is a need to compare yd and rem again below.
                    if (k == 0) cmp = k = 1;
                    prod = yd.slice();
                  }

                  prodL = prod.length;
                  if (prodL < remL) prod.unshift(0);

                  // Subtract product from remainder.
                  subtract(rem, prod, remL, base);

                  // If product was < previous remainder.
                  if (cmp == -1) {
                    remL = rem.length;

                    // Compare divisor and new remainder.
                    cmp = compare(yd, rem, yL, remL);

                    // If divisor < new remainder, subtract divisor from remainder.
                    if (cmp < 1) {
                      k++;

                      // Subtract divisor from remainder.
                      subtract(rem, yL < remL ? yz : yd, remL, base);
                    }
                  }

                  remL = rem.length;
                } else if (cmp === 0) {
                  k++;
                  rem = [0];
                }    // if cmp === 1, k will be 0

                // Add the next digit, k, to the result array.
                qd[i++] = k;

                // Update the remainder.
                if (cmp && rem[0]) {
                  rem[remL++] = xd[xi] || 0;
                } else {
                  rem = [xd[xi]];
                  remL = 1;
                }

              } while ((xi++ < xL || rem[0] !== void 0) && sd--);

              more = rem[0] !== void 0;
            }

            // Leading zero?
            if (!qd[0]) qd.shift();
          }

          // logBase is 1 when divide is being used for base conversion.
          if (logBase == 1) {
            q.e = e;
            inexact = more;
          } else {

            // To calculate q.e, first get the number of digits of qd[0].
            for (i = 1, k = qd[0]; k >= 10; k /= 10) i++;
            q.e = i + e * logBase - 1;

            finalise(q, dp ? pr + q.e + 1 : pr, rm, more);
          }

          return q;
        };
      })();


      /*
       * Round `x` to `sd` significant digits using rounding mode `rm`.
       * Check for over/under-flow.
       */
       function finalise(x, sd, rm, isTruncated) {
        var digits, i, j, k, rd, roundUp, w, xd, xdi,
          Ctor = x.constructor;

        // Don't round if sd is null or undefined.
        out: if (sd != null) {
          xd = x.d;

          // Infinity/NaN.
          if (!xd) return x;

          // rd: the rounding digit, i.e. the digit after the digit that may be rounded up.
          // w: the word of xd containing rd, a base 1e7 number.
          // xdi: the index of w within xd.
          // digits: the number of digits of w.
          // i: what would be the index of rd within w if all the numbers were 7 digits long (i.e. if
          // they had leading zeros)
          // j: if > 0, the actual index of rd within w (if < 0, rd is a leading zero).

          // Get the length of the first word of the digits array xd.
          for (digits = 1, k = xd[0]; k >= 10; k /= 10) digits++;
          i = sd - digits;

          // Is the rounding digit in the first word of xd?
          if (i < 0) {
            i += LOG_BASE;
            j = sd;
            w = xd[xdi = 0];

            // Get the rounding digit at index j of w.
            rd = w / mathpow(10, digits - j - 1) % 10 | 0;
          } else {
            xdi = Math.ceil((i + 1) / LOG_BASE);
            k = xd.length;
            if (xdi >= k) {
              if (isTruncated) {

                // Needed by `naturalExponential`, `naturalLogarithm` and `squareRoot`.
                for (; k++ <= xdi;) xd.push(0);
                w = rd = 0;
                digits = 1;
                i %= LOG_BASE;
                j = i - LOG_BASE + 1;
              } else {
                break out;
              }
            } else {
              w = k = xd[xdi];

              // Get the number of digits of w.
              for (digits = 1; k >= 10; k /= 10) digits++;

              // Get the index of rd within w.
              i %= LOG_BASE;

              // Get the index of rd within w, adjusted for leading zeros.
              // The number of leading zeros of w is given by LOG_BASE - digits.
              j = i - LOG_BASE + digits;

              // Get the rounding digit at index j of w.
              rd = j < 0 ? 0 : w / mathpow(10, digits - j - 1) % 10 | 0;
            }
          }

          // Are there any non-zero digits after the rounding digit?
          isTruncated = isTruncated || sd < 0 ||
            xd[xdi + 1] !== void 0 || (j < 0 ? w : w % mathpow(10, digits - j - 1));

          // The expression `w % mathpow(10, digits - j - 1)` returns all the digits of w to the right
          // of the digit at (left-to-right) index j, e.g. if w is 908714 and j is 2, the expression
          // will give 714.

          roundUp = rm < 4
            ? (rd || isTruncated) && (rm == 0 || rm == (x.s < 0 ? 3 : 2))
            : rd > 5 || rd == 5 && (rm == 4 || isTruncated || rm == 6 &&

              // Check whether the digit to the left of the rounding digit is odd.
              ((i > 0 ? j > 0 ? w / mathpow(10, digits - j) : 0 : xd[xdi - 1]) % 10) & 1 ||
                rm == (x.s < 0 ? 8 : 7));

          if (sd < 1 || !xd[0]) {
            xd.length = 0;
            if (roundUp) {

              // Convert sd to decimal places.
              sd -= x.e + 1;

              // 1, 0.1, 0.01, 0.001, 0.0001 etc.
              xd[0] = mathpow(10, (LOG_BASE - sd % LOG_BASE) % LOG_BASE);
              x.e = -sd || 0;
            } else {

              // Zero.
              xd[0] = x.e = 0;
            }

            return x;
          }

          // Remove excess digits.
          if (i == 0) {
            xd.length = xdi;
            k = 1;
            xdi--;
          } else {
            xd.length = xdi + 1;
            k = mathpow(10, LOG_BASE - i);

            // E.g. 56700 becomes 56000 if 7 is the rounding digit.
            // j > 0 means i > number of leading zeros of w.
            xd[xdi] = j > 0 ? (w / mathpow(10, digits - j) % mathpow(10, j) | 0) * k : 0;
          }

          if (roundUp) {
            for (;;) {

              // Is the digit to be rounded up in the first word of xd?
              if (xdi == 0) {

                // i will be the length of xd[0] before k is added.
                for (i = 1, j = xd[0]; j >= 10; j /= 10) i++;
                j = xd[0] += k;
                for (k = 1; j >= 10; j /= 10) k++;

                // if i != k the length has increased.
                if (i != k) {
                  x.e++;
                  if (xd[0] == BASE) xd[0] = 1;
                }

                break;
              } else {
                xd[xdi] += k;
                if (xd[xdi] != BASE) break;
                xd[xdi--] = 0;
                k = 1;
              }
            }
          }

          // Remove trailing zeros.
          for (i = xd.length; xd[--i] === 0;) xd.pop();
        }

        if (external) {

          // Overflow?
          if (x.e > Ctor.maxE) {

            // Infinity.
            x.d = null;
            x.e = NaN;

          // Underflow?
          } else if (x.e < Ctor.minE) {

            // Zero.
            x.e = 0;
            x.d = [0];
            // Ctor.underflow = true;
          } // else Ctor.underflow = false;
        }

        return x;
      }


      function finiteToString(x, isExp, sd) {
        if (!x.isFinite()) return nonFiniteToString(x);
        var k,
          e = x.e,
          str = digitsToString(x.d),
          len = str.length;

        if (isExp) {
          if (sd && (k = sd - len) > 0) {
            str = str.charAt(0) + '.' + str.slice(1) + getZeroString(k);
          } else if (len > 1) {
            str = str.charAt(0) + '.' + str.slice(1);
          }

          str = str + (x.e < 0 ? 'e' : 'e+') + x.e;
        } else if (e < 0) {
          str = '0.' + getZeroString(-e - 1) + str;
          if (sd && (k = sd - len) > 0) str += getZeroString(k);
        } else if (e >= len) {
          str += getZeroString(e + 1 - len);
          if (sd && (k = sd - e - 1) > 0) str = str + '.' + getZeroString(k);
        } else {
          if ((k = e + 1) < len) str = str.slice(0, k) + '.' + str.slice(k);
          if (sd && (k = sd - len) > 0) {
            if (e + 1 === len) str += '.';
            str += getZeroString(k);
          }
        }

        return str;
      }


      // Calculate the base 10 exponent from the base 1e7 exponent.
      function getBase10Exponent(digits, e) {
        var w = digits[0];

        // Add the number of digits of the first word of the digits array.
        for ( e *= LOG_BASE; w >= 10; w /= 10) e++;
        return e;
      }


      function getLn10(Ctor, sd, pr) {
        if (sd > LN10_PRECISION) {

          // Reset global state in case the exception is caught.
          external = true;
          if (pr) Ctor.precision = pr;
          throw Error(precisionLimitExceeded);
        }
        return finalise(new Ctor(LN10), sd, 1, true);
      }


      function getPi(Ctor, sd, rm) {
        if (sd > PI_PRECISION) throw Error(precisionLimitExceeded);
        return finalise(new Ctor(PI), sd, rm, true);
      }


      function getPrecision(digits) {
        var w = digits.length - 1,
          len = w * LOG_BASE + 1;

        w = digits[w];

        // If non-zero...
        if (w) {

          // Subtract the number of trailing zeros of the last word.
          for (; w % 10 == 0; w /= 10) len--;

          // Add the number of digits of the first word.
          for (w = digits[0]; w >= 10; w /= 10) len++;
        }

        return len;
      }


      function getZeroString(k) {
        var zs = '';
        for (; k--;) zs += '0';
        return zs;
      }


      /*
       * Return a new Decimal whose value is the value of Decimal `x` to the power `n`, where `n` is an
       * integer of type number.
       *
       * Implements 'exponentiation by squaring'. Called by `pow` and `parseOther`.
       *
       */
      function intPow(Ctor, x, n, pr) {
        var isTruncated,
          r = new Ctor(1),

          // Max n of 9007199254740991 takes 53 loop iterations.
          // Maximum digits array length; leaves [28, 34] guard digits.
          k = Math.ceil(pr / LOG_BASE + 4);

        external = false;

        for (;;) {
          if (n % 2) {
            r = r.times(x);
            if (truncate(r.d, k)) isTruncated = true;
          }

          n = mathfloor(n / 2);
          if (n === 0) {

            // To ensure correct rounding when r.d is truncated, increment the last word if it is zero.
            n = r.d.length - 1;
            if (isTruncated && r.d[n] === 0) ++r.d[n];
            break;
          }

          x = x.times(x);
          truncate(x.d, k);
        }

        external = true;

        return r;
      }


      function isOdd(n) {
        return n.d[n.d.length - 1] & 1;
      }


      /*
       * Handle `max` and `min`. `ltgt` is 'lt' or 'gt'.
       */
      function maxOrMin(Ctor, args, ltgt) {
        var y,
          x = new Ctor(args[0]),
          i = 0;

        for (; ++i < args.length;) {
          y = new Ctor(args[i]);
          if (!y.s) {
            x = y;
            break;
          } else if (x[ltgt](y)) {
            x = y;
          }
        }

        return x;
      }


      /*
       * Return a new Decimal whose value is the natural exponential of `x` rounded to `sd` significant
       * digits.
       *
       * Taylor/Maclaurin series.
       *
       * exp(x) = x^0/0! + x^1/1! + x^2/2! + x^3/3! + ...
       *
       * Argument reduction:
       *   Repeat x = x / 32, k += 5, until |x| < 0.1
       *   exp(x) = exp(x / 2^k)^(2^k)
       *
       * Previously, the argument was initially reduced by
       * exp(x) = exp(r) * 10^k  where r = x - k * ln10, k = floor(x / ln10)
       * to first put r in the range [0, ln10], before dividing by 32 until |x| < 0.1, but this was
       * found to be slower than just dividing repeatedly by 32 as above.
       *
       * Max integer argument: exp('20723265836946413') = 6.3e+9000000000000000
       * Min integer argument: exp('-20723265836946411') = 1.2e-9000000000000000
       * (Math object integer min/max: Math.exp(709) = 8.2e+307, Math.exp(-745) = 5e-324)
       *
       *  exp(Infinity)  = Infinity
       *  exp(-Infinity) = 0
       *  exp(NaN)       = NaN
       *  exp(±0)        = 1
       *
       *  exp(x) is non-terminating for any finite, non-zero x.
       *
       *  The result will always be correctly rounded.
       *
       */
      function naturalExponential(x, sd) {
        var denominator, guard, j, pow, sum, t, wpr,
          rep = 0,
          i = 0,
          k = 0,
          Ctor = x.constructor,
          rm = Ctor.rounding,
          pr = Ctor.precision;

        // 0/NaN/Infinity?
        if (!x.d || !x.d[0] || x.e > 17) {

          return new Ctor(x.d
            ? !x.d[0] ? 1 : x.s < 0 ? 0 : 1 / 0
            : x.s ? x.s < 0 ? 0 : x : 0 / 0);
        }

        if (sd == null) {
          external = false;
          wpr = pr;
        } else {
          wpr = sd;
        }

        t = new Ctor(0.03125);

        // while abs(x) >= 0.1
        while (x.e > -2) {

          // x = x / 2^5
          x = x.times(t);
          k += 5;
        }

        // Use 2 * log10(2^k) + 5 (empirically derived) to estimate the increase in precision
        // necessary to ensure the first 4 rounding digits are correct.
        guard = Math.log(mathpow(2, k)) / Math.LN10 * 2 + 5 | 0;
        wpr += guard;
        denominator = pow = sum = new Ctor(1);
        Ctor.precision = wpr;

        for (;;) {
          pow = finalise(pow.times(x), wpr, 1);
          denominator = denominator.times(++i);
          t = sum.plus(divide(pow, denominator, wpr, 1));

          if (digitsToString(t.d).slice(0, wpr) === digitsToString(sum.d).slice(0, wpr)) {
            j = k;
            while (j--) sum = finalise(sum.times(sum), wpr, 1);

            // Check to see if the first 4 rounding digits are [49]999.
            // If so, repeat the summation with a higher precision, otherwise
            // e.g. with precision: 18, rounding: 1
            // exp(18.404272462595034083567793919843761) = 98372560.1229999999 (should be 98372560.123)
            // `wpr - guard` is the index of first rounding digit.
            if (sd == null) {

              if (rep < 3 && checkRoundingDigits(sum.d, wpr - guard, rm, rep)) {
                Ctor.precision = wpr += 10;
                denominator = pow = t = new Ctor(1);
                i = 0;
                rep++;
              } else {
                return finalise(sum, Ctor.precision = pr, rm, external = true);
              }
            } else {
              Ctor.precision = pr;
              return sum;
            }
          }

          sum = t;
        }
      }


      /*
       * Return a new Decimal whose value is the natural logarithm of `x` rounded to `sd` significant
       * digits.
       *
       *  ln(-n)        = NaN
       *  ln(0)         = -Infinity
       *  ln(-0)        = -Infinity
       *  ln(1)         = 0
       *  ln(Infinity)  = Infinity
       *  ln(-Infinity) = NaN
       *  ln(NaN)       = NaN
       *
       *  ln(n) (n != 1) is non-terminating.
       *
       */
      function naturalLogarithm(y, sd) {
        var c, c0, denominator, e, numerator, rep, sum, t, wpr, x1, x2,
          n = 1,
          guard = 10,
          x = y,
          xd = x.d,
          Ctor = x.constructor,
          rm = Ctor.rounding,
          pr = Ctor.precision;

        // Is x negative or Infinity, NaN, 0 or 1?
        if (x.s < 0 || !xd || !xd[0] || !x.e && xd[0] == 1 && xd.length == 1) {
          return new Ctor(xd && !xd[0] ? -1 / 0 : x.s != 1 ? NaN : xd ? 0 : x);
        }

        if (sd == null) {
          external = false;
          wpr = pr;
        } else {
          wpr = sd;
        }

        Ctor.precision = wpr += guard;
        c = digitsToString(xd);
        c0 = c.charAt(0);

        if (Math.abs(e = x.e) < 1.5e15) {

          // Argument reduction.
          // The series converges faster the closer the argument is to 1, so using
          // ln(a^b) = b * ln(a),   ln(a) = ln(a^b) / b
          // multiply the argument by itself until the leading digits of the significand are 7, 8, 9,
          // 10, 11, 12 or 13, recording the number of multiplications so the sum of the series can
          // later be divided by this number, then separate out the power of 10 using
          // ln(a*10^b) = ln(a) + b*ln(10).

          // max n is 21 (gives 0.9, 1.0 or 1.1) (9e15 / 21 = 4.2e14).
          //while (c0 < 9 && c0 != 1 || c0 == 1 && c.charAt(1) > 1) {
          // max n is 6 (gives 0.7 - 1.3)
          while (c0 < 7 && c0 != 1 || c0 == 1 && c.charAt(1) > 3) {
            x = x.times(y);
            c = digitsToString(x.d);
            c0 = c.charAt(0);
            n++;
          }

          e = x.e;

          if (c0 > 1) {
            x = new Ctor('0.' + c);
            e++;
          } else {
            x = new Ctor(c0 + '.' + c.slice(1));
          }
        } else {

          // The argument reduction method above may result in overflow if the argument y is a massive
          // number with exponent >= 1500000000000000 (9e15 / 6 = 1.5e15), so instead recall this
          // function using ln(x*10^e) = ln(x) + e*ln(10).
          t = getLn10(Ctor, wpr + 2, pr).times(e + '');
          x = naturalLogarithm(new Ctor(c0 + '.' + c.slice(1)), wpr - guard).plus(t);
          Ctor.precision = pr;

          return sd == null ? finalise(x, pr, rm, external = true) : x;
        }

        // x1 is x reduced to a value near 1.
        x1 = x;

        // Taylor series.
        // ln(y) = ln((1 + x)/(1 - x)) = 2(x + x^3/3 + x^5/5 + x^7/7 + ...)
        // where x = (y - 1)/(y + 1)    (|x| < 1)
        sum = numerator = x = divide(x.minus(1), x.plus(1), wpr, 1);
        x2 = finalise(x.times(x), wpr, 1);
        denominator = 3;

        for (;;) {
          numerator = finalise(numerator.times(x2), wpr, 1);
          t = sum.plus(divide(numerator, new Ctor(denominator), wpr, 1));

          if (digitsToString(t.d).slice(0, wpr) === digitsToString(sum.d).slice(0, wpr)) {
            sum = sum.times(2);

            // Reverse the argument reduction. Check that e is not 0 because, besides preventing an
            // unnecessary calculation, -0 + 0 = +0 and to ensure correct rounding -0 needs to stay -0.
            if (e !== 0) sum = sum.plus(getLn10(Ctor, wpr + 2, pr).times(e + ''));
            sum = divide(sum, new Ctor(n), wpr, 1);

            // Is rm > 3 and the first 4 rounding digits 4999, or rm < 4 (or the summation has
            // been repeated previously) and the first 4 rounding digits 9999?
            // If so, restart the summation with a higher precision, otherwise
            // e.g. with precision: 12, rounding: 1
            // ln(135520028.6126091714265381533) = 18.7246299999 when it should be 18.72463.
            // `wpr - guard` is the index of first rounding digit.
            if (sd == null) {
              if (checkRoundingDigits(sum.d, wpr - guard, rm, rep)) {
                Ctor.precision = wpr += guard;
                t = numerator = x = divide(x1.minus(1), x1.plus(1), wpr, 1);
                x2 = finalise(x.times(x), wpr, 1);
                denominator = rep = 1;
              } else {
                return finalise(sum, Ctor.precision = pr, rm, external = true);
              }
            } else {
              Ctor.precision = pr;
              return sum;
            }
          }

          sum = t;
          denominator += 2;
        }
      }


      // ±Infinity, NaN.
      function nonFiniteToString(x) {
        // Unsigned.
        return String(x.s * x.s / 0);
      }


      /*
       * Parse the value of a new Decimal `x` from string `str`.
       */
      function parseDecimal(x, str) {
        var e, i, len;

        // Decimal point?
        if ((e = str.indexOf('.')) > -1) str = str.replace('.', '');

        // Exponential form?
        if ((i = str.search(/e/i)) > 0) {

          // Determine exponent.
          if (e < 0) e = i;
          e += +str.slice(i + 1);
          str = str.substring(0, i);
        } else if (e < 0) {

          // Integer.
          e = str.length;
        }

        // Determine leading zeros.
        for (i = 0; str.charCodeAt(i) === 48; i++);

        // Determine trailing zeros.
        for (len = str.length; str.charCodeAt(len - 1) === 48; --len);
        str = str.slice(i, len);

        if (str) {
          len -= i;
          x.e = e = e - i - 1;
          x.d = [];

          // Transform base

          // e is the base 10 exponent.
          // i is where to slice str to get the first word of the digits array.
          i = (e + 1) % LOG_BASE;
          if (e < 0) i += LOG_BASE;

          if (i < len) {
            if (i) x.d.push(+str.slice(0, i));
            for (len -= LOG_BASE; i < len;) x.d.push(+str.slice(i, i += LOG_BASE));
            str = str.slice(i);
            i = LOG_BASE - str.length;
          } else {
            i -= len;
          }

          for (; i--;) str += '0';
          x.d.push(+str);

          if (external) {

            // Overflow?
            if (x.e > x.constructor.maxE) {

              // Infinity.
              x.d = null;
              x.e = NaN;

            // Underflow?
            } else if (x.e < x.constructor.minE) {

              // Zero.
              x.e = 0;
              x.d = [0];
              // x.constructor.underflow = true;
            } // else x.constructor.underflow = false;
          }
        } else {

          // Zero.
          x.e = 0;
          x.d = [0];
        }

        return x;
      }


      /*
       * Parse the value of a new Decimal `x` from a string `str`, which is not a decimal value.
       */
      function parseOther(x, str) {
        var base, Ctor, divisor, i, isFloat, len, p, xd, xe;

        if (str === 'Infinity' || str === 'NaN') {
          if (!+str) x.s = NaN;
          x.e = NaN;
          x.d = null;
          return x;
        }

        if (isHex.test(str))  {
          base = 16;
          str = str.toLowerCase();
        } else if (isBinary.test(str))  {
          base = 2;
        } else if (isOctal.test(str))  {
          base = 8;
        } else {
          throw Error(invalidArgument + str);
        }

        // Is there a binary exponent part?
        i = str.search(/p/i);

        if (i > 0) {
          p = +str.slice(i + 1);
          str = str.substring(2, i);
        } else {
          str = str.slice(2);
        }

        // Convert `str` as an integer then divide the result by `base` raised to a power such that the
        // fraction part will be restored.
        i = str.indexOf('.');
        isFloat = i >= 0;
        Ctor = x.constructor;

        if (isFloat) {
          str = str.replace('.', '');
          len = str.length;
          i = len - i;

          // log[10](16) = 1.2041... , log[10](88) = 1.9444....
          divisor = intPow(Ctor, new Ctor(base), i, i * 2);
        }

        xd = convertBase(str, base, BASE);
        xe = xd.length - 1;

        // Remove trailing zeros.
        for (i = xe; xd[i] === 0; --i) xd.pop();
        if (i < 0) return new Ctor(x.s * 0);
        x.e = getBase10Exponent(xd, xe);
        x.d = xd;
        external = false;

        // At what precision to perform the division to ensure exact conversion?
        // maxDecimalIntegerPartDigitCount = ceil(log[10](b) * otherBaseIntegerPartDigitCount)
        // log[10](2) = 0.30103, log[10](8) = 0.90309, log[10](16) = 1.20412
        // E.g. ceil(1.2 * 3) = 4, so up to 4 decimal digits are needed to represent 3 hex int digits.
        // maxDecimalFractionPartDigitCount = {Hex:4|Oct:3|Bin:1} * otherBaseFractionPartDigitCount
        // Therefore using 4 * the number of digits of str will always be enough.
        if (isFloat) x = divide(x, divisor, len * 4);

        // Multiply by the binary exponent part if present.
        if (p) x = x.times(Math.abs(p) < 54 ? mathpow(2, p) : Decimal.pow(2, p));
        external = true;

        return x;
      }


      /*
       * sin(x) = x - x^3/3! + x^5/5! - ...
       * |x| < pi/2
       *
       */
      function sine(Ctor, x) {
        var k,
          len = x.d.length;

        if (len < 3) return taylorSeries(Ctor, 2, x, x);

        // Argument reduction: sin(5x) = 16*sin^5(x) - 20*sin^3(x) + 5*sin(x)
        // i.e. sin(x) = 16*sin^5(x/5) - 20*sin^3(x/5) + 5*sin(x/5)
        // and  sin(x) = sin(x/5)(5 + sin^2(x/5)(16sin^2(x/5) - 20))

        // Estimate the optimum number of times to use the argument reduction.
        k = 1.4 * Math.sqrt(len);
        k = k > 16 ? 16 : k | 0;

        x = x.times(1 / tinyPow(5, k));
        x = taylorSeries(Ctor, 2, x, x);

        // Reverse argument reduction
        var sin2_x,
          d5 = new Ctor(5),
          d16 = new Ctor(16),
          d20 = new Ctor(20);
        for (; k--;) {
          sin2_x = x.times(x);
          x = x.times(d5.plus(sin2_x.times(d16.times(sin2_x).minus(d20))));
        }

        return x;
      }


      // Calculate Taylor series for `cos`, `cosh`, `sin` and `sinh`.
      function taylorSeries(Ctor, n, x, y, isHyperbolic) {
        var j, t, u, x2,
          pr = Ctor.precision,
          k = Math.ceil(pr / LOG_BASE);

        external = false;
        x2 = x.times(x);
        u = new Ctor(y);

        for (;;) {
          t = divide(u.times(x2), new Ctor(n++ * n++), pr, 1);
          u = isHyperbolic ? y.plus(t) : y.minus(t);
          y = divide(t.times(x2), new Ctor(n++ * n++), pr, 1);
          t = u.plus(y);

          if (t.d[k] !== void 0) {
            for (j = k; t.d[j] === u.d[j] && j--;);
            if (j == -1) break;
          }

          j = u;
          u = y;
          y = t;
          t = j;
        }

        external = true;
        t.d.length = k + 1;

        return t;
      }


      // Exponent e must be positive and non-zero.
      function tinyPow(b, e) {
        var n = b;
        while (--e) n *= b;
        return n;
      }


      // Return the absolute value of `x` reduced to less than or equal to half pi.
      function toLessThanHalfPi(Ctor, x) {
        var t,
          isNeg = x.s < 0,
          pi = getPi(Ctor, Ctor.precision, 1),
          halfPi = pi.times(0.5);

        x = x.abs();

        if (x.lte(halfPi)) {
          quadrant = isNeg ? 4 : 1;
          return x;
        }

        t = x.divToInt(pi);

        if (t.isZero()) {
          quadrant = isNeg ? 3 : 2;
        } else {
          x = x.minus(t.times(pi));

          // 0 <= x < pi
          if (x.lte(halfPi)) {
            quadrant = isOdd(t) ? (isNeg ? 2 : 3) : (isNeg ? 4 : 1);
            return x;
          }

          quadrant = isOdd(t) ? (isNeg ? 1 : 4) : (isNeg ? 3 : 2);
        }

        return x.minus(pi).abs();
      }


      /*
       * Return the value of Decimal `x` as a string in base `baseOut`.
       *
       * If the optional `sd` argument is present include a binary exponent suffix.
       */
      function toStringBinary(x, baseOut, sd, rm) {
        var base, e, i, k, len, roundUp, str, xd, y,
          Ctor = x.constructor,
          isExp = sd !== void 0;

        if (isExp) {
          checkInt32(sd, 1, MAX_DIGITS);
          if (rm === void 0) rm = Ctor.rounding;
          else checkInt32(rm, 0, 8);
        } else {
          sd = Ctor.precision;
          rm = Ctor.rounding;
        }

        if (!x.isFinite()) {
          str = nonFiniteToString(x);
        } else {
          str = finiteToString(x);
          i = str.indexOf('.');

          // Use exponential notation according to `toExpPos` and `toExpNeg`? No, but if required:
          // maxBinaryExponent = floor((decimalExponent + 1) * log[2](10))
          // minBinaryExponent = floor(decimalExponent * log[2](10))
          // log[2](10) = 3.321928094887362347870319429489390175864

          if (isExp) {
            base = 2;
            if (baseOut == 16) {
              sd = sd * 4 - 3;
            } else if (baseOut == 8) {
              sd = sd * 3 - 2;
            }
          } else {
            base = baseOut;
          }

          // Convert the number as an integer then divide the result by its base raised to a power such
          // that the fraction part will be restored.

          // Non-integer.
          if (i >= 0) {
            str = str.replace('.', '');
            y = new Ctor(1);
            y.e = str.length - i;
            y.d = convertBase(finiteToString(y), 10, base);
            y.e = y.d.length;
          }

          xd = convertBase(str, 10, base);
          e = len = xd.length;

          // Remove trailing zeros.
          for (; xd[--len] == 0;) xd.pop();

          if (!xd[0]) {
            str = isExp ? '0p+0' : '0';
          } else {
            if (i < 0) {
              e--;
            } else {
              x = new Ctor(x);
              x.d = xd;
              x.e = e;
              x = divide(x, y, sd, rm, 0, base);
              xd = x.d;
              e = x.e;
              roundUp = inexact;
            }

            // The rounding digit, i.e. the digit after the digit that may be rounded up.
            i = xd[sd];
            k = base / 2;
            roundUp = roundUp || xd[sd + 1] !== void 0;

            roundUp = rm < 4
              ? (i !== void 0 || roundUp) && (rm === 0 || rm === (x.s < 0 ? 3 : 2))
              : i > k || i === k && (rm === 4 || roundUp || rm === 6 && xd[sd - 1] & 1 ||
                rm === (x.s < 0 ? 8 : 7));

            xd.length = sd;

            if (roundUp) {

              // Rounding up may mean the previous digit has to be rounded up and so on.
              for (; ++xd[--sd] > base - 1;) {
                xd[sd] = 0;
                if (!sd) {
                  ++e;
                  xd.unshift(1);
                }
              }
            }

            // Determine trailing zeros.
            for (len = xd.length; !xd[len - 1]; --len);

            // E.g. [4, 11, 15] becomes 4bf.
            for (i = 0, str = ''; i < len; i++) str += NUMERALS.charAt(xd[i]);

            // Add binary exponent suffix?
            if (isExp) {
              if (len > 1) {
                if (baseOut == 16 || baseOut == 8) {
                  i = baseOut == 16 ? 4 : 3;
                  for (--len; len % i; len++) str += '0';
                  xd = convertBase(str, base, baseOut);
                  for (len = xd.length; !xd[len - 1]; --len);

                  // xd[0] will always be be 1
                  for (i = 1, str = '1.'; i < len; i++) str += NUMERALS.charAt(xd[i]);
                } else {
                  str = str.charAt(0) + '.' + str.slice(1);
                }
              }

              str =  str + (e < 0 ? 'p' : 'p+') + e;
            } else if (e < 0) {
              for (; ++e;) str = '0' + str;
              str = '0.' + str;
            } else {
              if (++e > len) for (e -= len; e-- ;) str += '0';
              else if (e < len) str = str.slice(0, e) + '.' + str.slice(e);
            }
          }

          str = (baseOut == 16 ? '0x' : baseOut == 2 ? '0b' : baseOut == 8 ? '0o' : '') + str;
        }

        return x.s < 0 ? '-' + str : str;
      }


      // Does not strip trailing zeros.
      function truncate(arr, len) {
        if (arr.length > len) {
          arr.length = len;
          return true;
        }
      }


      // Decimal methods


      /*
       *  abs
       *  acos
       *  acosh
       *  add
       *  asin
       *  asinh
       *  atan
       *  atanh
       *  atan2
       *  cbrt
       *  ceil
       *  clone
       *  config
       *  cos
       *  cosh
       *  div
       *  exp
       *  floor
       *  hypot
       *  ln
       *  log
       *  log2
       *  log10
       *  max
       *  min
       *  mod
       *  mul
       *  pow
       *  random
       *  round
       *  set
       *  sign
       *  sin
       *  sinh
       *  sqrt
       *  sub
       *  tan
       *  tanh
       *  trunc
       */


      /*
       * Return a new Decimal whose value is the absolute value of `x`.
       *
       * x {number|string|Decimal}
       *
       */
      function abs(x) {
        return new this(x).abs();
      }


      /*
       * Return a new Decimal whose value is the arccosine in radians of `x`.
       *
       * x {number|string|Decimal}
       *
       */
      function acos(x) {
        return new this(x).acos();
      }


      /*
       * Return a new Decimal whose value is the inverse of the hyperbolic cosine of `x`, rounded to
       * `precision` significant digits using rounding mode `rounding`.
       *
       * x {number|string|Decimal} A value in radians.
       *
       */
      function acosh(x) {
        return new this(x).acosh();
      }


      /*
       * Return a new Decimal whose value is the sum of `x` and `y`, rounded to `precision` significant
       * digits using rounding mode `rounding`.
       *
       * x {number|string|Decimal}
       * y {number|string|Decimal}
       *
       */
      function add(x, y) {
        return new this(x).plus(y);
      }


      /*
       * Return a new Decimal whose value is the arcsine in radians of `x`, rounded to `precision`
       * significant digits using rounding mode `rounding`.
       *
       * x {number|string|Decimal}
       *
       */
      function asin(x) {
        return new this(x).asin();
      }


      /*
       * Return a new Decimal whose value is the inverse of the hyperbolic sine of `x`, rounded to
       * `precision` significant digits using rounding mode `rounding`.
       *
       * x {number|string|Decimal} A value in radians.
       *
       */
      function asinh(x) {
        return new this(x).asinh();
      }


      /*
       * Return a new Decimal whose value is the arctangent in radians of `x`, rounded to `precision`
       * significant digits using rounding mode `rounding`.
       *
       * x {number|string|Decimal}
       *
       */
      function atan(x) {
        return new this(x).atan();
      }


      /*
       * Return a new Decimal whose value is the inverse of the hyperbolic tangent of `x`, rounded to
       * `precision` significant digits using rounding mode `rounding`.
       *
       * x {number|string|Decimal} A value in radians.
       *
       */
      function atanh(x) {
        return new this(x).atanh();
      }


      /*
       * Return a new Decimal whose value is the arctangent in radians of `y/x` in the range -pi to pi
       * (inclusive), rounded to `precision` significant digits using rounding mode `rounding`.
       *
       * Domain: [-Infinity, Infinity]
       * Range: [-pi, pi]
       *
       * y {number|string|Decimal} The y-coordinate.
       * x {number|string|Decimal} The x-coordinate.
       *
       * atan2(±0, -0)               = ±pi
       * atan2(±0, +0)               = ±0
       * atan2(±0, -x)               = ±pi for x > 0
       * atan2(±0, x)                = ±0 for x > 0
       * atan2(-y, ±0)               = -pi/2 for y > 0
       * atan2(y, ±0)                = pi/2 for y > 0
       * atan2(±y, -Infinity)        = ±pi for finite y > 0
       * atan2(±y, +Infinity)        = ±0 for finite y > 0
       * atan2(±Infinity, x)         = ±pi/2 for finite x
       * atan2(±Infinity, -Infinity) = ±3*pi/4
       * atan2(±Infinity, +Infinity) = ±pi/4
       * atan2(NaN, x) = NaN
       * atan2(y, NaN) = NaN
       *
       */
      function atan2(y, x) {
        y = new this(y);
        x = new this(x);
        var r,
          pr = this.precision,
          rm = this.rounding,
          wpr = pr + 4;

        // Either NaN
        if (!y.s || !x.s) {
          r = new this(NaN);

        // Both ±Infinity
        } else if (!y.d && !x.d) {
          r = getPi(this, wpr, 1).times(x.s > 0 ? 0.25 : 0.75);
          r.s = y.s;

        // x is ±Infinity or y is ±0
        } else if (!x.d || y.isZero()) {
          r = x.s < 0 ? getPi(this, pr, rm) : new this(0);
          r.s = y.s;

        // y is ±Infinity or x is ±0
        } else if (!y.d || x.isZero()) {
          r = getPi(this, wpr, 1).times(0.5);
          r.s = y.s;

        // Both non-zero and finite
        } else if (x.s < 0) {
          this.precision = wpr;
          this.rounding = 1;
          r = this.atan(divide(y, x, wpr, 1));
          x = getPi(this, wpr, 1);
          this.precision = pr;
          this.rounding = rm;
          r = y.s < 0 ? r.minus(x) : r.plus(x);
        } else {
          r = this.atan(divide(y, x, wpr, 1));
        }

        return r;
      }


      /*
       * Return a new Decimal whose value is the cube root of `x`, rounded to `precision` significant
       * digits using rounding mode `rounding`.
       *
       * x {number|string|Decimal}
       *
       */
      function cbrt(x) {
        return new this(x).cbrt();
      }


      /*
       * Return a new Decimal whose value is `x` rounded to an integer using `ROUND_CEIL`.
       *
       * x {number|string|Decimal}
       *
       */
      function ceil(x) {
        return finalise(x = new this(x), x.e + 1, 2);
      }


      /*
       * Configure global settings for a Decimal constructor.
       *
       * `obj` is an object with one or more of the following properties,
       *
       *   precision  {number}
       *   rounding   {number}
       *   toExpNeg   {number}
       *   toExpPos   {number}
       *   maxE       {number}
       *   minE       {number}
       *   modulo     {number}
       *   crypto     {boolean|number}
       *   defaults   {true}
       *
       * E.g. Decimal.config({ precision: 20, rounding: 4 })
       *
       */
      function config(obj) {
        if (!obj || typeof obj !== 'object') throw Error(decimalError + 'Object expected');
        var i, p, v,
          useDefaults = obj.defaults === true,
          ps = [
            'precision', 1, MAX_DIGITS,
            'rounding', 0, 8,
            'toExpNeg', -EXP_LIMIT, 0,
            'toExpPos', 0, EXP_LIMIT,
            'maxE', 0, EXP_LIMIT,
            'minE', -EXP_LIMIT, 0,
            'modulo', 0, 9
          ];

        for (i = 0; i < ps.length; i += 3) {
          if (p = ps[i], useDefaults) this[p] = DEFAULTS[p];
          if ((v = obj[p]) !== void 0) {
            if (mathfloor(v) === v && v >= ps[i + 1] && v <= ps[i + 2]) this[p] = v;
            else throw Error(invalidArgument + p + ': ' + v);
          }
        }

        if (p = 'crypto', useDefaults) this[p] = DEFAULTS[p];
        if ((v = obj[p]) !== void 0) {
          if (v === true || v === false || v === 0 || v === 1) {
            if (v) {
              if (typeof crypto != 'undefined' && crypto &&
                (crypto.getRandomValues || crypto.randomBytes)) {
                this[p] = true;
              } else {
                throw Error(cryptoUnavailable);
              }
            } else {
              this[p] = false;
            }
          } else {
            throw Error(invalidArgument + p + ': ' + v);
          }
        }

        return this;
      }


      /*
       * Return a new Decimal whose value is the cosine of `x`, rounded to `precision` significant
       * digits using rounding mode `rounding`.
       *
       * x {number|string|Decimal} A value in radians.
       *
       */
      function cos(x) {
        return new this(x).cos();
      }


      /*
       * Return a new Decimal whose value is the hyperbolic cosine of `x`, rounded to precision
       * significant digits using rounding mode `rounding`.
       *
       * x {number|string|Decimal} A value in radians.
       *
       */
      function cosh(x) {
        return new this(x).cosh();
      }


      /*
       * Create and return a Decimal constructor with the same configuration properties as this Decimal
       * constructor.
       *
       */
      function clone(obj) {
        var i, p, ps;

        /*
         * The Decimal constructor and exported function.
         * Return a new Decimal instance.
         *
         * v {number|string|Decimal} A numeric value.
         *
         */
        function Decimal(v) {
          var e, i, t,
            x = this;

          // Decimal called without new.
          if (!(x instanceof Decimal)) return new Decimal(v);

          // Retain a reference to this Decimal constructor, and shadow Decimal.prototype.constructor
          // which points to Object.
          x.constructor = Decimal;

          // Duplicate.
          if (v instanceof Decimal) {
            x.s = v.s;

            if (external) {
              if (!v.d || v.e > Decimal.maxE) {

                // Infinity.
                x.e = NaN;
                x.d = null;
              } else if (v.e < Decimal.minE) {

                // Zero.
                x.e = 0;
                x.d = [0];
              } else {
                x.e = v.e;
                x.d = v.d.slice();
              }
            } else {
              x.e = v.e;
              x.d = v.d ? v.d.slice() : v.d;
            }

            return;
          }

          t = typeof v;

          if (t === 'number') {
            if (v === 0) {
              x.s = 1 / v < 0 ? -1 : 1;
              x.e = 0;
              x.d = [0];
              return;
            }

            if (v < 0) {
              v = -v;
              x.s = -1;
            } else {
              x.s = 1;
            }

            // Fast path for small integers.
            if (v === ~~v && v < 1e7) {
              for (e = 0, i = v; i >= 10; i /= 10) e++;

              if (external) {
                if (e > Decimal.maxE) {
                  x.e = NaN;
                  x.d = null;
                } else if (e < Decimal.minE) {
                  x.e = 0;
                  x.d = [0];
                } else {
                  x.e = e;
                  x.d = [v];
                }
              } else {
                x.e = e;
                x.d = [v];
              }

              return;

            // Infinity, NaN.
            } else if (v * 0 !== 0) {
              if (!v) x.s = NaN;
              x.e = NaN;
              x.d = null;
              return;
            }

            return parseDecimal(x, v.toString());

          } else if (t !== 'string') {
            throw Error(invalidArgument + v);
          }

          // Minus sign?
          if ((i = v.charCodeAt(0)) === 45) {
            v = v.slice(1);
            x.s = -1;
          } else {
            // Plus sign?
            if (i === 43) v = v.slice(1);
            x.s = 1;
          }

          return isDecimal.test(v) ? parseDecimal(x, v) : parseOther(x, v);
        }

        Decimal.prototype = P;

        Decimal.ROUND_UP = 0;
        Decimal.ROUND_DOWN = 1;
        Decimal.ROUND_CEIL = 2;
        Decimal.ROUND_FLOOR = 3;
        Decimal.ROUND_HALF_UP = 4;
        Decimal.ROUND_HALF_DOWN = 5;
        Decimal.ROUND_HALF_EVEN = 6;
        Decimal.ROUND_HALF_CEIL = 7;
        Decimal.ROUND_HALF_FLOOR = 8;
        Decimal.EUCLID = 9;

        Decimal.config = Decimal.set = config;
        Decimal.clone = clone;
        Decimal.isDecimal = isDecimalInstance;

        Decimal.abs = abs;
        Decimal.acos = acos;
        Decimal.acosh = acosh;        // ES6
        Decimal.add = add;
        Decimal.asin = asin;
        Decimal.asinh = asinh;        // ES6
        Decimal.atan = atan;
        Decimal.atanh = atanh;        // ES6
        Decimal.atan2 = atan2;
        Decimal.cbrt = cbrt;          // ES6
        Decimal.ceil = ceil;
        Decimal.cos = cos;
        Decimal.cosh = cosh;          // ES6
        Decimal.div = div;
        Decimal.exp = exp;
        Decimal.floor = floor;
        Decimal.hypot = hypot;        // ES6
        Decimal.ln = ln;
        Decimal.log = log;
        Decimal.log10 = log10;        // ES6
        Decimal.log2 = log2;          // ES6
        Decimal.max = max;
        Decimal.min = min;
        Decimal.mod = mod;
        Decimal.mul = mul;
        Decimal.pow = pow;
        Decimal.random = random;
        Decimal.round = round;
        Decimal.sign = sign;          // ES6
        Decimal.sin = sin;
        Decimal.sinh = sinh;          // ES6
        Decimal.sqrt = sqrt;
        Decimal.sub = sub;
        Decimal.tan = tan;
        Decimal.tanh = tanh;          // ES6
        Decimal.trunc = trunc;        // ES6

        if (obj === void 0) obj = {};
        if (obj) {
          if (obj.defaults !== true) {
            ps = ['precision', 'rounding', 'toExpNeg', 'toExpPos', 'maxE', 'minE', 'modulo', 'crypto'];
            for (i = 0; i < ps.length;) if (!obj.hasOwnProperty(p = ps[i++])) obj[p] = this[p];
          }
        }

        Decimal.config(obj);

        return Decimal;
      }


      /*
       * Return a new Decimal whose value is `x` divided by `y`, rounded to `precision` significant
       * digits using rounding mode `rounding`.
       *
       * x {number|string|Decimal}
       * y {number|string|Decimal}
       *
       */
      function div(x, y) {
        return new this(x).div(y);
      }


      /*
       * Return a new Decimal whose value is the natural exponential of `x`, rounded to `precision`
       * significant digits using rounding mode `rounding`.
       *
       * x {number|string|Decimal} The power to which to raise the base of the natural log.
       *
       */
      function exp(x) {
        return new this(x).exp();
      }


      /*
       * Return a new Decimal whose value is `x` round to an integer using `ROUND_FLOOR`.
       *
       * x {number|string|Decimal}
       *
       */
      function floor(x) {
        return finalise(x = new this(x), x.e + 1, 3);
      }


      /*
       * Return a new Decimal whose value is the square root of the sum of the squares of the arguments,
       * rounded to `precision` significant digits using rounding mode `rounding`.
       *
       * hypot(a, b, ...) = sqrt(a^2 + b^2 + ...)
       *
       * arguments {number|string|Decimal}
       *
       */
      function hypot() {
        var i, n,
          t = new this(0);

        external = false;

        for (i = 0; i < arguments.length;) {
          n = new this(arguments[i++]);
          if (!n.d) {
            if (n.s) {
              external = true;
              return new this(1 / 0);
            }
            t = n;
          } else if (t.d) {
            t = t.plus(n.times(n));
          }
        }

        external = true;

        return t.sqrt();
      }


      /*
       * Return true if object is a Decimal instance (where Decimal is any Decimal constructor),
       * otherwise return false.
       *
       */
      function isDecimalInstance(obj) {
        return obj instanceof Decimal || obj && obj.name === '[object Decimal]' || false;
      }


      /*
       * Return a new Decimal whose value is the natural logarithm of `x`, rounded to `precision`
       * significant digits using rounding mode `rounding`.
       *
       * x {number|string|Decimal}
       *
       */
      function ln(x) {
        return new this(x).ln();
      }


      /*
       * Return a new Decimal whose value is the log of `x` to the base `y`, or to base 10 if no base
       * is specified, rounded to `precision` significant digits using rounding mode `rounding`.
       *
       * log[y](x)
       *
       * x {number|string|Decimal} The argument of the logarithm.
       * y {number|string|Decimal} The base of the logarithm.
       *
       */
      function log(x, y) {
        return new this(x).log(y);
      }


      /*
       * Return a new Decimal whose value is the base 2 logarithm of `x`, rounded to `precision`
       * significant digits using rounding mode `rounding`.
       *
       * x {number|string|Decimal}
       *
       */
      function log2(x) {
        return new this(x).log(2);
      }


      /*
       * Return a new Decimal whose value is the base 10 logarithm of `x`, rounded to `precision`
       * significant digits using rounding mode `rounding`.
       *
       * x {number|string|Decimal}
       *
       */
      function log10(x) {
        return new this(x).log(10);
      }


      /*
       * Return a new Decimal whose value is the maximum of the arguments.
       *
       * arguments {number|string|Decimal}
       *
       */
      function max() {
        return maxOrMin(this, arguments, 'lt');
      }


      /*
       * Return a new Decimal whose value is the minimum of the arguments.
       *
       * arguments {number|string|Decimal}
       *
       */
      function min() {
        return maxOrMin(this, arguments, 'gt');
      }


      /*
       * Return a new Decimal whose value is `x` modulo `y`, rounded to `precision` significant digits
       * using rounding mode `rounding`.
       *
       * x {number|string|Decimal}
       * y {number|string|Decimal}
       *
       */
      function mod(x, y) {
        return new this(x).mod(y);
      }


      /*
       * Return a new Decimal whose value is `x` multiplied by `y`, rounded to `precision` significant
       * digits using rounding mode `rounding`.
       *
       * x {number|string|Decimal}
       * y {number|string|Decimal}
       *
       */
      function mul(x, y) {
        return new this(x).mul(y);
      }


      /*
       * Return a new Decimal whose value is `x` raised to the power `y`, rounded to precision
       * significant digits using rounding mode `rounding`.
       *
       * x {number|string|Decimal} The base.
       * y {number|string|Decimal} The exponent.
       *
       */
      function pow(x, y) {
        return new this(x).pow(y);
      }


      /*
       * Returns a new Decimal with a random value equal to or greater than 0 and less than 1, and with
       * `sd`, or `Decimal.precision` if `sd` is omitted, significant digits (or less if trailing zeros
       * are produced).
       *
       * [sd] {number} Significant digits. Integer, 0 to MAX_DIGITS inclusive.
       *
       */
      function random(sd) {
        var d, e, k, n,
          i = 0,
          r = new this(1),
          rd = [];

        if (sd === void 0) sd = this.precision;
        else checkInt32(sd, 1, MAX_DIGITS);

        k = Math.ceil(sd / LOG_BASE);

        if (!this.crypto) {
          for (; i < k;) rd[i++] = Math.random() * 1e7 | 0;

        // Browsers supporting crypto.getRandomValues.
        } else if (crypto.getRandomValues) {
          d = crypto.getRandomValues(new Uint32Array(k));

          for (; i < k;) {
            n = d[i];

            // 0 <= n < 4294967296
            // Probability n >= 4.29e9, is 4967296 / 4294967296 = 0.00116 (1 in 865).
            if (n >= 4.29e9) {
              d[i] = crypto.getRandomValues(new Uint32Array(1))[0];
            } else {

              // 0 <= n <= 4289999999
              // 0 <= (n % 1e7) <= 9999999
              rd[i++] = n % 1e7;
            }
          }

        // Node.js supporting crypto.randomBytes.
        } else if (crypto.randomBytes) {

          // buffer
          d = crypto.randomBytes(k *= 4);

          for (; i < k;) {

            // 0 <= n < 2147483648
            n = d[i] + (d[i + 1] << 8) + (d[i + 2] << 16) + ((d[i + 3] & 0x7f) << 24);

            // Probability n >= 2.14e9, is 7483648 / 2147483648 = 0.0035 (1 in 286).
            if (n >= 2.14e9) {
              crypto.randomBytes(4).copy(d, i);
            } else {

              // 0 <= n <= 2139999999
              // 0 <= (n % 1e7) <= 9999999
              rd.push(n % 1e7);
              i += 4;
            }
          }

          i = k / 4;
        } else {
          throw Error(cryptoUnavailable);
        }

        k = rd[--i];
        sd %= LOG_BASE;

        // Convert trailing digits to zeros according to sd.
        if (k && sd) {
          n = mathpow(10, LOG_BASE - sd);
          rd[i] = (k / n | 0) * n;
        }

        // Remove trailing words which are zero.
        for (; rd[i] === 0; i--) rd.pop();

        // Zero?
        if (i < 0) {
          e = 0;
          rd = [0];
        } else {
          e = -1;

          // Remove leading words which are zero and adjust exponent accordingly.
          for (; rd[0] === 0; e -= LOG_BASE) rd.shift();

          // Count the digits of the first word of rd to determine leading zeros.
          for (k = 1, n = rd[0]; n >= 10; n /= 10) k++;

          // Adjust the exponent for leading zeros of the first word of rd.
          if (k < LOG_BASE) e -= LOG_BASE - k;
        }

        r.e = e;
        r.d = rd;

        return r;
      }


      /*
       * Return a new Decimal whose value is `x` rounded to an integer using rounding mode `rounding`.
       *
       * To emulate `Math.round`, set rounding to 7 (ROUND_HALF_CEIL).
       *
       * x {number|string|Decimal}
       *
       */
      function round(x) {
        return finalise(x = new this(x), x.e + 1, this.rounding);
      }


      /*
       * Return
       *   1    if x > 0,
       *  -1    if x < 0,
       *   0    if x is 0,
       *  -0    if x is -0,
       *   NaN  otherwise
       *
       * x {number|string|Decimal}
       *
       */
      function sign(x) {
        x = new this(x);
        return x.d ? (x.d[0] ? x.s : 0 * x.s) : x.s || NaN;
      }


      /*
       * Return a new Decimal whose value is the sine of `x`, rounded to `precision` significant digits
       * using rounding mode `rounding`.
       *
       * x {number|string|Decimal} A value in radians.
       *
       */
      function sin(x) {
        return new this(x).sin();
      }


      /*
       * Return a new Decimal whose value is the hyperbolic sine of `x`, rounded to `precision`
       * significant digits using rounding mode `rounding`.
       *
       * x {number|string|Decimal} A value in radians.
       *
       */
      function sinh(x) {
        return new this(x).sinh();
      }


      /*
       * Return a new Decimal whose value is the square root of `x`, rounded to `precision` significant
       * digits using rounding mode `rounding`.
       *
       * x {number|string|Decimal}
       *
       */
      function sqrt(x) {
        return new this(x).sqrt();
      }


      /*
       * Return a new Decimal whose value is `x` minus `y`, rounded to `precision` significant digits
       * using rounding mode `rounding`.
       *
       * x {number|string|Decimal}
       * y {number|string|Decimal}
       *
       */
      function sub(x, y) {
        return new this(x).sub(y);
      }


      /*
       * Return a new Decimal whose value is the tangent of `x`, rounded to `precision` significant
       * digits using rounding mode `rounding`.
       *
       * x {number|string|Decimal} A value in radians.
       *
       */
      function tan(x) {
        return new this(x).tan();
      }


      /*
       * Return a new Decimal whose value is the hyperbolic tangent of `x`, rounded to `precision`
       * significant digits using rounding mode `rounding`.
       *
       * x {number|string|Decimal} A value in radians.
       *
       */
      function tanh(x) {
        return new this(x).tanh();
      }


      /*
       * Return a new Decimal whose value is `x` truncated to an integer.
       *
       * x {number|string|Decimal}
       *
       */
      function trunc(x) {
        return finalise(x = new this(x), x.e + 1, 1);
      }


      // Create and configure initial Decimal constructor.
      Decimal = clone(DEFAULTS);

      Decimal['default'] = Decimal.Decimal = Decimal;

      // Create the internal constants from their string values.
      LN10 = new Decimal(LN10);
      PI = new Decimal(PI);


      // Export.


      // AMD.
      if ( module.exports) {
        if (typeof Symbol == 'function' && typeof Symbol.iterator == 'symbol') {
          P[Symbol.for('nodejs.util.inspect.custom')] = P.toString;
          P[Symbol.toStringTag] = 'Decimal';
        }

        module.exports = Decimal;

      // Browser.
      } else {
        if (!globalScope) {
          globalScope = typeof self != 'undefined' && self && self.self == self ? self : window;
        }

        noConflict = globalScope.Decimal;
        Decimal.noConflict = function () {
          globalScope.Decimal = noConflict;
          return Decimal;
        };

        globalScope.Decimal = Decimal;
      }
    })(commonjsGlobal);
    });

    var name$1 = 'BigNumber';
    var dependencies$1 = ['?on', 'config'];
    var createBigNumberClass = /* #__PURE__ */factory$2(name$1, dependencies$1, function (_ref) {
      var on = _ref.on,
          config = _ref.config;
      var BigNumber = decimal.clone({
        precision: config.precision
      });
      /**
       * Attach type information
       */

      BigNumber.prototype.type = 'BigNumber';
      BigNumber.prototype.isBigNumber = true;
      /**
       * Get a JSON representation of a BigNumber containing
       * type information
       * @returns {Object} Returns a JSON object structured as:
       *                   `{"mathjs": "BigNumber", "value": "0.2"}`
       */

      BigNumber.prototype.toJSON = function () {
        return {
          mathjs: 'BigNumber',
          value: this.toString()
        };
      };
      /**
       * Instantiate a BigNumber from a JSON object
       * @param {Object} json  a JSON object structured as:
       *                       `{"mathjs": "BigNumber", "value": "0.2"}`
       * @return {BigNumber}
       */


      BigNumber.fromJSON = function (json) {
        return new BigNumber(json.value);
      };

      if (on) {
        // listen for changed in the configuration, automatically apply changed precision
        on('config', function (curr, prev) {
          if (curr.precision !== prev.precision) {
            BigNumber.config({
              precision: curr.precision
            });
          }
        });
      }

      return BigNumber;
    }, {
      isClass: true
    });

    var complex = createCommonjsModule(function (module, exports) {
    /**
     * @license Complex.js v2.0.11 11/02/2016
     *
     * Copyright (c) 2016, Robert Eisele (robert@xarg.org)
     * Dual licensed under the MIT or GPL Version 2 licenses.
     **/

    /**
     *
     * This class allows the manipulation of complex numbers.
     * You can pass a complex number in different formats. Either as object, double, string or two integer parameters.
     *
     * Object form
     * { re: <real>, im: <imaginary> }
     * { arg: <angle>, abs: <radius> }
     * { phi: <angle>, r: <radius> }
     *
     * Array / Vector form
     * [ real, imaginary ]
     *
     * Double form
     * 99.3 - Single double value
     *
     * String form
     * '23.1337' - Simple real number
     * '15+3i' - a simple complex number
     * '3-i' - a simple complex number
     *
     * Example:
     *
     * var c = new Complex('99.3+8i');
     * c.mul({r: 3, i: 9}).div(4.9).sub(3, 2);
     *
     */

    (function(root) {

      var cosh = function(x) {
        return (Math.exp(x) + Math.exp(-x)) * 0.5;
      };

      var sinh = function(x) {
        return (Math.exp(x) - Math.exp(-x)) * 0.5;
      };

      /**
       * Calculates cos(x) - 1 using Taylor series if x is small.
       *
       * @param {number} x
       * @returns {number} cos(x) - 1
       */

      var cosm1 = function(x) {
        var limit = Math.PI/4;
        if (x < -limit || x > limit) {
          return (Math.cos(x) - 1.0);
        }

        var xx = x * x;
        return xx *
          (-0.5 + xx *
            (1/24 + xx *
              (-1/720 + xx *
                (1/40320 + xx *
                  (-1/3628800 + xx *
                    (1/4790014600 + xx *
                      (-1/87178291200 + xx *
                        (1/20922789888000)
                      )
                    )
                  )
                )
              )
            )
          )
      };

      var hypot = function(x, y) {

        var a = Math.abs(x);
        var b = Math.abs(y);

        if (a < 3000 && b < 3000) {
          return Math.sqrt(a * a + b * b);
        }

        if (a < b) {
          a = b;
          b = x / y;
        } else {
          b = y / x;
        }
        return a * Math.sqrt(1 + b * b);
      };

      var parser_exit = function() {
        throw SyntaxError('Invalid Param');
      };

      /**
       * Calculates log(sqrt(a^2+b^2)) in a way to avoid overflows
       *
       * @param {number} a
       * @param {number} b
       * @returns {number}
       */
      function logHypot(a, b) {

        var _a = Math.abs(a);
        var _b = Math.abs(b);

        if (a === 0) {
          return Math.log(_b);
        }

        if (b === 0) {
          return Math.log(_a);
        }

        if (_a < 3000 && _b < 3000) {
          return Math.log(a * a + b * b) * 0.5;
        }

        /* I got 4 ideas to compute this property without overflow:
         *
         * Testing 1000000 times with random samples for a,b ∈ [1, 1000000000] against a big decimal library to get an error estimate
         *
         * 1. Only eliminate the square root: (OVERALL ERROR: 3.9122483030951116e-11)

         Math.log(a * a + b * b) / 2

         *
         *
         * 2. Try to use the non-overflowing pythagoras: (OVERALL ERROR: 8.889760039210159e-10)

         var fn = function(a, b) {
         a = Math.abs(a);
         b = Math.abs(b);
         var t = Math.min(a, b);
         a = Math.max(a, b);
         t = t / a;

         return Math.log(a) + Math.log(1 + t * t) / 2;
         };

         * 3. Abuse the identity cos(atan(y/x) = x / sqrt(x^2+y^2): (OVERALL ERROR: 3.4780178737037204e-10)

         Math.log(a / Math.cos(Math.atan2(b, a)))

         * 4. Use 3. and apply log rules: (OVERALL ERROR: 1.2014087502620896e-9)

         Math.log(a) - Math.log(Math.cos(Math.atan2(b, a)))

         */

        return Math.log(a / Math.cos(Math.atan2(b, a)));
      }

      var parse = function(a, b) {

        var z = {'re': 0, 'im': 0};

        if (a === undefined || a === null) {
          z['re'] =
                  z['im'] = 0;
        } else if (b !== undefined) {
          z['re'] = a;
          z['im'] = b;
        } else
          switch (typeof a) {

            case 'object':

              if ('im' in a && 're' in a) {
                z['re'] = a['re'];
                z['im'] = a['im'];
              } else if ('abs' in a && 'arg' in a) {
                if (!Number.isFinite(a['abs']) && Number.isFinite(a['arg'])) {
                  return Complex['INFINITY'];
                }
                z['re'] = a['abs'] * Math.cos(a['arg']);
                z['im'] = a['abs'] * Math.sin(a['arg']);
              } else if ('r' in a && 'phi' in a) {
                if (!Number.isFinite(a['r']) && Number.isFinite(a['phi'])) {
                  return Complex['INFINITY'];
                }
                z['re'] = a['r'] * Math.cos(a['phi']);
                z['im'] = a['r'] * Math.sin(a['phi']);
              } else if (a.length === 2) { // Quick array check
                z['re'] = a[0];
                z['im'] = a[1];
              } else {
                parser_exit();
              }
              break;

            case 'string':

              z['im'] = /* void */
                      z['re'] = 0;

              var tokens = a.match(/\d+\.?\d*e[+-]?\d+|\d+\.?\d*|\.\d+|./g);
              var plus = 1;
              var minus = 0;

              if (tokens === null) {
                parser_exit();
              }

              for (var i = 0; i < tokens.length; i++) {

                var c = tokens[i];

                if (c === ' ' || c === '\t' || c === '\n') ; else if (c === '+') {
                  plus++;
                } else if (c === '-') {
                  minus++;
                } else if (c === 'i' || c === 'I') {

                  if (plus + minus === 0) {
                    parser_exit();
                  }

                  if (tokens[i + 1] !== ' ' && !isNaN(tokens[i + 1])) {
                    z['im'] += parseFloat((minus % 2 ? '-' : '') + tokens[i + 1]);
                    i++;
                  } else {
                    z['im'] += parseFloat((minus % 2 ? '-' : '') + '1');
                  }
                  plus = minus = 0;

                } else {

                  if (plus + minus === 0 || isNaN(c)) {
                    parser_exit();
                  }

                  if (tokens[i + 1] === 'i' || tokens[i + 1] === 'I') {
                    z['im'] += parseFloat((minus % 2 ? '-' : '') + c);
                    i++;
                  } else {
                    z['re'] += parseFloat((minus % 2 ? '-' : '') + c);
                  }
                  plus = minus = 0;
                }
              }

              // Still something on the stack
              if (plus + minus > 0) {
                parser_exit();
              }
              break;

            case 'number':
              z['im'] = 0;
              z['re'] = a;
              break;

            default:
              parser_exit();
          }

        return z;
      };

      /**
       * @constructor
       * @returns {Complex}
       */
      function Complex(a, b) {

        if (!(this instanceof Complex)) {
          return new Complex(a, b);
        }

        var z = parse(a, b);

        this['re'] = z['re'];
        this['im'] = z['im'];
      }

      Complex.prototype = {

        're': 0,
        'im': 0,

        /**
         * Calculates the sign of a complex number, which is a normalized complex
         *
         * @returns {Complex}
         */
        'sign': function() {

          var abs = this['abs']();

          return new Complex(
                  this['re'] / abs,
                  this['im'] / abs);
        },

        /**
         * Adds two complex numbers
         *
         * @returns {Complex}
         */
        'add': function(a, b) {

          var z = new Complex(a, b);

          // Infinity + Infinity = NaN
          if (this['isInfinite']() && z['isInfinite']()) {
            return Complex['NAN'];
          }

          // Infinity + z = Infinity { where z != Infinity }
          if (this['isInfinite']() || z['isInfinite']()) {
            return Complex['INFINITY'];
          }

          return new Complex(
                  this['re'] + z['re'],
                  this['im'] + z['im']);
        },

        /**
         * Subtracts two complex numbers
         *
         * @returns {Complex}
         */
        'sub': function(a, b) {

          var z = new Complex(a, b);

          // Infinity - Infinity = NaN
          if (this['isInfinite']() && z['isInfinite']()) {
            return Complex['NAN'];
          }

          // Infinity - z = Infinity { where z != Infinity }
          if (this['isInfinite']() || z['isInfinite']()) {
            return Complex['INFINITY'];
          }

          return new Complex(
                  this['re'] - z['re'],
                  this['im'] - z['im']);
        },

        /**
         * Multiplies two complex numbers
         *
         * @returns {Complex}
         */
        'mul': function(a, b) {

          var z = new Complex(a, b);

          // Infinity * 0 = NaN
          if ((this['isInfinite']() && z['isZero']()) || (this['isZero']() && z['isInfinite']())) {
            return Complex['NAN'];
          }

          // Infinity * z = Infinity { where z != 0 }
          if (this['isInfinite']() || z['isInfinite']()) {
            return Complex['INFINITY'];
          }

          // Short circuit for real values
          if (z['im'] === 0 && this['im'] === 0) {
            return new Complex(this['re'] * z['re'], 0);
          }

          return new Complex(
                  this['re'] * z['re'] - this['im'] * z['im'],
                  this['re'] * z['im'] + this['im'] * z['re']);
        },

        /**
         * Divides two complex numbers
         *
         * @returns {Complex}
         */
        'div': function(a, b) {

          var z = new Complex(a, b);

          // 0 / 0 = NaN and Infinity / Infinity = NaN
          if ((this['isZero']() && z['isZero']()) || (this['isInfinite']() && z['isInfinite']())) {
            return Complex['NAN'];
          }

          // Infinity / 0 = Infinity
          if (this['isInfinite']() || z['isZero']()) {
            return Complex['INFINITY'];
          }

          // 0 / Infinity = 0
          if (this['isZero']() || z['isInfinite']()) {
            return Complex['ZERO'];
          }

          a = this['re'];
          b = this['im'];

          var c = z['re'];
          var d = z['im'];
          var t, x;

          if (0 === d) {
            // Divisor is real
            return new Complex(a / c, b / c);
          }

          if (Math.abs(c) < Math.abs(d)) {

            x = c / d;
            t = c * x + d;

            return new Complex(
                    (a * x + b) / t,
                    (b * x - a) / t);

          } else {

            x = d / c;
            t = d * x + c;

            return new Complex(
                    (a + b * x) / t,
                    (b - a * x) / t);
          }
        },

        /**
         * Calculate the power of two complex numbers
         *
         * @returns {Complex}
         */
        'pow': function(a, b) {

          var z = new Complex(a, b);

          a = this['re'];
          b = this['im'];

          if (z['isZero']()) {
            return Complex['ONE'];
          }

          // If the exponent is real
          if (z['im'] === 0) {

            if (b === 0 && a >= 0) {

              return new Complex(Math.pow(a, z['re']), 0);

            } else if (a === 0) { // If base is fully imaginary

              switch ((z['re'] % 4 + 4) % 4) {
                case 0:
                  return new Complex(Math.pow(b, z['re']), 0);
                case 1:
                  return new Complex(0, Math.pow(b, z['re']));
                case 2:
                  return new Complex(-Math.pow(b, z['re']), 0);
                case 3:
                  return new Complex(0, -Math.pow(b, z['re']));
              }
            }
          }

          /* I couldn't find a good formula, so here is a derivation and optimization
           *
           * z_1^z_2 = (a + bi)^(c + di)
           *         = exp((c + di) * log(a + bi)
           *         = pow(a^2 + b^2, (c + di) / 2) * exp(i(c + di)atan2(b, a))
           * =>...
           * Re = (pow(a^2 + b^2, c / 2) * exp(-d * atan2(b, a))) * cos(d * log(a^2 + b^2) / 2 + c * atan2(b, a))
           * Im = (pow(a^2 + b^2, c / 2) * exp(-d * atan2(b, a))) * sin(d * log(a^2 + b^2) / 2 + c * atan2(b, a))
           *
           * =>...
           * Re = exp(c * log(sqrt(a^2 + b^2)) - d * atan2(b, a)) * cos(d * log(sqrt(a^2 + b^2)) + c * atan2(b, a))
           * Im = exp(c * log(sqrt(a^2 + b^2)) - d * atan2(b, a)) * sin(d * log(sqrt(a^2 + b^2)) + c * atan2(b, a))
           *
           * =>
           * Re = exp(c * logsq2 - d * arg(z_1)) * cos(d * logsq2 + c * arg(z_1))
           * Im = exp(c * logsq2 - d * arg(z_1)) * sin(d * logsq2 + c * arg(z_1))
           *
           */

          if (a === 0 && b === 0 && z['re'] > 0 && z['im'] >= 0) {
            return Complex['ZERO'];
          }

          var arg = Math.atan2(b, a);
          var loh = logHypot(a, b);

          a = Math.exp(z['re'] * loh - z['im'] * arg);
          b = z['im'] * loh + z['re'] * arg;
          return new Complex(
                  a * Math.cos(b),
                  a * Math.sin(b));
        },

        /**
         * Calculate the complex square root
         *
         * @returns {Complex}
         */
        'sqrt': function() {

          var a = this['re'];
          var b = this['im'];
          var r = this['abs']();

          var re, im;

          if (a >= 0) {

            if (b === 0) {
              return new Complex(Math.sqrt(a), 0);
            }

            re = 0.5 * Math.sqrt(2.0 * (r + a));
          } else {
            re = Math.abs(b) / Math.sqrt(2 * (r - a));
          }

          if (a <= 0) {
            im = 0.5 * Math.sqrt(2.0 * (r - a));
          } else {
            im = Math.abs(b) / Math.sqrt(2 * (r + a));
          }

          return new Complex(re, b < 0 ? -im : im);
        },

        /**
         * Calculate the complex exponent
         *
         * @returns {Complex}
         */
        'exp': function() {

          var tmp = Math.exp(this['re']);

          if (this['im'] === 0) ;
          return new Complex(
                  tmp * Math.cos(this['im']),
                  tmp * Math.sin(this['im']));
        },

        /**
         * Calculate the complex exponent and subtracts one.
         *
         * This may be more accurate than `Complex(x).exp().sub(1)` if
         * `x` is small.
         *
         * @returns {Complex}
         */
        'expm1': function() {

          /**
           * exp(a + i*b) - 1
           = exp(a) * (cos(b) + j*sin(b)) - 1
           = expm1(a)*cos(b) + cosm1(b) + j*exp(a)*sin(b)
           */

          var a = this['re'];
          var b = this['im'];

          return new Complex(
                  Math.expm1(a) * Math.cos(b) + cosm1(b),
                  Math.exp(a) * Math.sin(b));
        },

        /**
         * Calculate the natural log
         *
         * @returns {Complex}
         */
        'log': function() {

          var a = this['re'];
          var b = this['im'];

          return new Complex(
                  logHypot(a, b),
                  Math.atan2(b, a));
        },

        /**
         * Calculate the magnitude of the complex number
         *
         * @returns {number}
         */
        'abs': function() {

          return hypot(this['re'], this['im']);
        },

        /**
         * Calculate the angle of the complex number
         *
         * @returns {number}
         */
        'arg': function() {

          return Math.atan2(this['im'], this['re']);
        },

        /**
         * Calculate the sine of the complex number
         *
         * @returns {Complex}
         */
        'sin': function() {

          // sin(c) = (e^b - e^(-b)) / (2i)

          var a = this['re'];
          var b = this['im'];

          return new Complex(
                  Math.sin(a) * cosh(b),
                  Math.cos(a) * sinh(b));
        },

        /**
         * Calculate the cosine
         *
         * @returns {Complex}
         */
        'cos': function() {

          // cos(z) = (e^b + e^(-b)) / 2

          var a = this['re'];
          var b = this['im'];

          return new Complex(
                  Math.cos(a) * cosh(b),
                  -Math.sin(a) * sinh(b));
        },

        /**
         * Calculate the tangent
         *
         * @returns {Complex}
         */
        'tan': function() {

          // tan(c) = (e^(ci) - e^(-ci)) / (i(e^(ci) + e^(-ci)))

          var a = 2 * this['re'];
          var b = 2 * this['im'];
          var d = Math.cos(a) + cosh(b);

          return new Complex(
                  Math.sin(a) / d,
                  sinh(b) / d);
        },

        /**
         * Calculate the cotangent
         *
         * @returns {Complex}
         */
        'cot': function() {

          // cot(c) = i(e^(ci) + e^(-ci)) / (e^(ci) - e^(-ci))

          var a = 2 * this['re'];
          var b = 2 * this['im'];
          var d = Math.cos(a) - cosh(b);

          return new Complex(
                  -Math.sin(a) / d,
                  sinh(b) / d);
        },

        /**
         * Calculate the secant
         *
         * @returns {Complex}
         */
        'sec': function() {

          // sec(c) = 2 / (e^(ci) + e^(-ci))

          var a = this['re'];
          var b = this['im'];
          var d = 0.5 * cosh(2 * b) + 0.5 * Math.cos(2 * a);

          return new Complex(
                  Math.cos(a) * cosh(b) / d,
                  Math.sin(a) * sinh(b) / d);
        },

        /**
         * Calculate the cosecans
         *
         * @returns {Complex}
         */
        'csc': function() {

          // csc(c) = 2i / (e^(ci) - e^(-ci))

          var a = this['re'];
          var b = this['im'];
          var d = 0.5 * cosh(2 * b) - 0.5 * Math.cos(2 * a);

          return new Complex(
                  Math.sin(a) * cosh(b) / d,
                  -Math.cos(a) * sinh(b) / d);
        },

        /**
         * Calculate the complex arcus sinus
         *
         * @returns {Complex}
         */
        'asin': function() {

          // asin(c) = -i * log(ci + sqrt(1 - c^2))

          var a = this['re'];
          var b = this['im'];

          var t1 = new Complex(
                  b * b - a * a + 1,
                  -2 * a * b)['sqrt']();

          var t2 = new Complex(
                  t1['re'] - b,
                  t1['im'] + a)['log']();

          return new Complex(t2['im'], -t2['re']);
        },

        /**
         * Calculate the complex arcus cosinus
         *
         * @returns {Complex}
         */
        'acos': function() {

          // acos(c) = i * log(c - i * sqrt(1 - c^2))

          var a = this['re'];
          var b = this['im'];

          var t1 = new Complex(
                  b * b - a * a + 1,
                  -2 * a * b)['sqrt']();

          var t2 = new Complex(
                  t1['re'] - b,
                  t1['im'] + a)['log']();

          return new Complex(Math.PI / 2 - t2['im'], t2['re']);
        },

        /**
         * Calculate the complex arcus tangent
         *
         * @returns {Complex}
         */
        'atan': function() {

          // atan(c) = i / 2 log((i + x) / (i - x))

          var a = this['re'];
          var b = this['im'];

          if (a === 0) {

            if (b === 1) {
              return new Complex(0, Infinity);
            }

            if (b === -1) {
              return new Complex(0, -Infinity);
            }
          }

          var d = a * a + (1.0 - b) * (1.0 - b);

          var t1 = new Complex(
                  (1 - b * b - a * a) / d,
                  -2 * a / d).log();

          return new Complex(-0.5 * t1['im'], 0.5 * t1['re']);
        },

        /**
         * Calculate the complex arcus cotangent
         *
         * @returns {Complex}
         */
        'acot': function() {

          // acot(c) = i / 2 log((c - i) / (c + i))

          var a = this['re'];
          var b = this['im'];

          if (b === 0) {
            return new Complex(Math.atan2(1, a), 0);
          }

          var d = a * a + b * b;
          return (d !== 0)
                  ? new Complex(
                          a / d,
                          -b / d).atan()
                  : new Complex(
                          (a !== 0) ? a / 0 : 0,
                          (b !== 0) ? -b / 0 : 0).atan();
        },

        /**
         * Calculate the complex arcus secant
         *
         * @returns {Complex}
         */
        'asec': function() {

          // asec(c) = -i * log(1 / c + sqrt(1 - i / c^2))

          var a = this['re'];
          var b = this['im'];

          if (a === 0 && b === 0) {
            return new Complex(0, Infinity);
          }

          var d = a * a + b * b;
          return (d !== 0)
                  ? new Complex(
                          a / d,
                          -b / d).acos()
                  : new Complex(
                          (a !== 0) ? a / 0 : 0,
                          (b !== 0) ? -b / 0 : 0).acos();
        },

        /**
         * Calculate the complex arcus cosecans
         *
         * @returns {Complex}
         */
        'acsc': function() {

          // acsc(c) = -i * log(i / c + sqrt(1 - 1 / c^2))

          var a = this['re'];
          var b = this['im'];

          if (a === 0 && b === 0) {
            return new Complex(Math.PI / 2, Infinity);
          }

          var d = a * a + b * b;
          return (d !== 0)
                  ? new Complex(
                          a / d,
                          -b / d).asin()
                  : new Complex(
                          (a !== 0) ? a / 0 : 0,
                          (b !== 0) ? -b / 0 : 0).asin();
        },

        /**
         * Calculate the complex sinh
         *
         * @returns {Complex}
         */
        'sinh': function() {

          // sinh(c) = (e^c - e^-c) / 2

          var a = this['re'];
          var b = this['im'];

          return new Complex(
                  sinh(a) * Math.cos(b),
                  cosh(a) * Math.sin(b));
        },

        /**
         * Calculate the complex cosh
         *
         * @returns {Complex}
         */
        'cosh': function() {

          // cosh(c) = (e^c + e^-c) / 2

          var a = this['re'];
          var b = this['im'];

          return new Complex(
                  cosh(a) * Math.cos(b),
                  sinh(a) * Math.sin(b));
        },

        /**
         * Calculate the complex tanh
         *
         * @returns {Complex}
         */
        'tanh': function() {

          // tanh(c) = (e^c - e^-c) / (e^c + e^-c)

          var a = 2 * this['re'];
          var b = 2 * this['im'];
          var d = cosh(a) + Math.cos(b);

          return new Complex(
                  sinh(a) / d,
                  Math.sin(b) / d);
        },

        /**
         * Calculate the complex coth
         *
         * @returns {Complex}
         */
        'coth': function() {

          // coth(c) = (e^c + e^-c) / (e^c - e^-c)

          var a = 2 * this['re'];
          var b = 2 * this['im'];
          var d = cosh(a) - Math.cos(b);

          return new Complex(
                  sinh(a) / d,
                  -Math.sin(b) / d);
        },

        /**
         * Calculate the complex coth
         *
         * @returns {Complex}
         */
        'csch': function() {

          // csch(c) = 2 / (e^c - e^-c)

          var a = this['re'];
          var b = this['im'];
          var d = Math.cos(2 * b) - cosh(2 * a);

          return new Complex(
                  -2 * sinh(a) * Math.cos(b) / d,
                  2 * cosh(a) * Math.sin(b) / d);
        },

        /**
         * Calculate the complex sech
         *
         * @returns {Complex}
         */
        'sech': function() {

          // sech(c) = 2 / (e^c + e^-c)

          var a = this['re'];
          var b = this['im'];
          var d = Math.cos(2 * b) + cosh(2 * a);

          return new Complex(
                  2 * cosh(a) * Math.cos(b) / d,
                  -2 * sinh(a) * Math.sin(b) / d);
        },

        /**
         * Calculate the complex asinh
         *
         * @returns {Complex}
         */
        'asinh': function() {

          // asinh(c) = log(c + sqrt(c^2 + 1))

          var tmp = this['im'];
          this['im'] = -this['re'];
          this['re'] = tmp;
          var res = this['asin']();

          this['re'] = -this['im'];
          this['im'] = tmp;
          tmp = res['re'];

          res['re'] = -res['im'];
          res['im'] = tmp;
          return res;
        },

        /**
         * Calculate the complex asinh
         *
         * @returns {Complex}
         */
        'acosh': function() {

          // acosh(c) = log(c + sqrt(c^2 - 1))

          var res = this['acos']();
          if (res['im'] <= 0) {
            var tmp = res['re'];
            res['re'] = -res['im'];
            res['im'] = tmp;
          } else {
            var tmp = res['im'];
            res['im'] = -res['re'];
            res['re'] = tmp;
          }
          return res;
        },

        /**
         * Calculate the complex atanh
         *
         * @returns {Complex}
         */
        'atanh': function() {

          // atanh(c) = log((1+c) / (1-c)) / 2

          var a = this['re'];
          var b = this['im'];

          var noIM = a > 1 && b === 0;
          var oneMinus = 1 - a;
          var onePlus = 1 + a;
          var d = oneMinus * oneMinus + b * b;

          var x = (d !== 0)
                  ? new Complex(
                          (onePlus * oneMinus - b * b) / d,
                          (b * oneMinus + onePlus * b) / d)
                  : new Complex(
                          (a !== -1) ? (a / 0) : 0,
                          (b !== 0) ? (b / 0) : 0);

          var temp = x['re'];
          x['re'] = logHypot(x['re'], x['im']) / 2;
          x['im'] = Math.atan2(x['im'], temp) / 2;
          if (noIM) {
            x['im'] = -x['im'];
          }
          return x;
        },

        /**
         * Calculate the complex acoth
         *
         * @returns {Complex}
         */
        'acoth': function() {

          // acoth(c) = log((c+1) / (c-1)) / 2

          var a = this['re'];
          var b = this['im'];

          if (a === 0 && b === 0) {
            return new Complex(0, Math.PI / 2);
          }

          var d = a * a + b * b;
          return (d !== 0)
                  ? new Complex(
                          a / d,
                          -b / d).atanh()
                  : new Complex(
                          (a !== 0) ? a / 0 : 0,
                          (b !== 0) ? -b / 0 : 0).atanh();
        },

        /**
         * Calculate the complex acsch
         *
         * @returns {Complex}
         */
        'acsch': function() {

          // acsch(c) = log((1+sqrt(1+c^2))/c)

          var a = this['re'];
          var b = this['im'];

          if (b === 0) {

            return new Complex(
                    (a !== 0)
                    ? Math.log(a + Math.sqrt(a * a + 1))
                    : Infinity, 0);
          }

          var d = a * a + b * b;
          return (d !== 0)
                  ? new Complex(
                          a / d,
                          -b / d).asinh()
                  : new Complex(
                          (a !== 0) ? a / 0 : 0,
                          (b !== 0) ? -b / 0 : 0).asinh();
        },

        /**
         * Calculate the complex asech
         *
         * @returns {Complex}
         */
        'asech': function() {

          // asech(c) = log((1+sqrt(1-c^2))/c)

          var a = this['re'];
          var b = this['im'];

          if (this['isZero']()) {
            return Complex['INFINITY'];
          }

          var d = a * a + b * b;
          return (d !== 0)
                  ? new Complex(
                          a / d,
                          -b / d).acosh()
                  : new Complex(
                          (a !== 0) ? a / 0 : 0,
                          (b !== 0) ? -b / 0 : 0).acosh();
        },

        /**
         * Calculate the complex inverse 1/z
         *
         * @returns {Complex}
         */
        'inverse': function() {

          // 1 / 0 = Infinity and 1 / Infinity = 0
          if (this['isZero']()) {
            return Complex['INFINITY'];
          }

          if (this['isInfinite']()) {
            return Complex['ZERO'];
          }

          var a = this['re'];
          var b = this['im'];

          var d = a * a + b * b;

          return new Complex(a / d, -b / d);
        },

        /**
         * Returns the complex conjugate
         *
         * @returns {Complex}
         */
        'conjugate': function() {

          return new Complex(this['re'], -this['im']);
        },

        /**
         * Gets the negated complex number
         *
         * @returns {Complex}
         */
        'neg': function() {

          return new Complex(-this['re'], -this['im']);
        },

        /**
         * Ceils the actual complex number
         *
         * @returns {Complex}
         */
        'ceil': function(places) {

          places = Math.pow(10, places || 0);

          return new Complex(
                  Math.ceil(this['re'] * places) / places,
                  Math.ceil(this['im'] * places) / places);
        },

        /**
         * Floors the actual complex number
         *
         * @returns {Complex}
         */
        'floor': function(places) {

          places = Math.pow(10, places || 0);

          return new Complex(
                  Math.floor(this['re'] * places) / places,
                  Math.floor(this['im'] * places) / places);
        },

        /**
         * Ceils the actual complex number
         *
         * @returns {Complex}
         */
        'round': function(places) {

          places = Math.pow(10, places || 0);

          return new Complex(
                  Math.round(this['re'] * places) / places,
                  Math.round(this['im'] * places) / places);
        },

        /**
         * Compares two complex numbers
         *
         * **Note:** new Complex(Infinity).equals(Infinity) === false
         *
         * @returns {boolean}
         */
        'equals': function(a, b) {

          var z = new Complex(a, b);

          return Math.abs(z['re'] - this['re']) <= Complex['EPSILON'] &&
                  Math.abs(z['im'] - this['im']) <= Complex['EPSILON'];
        },

        /**
         * Clones the actual object
         *
         * @returns {Complex}
         */
        'clone': function() {

          return new Complex(this['re'], this['im']);
        },

        /**
         * Gets a string of the actual complex number
         *
         * @returns {string}
         */
        'toString': function() {

          var a = this['re'];
          var b = this['im'];
          var ret = '';

          if (this['isNaN']()) {
            return 'NaN';
          }

          if (this['isZero']()) {
            return '0';
          }

          if (this['isInfinite']()) {
            return 'Infinity';
          }

          if (a !== 0) {
            ret += a;
          }

          if (b !== 0) {

            if (a !== 0) {
              ret += b < 0 ? ' - ' : ' + ';
            } else if (b < 0) {
              ret += '-';
            }

            b = Math.abs(b);

            if (1 !== b) {
              ret += b;
            }
            ret += 'i';
          }

          if (!ret)
            return '0';

          return ret;
        },

        /**
         * Returns the actual number as a vector
         *
         * @returns {Array}
         */
        'toVector': function() {

          return [this['re'], this['im']];
        },

        /**
         * Returns the actual real value of the current object
         *
         * @returns {number|null}
         */
        'valueOf': function() {

          if (this['im'] === 0) {
            return this['re'];
          }
          return null;
        },

        /**
         * Determines whether a complex number is not on the Riemann sphere.
         *
         * @returns {boolean}
         */
        'isNaN': function() {
          return isNaN(this['re']) || isNaN(this['im']);
        },

        /**
         * Determines whether or not a complex number is at the zero pole of the
         * Riemann sphere.
         *
         * @returns {boolean}
         */
        'isZero': function() {
          return (
                  (this['re'] === 0 || this['re'] === -0) &&
                  (this['im'] === 0 || this['im'] === -0)
                  );
        },

        /**
         * Determines whether a complex number is not at the infinity pole of the
         * Riemann sphere.
         *
         * @returns {boolean}
         */
        'isFinite': function() {
          return isFinite(this['re']) && isFinite(this['im']);
        },

        /**
         * Determines whether or not a complex number is at the infinity pole of the
         * Riemann sphere.
         *
         * @returns {boolean}
         */
        'isInfinite': function() {
          return !(this['isNaN']() || this['isFinite']());
        }
      };

      Complex['ZERO'] = new Complex(0, 0);
      Complex['ONE'] = new Complex(1, 0);
      Complex['I'] = new Complex(0, 1);
      Complex['PI'] = new Complex(Math.PI, 0);
      Complex['E'] = new Complex(Math.E, 0);
      Complex['INFINITY'] = new Complex(Infinity, Infinity);
      Complex['NAN'] = new Complex(NaN, NaN);
      Complex['EPSILON'] = 1e-16;

      {
        Object.defineProperty(exports, "__esModule", {'value': true});
        Complex['default'] = Complex;
        Complex['Complex'] = Complex;
        module['exports'] = Complex;
      }

    })();
    });

    var Complex = unwrapExports(complex);

    function _typeof$3(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof$3 = function _typeof(obj) { return typeof obj; }; } else { _typeof$3 = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof$3(obj); }
    var name$2 = 'Complex';
    var dependencies$2 = [];
    var createComplexClass = /* #__PURE__ */factory$2(name$2, dependencies$2, function () {
      /**
       * Attach type information
       */
      Complex.prototype.type = 'Complex';
      Complex.prototype.isComplex = true;
      /**
       * Get a JSON representation of the complex number
       * @returns {Object} Returns a JSON object structured as:
       *                   `{"mathjs": "Complex", "re": 2, "im": 3}`
       */

      Complex.prototype.toJSON = function () {
        return {
          mathjs: 'Complex',
          re: this.re,
          im: this.im
        };
      };
      /*
       * Return the value of the complex number in polar notation
       * The angle phi will be set in the interval of [-pi, pi].
       * @return {{r: number, phi: number}} Returns and object with properties r and phi.
       */


      Complex.prototype.toPolar = function () {
        return {
          r: this.abs(),
          phi: this.arg()
        };
      };
      /**
       * Get a string representation of the complex number,
       * with optional formatting options.
       * @param {Object | number | Function} [options]  Formatting options. See
       *                                                lib/utils/number:format for a
       *                                                description of the available
       *                                                options.
       * @return {string} str
       */


      Complex.prototype.format = function (options) {
        var str = '';
        var im = this.im;
        var re = this.re;
        var strRe = format(this.re, options);
        var strIm = format(this.im, options); // round either re or im when smaller than the configured precision

        var precision = isNumber(options) ? options : options ? options.precision : null;

        if (precision !== null) {
          var epsilon = Math.pow(10, -precision);

          if (Math.abs(re / im) < epsilon) {
            re = 0;
          }

          if (Math.abs(im / re) < epsilon) {
            im = 0;
          }
        }

        if (im === 0) {
          // real value
          str = strRe;
        } else if (re === 0) {
          // purely complex value
          if (im === 1) {
            str = 'i';
          } else if (im === -1) {
            str = '-i';
          } else {
            str = strIm + 'i';
          }
        } else {
          // complex value
          if (im < 0) {
            if (im === -1) {
              str = strRe + ' - i';
            } else {
              str = strRe + ' - ' + strIm.substring(1) + 'i';
            }
          } else {
            if (im === 1) {
              str = strRe + ' + i';
            } else {
              str = strRe + ' + ' + strIm + 'i';
            }
          }
        }

        return str;
      };
      /**
       * Create a complex number from polar coordinates
       *
       * Usage:
       *
       *     Complex.fromPolar(r: number, phi: number) : Complex
       *     Complex.fromPolar({r: number, phi: number}) : Complex
       *
       * @param {*} args...
       * @return {Complex}
       */


      Complex.fromPolar = function (args) {
        switch (arguments.length) {
          case 1:
            {
              var arg = arguments[0];

              if (_typeof$3(arg) === 'object') {
                return Complex(arg);
              } else {
                throw new TypeError('Input has to be an object with r and phi keys.');
              }
            }

          case 2:
            {
              var r = arguments[0];
              var phi = arguments[1];

              if (isNumber(r)) {
                if (isUnit(phi) && phi.hasBase('ANGLE')) {
                  // convert unit to a number in radians
                  phi = phi.toNumber('rad');
                }

                if (isNumber(phi)) {
                  return new Complex({
                    r: r,
                    phi: phi
                  });
                }

                throw new TypeError('Phi is not a number nor an angle unit.');
              } else {
                throw new TypeError('Radius r is not a number.');
              }
            }

          default:
            throw new SyntaxError('Wrong number of arguments in function fromPolar');
        }
      };

      Complex.prototype.valueOf = Complex.prototype.toString;
      /**
       * Create a Complex number from a JSON object
       * @param {Object} json  A JSON Object structured as
       *                       {"mathjs": "Complex", "re": 2, "im": 3}
       *                       All properties are optional, default values
       *                       for `re` and `im` are 0.
       * @return {Complex} Returns a new Complex number
       */

      Complex.fromJSON = function (json) {
        return new Complex(json);
      };
      /**
       * Compare two complex numbers, `a` and `b`:
       *
       * - Returns 1 when the real part of `a` is larger than the real part of `b`
       * - Returns -1 when the real part of `a` is smaller than the real part of `b`
       * - Returns 1 when the real parts are equal
       *   and the imaginary part of `a` is larger than the imaginary part of `b`
       * - Returns -1 when the real parts are equal
       *   and the imaginary part of `a` is smaller than the imaginary part of `b`
       * - Returns 0 when both real and imaginary parts are equal.
       *
       * @params {Complex} a
       * @params {Complex} b
       * @returns {number} Returns the comparison result: -1, 0, or 1
       */


      Complex.compare = function (a, b) {
        if (a.re > b.re) {
          return 1;
        }

        if (a.re < b.re) {
          return -1;
        }

        if (a.im > b.im) {
          return 1;
        }

        if (a.im < b.im) {
          return -1;
        }

        return 0;
      };

      return Complex;
    }, {
      isClass: true
    });

    var fraction = createCommonjsModule(function (module, exports) {
    /**
     * @license Fraction.js v4.0.12 09/09/2015
     * http://www.xarg.org/2014/03/rational-numbers-in-javascript/
     *
     * Copyright (c) 2015, Robert Eisele (robert@xarg.org)
     * Dual licensed under the MIT or GPL Version 2 licenses.
     **/


    /**
     *
     * This class offers the possibility to calculate fractions.
     * You can pass a fraction in different formats. Either as array, as double, as string or as an integer.
     *
     * Array/Object form
     * [ 0 => <nominator>, 1 => <denominator> ]
     * [ n => <nominator>, d => <denominator> ]
     *
     * Integer form
     * - Single integer value
     *
     * Double form
     * - Single double value
     *
     * String form
     * 123.456 - a simple double
     * 123/456 - a string fraction
     * 123.'456' - a double with repeating decimal places
     * 123.(456) - synonym
     * 123.45'6' - a double with repeating last place
     * 123.45(6) - synonym
     *
     * Example:
     *
     * var f = new Fraction("9.4'31'");
     * f.mul([-4, 3]).div(4.9);
     *
     */

    (function(root) {

      // Maximum search depth for cyclic rational numbers. 2000 should be more than enough.
      // Example: 1/7 = 0.(142857) has 6 repeating decimal places.
      // If MAX_CYCLE_LEN gets reduced, long cycles will not be detected and toString() only gets the first 10 digits
      var MAX_CYCLE_LEN = 2000;

      // Parsed data to avoid calling "new" all the time
      var P = {
        "s": 1,
        "n": 0,
        "d": 1
      };

      function createError(name) {

        function errorConstructor() {
          var temp = Error.apply(this, arguments);
          temp['name'] = this['name'] = name;
          this['stack'] = temp['stack'];
          this['message'] = temp['message'];
        }

        /**
         * Error constructor
         *
         * @constructor
         */
        function IntermediateInheritor() {}
        IntermediateInheritor.prototype = Error.prototype;
        errorConstructor.prototype = new IntermediateInheritor();

        return errorConstructor;
      }

      var DivisionByZero = Fraction['DivisionByZero'] = createError('DivisionByZero');
      var InvalidParameter = Fraction['InvalidParameter'] = createError('InvalidParameter');

      function assign(n, s) {

        if (isNaN(n = parseInt(n, 10))) {
          throwInvalidParam();
        }
        return n * s;
      }

      function throwInvalidParam() {
        throw new InvalidParameter();
      }

      var parse = function(p1, p2) {

        var n = 0, d = 1, s = 1;
        var v = 0, w = 0, x = 0, y = 1, z = 1;

        var A = 0, B = 1;
        var C = 1, D = 1;

        var N = 10000000;
        var M;

        if (p1 === undefined || p1 === null) ; else if (p2 !== undefined) {
          n = p1;
          d = p2;
          s = n * d;
        } else
          switch (typeof p1) {

            case "object":
            {
              if ("d" in p1 && "n" in p1) {
                n = p1["n"];
                d = p1["d"];
                if ("s" in p1)
                  n *= p1["s"];
              } else if (0 in p1) {
                n = p1[0];
                if (1 in p1)
                  d = p1[1];
              } else {
                throwInvalidParam();
              }
              s = n * d;
              break;
            }
            case "number":
            {
              if (p1 < 0) {
                s = p1;
                p1 = -p1;
              }

              if (p1 % 1 === 0) {
                n = p1;
              } else if (p1 > 0) { // check for != 0, scale would become NaN (log(0)), which converges really slow

                if (p1 >= 1) {
                  z = Math.pow(10, Math.floor(1 + Math.log(p1) / Math.LN10));
                  p1 /= z;
                }

                // Using Farey Sequences
                // http://www.johndcook.com/blog/2010/10/20/best-rational-approximation/

                while (B <= N && D <= N) {
                  M = (A + C) / (B + D);

                  if (p1 === M) {
                    if (B + D <= N) {
                      n = A + C;
                      d = B + D;
                    } else if (D > B) {
                      n = C;
                      d = D;
                    } else {
                      n = A;
                      d = B;
                    }
                    break;

                  } else {

                    if (p1 > M) {
                      A += C;
                      B += D;
                    } else {
                      C += A;
                      D += B;
                    }

                    if (B > N) {
                      n = C;
                      d = D;
                    } else {
                      n = A;
                      d = B;
                    }
                  }
                }
                n *= z;
              } else if (isNaN(p1) || isNaN(p2)) {
                d = n = NaN;
              }
              break;
            }
            case "string":
            {
              B = p1.match(/\d+|./g);

              if (B === null)
                throwInvalidParam();

              if (B[A] === '-') {// Check for minus sign at the beginning
                s = -1;
                A++;
              } else if (B[A] === '+') {// Check for plus sign at the beginning
                A++;
              }

              if (B.length === A + 1) { // Check if it's just a simple number "1234"
                w = assign(B[A++], s);
              } else if (B[A + 1] === '.' || B[A] === '.') { // Check if it's a decimal number

                if (B[A] !== '.') { // Handle 0.5 and .5
                  v = assign(B[A++], s);
                }
                A++;

                // Check for decimal places
                if (A + 1 === B.length || B[A + 1] === '(' && B[A + 3] === ')' || B[A + 1] === "'" && B[A + 3] === "'") {
                  w = assign(B[A], s);
                  y = Math.pow(10, B[A].length);
                  A++;
                }

                // Check for repeating places
                if (B[A] === '(' && B[A + 2] === ')' || B[A] === "'" && B[A + 2] === "'") {
                  x = assign(B[A + 1], s);
                  z = Math.pow(10, B[A + 1].length) - 1;
                  A += 3;
                }

              } else if (B[A + 1] === '/' || B[A + 1] === ':') { // Check for a simple fraction "123/456" or "123:456"
                w = assign(B[A], s);
                y = assign(B[A + 2], 1);
                A += 3;
              } else if (B[A + 3] === '/' && B[A + 1] === ' ') { // Check for a complex fraction "123 1/2"
                v = assign(B[A], s);
                w = assign(B[A + 2], s);
                y = assign(B[A + 4], 1);
                A += 5;
              }

              if (B.length <= A) { // Check for more tokens on the stack
                d = y * z;
                s = /* void */
                        n = x + d * v + z * w;
                break;
              }

              /* Fall through on error */
            }
            default:
              throwInvalidParam();
          }

        if (d === 0) {
          throw new DivisionByZero();
        }

        P["s"] = s < 0 ? -1 : 1;
        P["n"] = Math.abs(n);
        P["d"] = Math.abs(d);
      };

      function modpow(b, e, m) {

        var r = 1;
        for (; e > 0; b = (b * b) % m, e >>= 1) {

          if (e & 1) {
            r = (r * b) % m;
          }
        }
        return r;
      }


      function cycleLen(n, d) {

        for (; d % 2 === 0;
                d /= 2) {
        }

        for (; d % 5 === 0;
                d /= 5) {
        }

        if (d === 1) // Catch non-cyclic numbers
          return 0;

        // If we would like to compute really large numbers quicker, we could make use of Fermat's little theorem:
        // 10^(d-1) % d == 1
        // However, we don't need such large numbers and MAX_CYCLE_LEN should be the capstone,
        // as we want to translate the numbers to strings.

        var rem = 10 % d;
        var t = 1;

        for (; rem !== 1; t++) {
          rem = rem * 10 % d;

          if (t > MAX_CYCLE_LEN)
            return 0; // Returning 0 here means that we don't print it as a cyclic number. It's likely that the answer is `d-1`
        }
        return t;
      }


         function cycleStart(n, d, len) {

        var rem1 = 1;
        var rem2 = modpow(10, len, d);

        for (var t = 0; t < 300; t++) { // s < ~log10(Number.MAX_VALUE)
          // Solve 10^s == 10^(s+t) (mod d)

          if (rem1 === rem2)
            return t;

          rem1 = rem1 * 10 % d;
          rem2 = rem2 * 10 % d;
        }
        return 0;
      }

      function gcd(a, b) {

        if (!a)
          return b;
        if (!b)
          return a;

        while (1) {
          a %= b;
          if (!a)
            return b;
          b %= a;
          if (!b)
            return a;
        }
      }
      /**
       * Module constructor
       *
       * @constructor
       * @param {number|Fraction=} a
       * @param {number=} b
       */
      function Fraction(a, b) {

        if (!(this instanceof Fraction)) {
          return new Fraction(a, b);
        }

        parse(a, b);

        if (Fraction['REDUCE']) {
          a = gcd(P["d"], P["n"]); // Abuse a
        } else {
          a = 1;
        }

        this["s"] = P["s"];
        this["n"] = P["n"] / a;
        this["d"] = P["d"] / a;
      }

      /**
       * Boolean global variable to be able to disable automatic reduction of the fraction
       *
       */
      Fraction['REDUCE'] = 1;

      Fraction.prototype = {

        "s": 1,
        "n": 0,
        "d": 1,

        /**
         * Calculates the absolute value
         *
         * Ex: new Fraction(-4).abs() => 4
         **/
        "abs": function() {

          return new Fraction(this["n"], this["d"]);
        },

        /**
         * Inverts the sign of the current fraction
         *
         * Ex: new Fraction(-4).neg() => 4
         **/
        "neg": function() {

          return new Fraction(-this["s"] * this["n"], this["d"]);
        },

        /**
         * Adds two rational numbers
         *
         * Ex: new Fraction({n: 2, d: 3}).add("14.9") => 467 / 30
         **/
        "add": function(a, b) {

          parse(a, b);
          return new Fraction(
                  this["s"] * this["n"] * P["d"] + P["s"] * this["d"] * P["n"],
                  this["d"] * P["d"]
                  );
        },

        /**
         * Subtracts two rational numbers
         *
         * Ex: new Fraction({n: 2, d: 3}).add("14.9") => -427 / 30
         **/
        "sub": function(a, b) {

          parse(a, b);
          return new Fraction(
                  this["s"] * this["n"] * P["d"] - P["s"] * this["d"] * P["n"],
                  this["d"] * P["d"]
                  );
        },

        /**
         * Multiplies two rational numbers
         *
         * Ex: new Fraction("-17.(345)").mul(3) => 5776 / 111
         **/
        "mul": function(a, b) {

          parse(a, b);
          return new Fraction(
                  this["s"] * P["s"] * this["n"] * P["n"],
                  this["d"] * P["d"]
                  );
        },

        /**
         * Divides two rational numbers
         *
         * Ex: new Fraction("-17.(345)").inverse().div(3)
         **/
        "div": function(a, b) {

          parse(a, b);
          return new Fraction(
                  this["s"] * P["s"] * this["n"] * P["d"],
                  this["d"] * P["n"]
                  );
        },

        /**
         * Clones the actual object
         *
         * Ex: new Fraction("-17.(345)").clone()
         **/
        "clone": function() {
          return new Fraction(this);
        },

        /**
         * Calculates the modulo of two rational numbers - a more precise fmod
         *
         * Ex: new Fraction('4.(3)').mod([7, 8]) => (13/3) % (7/8) = (5/6)
         **/
        "mod": function(a, b) {

          if (isNaN(this['n']) || isNaN(this['d'])) {
            return new Fraction(NaN);
          }

          if (a === undefined) {
            return new Fraction(this["s"] * this["n"] % this["d"], 1);
          }

          parse(a, b);
          if (0 === P["n"] && 0 === this["d"]) {
            Fraction(0, 0); // Throw DivisionByZero
          }

          /*
           * First silly attempt, kinda slow
           *
           return that["sub"]({
           "n": num["n"] * Math.floor((this.n / this.d) / (num.n / num.d)),
           "d": num["d"],
           "s": this["s"]
           });*/

          /*
           * New attempt: a1 / b1 = a2 / b2 * q + r
           * => b2 * a1 = a2 * b1 * q + b1 * b2 * r
           * => (b2 * a1 % a2 * b1) / (b1 * b2)
           */
          return new Fraction(
                  this["s"] * (P["d"] * this["n"]) % (P["n"] * this["d"]),
                  P["d"] * this["d"]
                  );
        },

        /**
         * Calculates the fractional gcd of two rational numbers
         *
         * Ex: new Fraction(5,8).gcd(3,7) => 1/56
         */
        "gcd": function(a, b) {

          parse(a, b);

          // gcd(a / b, c / d) = gcd(a, c) / lcm(b, d)

          return new Fraction(gcd(P["n"], this["n"]) * gcd(P["d"], this["d"]), P["d"] * this["d"]);
        },

        /**
         * Calculates the fractional lcm of two rational numbers
         *
         * Ex: new Fraction(5,8).lcm(3,7) => 15
         */
        "lcm": function(a, b) {

          parse(a, b);

          // lcm(a / b, c / d) = lcm(a, c) / gcd(b, d)

          if (P["n"] === 0 && this["n"] === 0) {
            return new Fraction;
          }
          return new Fraction(P["n"] * this["n"], gcd(P["n"], this["n"]) * gcd(P["d"], this["d"]));
        },

        /**
         * Calculates the ceil of a rational number
         *
         * Ex: new Fraction('4.(3)').ceil() => (5 / 1)
         **/
        "ceil": function(places) {

          places = Math.pow(10, places || 0);

          if (isNaN(this["n"]) || isNaN(this["d"])) {
            return new Fraction(NaN);
          }
          return new Fraction(Math.ceil(places * this["s"] * this["n"] / this["d"]), places);
        },

        /**
         * Calculates the floor of a rational number
         *
         * Ex: new Fraction('4.(3)').floor() => (4 / 1)
         **/
        "floor": function(places) {

          places = Math.pow(10, places || 0);

          if (isNaN(this["n"]) || isNaN(this["d"])) {
            return new Fraction(NaN);
          }
          return new Fraction(Math.floor(places * this["s"] * this["n"] / this["d"]), places);
        },

        /**
         * Rounds a rational numbers
         *
         * Ex: new Fraction('4.(3)').round() => (4 / 1)
         **/
        "round": function(places) {

          places = Math.pow(10, places || 0);

          if (isNaN(this["n"]) || isNaN(this["d"])) {
            return new Fraction(NaN);
          }
          return new Fraction(Math.round(places * this["s"] * this["n"] / this["d"]), places);
        },

        /**
         * Gets the inverse of the fraction, means numerator and denumerator are exchanged
         *
         * Ex: new Fraction([-3, 4]).inverse() => -4 / 3
         **/
        "inverse": function() {

          return new Fraction(this["s"] * this["d"], this["n"]);
        },

        /**
         * Calculates the fraction to some integer exponent
         *
         * Ex: new Fraction(-1,2).pow(-3) => -8
         */
        "pow": function(m) {

          if (m < 0) {
            return new Fraction(Math.pow(this['s'] * this["d"], -m), Math.pow(this["n"], -m));
          } else {
            return new Fraction(Math.pow(this['s'] * this["n"], m), Math.pow(this["d"], m));
          }
        },

        /**
         * Check if two rational numbers are the same
         *
         * Ex: new Fraction(19.6).equals([98, 5]);
         **/
        "equals": function(a, b) {

          parse(a, b);
          return this["s"] * this["n"] * P["d"] === P["s"] * P["n"] * this["d"]; // Same as compare() === 0
        },

        /**
         * Check if two rational numbers are the same
         *
         * Ex: new Fraction(19.6).equals([98, 5]);
         **/
        "compare": function(a, b) {

          parse(a, b);
          var t = (this["s"] * this["n"] * P["d"] - P["s"] * P["n"] * this["d"]);
          return (0 < t) - (t < 0);
        },

        "simplify": function(eps) {

          // First naive implementation, needs improvement

          if (isNaN(this['n']) || isNaN(this['d'])) {
            return this;
          }

          var cont = this['abs']()['toContinued']();

          eps = eps || 0.001;

          function rec(a) {
            if (a.length === 1)
              return new Fraction(a[0]);
            return rec(a.slice(1))['inverse']()['add'](a[0]);
          }

          for (var i = 0; i < cont.length; i++) {
            var tmp = rec(cont.slice(0, i + 1));
            if (tmp['sub'](this['abs']())['abs']().valueOf() < eps) {
              return tmp['mul'](this['s']);
            }
          }
          return this;
        },

        /**
         * Check if two rational numbers are divisible
         *
         * Ex: new Fraction(19.6).divisible(1.5);
         */
        "divisible": function(a, b) {

          parse(a, b);
          return !(!(P["n"] * this["d"]) || ((this["n"] * P["d"]) % (P["n"] * this["d"])));
        },

        /**
         * Returns a decimal representation of the fraction
         *
         * Ex: new Fraction("100.'91823'").valueOf() => 100.91823918239183
         **/
        'valueOf': function() {

          return this["s"] * this["n"] / this["d"];
        },

        /**
         * Returns a string-fraction representation of a Fraction object
         *
         * Ex: new Fraction("1.'3'").toFraction() => "4 1/3"
         **/
        'toFraction': function(excludeWhole) {

          var whole, str = "";
          var n = this["n"];
          var d = this["d"];
          if (this["s"] < 0) {
            str += '-';
          }

          if (d === 1) {
            str += n;
          } else {

            if (excludeWhole && (whole = Math.floor(n / d)) > 0) {
              str += whole;
              str += " ";
              n %= d;
            }

            str += n;
            str += '/';
            str += d;
          }
          return str;
        },

        /**
         * Returns a latex representation of a Fraction object
         *
         * Ex: new Fraction("1.'3'").toLatex() => "\frac{4}{3}"
         **/
        'toLatex': function(excludeWhole) {

          var whole, str = "";
          var n = this["n"];
          var d = this["d"];
          if (this["s"] < 0) {
            str += '-';
          }

          if (d === 1) {
            str += n;
          } else {

            if (excludeWhole && (whole = Math.floor(n / d)) > 0) {
              str += whole;
              n %= d;
            }

            str += "\\frac{";
            str += n;
            str += '}{';
            str += d;
            str += '}';
          }
          return str;
        },

        /**
         * Returns an array of continued fraction elements
         *
         * Ex: new Fraction("7/8").toContinued() => [0,1,7]
         */
        'toContinued': function() {

          var t;
          var a = this['n'];
          var b = this['d'];
          var res = [];

          if (isNaN(this['n']) || isNaN(this['d'])) {
            return res;
          }

          do {
            res.push(Math.floor(a / b));
            t = a % b;
            a = b;
            b = t;
          } while (a !== 1);

          return res;
        },

        /**
         * Creates a string representation of a fraction with all digits
         *
         * Ex: new Fraction("100.'91823'").toString() => "100.(91823)"
         **/
        'toString': function(dec) {

          var g;
          var N = this["n"];
          var D = this["d"];

          if (isNaN(N) || isNaN(D)) {
            return "NaN";
          }

          if (!Fraction['REDUCE']) {
            g = gcd(N, D);
            N /= g;
            D /= g;
          }

          dec = dec || 15; // 15 = decimal places when no repitation

          var cycLen = cycleLen(N, D); // Cycle length
          var cycOff = cycleStart(N, D, cycLen); // Cycle start

          var str = this['s'] === -1 ? "-" : "";

          str += N / D | 0;

          N %= D;
          N *= 10;

          if (N)
            str += ".";

          if (cycLen) {

            for (var i = cycOff; i--; ) {
              str += N / D | 0;
              N %= D;
              N *= 10;
            }
            str += "(";
            for (var i = cycLen; i--; ) {
              str += N / D | 0;
              N %= D;
              N *= 10;
            }
            str += ")";
          } else {
            for (var i = dec; N && i--; ) {
              str += N / D | 0;
              N %= D;
              N *= 10;
            }
          }
          return str;
        }
      };

      {
        Object.defineProperty(exports, "__esModule", {'value': true});
        Fraction['default'] = Fraction;
        Fraction['Fraction'] = Fraction;
        module['exports'] = Fraction;
      }

    })();
    });

    var Fraction = unwrapExports(fraction);

    var name$3 = 'Fraction';
    var dependencies$3 = [];
    var createFractionClass = /* #__PURE__ */factory$2(name$3, dependencies$3, function () {
      /**
       * Attach type information
       */
      Fraction.prototype.type = 'Fraction';
      Fraction.prototype.isFraction = true;
      /**
       * Get a JSON representation of a Fraction containing type information
       * @returns {Object} Returns a JSON object structured as:
       *                   `{"mathjs": "Fraction", "n": 3, "d": 8}`
       */

      Fraction.prototype.toJSON = function () {
        return {
          mathjs: 'Fraction',
          n: this.s * this.n,
          d: this.d
        };
      };
      /**
       * Instantiate a Fraction from a JSON object
       * @param {Object} json  a JSON object structured as:
       *                       `{"mathjs": "Fraction", "n": 3, "d": 8}`
       * @return {BigNumber}
       */


      Fraction.fromJSON = function (json) {
        return new Fraction(json);
      };

      return Fraction;
    }, {
      isClass: true
    });

    var name$4 = 'Matrix';
    var dependencies$4 = [];
    var createMatrixClass = /* #__PURE__ */factory$2(name$4, dependencies$4, function () {
      /**
       * @constructor Matrix
       *
       * A Matrix is a wrapper around an Array. A matrix can hold a multi dimensional
       * array. A matrix can be constructed as:
       *
       *     let matrix = math.matrix(data)
       *
       * Matrix contains the functions to resize, get and set values, get the size,
       * clone the matrix and to convert the matrix to a vector, array, or scalar.
       * Furthermore, one can iterate over the matrix using map and forEach.
       * The internal Array of the Matrix can be accessed using the function valueOf.
       *
       * Example usage:
       *
       *     let matrix = math.matrix([[1, 2], [3, 4]])
       *     matix.size()              // [2, 2]
       *     matrix.resize([3, 2], 5)
       *     matrix.valueOf()          // [[1, 2], [3, 4], [5, 5]]
       *     matrix.subset([1,2])       // 3 (indexes are zero-based)
       *
       */
      function Matrix() {
        if (!(this instanceof Matrix)) {
          throw new SyntaxError('Constructor must be called with the new operator');
        }
      }
      /**
       * Attach type information
       */


      Matrix.prototype.type = 'Matrix';
      Matrix.prototype.isMatrix = true;
      /**
       * Get the storage format used by the matrix.
       *
       * Usage:
       *     const format = matrix.storage()   // retrieve storage format
       *
       * @return {string}           The storage format.
       */

      Matrix.prototype.storage = function () {
        // must be implemented by each of the Matrix implementations
        throw new Error('Cannot invoke storage on a Matrix interface');
      };
      /**
       * Get the datatype of the data stored in the matrix.
       *
       * Usage:
       *     const format = matrix.datatype()    // retrieve matrix datatype
       *
       * @return {string}           The datatype.
       */


      Matrix.prototype.datatype = function () {
        // must be implemented by each of the Matrix implementations
        throw new Error('Cannot invoke datatype on a Matrix interface');
      };
      /**
       * Create a new Matrix With the type of the current matrix instance
       * @param {Array | Object} data
       * @param {string} [datatype]
       */


      Matrix.prototype.create = function (data, datatype) {
        throw new Error('Cannot invoke create on a Matrix interface');
      };
      /**
       * Get a subset of the matrix, or replace a subset of the matrix.
       *
       * Usage:
       *     const subset = matrix.subset(index)               // retrieve subset
       *     const value = matrix.subset(index, replacement)   // replace subset
       *
       * @param {Index} index
       * @param {Array | Matrix | *} [replacement]
       * @param {*} [defaultValue=0]      Default value, filled in on new entries when
       *                                  the matrix is resized. If not provided,
       *                                  new matrix elements will be filled with zeros.
       */


      Matrix.prototype.subset = function (index, replacement, defaultValue) {
        // must be implemented by each of the Matrix implementations
        throw new Error('Cannot invoke subset on a Matrix interface');
      };
      /**
       * Get a single element from the matrix.
       * @param {number[]} index   Zero-based index
       * @return {*} value
       */


      Matrix.prototype.get = function (index) {
        // must be implemented by each of the Matrix implementations
        throw new Error('Cannot invoke get on a Matrix interface');
      };
      /**
       * Replace a single element in the matrix.
       * @param {number[]} index   Zero-based index
       * @param {*} value
       * @param {*} [defaultValue]        Default value, filled in on new entries when
       *                                  the matrix is resized. If not provided,
       *                                  new matrix elements will be left undefined.
       * @return {Matrix} self
       */


      Matrix.prototype.set = function (index, value, defaultValue) {
        // must be implemented by each of the Matrix implementations
        throw new Error('Cannot invoke set on a Matrix interface');
      };
      /**
       * Resize the matrix to the given size. Returns a copy of the matrix when
       * `copy=true`, otherwise return the matrix itself (resize in place).
       *
       * @param {number[]} size           The new size the matrix should have.
       * @param {*} [defaultValue=0]      Default value, filled in on new entries.
       *                                  If not provided, the matrix elements will
       *                                  be filled with zeros.
       * @param {boolean} [copy]          Return a resized copy of the matrix
       *
       * @return {Matrix}                 The resized matrix
       */


      Matrix.prototype.resize = function (size, defaultValue) {
        // must be implemented by each of the Matrix implementations
        throw new Error('Cannot invoke resize on a Matrix interface');
      };
      /**
       * Reshape the matrix to the given size. Returns a copy of the matrix when
       * `copy=true`, otherwise return the matrix itself (reshape in place).
       *
       * @param {number[]} size           The new size the matrix should have.
       * @param {boolean} [copy]          Return a reshaped copy of the matrix
       *
       * @return {Matrix}                 The reshaped matrix
       */


      Matrix.prototype.reshape = function (size, defaultValue) {
        // must be implemented by each of the Matrix implementations
        throw new Error('Cannot invoke reshape on a Matrix interface');
      };
      /**
       * Create a clone of the matrix
       * @return {Matrix} clone
       */


      Matrix.prototype.clone = function () {
        // must be implemented by each of the Matrix implementations
        throw new Error('Cannot invoke clone on a Matrix interface');
      };
      /**
       * Retrieve the size of the matrix.
       * @returns {number[]} size
       */


      Matrix.prototype.size = function () {
        // must be implemented by each of the Matrix implementations
        throw new Error('Cannot invoke size on a Matrix interface');
      };
      /**
       * Create a new matrix with the results of the callback function executed on
       * each entry of the matrix.
       * @param {Function} callback   The callback function is invoked with three
       *                              parameters: the value of the element, the index
       *                              of the element, and the Matrix being traversed.
       * @param {boolean} [skipZeros] Invoke callback function for non-zero values only.
       *
       * @return {Matrix} matrix
       */


      Matrix.prototype.map = function (callback, skipZeros) {
        // must be implemented by each of the Matrix implementations
        throw new Error('Cannot invoke map on a Matrix interface');
      };
      /**
       * Execute a callback function on each entry of the matrix.
       * @param {Function} callback   The callback function is invoked with three
       *                              parameters: the value of the element, the index
       *                              of the element, and the Matrix being traversed.
       */


      Matrix.prototype.forEach = function (callback) {
        // must be implemented by each of the Matrix implementations
        throw new Error('Cannot invoke forEach on a Matrix interface');
      };
      /**
       * Create an Array with a copy of the data of the Matrix
       * @returns {Array} array
       */


      Matrix.prototype.toArray = function () {
        // must be implemented by each of the Matrix implementations
        throw new Error('Cannot invoke toArray on a Matrix interface');
      };
      /**
       * Get the primitive value of the Matrix: a multidimensional array
       * @returns {Array} array
       */


      Matrix.prototype.valueOf = function () {
        // must be implemented by each of the Matrix implementations
        throw new Error('Cannot invoke valueOf on a Matrix interface');
      };
      /**
       * Get a string representation of the matrix, with optional formatting options.
       * @param {Object | number | Function} [options]  Formatting options. See
       *                                                lib/utils/number:format for a
       *                                                description of the available
       *                                                options.
       * @returns {string} str
       */


      Matrix.prototype.format = function (options) {
        // must be implemented by each of the Matrix implementations
        throw new Error('Cannot invoke format on a Matrix interface');
      };
      /**
       * Get a string representation of the matrix
       * @returns {string} str
       */


      Matrix.prototype.toString = function () {
        // must be implemented by each of the Matrix implementations
        throw new Error('Cannot invoke toString on a Matrix interface');
      };

      return Matrix;
    }, {
      isClass: true
    });

    var name$5 = 'DenseMatrix';
    var dependencies$5 = ['Matrix'];
    var createDenseMatrixClass = /* #__PURE__ */factory$2(name$5, dependencies$5, function (_ref) {
      var Matrix = _ref.Matrix;

      /**
       * Dense Matrix implementation. A regular, dense matrix, supporting multi-dimensional matrices. This is the default matrix type.
       * @class DenseMatrix
       */
      function DenseMatrix(data, datatype) {
        if (!(this instanceof DenseMatrix)) {
          throw new SyntaxError('Constructor must be called with the new operator');
        }

        if (datatype && !isString(datatype)) {
          throw new Error('Invalid datatype: ' + datatype);
        }

        if (isMatrix(data)) {
          // check data is a DenseMatrix
          if (data.type === 'DenseMatrix') {
            // clone data & size
            this._data = clone(data._data);
            this._size = clone(data._size);
            this._datatype = datatype || data._datatype;
          } else {
            // build data from existing matrix
            this._data = data.toArray();
            this._size = data.size();
            this._datatype = datatype || data._datatype;
          }
        } else if (data && isArray(data.data) && isArray(data.size)) {
          // initialize fields from JSON representation
          this._data = data.data;
          this._size = data.size; // verify the dimensions of the array

          validate(this._data, this._size);
          this._datatype = datatype || data.datatype;
        } else if (isArray(data)) {
          // replace nested Matrices with Arrays
          this._data = preprocess(data); // get the dimensions of the array

          this._size = arraySize(this._data); // verify the dimensions of the array, TODO: compute size while processing array

          validate(this._data, this._size); // data type unknown

          this._datatype = datatype;
        } else if (data) {
          // unsupported type
          throw new TypeError('Unsupported type of data (' + typeOf(data) + ')');
        } else {
          // nothing provided
          this._data = [];
          this._size = [0];
          this._datatype = datatype;
        }
      }

      DenseMatrix.prototype = new Matrix();
      /**
       * Create a new DenseMatrix
       */

      DenseMatrix.prototype.createDenseMatrix = function (data, datatype) {
        return new DenseMatrix(data, datatype);
      };
      /**
       * Attach type information
       */


      DenseMatrix.prototype.type = 'DenseMatrix';
      DenseMatrix.prototype.isDenseMatrix = true;
      /**
       * Get the matrix type
       *
       * Usage:
       *    const matrixType = matrix.getDataType()  // retrieves the matrix type
       *
       * @memberOf DenseMatrix
       * @return {string}   type information; if multiple types are found from the Matrix, it will return "mixed"
       */

      DenseMatrix.prototype.getDataType = function () {
        return getArrayDataType(this._data, typeOf);
      };
      /**
       * Get the storage format used by the matrix.
       *
       * Usage:
       *     const format = matrix.storage()  // retrieve storage format
       *
       * @memberof DenseMatrix
       * @return {string}           The storage format.
       */


      DenseMatrix.prototype.storage = function () {
        return 'dense';
      };
      /**
       * Get the datatype of the data stored in the matrix.
       *
       * Usage:
       *     const format = matrix.datatype()   // retrieve matrix datatype
       *
       * @memberof DenseMatrix
       * @return {string}           The datatype.
       */


      DenseMatrix.prototype.datatype = function () {
        return this._datatype;
      };
      /**
       * Create a new DenseMatrix
       * @memberof DenseMatrix
       * @param {Array} data
       * @param {string} [datatype]
       */


      DenseMatrix.prototype.create = function (data, datatype) {
        return new DenseMatrix(data, datatype);
      };
      /**
       * Get a subset of the matrix, or replace a subset of the matrix.
       *
       * Usage:
       *     const subset = matrix.subset(index)               // retrieve subset
       *     const value = matrix.subset(index, replacement)   // replace subset
       *
       * @memberof DenseMatrix
       * @param {Index} index
       * @param {Array | Matrix | *} [replacement]
       * @param {*} [defaultValue=0]      Default value, filled in on new entries when
       *                                  the matrix is resized. If not provided,
       *                                  new matrix elements will be filled with zeros.
       */


      DenseMatrix.prototype.subset = function (index, replacement, defaultValue) {
        switch (arguments.length) {
          case 1:
            return _get(this, index);
          // intentional fall through

          case 2:
          case 3:
            return _set(this, index, replacement, defaultValue);

          default:
            throw new SyntaxError('Wrong number of arguments');
        }
      };
      /**
       * Get a single element from the matrix.
       * @memberof DenseMatrix
       * @param {number[]} index   Zero-based index
       * @return {*} value
       */


      DenseMatrix.prototype.get = function (index) {
        if (!isArray(index)) {
          throw new TypeError('Array expected');
        }

        if (index.length !== this._size.length) {
          throw new DimensionError(index.length, this._size.length);
        } // check index


        for (var x = 0; x < index.length; x++) {
          validateIndex(index[x], this._size[x]);
        }

        var data = this._data;

        for (var i = 0, ii = index.length; i < ii; i++) {
          var indexI = index[i];
          validateIndex(indexI, data.length);
          data = data[indexI];
        }

        return data;
      };
      /**
       * Replace a single element in the matrix.
       * @memberof DenseMatrix
       * @param {number[]} index   Zero-based index
       * @param {*} value
       * @param {*} [defaultValue]        Default value, filled in on new entries when
       *                                  the matrix is resized. If not provided,
       *                                  new matrix elements will be left undefined.
       * @return {DenseMatrix} self
       */


      DenseMatrix.prototype.set = function (index, value, defaultValue) {
        if (!isArray(index)) {
          throw new TypeError('Array expected');
        }

        if (index.length < this._size.length) {
          throw new DimensionError(index.length, this._size.length, '<');
        }

        var i, ii, indexI; // enlarge matrix when needed

        var size = index.map(function (i) {
          return i + 1;
        });

        _fit(this, size, defaultValue); // traverse over the dimensions


        var data = this._data;

        for (i = 0, ii = index.length - 1; i < ii; i++) {
          indexI = index[i];
          validateIndex(indexI, data.length);
          data = data[indexI];
        } // set new value


        indexI = index[index.length - 1];
        validateIndex(indexI, data.length);
        data[indexI] = value;
        return this;
      };
      /**
       * Get a submatrix of this matrix
       * @memberof DenseMatrix
       * @param {DenseMatrix} matrix
       * @param {Index} index   Zero-based index
       * @private
       */


      function _get(matrix, index) {
        if (!isIndex(index)) {
          throw new TypeError('Invalid index');
        }

        var isScalar = index.isScalar();

        if (isScalar) {
          // return a scalar
          return matrix.get(index.min());
        } else {
          // validate dimensions
          var size = index.size();

          if (size.length !== matrix._size.length) {
            throw new DimensionError(size.length, matrix._size.length);
          } // validate if any of the ranges in the index is out of range


          var min = index.min();
          var max = index.max();

          for (var i = 0, ii = matrix._size.length; i < ii; i++) {
            validateIndex(min[i], matrix._size[i]);
            validateIndex(max[i], matrix._size[i]);
          } // retrieve submatrix
          // TODO: more efficient when creating an empty matrix and setting _data and _size manually


          return new DenseMatrix(_getSubmatrix(matrix._data, index, size.length, 0), matrix._datatype);
        }
      }
      /**
       * Recursively get a submatrix of a multi dimensional matrix.
       * Index is not checked for correct number or length of dimensions.
       * @memberof DenseMatrix
       * @param {Array} data
       * @param {Index} index
       * @param {number} dims   Total number of dimensions
       * @param {number} dim    Current dimension
       * @return {Array} submatrix
       * @private
       */


      function _getSubmatrix(data, index, dims, dim) {
        var last = dim === dims - 1;
        var range = index.dimension(dim);

        if (last) {
          return range.map(function (i) {
            validateIndex(i, data.length);
            return data[i];
          }).valueOf();
        } else {
          return range.map(function (i) {
            validateIndex(i, data.length);
            var child = data[i];
            return _getSubmatrix(child, index, dims, dim + 1);
          }).valueOf();
        }
      }
      /**
       * Replace a submatrix in this matrix
       * Indexes are zero-based.
       * @memberof DenseMatrix
       * @param {DenseMatrix} matrix
       * @param {Index} index
       * @param {DenseMatrix | Array | *} submatrix
       * @param {*} defaultValue          Default value, filled in on new entries when
       *                                  the matrix is resized.
       * @return {DenseMatrix} matrix
       * @private
       */


      function _set(matrix, index, submatrix, defaultValue) {
        if (!index || index.isIndex !== true) {
          throw new TypeError('Invalid index');
        } // get index size and check whether the index contains a single value


        var iSize = index.size();
        var isScalar = index.isScalar(); // calculate the size of the submatrix, and convert it into an Array if needed

        var sSize;

        if (isMatrix(submatrix)) {
          sSize = submatrix.size();
          submatrix = submatrix.valueOf();
        } else {
          sSize = arraySize(submatrix);
        }

        if (isScalar) {
          // set a scalar
          // check whether submatrix is a scalar
          if (sSize.length !== 0) {
            throw new TypeError('Scalar expected');
          }

          matrix.set(index.min(), submatrix, defaultValue);
        } else {
          // set a submatrix
          // validate dimensions
          if (iSize.length < matrix._size.length) {
            throw new DimensionError(iSize.length, matrix._size.length, '<');
          }

          if (sSize.length < iSize.length) {
            // calculate number of missing outer dimensions
            var i = 0;
            var outer = 0;

            while (iSize[i] === 1 && sSize[i] === 1) {
              i++;
            }

            while (iSize[i] === 1) {
              outer++;
              i++;
            } // unsqueeze both outer and inner dimensions


            submatrix = unsqueeze(submatrix, iSize.length, outer, sSize);
          } // check whether the size of the submatrix matches the index size


          if (!deepStrictEqual(iSize, sSize)) {
            throw new DimensionError(iSize, sSize, '>');
          } // enlarge matrix when needed


          var size = index.max().map(function (i) {
            return i + 1;
          });

          _fit(matrix, size, defaultValue); // insert the sub matrix


          var dims = iSize.length;
          var dim = 0;

          _setSubmatrix(matrix._data, index, submatrix, dims, dim);
        }

        return matrix;
      }
      /**
       * Replace a submatrix of a multi dimensional matrix.
       * @memberof DenseMatrix
       * @param {Array} data
       * @param {Index} index
       * @param {Array} submatrix
       * @param {number} dims   Total number of dimensions
       * @param {number} dim
       * @private
       */


      function _setSubmatrix(data, index, submatrix, dims, dim) {
        var last = dim === dims - 1;
        var range = index.dimension(dim);

        if (last) {
          range.forEach(function (dataIndex, subIndex) {
            validateIndex(dataIndex);
            data[dataIndex] = submatrix[subIndex[0]];
          });
        } else {
          range.forEach(function (dataIndex, subIndex) {
            validateIndex(dataIndex);

            _setSubmatrix(data[dataIndex], index, submatrix[subIndex[0]], dims, dim + 1);
          });
        }
      }
      /**
       * Resize the matrix to the given size. Returns a copy of the matrix when
       * `copy=true`, otherwise return the matrix itself (resize in place).
       *
       * @memberof DenseMatrix
       * @param {number[]} size           The new size the matrix should have.
       * @param {*} [defaultValue=0]      Default value, filled in on new entries.
       *                                  If not provided, the matrix elements will
       *                                  be filled with zeros.
       * @param {boolean} [copy]          Return a resized copy of the matrix
       *
       * @return {Matrix}                 The resized matrix
       */


      DenseMatrix.prototype.resize = function (size, defaultValue, copy) {
        // validate arguments
        if (!isArray(size)) {
          throw new TypeError('Array expected');
        } // matrix to resize


        var m = copy ? this.clone() : this; // resize matrix

        return _resize(m, size, defaultValue);
      };

      function _resize(matrix, size, defaultValue) {
        // check size
        if (size.length === 0) {
          // first value in matrix
          var v = matrix._data; // go deep

          while (isArray(v)) {
            v = v[0];
          }

          return v;
        } // resize matrix


        matrix._size = size.slice(0); // copy the array

        matrix._data = resize(matrix._data, matrix._size, defaultValue); // return matrix

        return matrix;
      }
      /**
       * Reshape the matrix to the given size. Returns a copy of the matrix when
       * `copy=true`, otherwise return the matrix itself (reshape in place).
       *
       * NOTE: This might be better suited to copy by default, instead of modifying
       *       in place. For now, it operates in place to remain consistent with
       *       resize().
       *
       * @memberof DenseMatrix
       * @param {number[]} size           The new size the matrix should have.
       * @param {boolean} [copy]          Return a reshaped copy of the matrix
       *
       * @return {Matrix}                 The reshaped matrix
       */


      DenseMatrix.prototype.reshape = function (size, copy) {
        var m = copy ? this.clone() : this;
        m._data = reshape(m._data, size);
        m._size = size.slice(0);
        return m;
      };
      /**
       * Enlarge the matrix when it is smaller than given size.
       * If the matrix is larger or equal sized, nothing is done.
       * @memberof DenseMatrix
       * @param {DenseMatrix} matrix           The matrix to be resized
       * @param {number[]} size
       * @param {*} defaultValue          Default value, filled in on new entries.
       * @private
       */


      function _fit(matrix, size, defaultValue) {
        var // copy the array
        newSize = matrix._size.slice(0);

        var changed = false; // add dimensions when needed

        while (newSize.length < size.length) {
          newSize.push(0);
          changed = true;
        } // enlarge size when needed


        for (var i = 0, ii = size.length; i < ii; i++) {
          if (size[i] > newSize[i]) {
            newSize[i] = size[i];
            changed = true;
          }
        }

        if (changed) {
          // resize only when size is changed
          _resize(matrix, newSize, defaultValue);
        }
      }
      /**
       * Create a clone of the matrix
       * @memberof DenseMatrix
       * @return {DenseMatrix} clone
       */


      DenseMatrix.prototype.clone = function () {
        var m = new DenseMatrix({
          data: clone(this._data),
          size: clone(this._size),
          datatype: this._datatype
        });
        return m;
      };
      /**
       * Retrieve the size of the matrix.
       * @memberof DenseMatrix
       * @returns {number[]} size
       */


      DenseMatrix.prototype.size = function () {
        return this._size.slice(0); // return a clone of _size
      };
      /**
       * Create a new matrix with the results of the callback function executed on
       * each entry of the matrix.
       * @memberof DenseMatrix
       * @param {Function} callback   The callback function is invoked with three
       *                              parameters: the value of the element, the index
       *                              of the element, and the Matrix being traversed.
       *
       * @return {DenseMatrix} matrix
       */


      DenseMatrix.prototype.map = function (callback) {
        // matrix instance
        var me = this;

        var recurse = function recurse(value, index) {
          if (isArray(value)) {
            return value.map(function (child, i) {
              return recurse(child, index.concat(i));
            });
          } else {
            return callback(value, index, me);
          }
        }; // determine the new datatype when the original matrix has datatype defined
        // TODO: should be done in matrix constructor instead


        var data = recurse(this._data, []);
        var datatype = this._datatype !== undefined ? getArrayDataType(data, typeOf) : undefined;
        return new DenseMatrix(data, datatype);
      };
      /**
       * Execute a callback function on each entry of the matrix.
       * @memberof DenseMatrix
       * @param {Function} callback   The callback function is invoked with three
       *                              parameters: the value of the element, the index
       *                              of the element, and the Matrix being traversed.
       */


      DenseMatrix.prototype.forEach = function (callback) {
        // matrix instance
        var me = this;

        var recurse = function recurse(value, index) {
          if (isArray(value)) {
            value.forEach(function (child, i) {
              recurse(child, index.concat(i));
            });
          } else {
            callback(value, index, me);
          }
        };

        recurse(this._data, []);
      };
      /**
       * Create an Array with a copy of the data of the DenseMatrix
       * @memberof DenseMatrix
       * @returns {Array} array
       */


      DenseMatrix.prototype.toArray = function () {
        return clone(this._data);
      };
      /**
       * Get the primitive value of the DenseMatrix: a multidimensional array
       * @memberof DenseMatrix
       * @returns {Array} array
       */


      DenseMatrix.prototype.valueOf = function () {
        return this._data;
      };
      /**
       * Get a string representation of the matrix, with optional formatting options.
       * @memberof DenseMatrix
       * @param {Object | number | Function} [options]  Formatting options. See
       *                                                lib/utils/number:format for a
       *                                                description of the available
       *                                                options.
       * @returns {string} str
       */


      DenseMatrix.prototype.format = function (options) {
        return format$2(this._data, options);
      };
      /**
       * Get a string representation of the matrix
       * @memberof DenseMatrix
       * @returns {string} str
       */


      DenseMatrix.prototype.toString = function () {
        return format$2(this._data);
      };
      /**
       * Get a JSON representation of the matrix
       * @memberof DenseMatrix
       * @returns {Object}
       */


      DenseMatrix.prototype.toJSON = function () {
        return {
          mathjs: 'DenseMatrix',
          data: this._data,
          size: this._size,
          datatype: this._datatype
        };
      };
      /**
       * Get the kth Matrix diagonal.
       *
       * @memberof DenseMatrix
       * @param {number | BigNumber} [k=0]     The kth diagonal where the vector will retrieved.
       *
       * @returns {Matrix}                     The matrix with the diagonal values.
       */


      DenseMatrix.prototype.diagonal = function (k) {
        // validate k if any
        if (k) {
          // convert BigNumber to a number
          if (isBigNumber(k)) {
            k = k.toNumber();
          } // is must be an integer


          if (!isNumber(k) || !isInteger(k)) {
            throw new TypeError('The parameter k must be an integer number');
          }
        } else {
          // default value
          k = 0;
        }

        var kSuper = k > 0 ? k : 0;
        var kSub = k < 0 ? -k : 0; // rows & columns

        var rows = this._size[0];
        var columns = this._size[1]; // number diagonal values

        var n = Math.min(rows - kSub, columns - kSuper); // x is a matrix get diagonal from matrix

        var data = []; // loop rows

        for (var i = 0; i < n; i++) {
          data[i] = this._data[i + kSub][i + kSuper];
        } // create DenseMatrix


        return new DenseMatrix({
          data: data,
          size: [n],
          datatype: this._datatype
        });
      };
      /**
       * Create a diagonal matrix.
       *
       * @memberof DenseMatrix
       * @param {Array} size                     The matrix size.
       * @param {number | Matrix | Array } value The values for the diagonal.
       * @param {number | BigNumber} [k=0]       The kth diagonal where the vector will be filled in.
       * @param {number} [defaultValue]          The default value for non-diagonal
       * @param {string} [datatype]              The datatype for the diagonal
       *
       * @returns {DenseMatrix}
       */


      DenseMatrix.diagonal = function (size, value, k, defaultValue) {
        if (!isArray(size)) {
          throw new TypeError('Array expected, size parameter');
        }

        if (size.length !== 2) {
          throw new Error('Only two dimensions matrix are supported');
        } // map size & validate


        size = size.map(function (s) {
          // check it is a big number
          if (isBigNumber(s)) {
            // convert it
            s = s.toNumber();
          } // validate arguments


          if (!isNumber(s) || !isInteger(s) || s < 1) {
            throw new Error('Size values must be positive integers');
          }

          return s;
        }); // validate k if any

        if (k) {
          // convert BigNumber to a number
          if (isBigNumber(k)) {
            k = k.toNumber();
          } // is must be an integer


          if (!isNumber(k) || !isInteger(k)) {
            throw new TypeError('The parameter k must be an integer number');
          }
        } else {
          // default value
          k = 0;
        }

        var kSuper = k > 0 ? k : 0;
        var kSub = k < 0 ? -k : 0; // rows and columns

        var rows = size[0];
        var columns = size[1]; // number of non-zero items

        var n = Math.min(rows - kSub, columns - kSuper); // value extraction function

        var _value; // check value


        if (isArray(value)) {
          // validate array
          if (value.length !== n) {
            // number of values in array must be n
            throw new Error('Invalid value array length');
          } // define function


          _value = function _value(i) {
            // return value @ i
            return value[i];
          };
        } else if (isMatrix(value)) {
          // matrix size
          var ms = value.size(); // validate matrix

          if (ms.length !== 1 || ms[0] !== n) {
            // number of values in array must be n
            throw new Error('Invalid matrix length');
          } // define function


          _value = function _value(i) {
            // return value @ i
            return value.get([i]);
          };
        } else {
          // define function
          _value = function _value() {
            // return value
            return value;
          };
        } // discover default value if needed


        if (!defaultValue) {
          // check first value in array
          defaultValue = isBigNumber(_value(0)) ? _value(0).mul(0) // trick to create a BigNumber with value zero
          : 0;
        } // empty array


        var data = []; // check we need to resize array

        if (size.length > 0) {
          // resize array
          data = resize(data, size, defaultValue); // fill diagonal

          for (var d = 0; d < n; d++) {
            data[d + kSub][d + kSuper] = _value(d);
          }
        } // create DenseMatrix


        return new DenseMatrix({
          data: data,
          size: [rows, columns]
        });
      };
      /**
       * Generate a matrix from a JSON object
       * @memberof DenseMatrix
       * @param {Object} json  An object structured like
       *                       `{"mathjs": "DenseMatrix", data: [], size: []}`,
       *                       where mathjs is optional
       * @returns {DenseMatrix}
       */


      DenseMatrix.fromJSON = function (json) {
        return new DenseMatrix(json);
      };
      /**
       * Swap rows i and j in Matrix.
       *
       * @memberof DenseMatrix
       * @param {number} i       Matrix row index 1
       * @param {number} j       Matrix row index 2
       *
       * @return {Matrix}        The matrix reference
       */


      DenseMatrix.prototype.swapRows = function (i, j) {
        // check index
        if (!isNumber(i) || !isInteger(i) || !isNumber(j) || !isInteger(j)) {
          throw new Error('Row index must be positive integers');
        } // check dimensions


        if (this._size.length !== 2) {
          throw new Error('Only two dimensional matrix is supported');
        } // validate index


        validateIndex(i, this._size[0]);
        validateIndex(j, this._size[0]); // swap rows

        DenseMatrix._swapRows(i, j, this._data); // return current instance


        return this;
      };
      /**
       * Swap rows i and j in Dense Matrix data structure.
       *
       * @param {number} i       Matrix row index 1
       * @param {number} j       Matrix row index 2
       * @param {Array} data     Matrix data
       */


      DenseMatrix._swapRows = function (i, j, data) {
        // swap values i <-> j
        var vi = data[i];
        data[i] = data[j];
        data[j] = vi;
      };
      /**
       * Preprocess data, which can be an Array or DenseMatrix with nested Arrays and
       * Matrices. Replaces all nested Matrices with Arrays
       * @memberof DenseMatrix
       * @param {Array} data
       * @return {Array} data
       */


      function preprocess(data) {
        for (var i = 0, ii = data.length; i < ii; i++) {
          var elem = data[i];

          if (isArray(elem)) {
            data[i] = preprocess(elem);
          } else if (elem && elem.isMatrix === true) {
            data[i] = preprocess(elem.valueOf());
          }
        }

        return data;
      }

      return DenseMatrix;
    }, {
      isClass: true
    });

    var name$6 = 'format';
    var dependencies$6 = ['typed'];
    var createFormat = /* #__PURE__ */factory$2(name$6, dependencies$6, function (_ref) {
      var typed = _ref.typed;

      /**
       * Format a value of any type into a string.
       *
       * Syntax:
       *
       *    math.format(value)
       *    math.format(value, options)
       *    math.format(value, precision)
       *    math.format(value, callback)
       *
       * Where:
       *
       *  - `value: *`
       *    The value to be formatted
       *  - `options: Object`
       *    An object with formatting options. Available options:
       *    - `notation: string`
       *      Number notation. Choose from:
       *      - 'fixed'
       *        Always use regular number notation.
       *        For example '123.40' and '14000000'
       *      - 'exponential'
       *        Always use exponential notation.
       *        For example '1.234e+2' and '1.4e+7'
       *      - 'engineering'
       *        Always use engineering notation: always have exponential notation,
       *        and select the exponent to be a multiple of 3.
       *        For example '123.4e+0' and '14.0e+6'
       *      - 'auto' (default)
       *        Regular number notation for numbers having an absolute value between
       *        `lower` and `upper` bounds, and uses exponential notation elsewhere.
       *        Lower bound is included, upper bound is excluded.
       *        For example '123.4' and '1.4e7'.
       *    - `precision: number`
       *      A number between 0 and 16 to round the digits of the number. In case
       *      of notations 'exponential', 'engineering', and 'auto', `precision`
       *      defines the total number of significant digits returned.
       *      In case of notation 'fixed', `precision` defines the number of
       *      significant digits after the decimal point.
       *      `precision` is undefined by default.
       *    - `lowerExp: number`
       *      Exponent determining the lower boundary for formatting a value with
       *      an exponent when `notation='auto`. Default value is `-3`.
       *    - `upperExp: number`
       *      Exponent determining the upper boundary for formatting a value with
       *      an exponent when `notation='auto`. Default value is `5`.
       *    - `fraction: string`. Available values: 'ratio' (default) or 'decimal'.
       *      For example `format(fraction(1, 3))` will output '1/3' when 'ratio' is
       *      configured, and will output `0.(3)` when 'decimal' is configured.
       * - `callback: function`
       *   A custom formatting function, invoked for all numeric elements in `value`,
       *   for example all elements of a matrix, or the real and imaginary
       *   parts of a complex number. This callback can be used to override the
       *   built-in numeric notation with any type of formatting. Function `callback`
       *   is called with `value` as parameter and must return a string.
       *
       * When `value` is an Object:
       *
       * - When the object contains a property `format` being a function, this function
       *   is invoked as `value.format(options)` and the result is returned.
       * - When the object has its own `toString` method, this method is invoked
       *   and the result is returned.
       * - In other cases the function will loop over all object properties and
       *   return JSON object notation like '{"a": 2, "b": 3}'.
       *
       * When value is a function:
       *
       * - When the function has a property `syntax`, it returns this
       *   syntax description.
       * - In other cases, a string `'function'` is returned.
       *
       * Examples:
       *
       *    math.format(6.4)                                        // returns '6.4'
       *    math.format(1240000)                                    // returns '1.24e6'
       *    math.format(1/3)                                        // returns '0.3333333333333333'
       *    math.format(1/3, 3)                                     // returns '0.333'
       *    math.format(21385, 2)                                   // returns '21000'
       *    math.format(12e8, {notation: 'fixed'})                  // returns '1200000000'
       *    math.format(2.3,  {notation: 'fixed', precision: 4})    // returns '2.3000'
       *    math.format(52.8, {notation: 'exponential'})            // returns '5.28e+1'
       *    math.format(12400,{notation: 'engineering'})            // returns '12.400e+3'
       *    math.format(2000, {lowerExp: -2, upperExp: 2})          // returns '2e+3'
       *
       *    function formatCurrency(value) {
       *      // return currency notation with two digits:
       *      return '$' + value.toFixed(2)
       *
       *      // you could also use math.format inside the callback:
       *      // return '$' + math.format(value, {notation: 'fixed', precision: 2})
       *    }
       *    math.format([2.1, 3, 0.016], formatCurrency}            // returns '[$2.10, $3.00, $0.02]'
       *
       * See also:
       *
       *    print
       *
       * @param {*} value                               Value to be stringified
       * @param {Object | Function | number} [options]  Formatting options
       * @return {string} The formatted value
       */
      return typed(name$6, {
        any: format$2,
        'any, Object | function | number': format$2
      });
    });

    /**
     * THIS FILE IS AUTO-GENERATED
     * DON'T MAKE CHANGES HERE
     */
    var Complex$1 = /* #__PURE__ */createComplexClass({});
    var BigNumber = /* #__PURE__ */createBigNumberClass({
      config: config
    });
    var Matrix = /* #__PURE__ */createMatrixClass({});
    var Fraction$1 = /* #__PURE__ */createFractionClass({});
    var DenseMatrix = /* #__PURE__ */createDenseMatrixClass({
      Matrix: Matrix
    });
    var typed = /* #__PURE__ */createTyped({
      BigNumber: BigNumber,
      Complex: Complex$1,
      DenseMatrix: DenseMatrix,
      Fraction: Fraction$1
    });
    var format$3 = /* #__PURE__ */createFormat({
      typed: typed
    });

    function handlePathElement(element, options) {
      const { properties, style } = extractProps(element, options);
      options.lastPathId++;

      const dataPointElements = parseDataPoints(properties.d);

      const swiftString = convertPathToSwift(dataPointElements, options);

      return swiftString;
    }

    function convertPathToSwift(dataPointElements, options) {
      console.log(dataPointElements);
      console.log(options);

      const identation = "        ";

      let swiftString = "";
      for (const el of dataPointElements) {
        switch (el.command) {
          case "M":
            swiftString +=
              identation + generateMoveToSwift(el.data, options) + "\n";
            break;
          case "L":
            swiftString +=
              identation + generateLineToSwift(el.data, options) + "\n";
            break;
          case "H":
            break;
          case "V":
            break;
          case "C":
            swiftString +=
              identation + generateCubicCurveSwift(el.data, options) + "\n";
            break;
          case "S":
            break;
          case "Q":
            break;
          case "T":
            break;
          case "A":
            break;
          case "Z":
            swiftString += identation + generateClosePathSwift() + "\n";
            break;
          default:
            console.error(
              `Unsupported path data point, please consider contributing on Github to help bring ${el.command} to this tool.`
            );
        }
      }

      return swiftString;
    }

    function parseDataPoints(dStr) {
      let elements = [];

      let lastElementId;

      for (let i = 0; i < dStr.length; i++) {
        if (/[a-zA-Z]/.test(dStr[i])) {
          // New command.
          lastElementId = elements.length;
          elements.push([dStr[i]]);
        } else {
          // Continue adding to the previous command
          if (elements[lastElementId].length == 1) {
            elements[lastElementId].push(dStr[i]);
          } else {
            elements[lastElementId][1] += dStr[i];
          }
        }
      }

      elements = elements.map((el) => {
        const command = el[0];
        if (el.length > 1) {
          const data = el[1]
            .trim()
            .split(" ")
            .map((val) =>
              val
                .trim()
                .split(",")
                .map((v) => parseFloat(v))
            );
          return { command, data };
        } else {
          return { command };
        }
      });

      return elements;
    }

    function generateMoveToSwift(data, options) {
      const [x, y] = data[0];
      const fmtOpts = {
        notation: "fixed",
        precision: options.numberPrecision,
      };

      const px = parseFloat(format$3(x / options.viewBox.width, fmtOpts));
      const py = parseFloat(format$3(y / options.viewBox.height, fmtOpts));

      return `path.move(to: CGPoint(x: ${px}*width, y: ${py}*height))`;
    }

    function generateLineToSwift(data, options) {
      const [x, y] = data[0];
      const fmtOpts = {
        notation: "fixed",
        precision: options.numberPrecision,
      };

      const px = parseFloat(format$3(x / options.viewBox.width, fmtOpts));
      const py = parseFloat(format$3(y / options.viewBox.height, fmtOpts));

      return `path.addLine(to: CGPoint(x: ${px}*width, y: ${py}*height))`;
    }

    function generateClosePathSwift(data, options) {
      return `path.closeSubpath()`;
    }

    function generateCubicCurveSwift(data, options) {
      const [p2, p3, p1] = data;
      const fmtOpts = {
        notation: "fixed",
        precision: options.numberPrecision,
      };

      const p1x = parseFloat(format$3(p1[0] / options.viewBox.width, fmtOpts));
      const p1y = parseFloat(format$3(p1[1] / options.viewBox.height, fmtOpts));

      const p2y = parseFloat(format$3(p2[1] / options.viewBox.height, fmtOpts));
      const p2x = parseFloat(format$3(p2[0] / options.viewBox.width, fmtOpts));

      const p3x = parseFloat(format$3(p3[0] / options.viewBox.width, fmtOpts));
      const p3y = parseFloat(format$3(p3[1] / options.viewBox.height, fmtOpts));

      return [
        `path.addCurve(to: CGPoint(x: ${p1x}*width, y: ${p1y}*height),`,
        `control1: CGPoint(x: ${p2x}*width, y: ${p2y}*height),`,
        `control2: CGPoint(x: ${p3x}*width, y: ${p3y}*height))`,
      ].join("");
    }

    function handleElement(element, options) {
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

    function convertToPixels(number) {
      const unit = String(number).substr(-2, 2);
      if (unit.search(/^[a-z]{2}$/i) != -1) {
        switch (unit) {
          case "em":
            return 0;
          case "ex":
            return 0;
          case "px":
            return parseFloat(number);
          case "pt":
            return parseFloat(number);
          case "pc":
            return 0;
          case "cm":
            return 0;
          case "mm":
            return 0;
          case "in":
            return 0;
          default:
            return 0;
        }
      } else {
        return parseFloat(number);
      }
    }

    function SwiftGenerator(svgJsonTree) {
      const { isSupportedVersion, width, height, viewBox } = parseSvgElement(
        svgJsonTree
      );

      if (!isSupportedVersion) {
        alert("Please pase valid version of SVG! (1.1)");
        return "Please use SVG verison 1.1!";
      }

      const svgPrimitives = getPrimitives(svgJsonTree);

      const numberPrecision = 5;

      const shapeName = "MyCustomShape";
      let swiftString = `struct ${shapeName}: Shape {\n`;
      swiftString += `    func path(in rect: CGRect) -> Path{\n`;
      swiftString += `        var path = Path()\n`;
      swiftString += `        let width = rect.size.width\n`;
      swiftString += `        let height = rect.size.height\n\n`;

      for (const element of svgPrimitives) {
        swiftString += handleElement(element, {
          viewBox,
          width,
          height,
          numberPrecision,
          lastPathId: 0,
        });
        swiftString += "\n";
      }

      swiftString += `        return path\n`;
      swiftString += `    }\n}`;

      return swiftString;
    }

    function getPrimitives(svgJsonTree) {
      const svg = select_1("svg", svgJsonTree);
      const elements = svg.children;
      return elements;
    }

    function parseSvgElement(svgJsonTree) {
      const svg = select_1("svg", svgJsonTree);
      const { properties } = svg;
      const { version, viewBox, width, height } = properties;

      // Parse width and height
      const widthUnit = convertToPixels(width);
      const heightUnit = convertToPixels(height);

      // Validiate and parse view box.
      const viewBoxElements = String(viewBox)
        .split(" ")
        .map((n) => parseFloat(n));
      const [vbx, vby, vbWidth, vbHeight] = viewBoxElements;
      const viewBoxValid =
        !isNaN(vbx) && !isNaN(vby) && !isNaN(vbWidth) && !isNaN(vbHeight);

      return {
        isSupportedVersion: version == 1.1,
        width: widthUnit,
        height: heightUnit,
        viewBox: viewBoxValid
          ? { x: vbx, y: vby, width: vbWidth, height: vbHeight } // If view box is provided, use it.
          : { x: 0, y: 0, width: widthUnit, height: heightUnit }, // Otherwise use width and height.
      };
    }

    /* src/App.svelte generated by Svelte v3.22.2 */
    const file = "src/App.svelte";

    function create_fragment(ctx) {
    	let main;
    	let h1;
    	let t1;
    	let i;
    	let t2;
    	let a;
    	let t4;
    	let t5;
    	let h20;
    	let t7;
    	let div0;
    	let textarea0;
    	let t8;
    	let button;
    	let t10;
    	let h21;
    	let t12;
    	let div1;
    	let textarea1;
    	let dispose;

    	const block = {
    		c: function create() {
    			main = element("main");
    			h1 = element("h1");
    			h1.textContent = "Welcome!";
    			t1 = space();
    			i = element("i");
    			t2 = text("Functionality is very limited for now, feel free to contribute on ");
    			a = element("a");
    			a.textContent = "Github";
    			t4 = text(".");
    			t5 = space();
    			h20 = element("h2");
    			h20.textContent = "Paste SVG code below:";
    			t7 = space();
    			div0 = element("div");
    			textarea0 = element("textarea");
    			t8 = space();
    			button = element("button");
    			button.textContent = "Convert to SwiftUI Shape!";
    			t10 = space();
    			h21 = element("h2");
    			h21.textContent = "Swift code wil be shown below:";
    			t12 = space();
    			div1 = element("div");
    			textarea1 = element("textarea");
    			add_location(h1, file, 18, 2, 1421);
    			attr_dev(a, "href", "https://github.com/bring-shrubbery/SVG-to-SwiftUI");
    			attr_dev(a, "target", "_blank");
    			add_location(a, file, 19, 71, 1510);
    			add_location(i, file, 19, 2, 1441);
    			add_location(h20, file, 20, 2, 1604);
    			add_location(textarea0, file, 22, 4, 1647);
    			add_location(div0, file, 21, 2, 1637);
    			add_location(button, file, 24, 2, 1693);
    			add_location(h21, file, 25, 2, 1767);
    			textarea1.value = /*swiftOutput*/ ctx[1];
    			attr_dev(textarea1, "id", "swift-output-area");
    			add_location(textarea1, file, 27, 4, 1819);
    			add_location(div1, file, 26, 2, 1809);
    			add_location(main, file, 17, 0, 1412);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h1);
    			append_dev(main, t1);
    			append_dev(main, i);
    			append_dev(i, t2);
    			append_dev(i, a);
    			append_dev(i, t4);
    			append_dev(main, t5);
    			append_dev(main, h20);
    			append_dev(main, t7);
    			append_dev(main, div0);
    			append_dev(div0, textarea0);
    			set_input_value(textarea0, /*svgInput*/ ctx[0]);
    			append_dev(main, t8);
    			append_dev(main, button);
    			append_dev(main, t10);
    			append_dev(main, h21);
    			append_dev(main, t12);
    			append_dev(main, div1);
    			append_dev(div1, textarea1);
    			if (remount) run_all(dispose);

    			dispose = [
    				listen_dev(textarea0, "input", /*textarea0_input_handler*/ ctx[3]),
    				listen_dev(button, "click", /*generateSwiftCode*/ ctx[2], false, false, false)
    			];
    		},
    		p: function update(ctx, [dirty]) {
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
    	let svgInput = `<svg width="300px" height="300px" viewBox="0 0 300 300" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
        <path d="M100,100 C100,59.875 100,33.2083333 100,20 C100,6.79166667 106.666667,0.124666263 120,-0.00100120993 L180,-0.00100120993 C193.333333,-0.00387801145 200,6.66312239 200,20 C200,33.3368776 200,60.0035443 200,100 C240,100 266.666667,100 280,100 C293.334856,100 300.002284,106.666667 300.002284,120 L300.002284,180 C300.052004,193.333333 293.384576,200 280,200 C266.615424,200 239.949124,200 200.001101,200 C200.001835,240 200.001835,266.666667 200.001101,280 C200.000367,293.334213 193.333333,300.001319 180,300.001319 L120,300.001319 C106.666667,300.109608 100,293.442502 100,280 C100,266.557498 100,239.890832 100,200 C60,200 33.3333333,200 20,200 C6.66605299,200 -0.000920519104,193.333333 -0.000920519104,180 L-0.000920519104,120 C-0.0324730702,106.666667 6.63450044,100 20,100 C33.3654996,100 60.0321662,100 100,100 Z" id="Path" fill="#000000"></path>
    </g>
</svg>`;

    	let swiftOutput = "";

    	const generateSwiftCode = () => {
    		const svgJsonTree = parse(svgInput.trim());
    		$$invalidate(1, swiftOutput = SwiftGenerator(svgJsonTree));
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("App", $$slots, []);

    	function textarea0_input_handler() {
    		svgInput = this.value;
    		$$invalidate(0, svgInput);
    	}

    	$$self.$capture_state = () => ({
    		parse,
    		SwiftGenerator,
    		svgInput,
    		swiftOutput,
    		generateSwiftCode
    	});

    	$$self.$inject_state = $$props => {
    		if ("svgInput" in $$props) $$invalidate(0, svgInput = $$props.svgInput);
    		if ("swiftOutput" in $$props) $$invalidate(1, swiftOutput = $$props.swiftOutput);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [svgInput, swiftOutput, generateSwiftCode, textarea0_input_handler];
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

    return app;

}());
//# sourceMappingURL=bundle.js.map
