import { v4 as uuid } from 'uuid';
import type { Edge, Node, Vec3 } from './types';
import { roundLength, distance } from './geometry';

/**
 * Express Builder parametric templates.
 * Coordinates match the viewport: X = width, Y = up (height), Z = depth.
 * Member lengths are centerline node-to-node, same convention as the Advanced builder.
 */

export type TemplateParamDef = {
  key: string;
  label: string;
  kind: 'length' | 'count' | 'toggle';
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  /** Hide the control when this returns false (e.g. shelf height without shelf). */
  visibleIf?: (params: Record<string, number>) => boolean;
};

export type ExpressMember = {
  id: string;
  role: string;
  from: Vec3;
  to: Vec3;
  length: number;
};

export type TemplateCategory = 'Frames' | 'Furniture' | 'Panels';

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  'Frames',
  'Furniture',
  'Panels',
];

/** One choice of which member set runs full-length through the joints. */
export type ContinuityOption = {
  /** Short label for the toggle, e.g. "Posts" or "Rails". */
  label: string;
  roles: string[];
};

export type TemplateDef = {
  id: string;
  name: string;
  tagline: string;
  category: TemplateCategory;
  /** Shown as an always-visible card; non-featured templates live in the "More" popover. */
  featured?: boolean;
  /**
   * Which member set runs full-length through joints (others butt and are
   * shortened). Index 0 is the default; a second option powers the
   * "through member" toggle.
   */
  continuity: ContinuityOption[];
  params: TemplateParamDef[];
  generate: (p: Record<string, number>) => ExpressMember[];
};

/** Roles that run continuous for the given through-member toggle index. */
export function continuousRolesFor(template: TemplateDef, index: number): string[] {
  const option = template.continuity[index] ?? template.continuity[0];
  return option ? option.roles : [];
}

function makeMember(role: string, index: number, from: Vec3, to: Vec3): ExpressMember {
  return {
    id: `${role}-${index}`,
    role,
    from,
    to,
    length: roundLength(distance(from, to)),
  };
}

/** Horizontal rectangle frame at a given height: 2 width rails + 2 depth rails. */
function rectFrame(
  roleW: string,
  roleD: string,
  width: number,
  depth: number,
  y: number,
  startIndex: { w: number; d: number },
): ExpressMember[] {
  const members = [
    makeMember(roleW, startIndex.w, [0, y, 0], [width, y, 0]),
    makeMember(roleW, startIndex.w + 1, [0, y, depth], [width, y, depth]),
    makeMember(roleD, startIndex.d, [0, y, 0], [0, y, depth]),
    makeMember(roleD, startIndex.d + 1, [width, y, 0], [width, y, depth]),
  ];
  startIndex.w += 2;
  startIndex.d += 2;
  return members;
}

/** 4 vertical members at the rectangle corners, from y0 to y1. */
function verticals(
  role: string,
  width: number,
  depth: number,
  y0: number,
  y1: number,
): ExpressMember[] {
  const corners: [number, number][] = [
    [0, 0],
    [width, 0],
    [width, depth],
    [0, depth],
  ];
  return corners.map(([x, z], i) =>
    makeMember(role, i, [x, y0, z], [x, y1, z]),
  );
}

const lengthParam = (
  key: string,
  label: string,
  defaultValue: number,
  min = 100,
  max = 3000,
): TemplateParamDef => ({
  key,
  label,
  kind: 'length',
  min,
  max,
  step: 10,
  defaultValue,
});

/** Vertical-plane rectangle (z = 0): 2 stiles (along Y) + top & bottom rails (along X). */
function panelFrame(
  stileRole: string,
  railRole: string,
  width: number,
  height: number,
): ExpressMember[] {
  return [
    makeMember(stileRole, 0, [0, 0, 0], [0, height, 0]),
    makeMember(stileRole, 1, [width, 0, 0], [width, height, 0]),
    makeMember(railRole, 0, [0, 0, 0], [width, 0, 0]),
    makeMember(railRole, 1, [0, height, 0], [width, height, 0]),
  ];
}

const countParam = (
  key: string,
  label: string,
  defaultValue: number,
  min: number,
  max: number,
): TemplateParamDef => ({
  key,
  label,
  kind: 'count',
  min,
  max,
  step: 1,
  defaultValue,
});

