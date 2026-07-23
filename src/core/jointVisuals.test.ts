import { describe, expect, it } from 'vitest';
import {
  computeBracketPlacements,
  computeJointTreatments,
} from './jointVisuals';
import type { Node } from './types';

/** L-corner: post up the Y axis, rail out along X, sharing node at origin. */
function corner(sectionPost = 40, sectionRail = 20) {
  const nodes: Node[] = [
    { id: 'o', position: [0, 0, 0] },
    { id: 'top', position: [0, 500, 0] },
    { id: 'right', position: [400, 0, 0] },
  ];
  const edges = [
    { id: 'post', fromId: 'o', toId: 'top' },
    { id: 'rail', fromId: 'o', toId: 'right' },
  ];
  const sections: Record<string, number> = {
    post: sectionPost,
    rail: sectionRail,
  };
  return { nodes, edges, sectionOf: (id: string) => sections[id] };
}

describe('computeJointTreatments', () => {
  it('butt: the smaller member trims by half the through section', () => {
    const { nodes, edges, sectionOf } = corner(40, 20);
    const t = computeJointTreatments(nodes, edges, sectionOf, 'butt');
    // Post (larger) runs through — untouched.
    expect(t.get('post')?.from.trim ?? 0).toBe(0);
    // Rail butts against the post's face: trimmed by 40/2 at the shared end.
    expect(t.get('rail')?.from.trim).toBe(20);
    expect(t.get('rail')?.to.trim ?? 0).toBe(0);
  });

  it('blind behaves like butt visually', () => {
    const { nodes, edges, sectionOf } = corner(40, 20);
    const t = computeJointTreatments(nodes, edges, sectionOf, 'blind');
    expect(t.get('rail')?.from.trim).toBe(20);
  });

  it('equal sections: the earlier edge runs through', () => {
    const { nodes, edges, sectionOf } = corner(30, 30);
    const t = computeJointTreatments(nodes, edges, sectionOf, 'butt');
    expect(t.get('post')?.from.trim ?? 0).toBe(0); // edge order 0 wins
    expect(t.get('rail')?.from.trim).toBe(15);
  });

  it('mitre: both members extend and get opposite bisecting clip planes', () => {
    const { nodes, edges, sectionOf } = corner(40, 40);
    const t = computeJointTreatments(nodes, edges, sectionOf, 'mitre');
    const post = t.get('post')!.from;
    const rail = t.get('rail')!.from;
    // Extended by half the other member's section (negative trim).
    expect(post.trim).toBe(-20);
    expect(rail.trim).toBe(-20);
    // Clip normals are opposite and bisect the corner (±[−x, y] / √2 here).
    expect(post.clipNormal).toBeDefined();
    expect(rail.clipNormal).toBeDefined();
    const [px, py] = [post.clipNormal![0], post.clipNormal![1]];
    expect(px).toBeCloseTo(-Math.SQRT1_2, 6);
    expect(py).toBeCloseTo(Math.SQRT1_2, 6);
    expect(rail.clipNormal![0]).toBeCloseTo(-px, 6);
    expect(rail.clipNormal![1]).toBeCloseTo(-py, 6);
  });

  it('mitre with 3+ members falls back to the butt rule', () => {
    const { nodes, edges } = corner(40, 20);
    const nodes3: Node[] = [...nodes, { id: 'left', position: [-400, 0, 0] }];
    const edges3 = [...edges, { id: 'rail2', fromId: 'o', toId: 'left' }];
    const sections: Record<string, number> = { post: 40, rail: 20, rail2: 20 };
    const t = computeJointTreatments(nodes3, edges3, (id) => sections[id], 'mitre');
    expect(t.get('rail')?.from.trim).toBe(20);
    expect(t.get('rail')?.from.clipNormal).toBeUndefined();
  });

  it('collinear splice stays end-to-end (no trim)', () => {
    const nodes: Node[] = [
      { id: 'a', position: [0, 0, 0] },
      { id: 'b', position: [500, 0, 0] },
      { id: 'c', position: [1000, 0, 0] },
    ];
    const edges = [
      { id: 'e1', fromId: 'a', toId: 'b' },
      { id: 'e2', fromId: 'b', toId: 'c' },
    ];
    const t = computeJointTreatments(nodes, edges, () => 30, 'butt');
    expect(t.get('e1')?.to.trim ?? 0).toBe(0);
    expect(t.get('e2')?.from.trim ?? 0).toBe(0);
  });

  it('trim never inverts a short member', () => {
    const nodes: Node[] = [
      { id: 'o', position: [0, 0, 0] },
      { id: 'top', position: [0, 500, 0] },
      { id: 'right', position: [30, 0, 0] }, // very short rail
    ];
    const edges = [
      { id: 'post', fromId: 'o', toId: 'top' },
      { id: 'rail', fromId: 'o', toId: 'right' },
    ];
    const sections: Record<string, number> = { post: 100, rail: 20 };
    const t = computeJointTreatments(nodes, edges, (id) => sections[id], 'butt');
    expect(t.get('rail')!.from.trim).toBeLessThanOrEqual(30 * 0.45);
  });

  it('lone members get no treatment', () => {
    const nodes: Node[] = [
      { id: 'a', position: [0, 0, 0] },
      { id: 'b', position: [500, 0, 0] },
    ];
    const t = computeJointTreatments(
      nodes,
      [{ id: 'e', fromId: 'a', toId: 'b' }],
      () => 20,
      'butt',
    );
    expect(t.size).toBe(0);
  });
});

describe('computeBracketPlacements', () => {
  it('emits one bracket per perpendicular butting member', () => {
    const { nodes, edges, sectionOf } = corner(40, 20);
    const placements = computeBracketPlacements(nodes, edges, sectionOf);
    expect(placements).toHaveLength(1);
    const p = placements[0];
    expect(p.position).toEqual([0, 0, 0]);
    expect(p.sectionB).toBe(40); // through = post
    expect(p.sectionA).toBe(20); // butting = rail
    // legA along the rail (+X), legB along the post (+Y).
    expect(p.legA[0]).toBeCloseTo(1, 6);
    expect(p.legB[1]).toBeCloseTo(1, 6);
  });

  it('skips non-perpendicular pairs', () => {
    const nodes: Node[] = [
      { id: 'o', position: [0, 0, 0] },
      { id: 'up', position: [0, 500, 0] },
      { id: 'diag', position: [100, 480, 0] }, // ~12° off the post
    ];
    const edges = [
      { id: 'post', fromId: 'o', toId: 'up' },
      { id: 'diag', fromId: 'o', toId: 'diag' },
    ];
    const sections: Record<string, number> = { post: 40, diag: 20 };
    expect(
      computeBracketPlacements(nodes, edges, (id) => sections[id]),
    ).toHaveLength(0);
  });
});
