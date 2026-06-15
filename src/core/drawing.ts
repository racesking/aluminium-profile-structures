import type { Vec3 } from './types';
import type { CutMember } from './joints';
import type { LengthUnit } from './units';
import { formatLength } from './units';

/**
 * Renders the parametric structure as an isometric technical drawing (SVG):
 * member lines, overall W/D/H dimension lines with arrowheads, and numbered
 * balloon callouts keyed to a parts list.
 */

type Pt = { x: number; y: number };

const COS30 = Math.cos(Math.PI / 6);
const SIN30 = Math.sin(Math.PI / 6);

/** Standard isometric projection. Axes: X = width, Y = up, Z = depth. */
export function iso(p: Vec3): Pt {
  return {
    x: (p[0] - p[2]) * COS30,
    y: (p[0] + p[2]) * SIN30 - p[1],
  };
}

export type DrawingItem = {
  n: number;
  role: string;
  color: string;
  lengthMm: number;
  qty: number;
};

const W = 720;
const MARGIN = 88;
const MAX_BODY_H = 440;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function arrowHead(at: Pt, dir: Pt, size = 7): string {
  const ang = Math.atan2(dir.y, dir.x);
  const a1 = ang + Math.PI - 0.42;
  const a2 = ang + Math.PI + 0.42;
  const p1 = `${(at.x + size * Math.cos(a1)).toFixed(1)},${(at.y + size * Math.sin(a1)).toFixed(1)}`;
  const p2 = `${(at.x + size * Math.cos(a2)).toFixed(1)},${(at.y + size * Math.sin(a2)).toFixed(1)}`;
  return `<polygon points="${at.x.toFixed(1)},${at.y.toFixed(1)} ${p1} ${p2}" fill="#111"/>`;
}

function norm(p: Pt): Pt {
  const l = Math.hypot(p.x, p.y) || 1;
  return { x: p.x / l, y: p.y / l };
}