export const TEMPLATES: TemplateDef[] = [
  {
    id: 'box-frame',
    name: 'Box frame',
    tagline: 'Rectangular 3D frame — enclosures, machine frames, carts.',
    category: 'Frames',
    featured: true,
    continuity: [
      { label: 'Posts', roles: ['Post'] },
      {
        label: 'Rails',
        roles: ['Bottom rail W', 'Bottom rail D', 'Top rail W', 'Top rail D'],
      },
    ],
    params: [
      lengthParam('width', 'Width', 1200),
      lengthParam('depth', 'Depth', 600),
      lengthParam('height', 'Height', 800),
    ],
    generate: (p) => {
      const { width, depth, height } = p;
      return [
        ...rectFrame('Bottom rail W', 'Bottom rail D', width, depth, 0, { w: 0, d: 0 }),
        ...rectFrame('Top rail W', 'Top rail D', width, depth, height, { w: 0, d: 0 }),
        ...verticals('Post', width, depth, 0, height),
      ];
    },
  },
  {
    id: 'cabinet',
    name: 'Cabinet frame',
    tagline: 'Box frame with a mid shelf — AV racks, cabinets, carts.',
    category: 'Frames',
    continuity: [
      { label: 'Posts', roles: ['Post'] },
      {
        label: 'Rails',
        roles: [
          'Bottom rail W',
          'Bottom rail D',
          'Shelf rail W',
          'Shelf rail D',
          'Top rail W',
          'Top rail D',
        ],
      },
    ],
    params: [
      lengthParam('width', 'Width', 800),
      lengthParam('depth', 'Depth', 450),
      lengthParam('height', 'Height', 1200, 200, 3000),
      {
        key: 'shelfHeight',
        label: 'Shelf height',
        kind: 'length',
        min: 50,
        max: 2950,
        step: 10,
        defaultValue: 600,
      },
    ],
    generate: (p) => {
      const { width, depth, height } = p;
      const shelfY = Math.min(Math.max(p.shelfHeight, 50), height - 50);
      return [
        ...rectFrame('Bottom rail W', 'Bottom rail D', width, depth, 0, { w: 0, d: 0 }),
        ...rectFrame('Shelf rail W', 'Shelf rail D', width, depth, shelfY, { w: 0, d: 0 }),
        ...rectFrame('Top rail W', 'Top rail D', width, depth, height, { w: 0, d: 0 }),
        ...verticals('Post', width, depth, 0, height),
      ];
    },
  },
  {
    id: 'table',
    name: 'Table / workbench',
    tagline: '4 legs, top frame, optional lower shelf.',
    category: 'Furniture',
    featured: true,
    continuity: [
      { label: 'Legs', roles: ['Leg'] },
      {
        label: 'Rails',
        roles: ['Top rail W', 'Top rail D', 'Shelf rail W', 'Shelf rail D'],
      },
    ],
    params: [
      lengthParam('width', 'Width', 1500),
      lengthParam('depth', 'Depth', 750),
      lengthParam('height', 'Height', 850, 200, 1500),
      {
        key: 'shelf',
        label: 'Lower shelf',
        kind: 'toggle',
        min: 0,
        max: 1,
        step: 1,
        defaultValue: 1,
      },
      {
        key: 'shelfHeight',
        label: 'Shelf height',
        kind: 'length',
        min: 50,
        max: 1400,
        step: 10,
        defaultValue: 250,
        visibleIf: (p) => p.shelf === 1,
      },
    ],
    generate: (p) => {
      const { width, depth, height, shelf } = p;
      const members = [
        ...verticals('Leg', width, depth, 0, height),
        ...rectFrame('Top rail W', 'Top rail D', width, depth, height, { w: 0, d: 0 }),
      ];
      if (shelf === 1) {
        const shelfY = Math.min(Math.max(p.shelfHeight, 50), height - 50);
        members.push(
          ...rectFrame('Shelf rail W', 'Shelf rail D', width, depth, shelfY, { w: 0, d: 0 }),
        );
      }
      return members;
    },
  },
  {
    id: 'shelving',
    name: 'Shelving rack',
    tagline: 'Uprights with evenly spaced shelf levels.',
    category: 'Furniture',
    featured: true,
    continuity: [
      { label: 'Uprights', roles: ['Upright'] },
      { label: 'Shelves', roles: ['Shelf rail W', 'Shelf rail D'] },
    ],
    params: [
      lengthParam('width', 'Width', 1000),
      lengthParam('depth', 'Depth', 500),
      lengthParam('height', 'Height', 2000, 200, 3000),
      countParam('shelves', 'Shelf levels', 4, 2, 8),
    ],
    generate: (p) => {
      const { width, depth, height } = p;
      const levels = Math.max(2, Math.round(p.shelves));
      const members = verticals('Upright', width, depth, 0, height);
      const idx = { w: 0, d: 0 };
      for (let i = 0; i < levels; i++) {
        const y = (height * i) / (levels - 1);
        members.push(...rectFrame('Shelf rail W', 'Shelf rail D', width, depth, y, idx));
      }
      return members;
    },
  },
  {
    id: 'bench',
    name: 'Bench / seat',
    tagline: '4 legs, top frame and slats across the seat.',
    category: 'Furniture',
    continuity: [
      { label: 'Legs', roles: ['Leg'] },
      { label: 'Rails', roles: ['Top rail W', 'Top rail D'] },
    ],
    params: [
      lengthParam('width', 'Width', 1400),
      lengthParam('depth', 'Depth', 400),
      lengthParam('height', 'Height', 450, 150, 1200),
      countParam('slats', 'Seat slats', 4, 0, 10),
    ],
    generate: (p) => {
      const { width, depth, height } = p;
      const slats = Math.max(0, Math.round(p.slats));
      const members = [
        ...verticals('Leg', width, depth, 0, height),
        ...rectFrame('Top rail W', 'Top rail D', width, depth, height, { w: 0, d: 0 }),
      ];
      for (let i = 0; i < slats; i++) {
        const x = (width * (i + 1)) / (slats + 1);
        members.push(
          makeMember('Slat', i, [x, height, 0], [x, height, depth]),
        );
      }
      return members;
    },
  },
  {
    id: 'flat-frame',
    name: 'Flat panel frame',
    tagline: '2D rectangle with optional crossbars — doors, panels, infills.',
    category: 'Panels',
    continuity: [
      { label: 'Stiles', roles: ['Stile'] },
      { label: 'Rails', roles: ['Rail'] },
    ],
    params: [
      lengthParam('width', 'Width', 1000),
      lengthParam('height', 'Height', 2000, 100, 4000),
      countParam('crossbars', 'Crossbars', 2, 0, 6),
    ],
    generate: (p) => {
      const { width, height } = p;
      const bars = Math.max(0, Math.round(p.crossbars));
      const members = panelFrame('Stile', 'Rail', width, height);
      for (let i = 0; i < bars; i++) {
        const y = (height * (i + 1)) / (bars + 1);
        members.push(makeMember('Crossbar', i, [0, y, 0], [width, y, 0]));
      }
      return members;
    },
  },
  {
    id: 'gate-panel',
    name: 'Gate / picket panel',
    tagline: '2D frame with vertical pickets — gates, railings, fences.',
    category: 'Panels',
    continuity: [
      { label: 'Stiles', roles: ['Stile'] },
      { label: 'Rails', roles: ['Rail'] },
    ],
    params: [
      lengthParam('width', 'Width', 1200),
      lengthParam('height', 'Height', 1000, 100, 3000),
      countParam('pickets', 'Pickets', 5, 0, 14),
    ],
    generate: (p) => {
      const { width, height } = p;
      const pickets = Math.max(0, Math.round(p.pickets));
      const members = panelFrame('Stile', 'Rail', width, height);
      for (let i = 0; i < pickets; i++) {
        const x = (width * (i + 1)) / (pickets + 1);
        members.push(makeMember('Picket', i, [x, 0, 0], [x, height, 0]));
      }
      return members;
    },
  },
  {
    id: 'ladder',
    name: 'Ladder',
    tagline: 'Two side rails with evenly spaced rungs.',
    category: 'Panels',
    continuity: [
      { label: 'Side rails', roles: ['Rail'] },
      { label: 'Rungs', roles: ['Rung'] },
    ],
    params: [
      lengthParam('length', 'Length', 2000, 200, 6000),
      lengthParam('width', 'Width', 400, 100, 1200),
      countParam('rungs', 'Rungs', 6, 2, 16),
    ],
    generate: (p) => {
      const { length, width } = p;
      const rungs = Math.max(2, Math.round(p.rungs));
      const members: ExpressMember[] = [
        makeMember('Rail', 0, [0, 0, 0], [0, length, 0]),
        makeMember('Rail', 1, [width, 0, 0], [width, length, 0]),
      ];
      for (let i = 0; i < rungs; i++) {
        const y = (length * (i + 1)) / (rungs + 1);
        members.push(makeMember('Rung', i, [0, y, 0], [width, y, 0]));
      }
      return members;
    },
  },
];

