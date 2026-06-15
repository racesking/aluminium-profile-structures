import type { Node, Profile } from './types';

/** Parse "20x20" or "20×20" → 20 */
export function parseSectionSizeMm(label?: string, fallback = 20): number {
  if (!label) return fallback;
  const m = label.match(/(\d+(?:\.\d+)?)/);
  return m ? Math.max(1, parseFloat(m[1])) : fallback;
}

export function getProfileSectionMm(profile: Profile): number {
  return profile.sectionSizeMm ?? parseSectionSizeMm(profile.sectionLabel, 20);
}

export function getMemberRadiusMm(sectionMm: number): number {
  return Math.max(0.5, sectionMm / 2);
}

export function getNodeRadiusMm(sectionMm: number): number {
  return Math.max(1, sectionMm / 2 + 1);
}

export function getStructureBounds(nodes: Node[]): {
  center: [number, number, number];
  span: number;
} {
  if (nodes.length === 0) {
    return { center: [0, 0, 0], span: 100 };
  }
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity,
    maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.position[0]);
    minY = Math.min(minY, n.position[1]);
    minZ = Math.min(minZ, n.position[2]);
    maxX = Math.max(maxX, n.position[0]);
    maxY = Math.max(maxY, n.position[1]);
    maxZ = Math.max(maxZ, n.position[2]);
  }
  const center: [number, number, number] = [
    (minX + maxX) / 2,
    (minY + maxY) / 2,
    (minZ + maxZ) / 2,
  ];
  const span = Math.max(
    maxX - minX,
    maxY - minY,
    maxZ - minZ,
    10,
  );
  return { center, span };
}

export function cameraDistanceForSpan(span: number): number {
  return Math.max(80, span * 2.2);
}
