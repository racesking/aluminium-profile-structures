/**
 * Visual joint treatment for the Advanced builder: how member geometry should
 * be shortened (or extended and clipped) at shared nodes so joints render the
 * way they are actually built, instead of members interpenetrating.
 *
 * Pure math over the node/edge graph — no three.js — so it is unit-testable.
 * The 3D layer applies the results: `trim` shortens (negative = extends) the
 * extruded member at that end; `clipNormal` (mitre) is the world-space normal
 * of a cutting plane through the node, keeping the half-space the normal
 * points into.
 */

import type { Node, Vec3 } from './types';

type EdgeLike = { id: string; fromId: string; toId: string };

export type EndTreatment = {
  /** Amount to shorten this end by, in mm. Negative = extend (mitre). */
  trim: number;
  /** Mitre cut: clip plane through the node; keep dot(p − node, n) ≥ 0. */
  clipNormal?: Vec3;
};

export type EdgeTreatment = { from: EndTreatment; to: EndTreatment };

export type BracketPlacement = {
  /** Node the bracket sits at. */
  position: Vec3;
  /** Unit direction of the butting member, pointing away from the node. */
  legA: Vec3;
  /** Unit direction of the through member, pointing away from the node. */
  legB: Vec3;
  sectionA: number;
  sectionB: number;
};

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: Vec3): number => Math.sqrt(dot(a, a));
const norm = (a: Vec3): Vec3 | null => {
  const l = len(a);
  return l < 1e-9 ? null : [a[0] / l, a[1] / l, a[2] / l];
};

type NodeMember = {
  edgeId: string;
  end: 'from' | 'to';
  /** Unit direction pointing away from the node, along the member. */
  dir: Vec3;
  length: number;
  section: number;
  order: number;
};

/** Members meeting at each node, with their outgoing directions. */
function buildAdjacency(
  nodes: Node[],
  edges: EdgeLike[],
  sectionOf: (edgeId: string) => number,
): Map<string, NodeMember[]> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const adj = new Map<string, NodeMember[]>();
  edges.forEach((e, order) => {
    const a = byId.get(e.fromId);
    const b = byId.get(e.toId);
    if (!a || !b) return;
    const ab = sub(b.position, a.position);
    const l = len(ab);
    const d = norm(ab);
    if (!d) return;
    const section = sectionOf(e.id);
    const list = (id: string) => {
      const arr = adj.get(id) ?? [];
      adj.set(id, arr);
      return arr;
    };
    list(e.fromId).push({ edgeId: e.id, end: 'from', dir: d, length: l, section, order });
    list(e.toId).push({
      edgeId: e.id,
      end: 'to',
      dir: [-d[0], -d[1], -d[2]],
      length: l,
      section,
      order,
    });
  });
  return adj;
}

/** The member that runs through the joint: largest section, ties by order. */
function pickThrough(members: NodeMember[]): NodeMember {
  return members.reduce((best, m) =>
    m.section > best.section || (m.section === best.section && m.order < best.order)
      ? m
      : best,
  );
}

/** True when the two directions are nearly collinear (end-to-end splice). */
function isCollinear(a: Vec3, b: Vec3): boolean {
  return Math.abs(dot(a, b)) > 0.9;
}

/**
 * Per-edge end treatments for the given joint type.
 *
 * - `butt` / `blind` / `bracket`: at each shared node the through member keeps
 *   its full length; every other member is shortened by half the through
 *   member's section, so it butts against the through face. Collinear splices
 *   are left touching end-to-end.
 * - `mitre` (exactly two members): both members extend by half the OTHER
 *   member's section and are cut by the bisecting plane — a picture-frame
 *   mitre. Nodes with 3+ members fall back to the butt rule.
 */
export function computeJointTreatments(
  nodes: Node[],
  edges: EdgeLike[],
  sectionOf: (edgeId: string) => number,
  jointId: string,
): Map<string, EdgeTreatment> {
  const adj = buildAdjacency(nodes, edges, sectionOf);
  const result = new Map<string, EdgeTreatment>();
  const endOf = (edgeId: string, end: 'from' | 'to'): EndTreatment => {
    const t = result.get(edgeId) ?? { from: { trim: 0 }, to: { trim: 0 } };
    result.set(edgeId, t);
    return t[end];
  };

  for (const members of adj.values()) {
    if (members.length < 2) continue;

    if (jointId === 'mitre' && members.length === 2) {
      const [a, b] = members;
      if (isCollinear(a.dir, b.dir)) continue; // straight splice: nothing to cut
      const nA = norm(sub(a.dir, b.dir));
      if (!nA) continue;
      const tA = endOf(a.edgeId, a.end);
      tA.trim = -b.section / 2;
      tA.clipNormal = nA;
      const tB = endOf(b.edgeId, b.end);
      tB.trim = -a.section / 2;
      tB.clipNormal = [-nA[0], -nA[1], -nA[2]];
      continue;
    }

    const through = pickThrough(members);
    for (const m of members) {
      if (m === through) continue;
      if (isCollinear(m.dir, through.dir)) continue;
      const t = endOf(m.edgeId, m.end);
      // Butt against the through member's face; never invert the member.
      t.trim = Math.min(through.section / 2, m.length * 0.45);
    }
  }
  return result;
}

/**
 * Bracket hardware placements: one angle bracket per (through, butting) pair
 * at each node, for near-perpendicular pairs only.
 */
export function computeBracketPlacements(
  nodes: Node[],
  edges: EdgeLike[],
  sectionOf: (edgeId: string) => number,
): BracketPlacement[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const adj = buildAdjacency(nodes, edges, sectionOf);
  const placements: BracketPlacement[] = [];
  for (const [nodeId, members] of adj.entries()) {
    if (members.length < 2) continue;
    const node = byId.get(nodeId);
    if (!node) continue;
    const through = pickThrough(members);
    for (const m of members) {
      if (m === through) continue;
      if (Math.abs(dot(m.dir, through.dir)) > 0.5) continue; // not ~90°
      placements.push({
        position: node.position,
        legA: m.dir,
        legB: through.dir,
        sectionA: m.section,
        sectionB: through.section,
      });
    }
  }
  return placements;
}
