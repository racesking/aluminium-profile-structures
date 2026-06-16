import { describe, it, expect } from 'vitest';
import { bomToCsv, structureToExportInput } from './bomExport';
import { solveCuttingStockByProfile } from './cuttingStock';
import type { CutMember } from './joints';
import type { ProfileDef } from './profiles';
import type { Edge, Node, StockBar } from './types';

const profile: ProfileDef = { id: 'a', name: '40x40', sectionMm: 40 };

function member(id: string, role: string, length: number): CutMember {
  return { id, role, from: [0, 0, 0], to: [length, 0, 0], length, nominal: length };
}

const cutMembers: CutMember[] = [
  member('p1', 'Post', 800),
  member('p2', 'Post', 800),
  member('p3', 'Post', 800),
  member('p4', 'Post', 800),
  member('r1', 'Rail', 1160),
  member('r2', 'Rail', 1160),
];

const multi = solveCuttingStockByProfile(
  [
    {
      profileId: 'a',
      profileName: '40x40',
      sectionMm: 40,
      pieces: cutMembers.map((m) => ({ edgeId: m.id, length: m.length, label: m.role })),
      stock: [{ id: 's', length: 6000, quantity: 2 }],
    },
  ],
  3,
);

const base = { multi, cutMembers, profileOf: () => profile, projectName: 'Test', dateStr: '2026-01-01' };

describe('bomToCsv', () => {
  it('emits a header and grouped member rows in mm', () => {
    const csv = bomToCsv({ ...base, units: 'mm' });
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Profile,Section (mm),Member,Length (mm),Qty');
    expect(csv).toContain('40x40,40,Post,800,4');
    expect(csv).toContain('40x40,40,Rail,1160,2');
  });

  it('includes a per-profile stock summary block', () => {
    const csv = bomToCsv({ ...base, units: 'mm' });
    expect(csv).toContain('Profile,Section (mm),Bars,Used (mm),Waste (mm)');
  });

  it('converts lengths to the chosen display unit', () => {
    const csv = bomToCsv({ ...base, units: 'm' });
    expect(csv.split('\n')[0]).toBe('Profile,Section (mm),Member,Length (m),Qty');
    expect(csv).toContain('40x40,40,Post,0.8,4');
  });
});

describe('structureToExportInput (Advanced builder)', () => {
  const nodes: Node[] = [
    { id: 'a', position: [0, 0, 0] },
    { id: 'b', position: [1000, 0, 0] },
    { id: 'c', position: [1000, 0, 500] },
    { id: 'd', position: [0, 0, 500] },
  ];
  const edges: Edge[] = [
    { id: 'e1', fromId: 'a', toId: 'b' }, // 1000
    { id: 'e2', fromId: 'c', toId: 'd' }, // 1000
    { id: 'e3', fromId: 'b', toId: 'c' }, // 500
    { id: 'e4', fromId: 'd', toId: 'a' }, // 500
  ];

  describe('single profile', () => {
    const prof: ProfileDef = { id: 'p1', name: '40×40', sectionMm: 40 };
    const stock: StockBar[] = [{ id: 's', length: 6000, quantity: 4 }];

    const input = structureToExportInput({
      nodes,
      edges,
      profiles: [prof],
      edgeProfileId: () => prof.id,
      stockByProfile: { [prof.id]: stock },
      kerf: 0,
      units: 'mm',
      projectName: 'T',
      dateStr: '2026-01-01',
    });

    it('groups members by length into lettered parts', () => {
      expect(input.cutMembers).toHaveLength(4);
      const roles = [...new Set(input.cutMembers.map((m) => m.role))].sort();
      expect(roles).toEqual(['Part A', 'Part B']);
    });

    it('assigns the longest length to Part A', () => {
      expect(input.cutMembers.find((m) => m.role === 'Part A')?.length).toBe(1000);
    });

    it('builds a single-profile cutting result', () => {
      expect(input.multi.byProfile).toHaveLength(1);
      expect(input.multi.byProfile[0].profileName).toBe('40×40');
      expect(input.multi.anyUnplaced).toBe(false);
    });

    it('resolves every part to its profile', () => {
      for (const m of input.cutMembers) {
        expect(input.profileOf(m.role).id).toBe(prof.id);
      }
    });
  });

  describe('multiple profiles', () => {
    const p1: ProfileDef = { id: 'p1', name: '40×40', sectionMm: 40 };
    const p2: ProfileDef = { id: 'p2', name: '20×20', sectionMm: 20 };
    // Horizontals (1000 mm) on p1, verticals (500 mm) on p2.
    const edgeProfileId = (id: string) => (id === 'e1' || id === 'e2' ? 'p1' : 'p2');

    const input = structureToExportInput({
      nodes,
      edges,
      profiles: [p1, p2],
      edgeProfileId,
      stockByProfile: {
        p1: [{ id: 's1', length: 6000, quantity: 4 }],
        p2: [{ id: 's2', length: 6000, quantity: 4 }],
      },
      kerf: 0,
      units: 'mm',
      projectName: 'T',
      dateStr: '2026-01-01',
    });

    it('cuts each profile from its own stock', () => {
      expect(input.multi.byProfile).toHaveLength(2);
      const names = input.multi.byProfile.map((g) => g.profileName).sort();
      expect(names).toEqual(['20×20', '40×40']);
    });

    it('gives each profile its own lettered parts', () => {
      const roles = [...new Set(input.cutMembers.map((m) => m.role))].sort();
      expect(roles).toEqual(['Part A', 'Part B']);
      // Part A is the longest of the first profile (1000 on p1).
      expect(input.profileOf('Part A').id).toBe('p1');
      expect(input.profileOf('Part B').id).toBe('p2');
    });

    it('maps each member to the profile of its edge', () => {
      const e1 = input.cutMembers.find((m) => m.id === 'e1')!;
      const e3 = input.cutMembers.find((m) => m.id === 'e3')!;
      expect(input.profileOf(e1.role).sectionMm).toBe(40);
      expect(input.profileOf(e3.role).sectionMm).toBe(20);
    });
  });
});
