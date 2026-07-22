import { describe, expect, it } from 'vitest';
import {
  PROFILE_SHAPES,
  contourArea,
  isProfileShape,
  profileShapeOf,
  sectionOutline,
  type ProfileShape,
} from './profileShapes';

const ALL: ProfileShape[] = PROFILE_SHAPES.map((s) => s.id);

describe('profileShapes', () => {
  it('validates shape ids', () => {
    expect(isProfileShape('bosch')).toBe(true);
    expect(isProfileShape('hex')).toBe(false);
    expect(isProfileShape(undefined)).toBe(false);
  });

  it('defaults legacy profiles to square', () => {
    expect(profileShapeOf({})).toBe('square');
    expect(profileShapeOf({ shape: 'round' })).toBe('round');
  });

  it('every shape fits its bounding square and winds CCW', () => {
    for (const shape of ALL) {
      const { outer, holes } = sectionOutline(shape, 40);
      expect(outer.length).toBeGreaterThanOrEqual(4);
      for (const [x, y] of [...outer, ...holes.flat()]) {
        expect(Math.abs(x)).toBeLessThanOrEqual(20 + 1e-9);
        expect(Math.abs(y)).toBeLessThanOrEqual(20 + 1e-9);
      }
      // Outer contour counter-clockwise (positive area)…
      expect(contourArea(outer)).toBeGreaterThan(0);
      // …holes clockwise (negative area).
      for (const hole of holes) {
        expect(contourArea(hole)).toBeLessThan(0);
      }
    }
  });

  it('hollow shapes have holes, solid shapes do not', () => {
    expect(sectionOutline('square', 40).holes).toHaveLength(1);
    expect(sectionOutline('round', 40).holes).toHaveLength(1);
    expect(sectionOutline('bosch', 40).holes).toHaveLength(1); // center bore
    expect(sectionOutline('angle', 40).holes).toHaveLength(0);
    expect(sectionOutline('tee', 40).holes).toHaveLength(0);
  });

  it('tiny sections degrade to solid instead of degenerate walls', () => {
    expect(sectionOutline('square', 2).holes).toHaveLength(0);
    expect(sectionOutline('round', 2).holes).toHaveLength(0);
  });

  it('bosch outline has four-fold symmetry and a bore', () => {
    const { outer, holes } = sectionOutline('bosch', 40);
    // 4 faces × 9 points each.
    expect(outer).toHaveLength(36);
    expect(holes).toHaveLength(1);
    // Material area = outer minus bore, well below the full square.
    const area = contourArea(outer) + contourArea(holes[0]);
    expect(area).toBeGreaterThan(0);
    expect(area).toBeLessThan(40 * 40);
  });

  it('outline scales linearly with section size', () => {
    const small = sectionOutline('tee', 20);
    const large = sectionOutline('tee', 40);
    expect(contourArea(large.outer)).toBeCloseTo(contourArea(small.outer) * 4, 4);
  });

  it('L angle area matches the two-legs formula', () => {
    const s = 40;
    const { outer } = sectionOutline('angle', s);
    // Area = s² − (s−t)² for leg thickness t.
    const t = Math.min(Math.max(1.5, Math.min(8, s * 0.18)), s / 2);
    expect(contourArea(outer)).toBeCloseTo(s * s - (s - t) * (s - t), 6);
  });
});
