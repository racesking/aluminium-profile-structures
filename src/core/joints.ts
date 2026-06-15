import { roundLength } from './geometry';
import type { ExpressMember } from './templates';

/**
 * Joint types for how members meet at a node, and how that changes the cut
 * length of each member relative to its nominal centerline length.
 *
 * `factor` is applied per butting end as a multiple of the profile section size.
 *   negative → the end is shortened (member stops at the mating face)
 *   positive → the end is extended (member runs to the outer corner)
 * `respectContinuity` true means members whose role is "continuous" for the
 * template (posts, legs, uprights, stiles, rails…) run full length and are not
 * shortened — only the members butting into them lose material.
 */
export type JointDef = {
  id: string;
  name: string;
  short: string;
  factor: number;
  respectContinuity: boolean;
};

export const JOINTS: JointDef[] = [
  {
    id: 'blind',
    name: 'Blind joint',
    short: 'Internal connector — one profile runs through, the other butts and is shortened.',
    factor: -0.5,
    respectContinuity: true,
  },
  {
    id: 'bracket',
    name: 'Angle bracket',
    short: 'External corner bracket — both profiles butt and are shortened.',
    factor: -0.5,
    respectContinuity: false,
  },
  {
    id: 'mitre',
    name: 'Mitre 45°',
    short: 'Corners cut at 45° — profiles run out to the outer corner.',
    factor: 0.5,
    respectContinuity: false,
  },
  {
    id: 'butt',
    name: 'Square butt',
    short: 'No compensation — members are cut to the nominal centreline length.',
    factor: 0,
    respectContinuity: false,
  },
];

export const DEFAULT_JOINT_ID = 'blind';

export function getJoint(id: string): JointDef {
  return JOINTS.find((j) => j.id === id) ?? JOINTS[0];
}

export type CutMember = ExpressMember & { nominal: number };

/** Resolve a member's profile section size (mm). Constant for single-profile designs. */
export type SectionResolver = number | ((member: ExpressMember) => number);

function resolveSection(resolver: SectionResolver, member: ExpressMember): number {
  return typeof resolver === 'function' ? resolver(member) : resolver;
}

/**
 * Apply joint compensation to member cut lengths. Geometry (from/to) is left at
 * the centerline so the 3D preview and Advanced-builder hand-off stay connected;
 * only the `length` used for the cut list changes.
 *
 * In these parametric templates every non-continuous member terminates against
 * another member at both ends, so each contributes two butting ends. A butting
 * member is shortened by the *mating* (through) member's section — so a thin rail
 * meeting a thick post loses half the post's width, not its own. When the joint
 * has no through member (bracket/mitre) each member uses its own section.
 *
 * `section` may be a constant (single-profile) or a per-member resolver.
 */
export function applyJointToMembers(
  members: ExpressMember[],
  jointId: string,
  section: SectionResolver,
  continuousRoles: string[],
): CutMember[] {
  const joint = getJoint(jointId);
  const continuous = new Set(continuousRoles);

  const throughMember = members.find((m) => continuous.has(m.role));
  const throughSection =
    throughMember !== undefined ? resolveSection(section, throughMember) : undefined;

  return members.map((m) => {
    const isContinuous = joint.respectContinuity && continuous.has(m.role);
    const buttEnds = isContinuous ? 0 : 2;
    const jointSection =
      joint.respectContinuity && throughSection !== undefined
        ? throughSection
        : resolveSection(section, m);
    const cut = roundLength(
      Math.max(1, m.length + joint.factor * jointSection * buttEnds),
    );
    return { ...m, length: cut, nominal: m.length };
  });
}
