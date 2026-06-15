import { describe, it, expect } from 'vitest';
import {
  TEMPLATES,
  getTemplate,
  defaultParams,
  continuousRolesFor,
  assignRoleColors,
  membersToStructure,
} from './templates';

function roleCounts(members: { role: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const m of members) counts[m.role] = (counts[m.role] ?? 0) + 1;
  return counts;
}

describe('template registry', () => {
  it('exposes 8 templates with exactly 3 featured', () => {
    expect(TEMPLATES).toHaveLength(8);
    expect(TEMPLATES.filter((t) => t.featured).map((t) => t.id)).toEqual([
      'box-frame',
      'table',
      'shelving',
    ]);
  });

  it('getTemplate falls back to the first template for an unknown id', () => {
    expect(getTemplate('box-frame').id).toBe('box-frame');
    expect(getTemplate('nope')).toBe(TEMPLATES[0]);
  });
});

describe('box frame generation', () => {
  const box = getTemplate('box-frame');
  const params = defaultParams(box); // 1200 × 600 × 800
  const members = box.generate(params);

  it('produces 12 members with the expected role counts', () => {
    expect(members).toHaveLength(12);
    expect(roleCounts(members)).toEqual({
      'Bottom rail W': 2,
      'Bottom rail D': 2,
      'Top rail W': 2,
      'Top rail D': 2,
      Post: 4,
    });
  });

  it('gives posts the height and rails the width/depth', () => {
    const byRole = (role: string) => members.find((m) => m.role === role)!.length;
    expect(byRole('Post')).toBe(800);
    expect(byRole('Top rail W')).toBe(1200);
    expect(byRole('Top rail D')).toBe(600);
  });
});

describe('continuousRolesFor', () => {
  const box = getTemplate('box-frame');

  it('returns the default set at index 0', () => {
    expect(continuousRolesFor(box, 0)).toEqual(['Post']);
  });

  it('returns the alternate set at index 1', () => {
    expect(continuousRolesFor(box, 1)).toContain('Top rail W');
  });

  it('falls back to the default set for an out-of-range index', () => {
    expect(continuousRolesFor(box, 99)).toEqual(['Post']);
  });
});

describe('membersToStructure', () => {
  it('merges coincident endpoints into 8 nodes and 12 edges for a box frame', () => {
    const box = getTemplate('box-frame');
    const members = box.generate(defaultParams(box));
    const { nodes, edges } = membersToStructure(members);
    expect(nodes).toHaveLength(8);
    expect(edges).toHaveLength(12);

    const nodeIds = new Set(nodes.map((n) => n.id));
    for (const e of edges) {
      expect(nodeIds.has(e.fromId)).toBe(true);
      expect(nodeIds.has(e.toId)).toBe(true);
    }
  });
});

describe('assignRoleColors', () => {
  it('assigns one stable colour per distinct role', () => {
    const box = getTemplate('box-frame');
    const members = box.generate(defaultParams(box));
    const a = assignRoleColors(members);
    const b = assignRoleColors(members);
    expect(a.size).toBe(5);
    expect(a.get('Post')).toBeTruthy();
    expect(a.get('Post')).toBe(b.get('Post'));
  });
});

describe('table shelf toggle', () => {
  const table = getTemplate('table');

  it('adds shelf rails when the lower shelf is enabled', () => {
    const withShelf = table.generate({ ...defaultParams(table), shelf: 1 });
    const withoutShelf = table.generate({ ...defaultParams(table), shelf: 0 });
    expect(withShelf.length).toBe(withoutShelf.length + 4);
  });
});

describe('every template is internally consistent', () => {
  it.each(TEMPLATES.map((t) => t.id))('%s generates positive-length members with unique ids', (id) => {
    const t = getTemplate(id);
    const members = t.generate(defaultParams(t));
    expect(members.length).toBeGreaterThan(0);
    const ids = new Set<string>();
    for (const m of members) {
      expect(m.role).toBeTruthy();
      expect(m.length).toBeGreaterThan(0);
      ids.add(m.id);
    }
    expect(ids.size).toBe(members.length);
  });
});
