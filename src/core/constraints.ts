import type { Edge, EdgeConstraint, Node, Vec3 } from './types';
import { direction, distance } from './geometry';

export function getEdgeDirection(
  nodes: Node[],
  edge: Edge,
): Vec3 | null {
  const from = nodes.find((n) => n.id === edge.fromId);
  const to = nodes.find((n) => n.id === edge.toId);
  if (!from || !to) return null;
  return direction(from.position, to.position);
}

function sharedNodeId(edgeA: Edge, edgeB: Edge): string | null {
  const endsA = [edgeA.fromId, edgeA.toId];
  for (const id of [edgeB.fromId, edgeB.toId]) {
    if (endsA.includes(id)) return id;
  }
  return null;
}

function directionFromPivot(
  nodes: Node[],
  edge: Edge,
  pivotId: string,
): Vec3 | null {
  const pivot = nodes.find((n) => n.id === pivotId);
  if (!pivot) return null;
  const otherId = edge.fromId === pivotId ? edge.toId : edge.fromId;
  const other = nodes.find((n) => n.id === otherId);
  if (!other) return null;
  return direction(pivot.position, other.position);
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(dot(v, v));
  if (len < 1e-9) return [1, 0, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}

function pickParallelTarget(ref: Vec3, current: Vec3): Vec3 {
  const d = dot(ref, current);
  return d >= 0 ? ref : ([-ref[0], -ref[1], -ref[2]] as Vec3);
}

function perpendicularDirection(ref: Vec3, current: Vec3): Vec3 {
  const refN = normalize(ref);
  const proj = dot(refN, current);
  const perp: Vec3 = [
    current[0] - refN[0] * proj,
    current[1] - refN[1] * proj,
    current[2] - refN[2] * proj,
  ];
  const len = Math.sqrt(dot(perp, perp));
  if (len > 1e-6) return normalize(perp);
  const fallback =
    Math.abs(refN[1]) < 0.9 ? cross(refN, [0, 1, 0]) : cross(refN, [1, 0, 0]);
  return normalize(fallback);
}

function alignEdgeToDirection(
  nodes: Node[],
  edge: Edge,
  targetDir: Vec3,
  pivotId?: string,
  pinned?: ReadonlySet<string>,
): Node[] {
  const from = nodes.find((n) => n.id === edge.fromId);
  const to = nodes.find((n) => n.id === edge.toId);
  if (!from || !to) return nodes;

  const len = distance(from.position, to.position);
  const d = normalize(targetDir);

  const pivot = pivotId ?? edge.fromId;
  const moveId = edge.fromId === pivot ? edge.toId : edge.fromId;
  // Never reposition a node pinned by a locked member.
  if (pinned?.has(moveId)) return nodes;
  const pivotNode = nodes.find((n) => n.id === pivot);
  if (!pivotNode) return nodes;

  const newPos: Vec3 = [
    pivotNode.position[0] + d[0] * len,
    pivotNode.position[1] + d[1] * len,
    pivotNode.position[2] + d[2] * len,
  ];

  return nodes.map((n) =>
    n.id === moveId ? { ...n, position: newPos } : n,
  );
}

export function alignEdgeParallel(
  nodes: Node[],
  edgeA: Edge,
  edgeB: Edge,
  pinned?: ReadonlySet<string>,
): Node[] {
  const shared = sharedNodeId(edgeA, edgeB);
  const dirA = shared
    ? directionFromPivot(nodes, edgeA, shared)
    : getEdgeDirection(nodes, edgeA);
  if (!dirA) return nodes;
  const dirB = shared
    ? directionFromPivot(nodes, edgeB, shared)
    : getEdgeDirection(nodes, edgeB);
  const target = pickParallelTarget(dirA, dirB ?? dirA);
  return alignEdgeToDirection(nodes, edgeB, target, shared ?? undefined, pinned);
}

export function alignEdgePerpendicular(
  nodes: Node[],
  edgeA: Edge,
  edgeB: Edge,
  pinned?: ReadonlySet<string>,
): Node[] {
  const shared = sharedNodeId(edgeA, edgeB);
  const dirA = shared
    ? directionFromPivot(nodes, edgeA, shared)
    : getEdgeDirection(nodes, edgeA);
  const dirB = shared
    ? directionFromPivot(nodes, edgeB, shared)
    : getEdgeDirection(nodes, edgeB);
  if (!dirA || !dirB) return nodes;
  const target = perpendicularDirection(dirA, dirB);
  return alignEdgeToDirection(nodes, edgeB, target, shared ?? undefined, pinned);
}

export function enforceConstraints(
  nodes: Node[],
  edges: Edge[],
  constraints: EdgeConstraint[],
  pinned?: ReadonlySet<string>,
): Node[] {
  let result = nodes;
  for (const c of constraints) {
    const edgeA = edges.find((e) => e.id === c.edgeAId);
    const edgeB = edges.find((e) => e.id === c.edgeBId);
    if (!edgeA || !edgeB) continue;
    if (c.type === 'parallel') {
      result = alignEdgeParallel(result, edgeA, edgeB, pinned);
    } else {
      result = alignEdgePerpendicular(result, edgeA, edgeB, pinned);
    }
  }
  return result;
}

export function constraintLabel(c: EdgeConstraint, edges: Edge[]): string {
  const idxA = edges.findIndex((e) => e.id === c.edgeAId);
  const idxB = edges.findIndex((e) => e.id === c.edgeBId);
  const a = idxA >= 0 ? `M${idxA + 1}` : '?';
  const b = idxB >= 0 ? `M${idxB + 1}` : '?';
  return `${a} ∥ ${b}`;
}

export function constraintLabelPerp(c: EdgeConstraint, edges: Edge[]): string {
  const idxA = edges.findIndex((e) => e.id === c.edgeAId);
  const idxB = edges.findIndex((e) => e.id === c.edgeBId);
  const a = idxA >= 0 ? `M${idxA + 1}` : '?';
  const b = idxB >= 0 ? `M${idxB + 1}` : '?';
  return `${a} ⊥ ${b}`;
}