export function structureDrawingSvg(
  members: CutMember[],
  roleColors: Map<string, string>,
  units: LengthUnit,
): { svg: string; items: DrawingItem[] } {
  if (members.length === 0) return { svg: '', items: [] };

  const proj = members.map((m) => ({ a: iso(m.from), b: iso(m.to), m }));

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const { a, b } of proj) {
    for (const p of [a, b]) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
  }
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const scale = Math.min((W - 2 * MARGIN) / spanX, MAX_BODY_H / spanY);
  const offsetX = (W - spanX * scale) / 2;
  const H = spanY * scale + 2 * MARGIN;

  const toScreen = (p: Pt): Pt => ({
    x: (p.x - minX) * scale + offsetX,
    y: (p.y - minY) * scale + MARGIN,
  });

  // 3D bounding box (centerline geometry).
  let nx = Infinity, xx = -Infinity, ny = Infinity, xy = -Infinity, nz = Infinity, xz = -Infinity;
  for (const m of members) {
    for (const p of [m.from, m.to]) {
      nx = Math.min(nx, p[0]); xx = Math.max(xx, p[0]);
      ny = Math.min(ny, p[1]); xy = Math.max(xy, p[1]);
      nz = Math.min(nz, p[2]); xz = Math.max(xz, p[2]);
    }
  }

  const parts: string[] = [];

  // ---- members ----
  for (const { a, b, m } of proj) {
    const sa = toScreen(a);
    const sb = toScreen(b);
    const color = roleColors.get(m.role) ?? '#444';
    parts.push(
      `<line x1="${sa.x.toFixed(1)}" y1="${sa.y.toFixed(1)}" x2="${sb.x.toFixed(1)}" y2="${sb.y.toFixed(1)}" stroke="${color}" stroke-width="3.5" stroke-linecap="round"/>`,
    );
  }

  const centroid = (() => {
    let sx = 0, sy = 0;
    for (const { a, b } of proj) {
      const mid = toScreen({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      sx += mid.x; sy += mid.y;
    }
    return { x: sx / proj.length, y: sy / proj.length };
  })();

  // ---- dimension lines for overall W / D / H ----
  const origin: Vec3 = [nx, ny, xz];
  const dim = (corner: Vec3, lengthMm: number) => {
    if (lengthMm < 1) return;
    const p1 = toScreen(iso(origin));
    const p2 = toScreen(iso(corner));
    const dir = norm({ x: p2.x - p1.x, y: p2.y - p1.y });
    let perp = { x: -dir.y, y: dir.x };
    const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    if (perp.x * (mid.x - centroid.x) + perp.y * (mid.y - centroid.y) < 0) {
      perp = { x: -perp.x, y: -perp.y };
    }
    const off = 26;
    const o1 = { x: p1.x + perp.x * off, y: p1.y + perp.y * off };
    const o2 = { x: p2.x + perp.x * off, y: p2.y + perp.y * off };
    const lblPos = { x: (o1.x + o2.x) / 2 + perp.x * 11, y: (o1.y + o2.y) / 2 + perp.y * 11 };
    const label = formatLength(lengthMm, units);
    parts.push(
      // extension lines
      `<line x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${o1.x.toFixed(1)}" y2="${o1.y.toFixed(1)}" stroke="#999" stroke-width="0.7"/>`,
      `<line x1="${p2.x.toFixed(1)}" y1="${p2.y.toFixed(1)}" x2="${o2.x.toFixed(1)}" y2="${o2.y.toFixed(1)}" stroke="#999" stroke-width="0.7"/>`,
      // dimension line + arrowheads
      `<line x1="${o1.x.toFixed(1)}" y1="${o1.y.toFixed(1)}" x2="${o2.x.toFixed(1)}" y2="${o2.y.toFixed(1)}" stroke="#111" stroke-width="1"/>`,
      arrowHead(o1, { x: -dir.x, y: -dir.y }),
      arrowHead(o2, dir),
      // label
      `<rect x="${(lblPos.x - label.length * 3.6 - 3).toFixed(1)}" y="${(lblPos.y - 8).toFixed(1)}" width="${(label.length * 7.2 + 6).toFixed(1)}" height="16" fill="#fff" opacity="0.9"/>`,
      `<text x="${lblPos.x.toFixed(1)}" y="${(lblPos.y + 4).toFixed(1)}" text-anchor="middle" font-family="monospace" font-size="11" fill="#111">${esc(label)}</text>`,
    );
  };
  dim([xx, ny, xz], xx - nx); // width
  dim([nx, ny, nz], xz - nz); // depth
  dim([nx, xy, xz], xy - ny); // height

  // ---- balloon callouts per role ----
  const seen = new Set<string>();
  const items: DrawingItem[] = [];
  const order: string[] = [];
  for (const m of members) {
    if (!seen.has(m.role)) {
      seen.add(m.role);
      order.push(m.role);
    }
  }
  order.forEach((role, i) => {
    const rep = proj.find((p) => p.m.role === role)!;
    const qty = members.filter((m) => m.role === role).length;
    items.push({ n: i + 1, role, color: roleColors.get(role) ?? '#444', lengthMm: rep.m.length, qty });

    const mid = toScreen({ x: (rep.a.x + rep.b.x) / 2, y: (rep.a.y + rep.b.y) / 2 });
    let dir = norm({ x: mid.x - centroid.x, y: mid.y - centroid.y });
    if (!Number.isFinite(dir.x) || (dir.x === 0 && dir.y === 0)) dir = { x: 0, y: -1 };
    const bpos = { x: mid.x + dir.x * 48, y: mid.y + dir.y * 48 };
    parts.push(
      `<line x1="${bpos.x.toFixed(1)}" y1="${bpos.y.toFixed(1)}" x2="${mid.x.toFixed(1)}" y2="${mid.y.toFixed(1)}" stroke="#111" stroke-width="0.7"/>`,
      `<circle cx="${mid.x.toFixed(1)}" cy="${mid.y.toFixed(1)}" r="2.2" fill="#111"/>`,
      `<circle cx="${bpos.x.toFixed(1)}" cy="${bpos.y.toFixed(1)}" r="11" fill="#fff" stroke="#111" stroke-width="1.2"/>`,
      `<text x="${bpos.x.toFixed(1)}" y="${(bpos.y + 4).toFixed(1)}" text-anchor="middle" font-family="monospace" font-size="12" font-weight="600" fill="#111">${i + 1}</text>`,
    );
  });

  const svg = `<svg viewBox="0 0 ${W} ${H.toFixed(0)}" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="system-ui, sans-serif">${parts.join('')}</svg>`;
  return { svg, items };
}
