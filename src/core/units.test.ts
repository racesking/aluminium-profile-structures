import { describe, it, expect } from 'vitest';
import { toDisplay, fromDisplay, formatLength } from './units';

describe('unit conversion', () => {
  it('converts mm to each display unit', () => {
    expect(toDisplay(1200, 'mm')).toBe(1200);
    expect(toDisplay(1200, 'cm')).toBe(120);
    expect(toDisplay(1200, 'm')).toBe(1.2);
    expect(toDisplay(254, 'in')).toBe(10);
  });

  it('round-trips display → mm', () => {
    expect(fromDisplay(120, 'cm')).toBe(1200);
    expect(fromDisplay(1.2, 'm')).toBe(1200);
    expect(fromDisplay(10, 'in')).toBe(254);
  });

  it('formats with unit suffix and trims trailing zeros', () => {
    expect(formatLength(1200, 'mm')).toBe('1200 mm');
    expect(formatLength(1200, 'cm')).toBe('120 cm');
    expect(formatLength(1200, 'm')).toBe('1.2 m');
  });
});
