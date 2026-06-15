import type { Node, Vec3 } from './types';

export function vec3(x: number, y: number, z: number): Vec3 {
  return [x, y, z];
}

export function distance(a: Vec3, b: Vec3): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function snapValue(value: number, snap: number): number {
  if (snap <= 0) return value;
  return Math.round(value / snap) * snap;
}

export function snapVec3(v: Vec3, snap: number): Vec3 {
  return [snapValue(v[0], snap), snapValue(v[1], snap), snapValue(v[2], snap)];
}

export function maybeSnapVec3(
  v: Vec3,
  snapToGrid: boolean,
  gridCellSize: number,
): Vec3 {
  if (!snapToGrid || gridCellSize <= 0) return v;
  return snapVec3(v, gridCellSize);
}

export function midpoint(a: Vec3, b: Vec3): Vec3 {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}

export function direction(from: Vec3, to: Vec3): Vec3 {
  const len = distance(from, to);
  if (len < 1e-9) return [1, 0, 0];
  return [(to[0] - from[0]) / len, (to[1] - from[1]) / len, (to[2] - from[2]) / len];
}

export function edgeLength(nodes: Node[], fromId: string, toId: string): number {
  const from = nodes.find((n) => n.id === fromId);
  const to = nodes.find((n) => n.id === toId);
  if (!from || !to) return 0;
  return distance(from.position, to.position);
}

/** Move the `moveId` node so edge fromId→toId has the target length (anchor at fromId). */
export function setEdgeLength(
  nodes: Node[],
  fromId: string,
  toId: string,
  targetLength: number,
  moveEnd: 'to' | 'from' = 'to',
): Node[] {
  const from = nodes.find((n) => n.id === fromId);
  const to = nodes.find((n) => n.id === toId);
  if (!from || !to) return nodes;

  const anchor = moveEnd === 'to' ? from : to;
  const moveId = moveEnd === 'to' ? toId : fromId;
  const other = moveEnd === 'to' ? to : from;
  const dir = direction(anchor.position, other.position);
  const newPos: Vec3 = [
    anchor.position[0] + dir[0] * targetLength,
    anchor.position[1] + dir[1] * targetLength,
    anchor.position[2] + dir[2] * targetLength,
  ];

  return nodes.map((n) =>
    n.id === moveId ? { ...n, position: newPos } : n,
  );
}

export function roundLength(mm: number): number {
  return Math.round(mm * 10) / 10;
}

export function nodeDistance(nodes: Node[], idA: string, idB: string): number | null {
  const a = nodes.find((n) => n.id === idA);
  const b = nodes.find((n) => n.id === idB);
  if (!a || !b) return null;
  return roundLength(distance(a.position, b.position));
}
