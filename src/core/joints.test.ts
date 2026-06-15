import { describe, it, expect } from 'vitest';
import { JOINTS, DEFAULT_JOINT_ID, getJoint, applyJointToMembers } from './joints';
import type { ExpressMember } from './templates';

const SECTION = 40;

// A post (vertical) and a rail (horizontal) meeting at a corner.
const members: ExpressMember[] = [
  { id: 'post', role: 'Post', from: [0, 0, 0], to: [0, 800, 0], length: 800 },
  { id: 'rail', role: 'Rail', from: [0, 0, 0], to: [1200, 0, 0], length: 1200 },
];

function lengthsFor(jointId: string) {
  const cut = applyJointToMembers(members, jointId, SECTION, ['Post']);
  return Object.fromEntries(cut.map((m) => [m.role, m.length]));
}

describe('getJoint / defaults', () => {
  it('defaults to the blind joint', () => {
    expect(DEFAULT_JOINT_ID).toBe('blind');
    expect(getJoint(DEFAULT_JOINT_ID).id).toBe('blind');
  });

  it('falls back to the first joint for an unknown id', () => {
    expect(getJoint('does-not-exist')).toBe(JOINTS[0]);
  });
});

describe('applyJointToMembers — cut length compensation (section 40 mm)', () => {
  it('blind joint: the continuous post stays full, the rail loses half a section per end', () => {
    expect(lengthsFor('blind')).toEqual({ Post: 800, Rail: 1160 });
  });

  it('angle bracket: continuity is ignored, so both members are shortened', () => {
    expect(lengthsFor('bracket')).toEqual({ Post: 760, Rail: 1160 });
  });

  it('mitre 45°: members extend to the outer corner', () => {
    expect(lengthsFor('mitre')).toEqual({ Post: 840, Rail: 1240 });
  });

  it('square butt: no compensation, nominal lengths', () => {
    expect(lengthsFor('butt')).toEqual({ Post: 800, Rail: 1200 });
  });

  it('preserves the nominal length alongside the cut length', () => {
    const cut = applyJointToMembers(members, 'blind', SECTION, ['Post']);
    const rail = cut.find((m) => m.role === 'Rail')!;
    expect(rail.nominal).toBe(1200);
    expect(rail.length).toBe(1160);
  });

  it('never produces a non-positive cut length', () => {
    const tiny: ExpressMember[] = [
      { id: 't', role: 'Rail', from: [0, 0, 0], to: [10, 0, 0], length: 10 },
    ];
    const cut = applyJointToMembers(tiny, 'blind', 1000, []);
    expect(cut[0].length).toBeGreaterThan(0);
  });
});
