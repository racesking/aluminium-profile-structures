import { v4 as uuid } from 'uuid';
import type { Edge, EdgeConstraint, Node, Vec3 } from './types';
import { maybeSnapVec3 } from './geometry';

export function connectedEdgeGroup(
  edges: Edge[],
  seedEdgeIds: string[],
): string[] {
  if (seedEdgeIds.length === 0) return [];
  const nodeToEdges = new Map<string, string[]>();
  for (const e of edges) {
    for (const nid of [e.fromId, e.toId]) {
      const list = nodeToEdges.get(nid) ?? [];
      list.push(e.id);
      nodeToEdges.set(nid, list);
    }
  }
  const result = new Set<string>(seedEdgeIds);
  const queue = [...seedEdgeIds];
  while (queue.length > 0) {
    const eid = queue.pop()!;
    const e = edges.find((x) => x.id === eid);
    if (!e) continue;
    for (const nid of [e.fromId, e.toId]) {
      for (const neighborEid of nodeToEdges.get(nid) ?? []) {
        if (!result.has(neighborEid)) {
          result.add(neighborEid);
          queue.push(neighborEid);
        }
      }
    }
  }
  return [...result];
}

export type DuplicateResult = {
  nodes: Node[];
  edges: Edge[];
  constraints: EdgeConstraint[];
  newEdgeIds: string[];
  newNodeIds: string[];
};

export function duplicateEdges(
  nodes: Node[],
  edges: Edge[],
  constraints: EdgeConstraint[],
  edgeIds: string[],
  offset: Vec3,
  snapToGrid: boolean,
  gridCellSize: number,
): DuplicateResult | null {
  if (edgeIds.length === 0) return null;

  const selectedEdges = edges.filter((e) => edgeIds.includes(e.id));
  if (selectedEdges.length === 0) return null;

  const nodeIdSet = new Set<string>();
  for (const e of selectedEdges) {
    nodeIdSet.add(e.fromId);
    nodeIdSet.add(e.toId);
  }

  const nodeIdMap = new Map<string, string>();
  const newNodes: Node[] = [];

  for (const nid of nodeIdSet) {
    const node = nodes.find((n) => n.id === nid);
    if (!node) continue;
    const newId = uuid();
    nodeIdMap.set(nid, newId);
    newNodes.push({
      id: newId,
      position: maybeSnapVec3(
        [
          node.position[0] + offset[0],
          node.position[1] + offset[1],
          node.position[2] + offset[2],
        ],
        snapToGrid,
        gridCellSize,
      ),
    });
  }

  const edgeIdMap = new Map<string, string>();
  const newEdges: Edge[] = selectedEdges.map((e) => {
    const newId = uuid();
    edgeIdMap.set(e.id, newId);
    return {
      id: newId,
      fromId: nodeIdMap.get(e.fromId)!,
      toId: nodeIdMap.get(e.toId)!,
    };
  });

  const edgeIdSet = new Set(edgeIds);
  const newConstraints: EdgeConstraint[] = constraints
    .filter((c) => edgeIdSet.has(c.edgeAId) && edgeIdSet.has(c.edgeBId))
    .map((c) => ({
      id: uuid(),
      edgeAId: edgeIdMap.get(c.edgeAId)!,
      edgeBId: edgeIdMap.get(c.edgeBId)!,
      type: c.type,
    }));

  return {
    nodes: newNodes,
    edges: newEdges,
    constraints: newConstraints,
    newEdgeIds: newEdges.map((e) => e.id),
    newNodeIds: newNodes.map((n) => n.id),
  };
}
