import {Properties} from 'hast';
import {ElementNode} from 'svg-parser';

type StyleData = Record<string, string | number>;

/**
 * Extracts
 * @param element Element node which
 * @param options
 */
export function extractStyle(element: ElementNode): StyleData {
  const props = element.properties;

  if (props) {
    if (typeof props.style === 'string') {
      return parseStyle(props.style);
    } else {
      return filterStyleProps(props);
    }
  } else {
    throw new Error(`No properties found on ${element.tagName} node!`);
  }
}

/**
 * Converts style property value into a map where key is
 * the style rule and value is the value of that rule.
 * @param style Style property string.
 */
export function parseStyle(style: string): StyleData {
  const styleProperties: StyleData = {};

  // Extract style statements into array of strings.
  const styleArray = style
    .replace(/\s/g, '')
    .split(';')
    .map(el => {
      const [property, value] = el.split(':');
      return {property, value};
    });

  // Remap array of {property, value} objects into a map.
  for (const el of styleArray) {
    styleProperties[el.property] = el.value;
  }

  return styleProperties;
}

/**
 * Filters out just the properties that are considered
 * style properties, i.e. `fill`, `color`, etc.
 * @param props Any properties from the HAST node.
 */
export function filterStyleProps(props: Properties): StyleData {
  return Object.keys(props)
    .filter(key => StylePropertiesSet.has(key))
    .reduce((obj, key) => {
      obj[key] = props[key];
      return obj;
    }, {});
}

export const StylePropertiesSet = new Set([
  'alignment-baseline',
  'baseline-shift',
  'clip', // Deprecated
  'clip-path',
  'clip-rule',
  'color',
  'color-interpolation',
  'color-interpolation-filters',
  'color-profile', // Deprecated since SVG 2
  'color-rendering',
  'cursor',
  'direction',
  'display',
  'dominant-baseline',
  'enable-background', // Deprecated since SVG 2
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
  'glyph-orientation-horizontal', // Deprecated since SVG 2
  'glyph-orientation-vertical', // Deprecated since SVG 2
  'image-rendering',
  'kerning', // Deprecated since SVG 2
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
