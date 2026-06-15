/**
 * Length units. The whole app stores lengths canonically in millimetres; this
 * module only handles display/entry conversion for the user-chosen unit.
 */
export type LengthUnit = 'mm' | 'cm' | 'm' | 'in';

export const LENGTH_UNITS: LengthUnit[] = ['mm', 'cm', 'm', 'in'];

/** Millimetres per one unit. */
const MM_PER: Record<LengthUnit, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
};

/** Decimal places shown when formatting a value in each unit. */
const DECIMALS: Record<LengthUnit, number> = {
  mm: 0,
  cm: 1,
  m: 3,
  in: 2,
};

/** Step for numeric inputs, in display units. */
const INPUT_STEP: Record<LengthUnit, number> = {
  mm: 1,
  cm: 0.5,
  m: 0.01,
  in: 0.1,
};

export function unitLabel(unit: LengthUnit): string {
  return unit;
}

export function unitInputStep(unit: LengthUnit): number {
  return INPUT_STEP[unit];
}

/** mm → value in the display unit (number). */
export function toDisplay(mm: number, unit: LengthUnit): number {
  const v = mm / MM_PER[unit];
  const d = DECIMALS[unit];
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

/** display-unit value → mm. */
export function fromDisplay(value: number, unit: LengthUnit): number {
  return value * MM_PER[unit];
}

function trimZeros(n: number): string {
  // 1.200 → "1.2", 120.0 → "120"
  return Number(n).toString();
}

/** mm → "1.2 m" / "120 cm" / "1200 mm" / "47.24 in". */
export function formatLength(mm: number, unit: LengthUnit): string {
  return `${trimZeros(toDisplay(mm, unit))} ${unit}`;
}

/** mm → just the number string in the display unit (no unit suffix). */
export function formatLengthValue(mm: number, unit: LengthUnit): string {
  return trimZeros(toDisplay(mm, unit));
}
