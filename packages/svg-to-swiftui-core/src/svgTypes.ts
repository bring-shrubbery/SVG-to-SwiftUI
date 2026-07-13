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
  cx?: string | number;
  cy?: string | number;
  r?: string | number;
  pathLength?: string;
}

export interface SVGEllipseAttributes extends SVGBaseAttributes {
  cx?: string | number;
  cy?: string | number;
  rx?: string | number;
  ry?: string | number;
  pathLength?: string;
}

export interface SVGRectAttributes extends SVGBaseAttributes {
  x: string | number;
  y: string | number;
  width: string | number;
  height: string | number;
  rx: string | number;
  ry: string | number;
  pathLength: string;
}
