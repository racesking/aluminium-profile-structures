import { describe, it, expect } from 'vitest';
import { iso, structureDrawingSvg } from './drawing';
import { getTemplate, defaultParams, assignRoleColors } from './templates';
import { applyJointToMembers } from './joints';

describe('iso projection', () => {
  const c = Math.cos(Math.PI / 6);
  const s = Math.sin(Math.PI / 6);

  it('projects the unit axes', () => {
    expect(iso([1, 0, 0]).x).toBeCloseTo(c);
    expect(iso([1, 0, 0]).y).toBeCloseTo(s);
    expect(iso([0, 1, 0])).toEqual({ x: 0, y: -1 });
    expect(iso([0, 0, 1]).x).toBeCloseTo(-c);
    expect(iso([0, 0, 1]).y).toBeCloseTo(s);
  });
});

describe('structureDrawingSvg', () => {
  const box = getTemplate('box-frame');
  const members = applyJointToMembers(box.generate(defaultParams(box)), 'blind', 40, ['Post']);
  const colors = assignRoleColors(members);
  const { svg, items } = structureDrawingSvg(members, colors, 'mm');

  it('returns an <svg> and one numbered item per distinct role', () => {
    expect(svg.startsWith('<svg')).toBe(true);
    expect(items).toHaveLength(5);
    expect(items.map((i) => i.n)).toEqual([1, 2, 3, 4, 5]);
    expect(items.find((i) => i.role === 'Post')?.qty).toBe(4);
  });

  it('draws the overall dimension labels', () => {
    expect(svg).toContain('1200 mm'); // width
    expect(svg).toContain('800 mm'); // height
    expect(svg).toContain('600 mm'); // depth
  });

  it('handles empty input', () => {
    expect(structureDrawingSvg([], colors, 'mm')).toEqual({ svg: '', items: [] });
  });
});
