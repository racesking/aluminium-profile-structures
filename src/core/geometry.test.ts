import { describe, it, expect } from 'vitest';
import {
  distance,
  snapValue,
  snapVec3,
  maybeSnapVec3,
  midpoint,
  direction,
  edgeLength,
  setEdgeLength,
  roundLength,
  nodeDistance,
} from './geometry';
import type { Node } from './types';

describe('distance', () => {
  it('computes 3-4-5 in the XY plane', () => {
    expect(distance([0, 0, 0], [3, 4, 0])).toBe(5);
  });

  it('is zero for identical points', () => {
    expect(distance([1, 2, 3], [1, 2, 3])).toBe(0);
  });
});

describe('snapValue', () => {
  it('rounds to the nearest multiple', () => {
    expect(snapValue(7, 5)).toBe(5);
    expect(snapValue(8, 5)).toBe(10);
  });

  it('returns the value unchanged when snap is non-positive', () => {
    expect(snapValue(7, 0)).toBe(7);
    expect(snapValue(7, -5)).toBe(7);
  });
});

describe('snapVec3 / maybeSnapVec3', () => {
  it('snaps each axis independently', () => {
    expect(snapVec3([7, 8, 12], 5)).toEqual([5, 10, 10]);
  });

  it('leaves the vector untouched when snapping is disabled', () => {
    expect(maybeSnapVec3([7, 8, 12], false, 5)).toEqual([7, 8, 12]);
  });

  it('leaves the vector untouched when the grid size is non-positive', () => {
    expect(maybeSnapVec3([7, 8, 12], true, 0)).toEqual([7, 8, 12]);
  });
});

describe('midpoint', () => {
  it('averages the two endpoints', () => {
    expect(midpoint([0, 0, 0], [2, 4, 6])).toEqual([1, 2, 3]);
  });
});

describe('direction', () => {
  it('returns a unit vector along the segment', () => {
    expect(direction([0, 0, 0], [0, 0, 5])).toEqual([0, 0, 1]);
  });

  it('falls back to +X for a degenerate (zero-length) segment', () => {
    expect(direction([1, 1, 1], [1, 1, 1])).toEqual([1, 0, 0]);
  });
});

describe('roundLength', () => {
  it('rounds to one decimal place (0.1 mm)', () => {
    expect(roundLength(1234.56)).toBe(1234.6);
    expect(roundLength(10.04)).toBe(10);
  });
});

describe('edgeLength / nodeDistance', () => {
  const nodes: Node[] = [
    { id: 'a', position: [0, 0, 0] },
    { id: 'b', position: [0, 0, 10] },
  ];

  it('measures the distance between two connected nodes', () => {
    expect(edgeLength(nodes, 'a', 'b')).toBe(10);
  });

  it('returns 0 when a node id is missing', () => {
    expect(edgeLength(nodes, 'a', 'missing')).toBe(0);
  });

  it('nodeDistance rounds and returns null for unknown ids', () => {
    expect(nodeDistance(nodes, 'a', 'b')).toBe(10);
    expect(nodeDistance(nodes, 'a', 'missing')).toBeNull();
  });
});

describe('setEdgeLength', () => {
  const nodes: Node[] = [
    { id: 'a', position: [0, 0, 0] },
    { id: 'b', position: [0, 0, 10] },
  ];

  it('moves the "to" node so the edge reaches the target length, anchored at "from"', () => {
    const result = setEdgeLength(nodes, 'a', 'b', 25, 'to');
    const moved = result.find((n) => n.id === 'b')!;
    expect(moved.position).toEqual([0, 0, 25]);
    // anchor unchanged
    expect(result.find((n) => n.id === 'a')!.position).toEqual([0, 0, 0]);
  });
});
