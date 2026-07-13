import colorNames from "color-name";

interface RGBAColor {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));

function parseHexColor(value: string): RGBAColor | undefined {
  const hex = value.slice(1);
  if (![3, 4, 6, 8].includes(hex.length) || !/^[\da-f]+$/i.test(hex)) return undefined;

  const expanded = hex.length <= 4 ? [...hex].map((component) => `${component}${component}`).join("") : hex;
  const withAlpha = expanded.length === 6 ? `${expanded}ff` : expanded;

  return {
    red: parseInt(withAlpha.slice(0, 2), 16) / 255,
    green: parseInt(withAlpha.slice(2, 4), 16) / 255,
    blue: parseInt(withAlpha.slice(4, 6), 16) / 255,
    alpha: parseInt(withAlpha.slice(6, 8), 16) / 255,
  };
}

function parseChannel(value: string): number | undefined {
  const trimmed = value.trim();
  const number = Number(trimmed.endsWith("%") ? trimmed.slice(0, -1) : trimmed);
  if (!Number.isFinite(number)) return undefined;
  return clamp(trimmed.endsWith("%") ? number / 100 : number / 255);
}

function parseAlpha(value: string): number | undefined {
  const trimmed = value.trim();
  const number = Number(trimmed.endsWith("%") ? trimmed.slice(0, -1) : trimmed);
  if (!Number.isFinite(number)) return undefined;
  return clamp(trimmed.endsWith("%") ? number / 100 : number);
}

function parseRGBColor(value: string): RGBAColor | undefined {
  const match = /^rgba?\((.*)\)$/i.exec(value);
  if (!match) return undefined;

  const body = match[1]!.trim();
  let channels: string[];
  let alpha = "1";

  if (body.includes(",")) {
    const parts = body.split(",").map((part) => part.trim());
    if (parts.length !== 3 && parts.length !== 4) return undefined;
    channels = parts.slice(0, 3);
    alpha = parts[3] ?? alpha;
  } else {
    const [channelPart, alphaPart] = body.split("/").map((part) => part.trim());
    channels = channelPart!.split(/\s+/);
    if (channels.length !== 3) return undefined;
    alpha = alphaPart ?? alpha;
  }

  const red = parseChannel(channels[0]!);
  const green = parseChannel(channels[1]!);
  const blue = parseChannel(channels[2]!);
  const parsedAlpha = parseAlpha(alpha);
  if (red === undefined || green === undefined || blue === undefined || parsedAlpha === undefined) return undefined;

  return { red, green, blue, alpha: parsedAlpha };
}

function parseHue(value: string): number | undefined {
  const trimmed = value.trim().toLowerCase();
  const number = Number.parseFloat(trimmed);
  if (!Number.isFinite(number)) return undefined;

  let degrees = number;
  if (trimmed.endsWith("turn")) degrees = number * 360;
  else if (trimmed.endsWith("rad")) degrees = (number * 180) / Math.PI;
  else if (trimmed.endsWith("grad")) degrees = number * 0.9;

  return ((degrees % 360) + 360) % 360;
}

function parsePercentage(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed.endsWith("%")) return undefined;
  const number = Number(trimmed.slice(0, -1));
  return Number.isFinite(number) ? clamp(number / 100) : undefined;
}

function parseHSLColor(value: string): RGBAColor | undefined {
  const match = /^hsla?\((.*)\)$/i.exec(value);
  if (!match) return undefined;

  const body = match[1]!.trim();
  let channels: string[];
  let alpha = "1";

  if (body.includes(",")) {
    const parts = body.split(",").map((part) => part.trim());
    if (parts.length !== 3 && parts.length !== 4) return undefined;
    channels = parts.slice(0, 3);
    alpha = parts[3] ?? alpha;
  } else {
    const [channelPart, alphaPart] = body.split("/").map((part) => part.trim());
    channels = channelPart!.split(/\s+/);
    if (channels.length !== 3) return undefined;
    alpha = alphaPart ?? alpha;
  }

  const hue = parseHue(channels[0]!);
  const saturation = parsePercentage(channels[1]!);
  const lightness = parsePercentage(channels[2]!);
  const parsedAlpha = parseAlpha(alpha);
  if (hue === undefined || saturation === undefined || lightness === undefined || parsedAlpha === undefined) {
    return undefined;
  }

  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const section = hue / 60;
  const secondary = chroma * (1 - Math.abs((section % 2) - 1));
  const [red, green, blue] =
    section < 1
      ? [chroma, secondary, 0]
      : section < 2
        ? [secondary, chroma, 0]
        : section < 3
          ? [0, chroma, secondary]
          : section < 4
            ? [0, secondary, chroma]
            : section < 5
              ? [secondary, 0, chroma]
              : [chroma, 0, secondary];
  const offset = lightness - chroma / 2;
  return { red: red + offset, green: green + offset, blue: blue + offset, alpha: parsedAlpha };
}

function formatComponent(value: number): string {
  return String(Number(clamp(value).toFixed(4)));
}

export function parseOpacity(value: string | number | undefined): number {
  if (value === undefined) return 1;
  return parseAlpha(String(value)) ?? 1;
}

export function swiftUIColor(paint: string, opacity = 1): string | undefined {
  const normalized = paint.trim().toLowerCase();
  if (normalized === "currentcolor") {
    const effectiveOpacity = clamp(opacity);
    return effectiveOpacity === 1 ? "Color.primary" : `Color.primary.opacity(${formatComponent(effectiveOpacity)})`;
  }

  const namedChannels = colorNames[normalized as keyof typeof colorNames];
  const color =
    normalized === "transparent"
      ? parseHexColor("#00000000")
      : namedChannels
        ? { red: namedChannels[0] / 255, green: namedChannels[1] / 255, blue: namedChannels[2] / 255, alpha: 1 }
        : normalized.startsWith("#")
          ? parseHexColor(normalized)
          : (parseRGBColor(normalized) ?? parseHSLColor(normalized));
  if (!color) return undefined;

  const alpha = clamp(color.alpha * opacity);
  const channels = `red: ${formatComponent(color.red)}, green: ${formatComponent(color.green)}, blue: ${formatComponent(color.blue)}`;
  return alpha === 1 ? `Color(${channels})` : `Color(${channels}, opacity: ${formatComponent(alpha)})`;
}
