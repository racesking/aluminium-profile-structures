import { describe, it, expect } from 'vitest';
import { parseProjectFile } from './projectFile';

function expressFile(expressOverrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    app: 'profile-builder',
    version: 1,
    kind: 'express',
    savedAt: '2026-01-01T00:00:00.000Z',
    name: 'demo',
    express: {
      templateId: 'box-frame',
      paramsByTemplate: { 'box-frame': { width: 1200, depth: 600, height: 800 } },
      kerf: 3,
      ...expressOverrides,
    },
  });
}

function structureFile(): string {
  return JSON.stringify({
    app: 'profile-builder',
    version: 1,
    kind: 'structure',
    savedAt: '2026-01-01T00:00:00.000Z',
    name: 'frame',
    structure: {
      nodes: [{ id: 'a', position: [0, 0, 0] }],
      edges: [],
      constraints: [],
      profile: { name: '40×40', sectionSizeMm: 40 },
      stock: [{ id: 's', length: 6000, quantity: 4 }],
      kerf: 3,
      snap: 5,
      gridCellSize: 5,
      snapToGrid: true,
      workPlane: 'xz',
      duplicateOffset: [100, 0, 0],
    },
  });
}

describe('parseProjectFile — valid', () => {
  it('parses a valid express project', () => {
    const p = parseProjectFile(expressFile());
    expect(p.kind).toBe('express');
    expect(p.express?.templateId).toBe('box-frame');
  });

  it('parses a valid structure project', () => {
    const p = parseProjectFile(structureFile());
    expect(p.kind).toBe('structure');
    expect(p.structure?.nodes).toHaveLength(1);
  });

  it('accepts a legacy single-profile express project', () => {
    const p = parseProjectFile(
      expressFile({
        stockMode: 'buy',
        buyLength: 6000,
        inventory: [{ id: 'x', length: 6000, quantity: 4 }],
        profileName: '40×40',
        sectionSizeMm: 40,
      }),
    );
    expect(p.express?.profileName).toBe('40×40');
  });

  it('preserves multi-profile fields', () => {
    const p = parseProjectFile(
      expressFile({
        profiles: [{ id: 'p1', name: '40×40', sectionMm: 40 }],
        roleProfileByTemplate: { 'box-frame': { Post: 'p1' } },
        stockByProfile: { p1: { buyLength: 6000, inventory: [] } },
      }),
    );
    expect(p.express?.profiles?.[0].sectionMm).toBe(40);
    expect(p.express?.stockByProfile?.p1.buyLength).toBe(6000);
  });
});

describe('parseProjectFile — rejects', () => {
  it('non-JSON text', () => {
    expect(() => parseProjectFile('not json {')).toThrow(/valid JSON/);
  });

  it('a file that is not a Profile Builder project', () => {
    expect(() => parseProjectFile(JSON.stringify({ app: 'something-else' }))).toThrow(
      /not a Profile Builder/,
    );
  });

  it('an express file missing its express payload', () => {
    const noPayload = JSON.stringify({
      app: 'profile-builder',
      version: 1,
      kind: 'express',
      savedAt: 't',
      name: 'x',
    });
    expect(() => parseProjectFile(noPayload)).toThrow(/missing|malformed/);
  });

  it('a malformed payload with a wrong field type', () => {
    const bad = JSON.stringify({
      app: 'profile-builder',
      version: 1,
      kind: 'express',
      savedAt: 't',
      name: 'x',
      express: { templateId: 'box-frame', paramsByTemplate: {}, kerf: 'three' },
    });
    expect(() => parseProjectFile(bad)).toThrow(/malformed/);
  });

  it('an unknown project kind', () => {
    const bad = JSON.stringify({
      app: 'profile-builder',
      version: 1,
      kind: 'spaceship',
      savedAt: 't',
      name: 'x',
    });
    expect(() => parseProjectFile(bad)).toThrow(/malformed/);
  });
});
