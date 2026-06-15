import type { Selection } from './types';

export { connectedEdgeGroup } from './duplicate';

export function getActiveEdgeIds(
  selection: { type: 'edge'; id: string } | { type: 'node'; id: string } | null,
  selectedEdgeIds: string[],
): string[] {
  if (selectedEdgeIds.length > 0) return selectedEdgeIds;
  if (selection?.type === 'edge') return [selection.id];
  return [];
}

/** Pair for constraints: reference A, member B to align. */
export function getConstraintEdgePair(
  selection: Selection,
  selectedEdgeIds: string[],
  secondEdgeId: string | null,
): { edgeAId: string; edgeBId: string } | null {
  if (secondEdgeId && selection?.type === 'edge' && selection.id !== secondEdgeId) {
    return { edgeAId: selection.id, edgeBId: secondEdgeId };
  }
  if (selectedEdgeIds.length >= 2) {
    return { edgeAId: selectedEdgeIds[0], edgeBId: selectedEdgeIds[1] };
  }
  return null;
}

export function getSelectedNodeIds(
  edges: { id: string; fromId: string; toId: string }[],
  edgeIds: string[],
): string[] {
  const set = new Set<string>();
  for (const eid of edgeIds) {
    const e = edges.find((x) => x.id === eid);
    if (e) {
      set.add(e.fromId);
      set.add(e.toId);
    }
  }
  return [...set];
}
