import { describe, expect, it } from 'vitest';
import {
  alignEdgeParallel,
  alignEdgePerpendicular,
  enforceConstraints,
} from './constraints';
import type { EdgeConstraint, Node } from './types';

/** Two edges sharing the origin: A up the Y axis, B at 45° in the XY plane. */
function pair() {
  const nodes: Node[] = [
    { id: 'o', position: [0, 0, 0] },
    { id: 'a', position: [0, 100, 0] },
    { id: 'b', position: [100, 100, 0] },
  ];
  const edgeA = { id: 'A', fromId: 'o', toId: 'a' };
  const edgeB = { id: 'B', fromId: 'o', toId: 'b' };
  return { nodes, edgeA, edgeB };
}

describe('constraint alignment with pinned nodes', () => {
  it('alignEdgeParallel moves B when nothing is pinned', () => {
    const { nodes, edgeA, edgeB } = pair();
    const out = alignEdgeParallel(nodes, edgeA, edgeB);
    expect(out.find((n) => n.id === 'b')!.position).not.toEqual([100, 100, 0]);
  });

  it('alignEdgeParallel leaves a pinned target node untouched', () => {
    const { nodes, edgeA, edgeB } = pair();
    const out = alignEdgeParallel(nodes, edgeA, edgeB, new Set(['b']));
    expect(out.find((n) => n.id === 'b')!.position).toEqual([100, 100, 0]);
  });

  it('alignEdgePerpendicular respects the pinned set too', () => {
    const { nodes, edgeA, edgeB } = pair();
    const out = alignEdgePerpendicular(nodes, edgeA, edgeB, new Set(['b']));
    expect(out.find((n) => n.id === 'b')!.position).toEqual([100, 100, 0]);
  });

  it('enforceConstraints skips moves onto pinned nodes and applies the rest', () => {
    const { nodes, edgeA, edgeB } = pair();
    const withC: Node[] = [
      ...nodes,
      { id: 'c', position: [50, -50, 0] },
      { id: 'd', position: [120, -10, 0] },
    ];
    const edgeC = { id: 'C', fromId: 'c', toId: 'd' };
    const edges = [edgeA, edgeB, edgeC];
    const constraints: EdgeConstraint[] = [
      { id: '1', edgeAId: 'A', edgeBId: 'B', type: 'parallel' },
      { id: '2', edgeAId: 'A', edgeBId: 'C', type: 'parallel' },
    ];
    const out = enforceConstraints(withC, edges, constraints, new Set(['b']));
    // B's free endpoint is pinned → unchanged.
    expect(out.find((n) => n.id === 'b')!.position).toEqual([100, 100, 0]);
    // C has no pinned endpoint → aligned parallel to A (vertical).
    const c = out.find((n) => n.id === 'c')!.position;
    const d = out.find((n) => n.id === 'd')!.position;
    expect(Math.abs(d[0] - c[0])).toBeLessThan(1e-6);
  });
});
