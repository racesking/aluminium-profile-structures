/**
 * The single source of truth for what gets cut in the Advanced builder.
 *
 * Cut lengths come from the same joint treatments that drive the 3D render
 * (core/jointVisuals), so what the viewport shows and what the cut plan,
 * BOM and drawing list can never disagree: a butting member is shortened by
 * half the through member's section, a mitred member is cut to its long
 * point. Members are grouped into lettered parts (A, B, …) by distinct
 * (profile, cut length); each member gets a label like "A2" that is shared by
 * the panel, the 3D labels, the cut plan and the drawing.
 *
 * Pure and framework-free so it is unit-tested.
 */

import { edgeLength, roundLength } from './geometry';
import { computeJointTreatments } from './jointVisuals';
import { solveCuttingStockByProfile, type MultiCuttingResult } from './cuttingStock';
import type { ProfileDef } from './profiles';
import type { CutPiece, Node, StockBar } from './types';

type EdgeLike = { id: string; fromId: string; toId: string };

/** Spreadsheet-style letters: 0 → A, 25 → Z, 26 → AA. */
export function partLetter(index: number): string {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Cut length of every member after joint compensation (mm, rounded to 0.1,
 * never below 1). Edges with missing endpoints or zero length are omitted.
 */
export function memberCutLengths(
  nodes: Node[],
  edges: EdgeLike[],
  sectionOf: (edgeId: string) => number,
  jointId: string,
): Map<string, number> {
  const treatments = computeJointTreatments(nodes, edges, sectionOf, jointId);
  const out = new Map<string, number>();
  for (const e of edges) {
    const centreline = edgeLength(nodes, e.fromId, e.toId);
    if (centreline <= 0) continue;
    const t = treatments.get(e.id);
    const cut = centreline - (t?.from.trim ?? 0) - (t?.to.trim ?? 0);
    out.set(e.id, Math.max(1, roundLength(cut)));
  }
  return out;
}

export type PartInfo = {
  /** Part letter shared by every member with the same profile + cut length. */
  part: string;
  /** Member label within the part, e.g. "A2". */
  label: string;
};

/**
 * Letter the parts: ordered by profile (profiles[] order), then longest cut
 * first, so the longest member of the first profile is part A. Members of a
 * part are numbered in edge order.
 */
export function assignParts(
  edges: EdgeLike[],
  profileIndexOf: (edgeId: string) => number,
  cutLengths: Map<string, number>,
): Map<string, PartInfo> {
  const keyOf = (id: string) => `${profileIndexOf(id)}|${cutLengths.get(id)}`;
  const keys = [
    ...new Set(edges.filter((e) => cutLengths.has(e.id)).map((e) => keyOf(e.id))),
  ].sort((a, b) => {
    const [pa, la] = a.split('|').map(Number);
    const [pb, lb] = b.split('|').map(Number);
    return pa - pb || lb - la;
  });
  const letterOf = new Map(keys.map((k, i) => [k, partLetter(i)]));
  const counters = new Map<string, number>();
  const out = new Map<string, PartInfo>();
  for (const e of edges) {
    if (!cutLengths.has(e.id)) continue;
    const part = letterOf.get(keyOf(e.id))!;
    const n = (counters.get(part) ?? 0) + 1;
    counters.set(part, n);
    out.set(e.id, { part, label: `${part}${n}` });
  }
  return out;
}

export type StructureCutPlan = {
  multi: MultiCuttingResult;
  cutLengths: Map<string, number>;
  parts: Map<string, PartInfo>;
  /** Sum of all member cut lengths (mm). */
  totalCut: number;
  /** Resolved profile per edge (dangling ids fall back to the first). */
  profileOf: (edgeId: string) => ProfileDef;
};

/** Everything the cut plan, BOM and drawing need, computed in one pass. */
export function planStructureCuts(args: {
  nodes: Node[];
  edges: EdgeLike[];
  profiles: ProfileDef[];
  edgeProfile: Record<string, string>;
  stockByProfile: Record<string, StockBar[]>;
  kerf: number;
  jointId: string;
}): StructureCutPlan {
  const { nodes, edges, profiles, edgeProfile, stockByProfile, kerf, jointId } = args;
  const indexById = new Map(profiles.map((p, i) => [p.id, i]));
  const profileIndexOf = (edgeId: string) => indexById.get(edgeProfile[edgeId] ?? '') ?? 0;
  const profileOf = (edgeId: string) => profiles[profileIndexOf(edgeId)];

  const cutLengths = memberCutLengths(
    nodes,
    edges,
    (id) => profileOf(id).sectionMm,
    jointId,
  );
  const parts = assignParts(edges, profileIndexOf, cutLengths);

  const piecesByProfile = new Map<string, CutPiece[]>();
  let totalCut = 0;
  for (const e of edges) {
    const length = cutLengths.get(e.id);
    if (length === undefined) continue;
    totalCut += length;
    const pid = profileOf(e.id).id;
    const list = piecesByProfile.get(pid) ?? [];
    list.push({ edgeId: e.id, length, label: parts.get(e.id)?.label });
    piecesByProfile.set(pid, list);
  }

  const groups = profiles
    .filter((p) => piecesByProfile.has(p.id))
    .map((p) => ({
      profileId: p.id,
      profileName: p.name,
      sectionMm: p.sectionMm,
      pieces: piecesByProfile.get(p.id)!,
      stock: stockByProfile[p.id] ?? [],
    }));

  return {
    multi: solveCuttingStockByProfile(groups, kerf),
    cutLengths,
    parts,
    totalCut: roundLength(totalCut),
    profileOf,
  };
}
