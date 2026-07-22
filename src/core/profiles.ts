import { v4 as uuid } from 'uuid';
import type { StockBar } from './types';
import type { ProfileShape } from './profileShapes';

/** A named extrusion profile with a square cross-section size in mm. */
export type ProfileDef = {
  id: string;
  name: string;
  sectionMm: number;
  /** Cross-section shape; absent on legacy profiles → square tube. */
  shape?: ProfileShape;
};

/** The stock available for one profile, in both stock modes. */
export type ProfileStock = {
  /** Bar length used in "buy new bars" mode (unlimited quantity). */
  buyLength: number;
  /** Bars/offcuts on hand, used in "my inventory" mode. */
  inventory: StockBar[];
};

export function clampSection(mm: number): number {
  return Math.max(1, Math.min(500, mm));
}

export function makeProfile(
  name = '40×40',
  sectionMm = 40,
  shape: ProfileShape = 'square',
): ProfileDef {
  return { id: uuid(), name, sectionMm: clampSection(sectionMm), shape };
}

export function defaultProfileStock(): ProfileStock {
  return {
    buyLength: 6000,
    inventory: [{ id: uuid(), length: 6000, quantity: 4 }],
  };
}

/** The profile a role is assigned to, falling back to the first profile. */
export function profileForRole(
  profiles: ProfileDef[],
  roleMap: Record<string, string>,
  role: string,
): ProfileDef {
  const id = roleMap[role];
  return profiles.find((p) => p.id === id) ?? profiles[0];
}

/**
 * Distinct high-contrast colors for profiles, cycled by index. Deliberately a
 * different feel from ROLE_PALETTE (templates.ts) so profile colors read apart
 * from the Express role colors.
 */
export const PROFILE_PALETTE: string[] = [
  '#0d9488', // teal
  '#7c3aed', // violet
  '#65a30d', // lime
  '#e11d48', // rose
  '#0284c7', // sky
  '#d97706', // gold
];

/** The palette color for the given profile index, cycling the palette. */
export function profileColorAt(index: number): string {
  const n = PROFILE_PALETTE.length;
  return PROFILE_PALETTE[((index % n) + n) % n];
}
