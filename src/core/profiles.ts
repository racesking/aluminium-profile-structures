import { v4 as uuid } from 'uuid';
import type { StockBar } from './types';

/** A named extrusion profile with a square cross-section size in mm. */
export type ProfileDef = {
  id: string;
  name: string;
  sectionMm: number;
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

export function makeProfile(name = '40×40', sectionMm = 40): ProfileDef {
  return { id: uuid(), name, sectionMm: clampSection(sectionMm) };
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