export function getTemplate(id: string): TemplateDef {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

export function defaultParams(template: TemplateDef): Record<string, number> {
  const params: Record<string, number> = {};
  for (const def of template.params) {
    params[def.key] = def.defaultValue;
  }
  return params;
}

/** Distinct high-contrast colors assigned per role, in order of first appearance. */
const ROLE_PALETTE = [
  '#2563eb', // blue
  '#ea580c', // orange
  '#16a34a', // green
  '#9333ea', // purple
  '#dc2626', // red
  '#0891b2', // cyan
  '#db2777', // pink
  '#ca8a04', // amber
];

export function assignRoleColors(members: ExpressMember[]): Map<string, string> {
  const colors = new Map<string, string>();
  for (const m of members) {
    if (!colors.has(m.role)) {
      colors.set(m.role, ROLE_PALETTE[colors.size % ROLE_PALETTE.length]);
    }
  }
  return colors;
}

/** Convert members to the Advanced builder's node/edge structure, merging coincident endpoints. */
export function membersToStructure(members: ExpressMember[]): {
  nodes: Node[];
  edges: Edge[];
} {
  const nodeByKey = new Map<string, Node>();
  const keyOf = (v: Vec3) =>
    `${Math.round(v[0] * 10)}|${Math.round(v[1] * 10)}|${Math.round(v[2] * 10)}`;

  const nodeFor = (v: Vec3): Node => {
    const key = keyOf(v);
    let node = nodeByKey.get(key);
    if (!node) {
      node = { id: uuid(), position: [...v] as Vec3 };
      nodeByKey.set(key, node);
    }
    return node;
  };

  const edges: Edge[] = members.map((m) => ({
    id: uuid(),
    fromId: nodeFor(m.from).id,
    toId: nodeFor(m.to).id,
  }));

  return { nodes: [...nodeByKey.values()], edges };
}
