import { describe, expect, it } from 'vitest';
import {
  assignParts,
  memberCutLengths,
  partLetter,
  planStructureCuts,
} from './structureCuts';
import { sectionLabel } from './profileShapes';
import type { Node } from './types';
import { createBoxFrame } from './boxFrame';
import type { ProfileDef } from './profiles';

/** Post up Y (500), rail out along X (400), sharing the origin. */
function corner() {
  const nodes: Node[] = [
    { id: 'o', position: [0, 0, 0] },
    { id: 'top', position: [0, 500, 0] },
    { id: 'right', position: [400, 0, 0] },
  ];
  const edges = [
    { id: 'post', fromId: 'o', toId: 'top' },
    { id: 'rail', fromId: 'o', toId: 'right' },
  ];
  return { nodes, edges };
}

describe('partLetter', () => {
  it('counts like spreadsheet columns', () => {
    expect(partLetter(0)).toBe('A');
    expect(partLetter(25)).toBe('Z');
    expect(partLetter(26)).toBe('AA');
  });
});

describe('memberCutLengths', () => {
  it('butt joint shortens the butting member by half the through section', () => {
    const { nodes, edges } = corner();
    const cuts = memberCutLengths(nodes, edges, () => 40, 'butt');
    expect(cuts.get('post')).toBe(500); // through member, full length
    expect(cuts.get('rail')).toBe(380); // 400 − 40/2
  });

  it('mitre cuts both members to their long point', () => {
    const { nodes, edges } = corner();
    const cuts = memberCutLengths(nodes, edges, () => 40, 'mitre');
    expect(cuts.get('post')).toBe(520); // 500 + 40/2
    expect(cuts.get('rail')).toBe(420);
  });

  it('a box frame (three-way corners) cuts the same for mitre and butt', () => {
    const { nodes, edges } = createBoxFrame(600, 400, 400);
    const mitre = memberCutLengths(nodes, edges, () => 20, 'mitre');
    const butt = memberCutLengths(nodes, edges, () => 20, 'butt');
    expect([...mitre.entries()]).toEqual([...butt.entries()]);
    // Through members keep full length; butting members lose 10 mm per end.
    expect([...new Set(butt.values())].sort((a, b) => a - b)).toEqual([380, 390, 590, 600]);
  });

  it('a lone member keeps its centreline length', () => {
    const nodes: Node[] = [
      { id: 'a', position: [0, 0, 0] },
      { id: 'b', position: [750, 0, 0] },
    ];
    const cuts = memberCutLengths(nodes, [{ id: 'e', fromId: 'a', toId: 'b' }], () => 40, 'blind');
    expect(cuts.get('e')).toBe(750);
  });
});

describe('assignParts', () => {
  it('letters by profile then longest first, numbering members within a part', () => {
    const edges = [
      { id: 'e1', fromId: '', toId: '' },
      { id: 'e2', fromId: '', toId: '' },
      { id: 'e3', fromId: '', toId: '' },
      { id: 'e4', fromId: '', toId: '' },
    ];
    const lengths = new Map([
      ['e1', 300],
      ['e2', 800],
      ['e3', 300],
      ['e4', 900],
    ]);
    const profileIndex: Record<string, number> = { e1: 0, e2: 0, e3: 0, e4: 1 };
    const parts = assignParts(edges, (id) => profileIndex[id], lengths);
    expect(parts.get('e2')).toEqual({ part: 'A', label: 'A1' }); // longest of profile 0
    expect(parts.get('e1')).toEqual({ part: 'B', label: 'B1' });
    expect(parts.get('e3')).toEqual({ part: 'B', label: 'B2' });
    expect(parts.get('e4')).toEqual({ part: 'C', label: 'C1' }); // profile 1 comes after
  });
});

describe('planStructureCuts', () => {
  it('feeds joint-compensated lengths and part labels into the cut plan', () => {
    const { nodes, edges } = corner();
    const profile: ProfileDef = { id: 'p', name: '40×40', sectionMm: 40 };
    const plan = planStructureCuts({
      nodes,
      edges,
      profiles: [profile],
      edgeProfile: {},
      stockByProfile: { p: [{ id: 's', length: 6000, quantity: 1 }] },
      kerf: 3,
      jointId: 'blind',
    });
    expect(plan.totalCut).toBe(880); // 500 + 380
    const cuts = plan.multi.byProfile[0].result.bars.flatMap((b) => b.cuts);
    expect(cuts.map((c) => c.length).sort()).toEqual([380, 500]);
    expect(cuts.map((c) => c.label).sort()).toEqual(['A1', 'B1']);
  });

  it('a dangling profile id falls back to the first profile — no member is lost', () => {
    const { nodes, edges } = corner();
    const profile: ProfileDef = { id: 'p', name: '40×40', sectionMm: 40 };
    const plan = planStructureCuts({
      nodes,
      edges,
      profiles: [profile],
      edgeProfile: { rail: 'deleted-profile' },
      stockByProfile: { p: [{ id: 's', length: 6000, quantity: 1 }] },
      kerf: 0,
      jointId: 'butt',
    });
    const placed = plan.multi.byProfile.flatMap((g) => g.result.bars.flatMap((b) => b.cuts));
    expect(placed).toHaveLength(2);
  });
});

describe('sectionLabel', () => {
  it('formats by shape', () => {
    expect(sectionLabel({ sectionMm: 40 })).toBe('40×40 mm');
    expect(sectionLabel({ sectionMm: 40, shape: 'round' })).toBe('⌀40 mm');
    expect(sectionLabel({ sectionMm: 30, shape: 'angle' })).toBe('L30×30 mm');
    expect(sectionLabel({ sectionMm: 45, shape: 'bosch' })).toBe('45×45 mm T-slot');
  });
});
