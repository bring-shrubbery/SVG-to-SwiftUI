interface SVGBaseAttributes {
  id?: string;
  class?: string;
  style?: string;
}

export interface SVGPathAttributes extends SVGBaseAttributes {
  d?: string;
  pathLength?: string;
}

export interface SVGCircleAttributes extends SVGBaseAttributes {
  cx?: string;
  cy?: string;
  r?: string;
  pathLength?: string;
}

export interface SVGEllipseAttributes extends SVGBaseAttributes {
  cx?: string;
  cy?: string;
  rx?: string;
  ry?: string;
  pathLength?: string;
}

export interface SVGRectAttributes extends SVGBaseAttributes {
  x: string;
  y: string;
  width: string;
  height: string;
  rx: string;
  ry: string;
  pathLength: string;
}
