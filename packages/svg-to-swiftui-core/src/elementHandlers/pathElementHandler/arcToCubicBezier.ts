/**
 * Converts an SVG arc to one or more cubic bezier curves.
 * Based on the SVG spec's arc parameterization algorithm.
 */

interface ArcParams {
  x1: number; // start x (current point)
  y1: number; // start y (current point)
  rx: number; // x radius
  ry: number; // y radius
  xAxisRotation: number; // in degrees
  largeArc: boolean;
  sweep: boolean;
  x2: number; // end x
  y2: number; // end y
}

interface CubicCurve {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x: number;
  y: number;
}

const TAU = Math.PI * 2;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function vectorAngle(ux: number, uy: number, vx: number, vy: number): number {
  const sign = ux * vy - uy * vx < 0 ? -1 : 1;
  const dot = ux * vx + uy * vy;
  const uLen = Math.sqrt(ux * ux + uy * uy);
  const vLen = Math.sqrt(vx * vx + vy * vy);
  let ratio = dot / (uLen * vLen);
  // Clamp to [-1, 1] due to floating point errors
  if (ratio > 1) ratio = 1;
  if (ratio < -1) ratio = -1;
  return sign * Math.acos(ratio);
}

function getArcCenter(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  fa: boolean,
  fs: boolean,
  rx: number,
  ry: number,
  sinPhi: number,
  cosPhi: number,
): [number, number, number, number] {
  const x1p = (cosPhi * (x1 - x2)) / 2 + (sinPhi * (y1 - y2)) / 2;
  const y1p = (-sinPhi * (x1 - x2)) / 2 + (cosPhi * (y1 - y2)) / 2;

  const rxSq = rx * rx;
  const rySq = ry * ry;
  const x1pSq = x1p * x1p;
  const y1pSq = y1p * y1p;

  let radicand = rxSq * rySq - rxSq * y1pSq - rySq * x1pSq;
  if (radicand < 0) radicand = 0;
  radicand /= rxSq * y1pSq + rySq * x1pSq;
  radicand = Math.sqrt(radicand) * (fa === fs ? -1 : 1);

  const cxp = radicand * ((rx * y1p) / ry);
  const cyp = radicand * (-(ry * x1p) / rx);

  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  const v1x = (x1p - cxp) / rx;
  const v1y = (y1p - cyp) / ry;
  const v2x = (-x1p - cxp) / rx;
  const v2y = (-y1p - cyp) / ry;

  const theta1 = vectorAngle(1, 0, v1x, v1y);
  let dtheta = vectorAngle(v1x, v1y, v2x, v2y);

  if (!fs && dtheta > 0) dtheta -= TAU;
  if (fs && dtheta < 0) dtheta += TAU;

  return [cx, cy, theta1, dtheta];
}

function approximateUnitArc(theta1: number, dtheta: number): [number, number, number, number, number, number] {
  const alpha = (4 / 3) * Math.tan(dtheta / 4);

  const x1 = Math.cos(theta1);
  const y1 = Math.sin(theta1);
  const x2 = Math.cos(theta1 + dtheta);
  const y2 = Math.sin(theta1 + dtheta);

  return [x1, y1, x1 - y1 * alpha, y1 + x1 * alpha, x2 + y2 * alpha, y2 - x2 * alpha];
}

export function arcToCubicCurves(params: ArcParams): CubicCurve[] {
  let { rx, ry } = params;
  const { x1, y1, x2, y2, xAxisRotation, largeArc, sweep } = params;

  // If endpoints are identical, no arc
  if (x1 === x2 && y1 === y2) return [];

  // If radii are zero, treat as line
  if (rx === 0 || ry === 0) {
    return [{ x1: x2, y1: y2, x2: x2, y2: y2, x: x2, y: y2 }];
  }

  const phi = toRadians(xAxisRotation % 360);
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);

  // Step 1: Ensure radii are positive and large enough
  rx = Math.abs(rx);
  ry = Math.abs(ry);

  // Scale radii if too small
  const x1p = (cosPhi * (x1 - x2)) / 2 + (sinPhi * (y1 - y2)) / 2;
  const y1p = (-sinPhi * (x1 - x2)) / 2 + (cosPhi * (y1 - y2)) / 2;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const sqrtLambda = Math.sqrt(lambda);
    rx *= sqrtLambda;
    ry *= sqrtLambda;
  }

  const [cx, cy, theta1, dtheta] = getArcCenter(x1, y1, x2, y2, largeArc, sweep, rx, ry, sinPhi, cosPhi);

  // Split into segments of <= 90 degrees
  const segments = Math.max(Math.ceil(Math.abs(dtheta) / (TAU / 4)), 1);
  const segmentAngle = dtheta / segments;

  const curves: CubicCurve[] = [];

  for (let i = 0; i < segments; i++) {
    const angle = theta1 + i * segmentAngle;
    const [_ux1, _uy1, cp1x, cp1y, cp2x, cp2y] = approximateUnitArc(angle, segmentAngle);

    // Transform back from unit circle
    const endX = Math.cos(angle + segmentAngle);
    const endY = Math.sin(angle + segmentAngle);

    curves.push({
      x1: cosPhi * rx * cp1x - sinPhi * ry * cp1y + cx,
      y1: sinPhi * rx * cp1x + cosPhi * ry * cp1y + cy,
      x2: cosPhi * rx * cp2x - sinPhi * ry * cp2y + cx,
      y2: sinPhi * rx * cp2x + cosPhi * ry * cp2y + cy,
      x: cosPhi * rx * endX - sinPhi * ry * endY + cx,
      y: sinPhi * rx * endX + cosPhi * ry * endY + cy,
    });
  }

  return curves;
}
