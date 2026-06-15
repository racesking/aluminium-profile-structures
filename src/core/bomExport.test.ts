import { describe, it, expect } from 'vitest';
import { bomToCsv, structureToExportInput } from './bomExport';
import { solveCuttingStockByProfile } from './cuttingStock';
import type { CutMember } from './joints';
import type { ProfileDef } from './profiles';
import type { Edge, Node, Profile, StockBar } from './types';

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
  const profile: Profile = { name: '40×40', sectionSizeMm: 40 };
  const stock: StockBar[] = [{ id: 's', length: 6000, quantity: 4 }];

  const input = structureToExportInput({
    nodes,
    edges,
    profile,
    stock,
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
  });
});
