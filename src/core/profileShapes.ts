/**
 * Cross-section outlines for the extrusion profile shapes, as pure 2D point
 * lists (mm, centered at the origin). Framework-free so the geometry can be
 * unit-tested; the 3D layer turns these into THREE.Shape/ExtrudeGeometry.
 *
 * Conventions: outer contours wind counter-clockwise, holes clockwise.
 * All shapes fit inside the sectionMm × sectionMm bounding square.
 */

export type ProfileShape = 'square' | 'round' | 'angle' | 'tee' | 'bosch';

export const PROFILE_SHAPES: { id: ProfileShape; label: string }[] = [
  { id: 'square', label: 'Square tube' },
  { id: 'round', label: 'Round pipe' },
  { id: 'angle', label: 'L angle' },
  { id: 'tee', label: 'T profile' },
  { id: 'bosch', label: 'Bosch (T-slot)' },
];

export function isProfileShape(v: unknown): v is ProfileShape {
  return PROFILE_SHAPES.some((s) => s.id === v);
}

/** The shape of a profile, defaulting legacy profiles to a square tube. */
export function profileShapeOf(p: { shape?: ProfileShape }): ProfileShape {
  return p.shape && isProfileShape(p.shape) ? p.shape : 'square';
}

/** A closed polygon; the closing edge back to the first point is implicit. */
export type Contour = [number, number][];

export type SectionOutline = {
  outer: Contour;
  holes: Contour[];
};

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

function circle(r: number, segments: number, clockwise: boolean): Contour {
  const pts: Contour = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2 * (clockwise ? -1 : 1);
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return pts;
}

/** Rotate a contour by k × 90° around the origin. */
function rot90(points: Contour, k: number): Contour {
  let pts = points;
  for (let i = 0; i < k; i++) {
    pts = pts.map(([x, y]) => [-y, x] as [number, number]);
  }
  return pts;
}

function squareTube(s: number): SectionOutline {
  const h = s / 2;
  const t = clamp(s * 0.12, 1, 6);
  const outer: Contour = [
    [-h, -h],
    [h, -h],
    [h, h],
    [-h, h],
  ];
  const inner = h - t;
  // Tiny sections render solid rather than with a degenerate wall.
  if (inner <= 0.25) return { outer, holes: [] };
  const hole: Contour = [
    [-inner, -inner],
    [-inner, inner],
    [inner, inner],
    [inner, -inner],
  ];
  return { outer, holes: [hole] };
}

function roundPipe(s: number): SectionOutline {
  const r = s / 2;
  const t = clamp(s * 0.12, 1, 6);
  const inner = r - t;
  return {
    outer: circle(r, 48, false),
    holes: inner > 0.25 ? [circle(inner, 32, true)] : [],
  };
}

function angleL(s: number): SectionOutline {
  const h = s / 2;
  const t = Math.min(clamp(s * 0.18, 1.5, 8), s / 2);
  return {
    outer: [
      [-h, -h],
      [h, -h],
      [h, -h + t],
      [-h + t, -h + t],
      [-h + t, h],
      [-h, h],
    ],
    holes: [],
  };
}

function teeT(s: number): SectionOutline {
  const h = s / 2;
  const t = Math.min(clamp(s * 0.18, 1.5, 8), s / 2);
  const t2 = t / 2;
  return {
    outer: [
      [h, h],
      [-h, h],
      [-h, h - t],
      [-t2, h - t],
      [-t2, -h],
      [t2, -h],
      [t2, h - t],
      [h, h - t],
    ],
    holes: [],
  };
}

/**
 * Stylized Bosch/Item-style T-slot extrusion: a square with a T-slot groove
 * centered on each of the four faces and a round center bore. Proportions are
 * tuned to read clearly at typical sections (20–45 mm).
 */
function boschTSlot(s: number): SectionOutline {
  const h = s / 2;
  const a2 = (s * 0.26) / 2; // slot opening half-width at the surface
  // Cavity half-width must stay below h - depth (= 0.22s), otherwise adjacent
  // faces' cavities cross and the outer contour self-intersects, corrupting
  // the extruded mesh.
  const b2 = (s * 0.4) / 2; // inner cavity half-width
  const lip = s * 0.09; // depth of the narrow lip
  const depth = s * 0.28; // total cavity depth

  // Top face, traversed CCW (right → left). The face's trailing corner is
  // supplied by the next face after rotation.
  const face: Contour = [
    [h, h],
    [a2, h],
    [a2, h - lip],
    [b2, h - lip],
    [b2, h - depth],
    [-b2, h - depth],
    [-b2, h - lip],
    [-a2, h - lip],
    [-a2, h],
  ];
  const outer: Contour = [
    ...face,
    ...rot90(face, 1),
    ...rot90(face, 2),
    ...rot90(face, 3),
  ];
  const bore = s * 0.14;
  return { outer, holes: [circle(bore, 24, true)] };
}

/** The cross-section outline for a profile shape at the given section size. */
export function sectionOutline(shape: ProfileShape, sectionMm: number): SectionOutline {
  const s = Math.max(1, sectionMm);
  switch (shape) {
    case 'round':
      return roundPipe(s);
    case 'angle':
      return angleL(s);
    case 'tee':
      return teeT(s);
    case 'bosch':
      return boschTSlot(s);
    case 'square':
    default:
      return squareTube(s);
  }
}

/** Signed polygon area via the shoelace formula (positive = CCW). */
export function contourArea(points: Contour): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}
