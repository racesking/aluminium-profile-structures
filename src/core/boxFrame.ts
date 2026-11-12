import { v4 as uuid } from 'uuid';
import type { Edge, Node } from './types';
import { vec3 } from './geometry';

/**
 * Rectangular tube frame in the viewport's convention: width on X, height on
 * Y (up), depth on Z — the same axes as the Express templates. Origin at
 * bottom-front-left.
 */
export function createBoxFrame(
  width: number,
  depth: number,
  height: number,
): { nodes: Node[]; edges: Edge[] } {
  const ids = Array.from({ length: 8 }, () => uuid());

  // Bottom: 0=FL, 1=FR, 2=BR, 3=BL  |  Top: 4–7 same order
  const nodes: Node[] = [
    { id: ids[0], position: vec3(0, 0, 0) },
    { id: ids[1], position: vec3(width, 0, 0) },
    { id: ids[2], position: vec3(width, 0, depth) },
    { id: ids[3], position: vec3(0, 0, depth) },
    { id: ids[4], position: vec3(0, height, 0) },
    { id: ids[5], position: vec3(width, height, 0) },
    { id: ids[6], position: vec3(width, height, depth) },
    { id: ids[7], position: vec3(0, height, depth) },
  ];

  const pairs: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ];

  const edges: Edge[] = pairs.map(([a, b]) => ({
    id: uuid(),
    fromId: ids[a],
    toId: ids[b],
  }));

  return { nodes, edges };
}
