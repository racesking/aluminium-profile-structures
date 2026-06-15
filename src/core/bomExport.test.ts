import { describe, it, expect } from 'vitest';
import { bomToCsv } from './bomExport';
import { solveCuttingStockByProfile } from './cuttingStock';
import type { CutMember } from './joints';
import type { ProfileDef } from './profiles';

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
