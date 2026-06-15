import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { createBoxFrame } from '../core/boxFrame';
import {
  alignEdgeParallel,
  alignEdgePerpendicular,
  enforceConstraints,
} from '../core/constraints';
import {
  edgeLength,
  maybeSnapVec3,
  nodeDistance,
  roundLength,
  setEdgeLength,
} from '../core/geometry';
import {
  connectedEdgeGroup,
  duplicateEdges,
} from '../core/duplicate';
import {
  getActiveEdgeIds,
  getConstraintEdgePair,
  getSelectedNodeIds,
} from '../core/selection';
import { parseSectionSizeMm } from '../core/visualScale';
import type { ClipboardPayload } from '../core/types';
import type { StructurePayload } from '../core/projectFile';
import {
  extractCutList,
  formatCutList,
  solveCuttingStock,
} from '../core/cuttingStock';
import type {
  AxisLock,
  CuttingResult,
  EdgeConstraint,
  HistorySnapshot,
  Node,
  Selection,
  StockBar,
  ToolMode,
  Vec3,
  ViewPreset,
  WorkPlane,
} from '../core/types';

const STORAGE_KEY = 'profile-builder-project';
const MAX_HISTORY = 80;

function cloneSnapshot(
  nodes: Node[],
  edges: { id: string; fromId: string; toId: string }[],
  constraints: EdgeConstraint[],
): HistorySnapshot {
  return {
    nodes: nodes.map((n) => ({ ...n, position: [...n.position] as Vec3 })),
    edges: edges.map((e) => ({ ...e })),
    constraints: constraints.map((c) => ({ ...c })),
  };
}

type StructureState = {
  nodes: Node[];
  edges: { id: string; fromId: string; toId: string }[];
  constraints: EdgeConstraint[];
  profile: { name: string; sectionLabel?: string; sectionSizeMm?: number };
  stock: StockBar[];
  kerf: number;
  snap: number;
  gridCellSize: number;
  snapToGrid: boolean;
  clipboard: ClipboardPayload | null;
  workPlane: WorkPlane;
  axisLock: AxisLock;
  selection: Selection;
  selectedEdgeIds: string[];
  secondEdgeId: string | null;
  duplicateOffset: Vec3;
  toolMode: ToolMode;
  connectFromId: string | null;
  viewPreset: ViewPreset;
  cuttingResult: CuttingResult | null;
  secondNodeId: string | null;
  historyPast: HistorySnapshot[];
  historyFuture: HistorySnapshot[];
  canUndo: boolean;
  canRedo: boolean;

  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  setProfile: (name: string, sectionLabel?: string) => void;
  setSectionSizeMm: (size: number) => void;
  setSnap: (snap: number) => void;
  setGridCellSize: (size: number) => void;
  setSnapToGrid: (on: boolean) => void;
  setKerf: (kerf: number) => void;
  setWorkPlane: (plane: WorkPlane) => void;
  setAxisLock: (axis: AxisLock) => void;
  setToolMode: (mode: ToolMode) => void;
  setViewPreset: (preset: ViewPreset) => void;
  setSelection: (sel: Selection) => void;
  setEdgeSelection: (edgeId: string, shiftKey: boolean, altKey?: boolean) => void;
  selectConnectedGroup: () => void;
  selectAllMembers: () => void;
  setDuplicateOffset: (offset: Vec3) => void;
  duplicateSelection: () => void;
  translateSelection: (delta: Vec3) => void;
  copySelection: () => void;
  pasteSelection: () => void;
  getConstraintPair: () => { edgeAId: string; edgeBId: string } | null;
  applyConstraintParallelToPair: () => void;
  applyConstraintPerpendicularToPair: () => void;
  setSecondEdge: (id: string | null) => void;
  setSecondNode: (id: string | null) => void;
  getActiveEdgeIds: () => string[];

  addNode: (position: Vec3) => string;
  moveNode: (id: string, position: Vec3, options?: { skipEnforce?: boolean }) => void;
  finishNodeDrag: () => void;
  deleteSelected: () => void;

  startConnect: (nodeId: string) => void;
  finishConnect: (nodeId: string) => void;
  cancelConnect: () => void;

  setEdgeLengthById: (edgeId: string, length: number) => void;
  getEdgeLength: (edgeId: string) => number;
  getNodePairDistance: () => number | null;

  addConstraintParallel: (edgeAId: string, edgeBId: string) => void;
  addConstraintPerpendicular: (edgeAId: string, edgeBId: string) => void;
  removeConstraint: (id: string) => void;

  addStockRow: () => void;
  updateStock: (id: string, length: number, quantity: number) => void;
  removeStock: (id: string) => void;

  loadBoxFrame: (width: number, depth: number, height: number) => void;
  importStructure: (payload: {
    nodes: Node[];
    edges: { id: string; fromId: string; toId: string }[];
    stock?: StockBar[];
    kerf?: number;
    profile?: { name: string; sectionLabel?: string; sectionSizeMm?: number };
  }) => void;
  optimize: () => void;
  clearCuttingResult: () => void;

  saveProject: () => void;
  loadProject: () => boolean;
  getStructurePayload: () => StructurePayload;
  hydrateFromPayload: (payload: StructurePayload) => void;
  exportCutList: () => string;
};

const defaultStock: StockBar[] = [
  { id: uuid(), length: 1000, quantity: 6 },
];

function applySnapshot(snapshot: HistorySnapshot): Partial<StructureState> {
  return {
    nodes: snapshot.nodes,
    edges: snapshot.edges,
    constraints: snapshot.constraints,
    cuttingResult: null,
  };
}

export const useStructureStore = create<StructureState>((set, get) => ({
  nodes: [],
  edges: [],
  constraints: [],
  profile: { name: '20×20', sectionLabel: '20×20 mm', sectionSizeMm: 20 },
  stock: defaultStock,
  kerf: 0,
  snap: 5,
  gridCellSize: 5,
  snapToGrid: true,
  clipboard: null,
  workPlane: 'xz',
  axisLock: null,
  selection: null,
  selectedEdgeIds: [],
  secondEdgeId: null,
  duplicateOffset: [100, 0, 0],
  toolMode: 'select',
  connectFromId: null,
  viewPreset: 'perspective',
  cuttingResult: null,
  secondNodeId: null,
  historyPast: [],
  historyFuture: [],
  canUndo: false,
  canRedo: false,

  pushHistory: () => {
    const { nodes, edges, constraints, historyPast } = get();
    const snap = cloneSnapshot(nodes, edges, constraints);
    const past = [...historyPast, snap].slice(-MAX_HISTORY);
    set({
      historyPast: past,
      historyFuture: [],
      canUndo: past.length > 0,
      canRedo: false,
    });
  },

  undo: () => {
    const { historyPast, historyFuture, nodes, edges, constraints } = get();
    if (historyPast.length === 0) return;
    const current = cloneSnapshot(nodes, edges, constraints);
    const past = [...historyPast];
    const prev = past.pop()!;
    set({
      ...applySnapshot(prev),
      historyPast: past,
      historyFuture: [current, ...historyFuture],
      canUndo: past.length > 0,
      canRedo: true,
      selection: null,
    });
  },

  redo: () => {
    const { historyFuture, historyPast, nodes, edges, constraints } = get();
    if (historyFuture.length === 0) return;
    const current = cloneSnapshot(nodes, edges, constraints);
    const future = [...historyFuture];
    const next = future.shift()!;
    const past = [...historyPast, current];
    set({
      ...applySnapshot(next),
      historyPast: past,
      historyFuture: future,
      canUndo: true,
      canRedo: future.length > 0,
      selection: null,
    });
  },

  setProfile: (name, sectionLabel) => {
    const label = sectionLabel ?? name;
    set({
      profile: {
        name,
        sectionLabel: label,
        sectionSizeMm: parseSectionSizeMm(label, 20),
      },
    });
  },
  setSectionSizeMm: (size) =>
    set((s) => ({
      profile: {
        ...s.profile,
        sectionSizeMm: Math.max(1, Math.min(10000, size)),
      },
    })),
  setSnap: (snap) => set({ snap }),
  setGridCellSize: (size) =>
    set({ gridCellSize: Math.max(0.1, Math.min(10000, size)) }),
  setSnapToGrid: (on) => set({ snapToGrid: on }),
  setKerf: (kerf) => set({ kerf: Math.max(0, kerf) }),
  setWorkPlane: (plane) => set({ workPlane: plane }),
  setAxisLock: (axis) => set({ axisLock: axis }),
  setToolMode: (mode) =>
    set({
      toolMode: mode,
      connectFromId: null,
      selection: null,
      secondEdgeId: null,
      selectedEdgeIds: [],
    }),
  setViewPreset: (preset) => set({ viewPreset: preset }),
  setSelection: (sel) => {
    if (sel?.type === 'edge') {
      set({
        selection: sel,
        selectedEdgeIds: [sel.id],
        secondEdgeId: null,
        cuttingResult: null,
      });
    } else {
      set({
        selection: sel,
        selectedEdgeIds: [],
        cuttingResult: null,
      });
    }
  },
  setEdgeSelection: (edgeId, shiftKey, altKey = false) => {
    const { selectedEdgeIds, selection } = get();
    if (altKey && selection?.type === 'edge') {
      set({
        secondEdgeId: edgeId === selection.id ? null : edgeId,
        cuttingResult: null,
      });
      return;
    }
    if (shiftKey) {
      const has = selectedEdgeIds.includes(edgeId);
      const next = has
        ? selectedEdgeIds.filter((id) => id !== edgeId)
        : [...selectedEdgeIds, edgeId];
      const pairSecond =
        next.length >= 2 ? next[next.length - 2] : null;
      set({
        selectedEdgeIds: next,
        selection:
          next.length > 0
            ? { type: 'edge', id: next[next.length - 1] }
            : null,
        secondEdgeId: pairSecond,
        cuttingResult: null,
      });
    } else {
      set({
        selectedEdgeIds: [edgeId],
        selection: { type: 'edge', id: edgeId },
        secondEdgeId: null,
        cuttingResult: null,
      });
    }
  },
  selectAllMembers: () => {
    const { edges } = get();
    if (edges.length === 0) return;
    const ids = edges.map((e) => e.id);
    set({
      selectedEdgeIds: ids,
      selection: { type: 'edge', id: ids[ids.length - 1] },
      cuttingResult: null,
    });
  },
  selectConnectedGroup: () => {
    const ids = getActiveEdgeIds(get().selection, get().selectedEdgeIds);
    if (ids.length === 0) return;
    const group = connectedEdgeGroup(get().edges, ids);
    const last = group[group.length - 1] ?? ids[0];
    set({
      selectedEdgeIds: group,
      selection: { type: 'edge', id: last },
      cuttingResult: null,
    });
  },
  setDuplicateOffset: (offset) => set({ duplicateOffset: offset }),
  duplicateSelection: () => {
    const { nodes, edges, constraints, duplicateOffset, snapToGrid, gridCellSize } =
      get();
    const edgeIds = getActiveEdgeIds(get().selection, get().selectedEdgeIds);
    if (edgeIds.length === 0) return;
    const result = duplicateEdges(
      nodes,
      edges,
      constraints,
      edgeIds,
      duplicateOffset,
      snapToGrid,
      gridCellSize,
    );
    if (!result) return;
    get().pushHistory();
    set((s) => ({
      nodes: [...s.nodes, ...result.nodes],
      edges: [...s.edges, ...result.edges],
      constraints: [...s.constraints, ...result.constraints],
      selectedEdgeIds: result.newEdgeIds,
      selection:
        result.newEdgeIds.length > 0
          ? { type: 'edge', id: result.newEdgeIds[result.newEdgeIds.length - 1] }
          : null,
      cuttingResult: null,
    }));
  },
  getActiveEdgeIds: () =>
    getActiveEdgeIds(get().selection, get().selectedEdgeIds),
  getConstraintPair: () =>
    getConstraintEdgePair(
      get().selection,
      get().selectedEdgeIds,
      get().secondEdgeId,
    ),
  translateSelection: (delta) => {
    const edgeIds = getActiveEdgeIds(get().selection, get().selectedEdgeIds);
    if (edgeIds.length === 0) return;
    const nodeIds = getSelectedNodeIds(get().edges, edgeIds);
    if (nodeIds.length === 0) return;
    get().pushHistory();
    set((s) => {
      let nodes = s.nodes.map((n) =>
        nodeIds.includes(n.id)
          ? {
              ...n,
              position: maybeSnapVec3(
                [
                  n.position[0] + delta[0],
                  n.position[1] + delta[1],
                  n.position[2] + delta[2],
                ],
                s.snapToGrid,
                s.gridCellSize,
              ),
            }
          : n,
      );
      if (s.constraints.length > 0) {
        nodes = enforceConstraints(nodes, s.edges, s.constraints);
      }
      return { nodes, cuttingResult: null };
    });
  },
  copySelection: () => {
    const edgeIds = getActiveEdgeIds(get().selection, get().selectedEdgeIds);
    if (edgeIds.length === 0) return;
    const { nodes, edges, constraints } = get();
    const nodeIds = new Set(getSelectedNodeIds(edges, edgeIds));
    set({
      clipboard: {
        nodes: nodes
          .filter((n) => nodeIds.has(n.id))
          .map((n) => ({ ...n, position: [...n.position] as Vec3 })),
        edges: edges.filter((e) => edgeIds.includes(e.id)).map((e) => ({ ...e })),
        constraints: constraints
          .filter((c) => edgeIds.includes(c.edgeAId) && edgeIds.includes(c.edgeBId))
          .map((c) => ({ ...c })),
      },
    });
  },
  pasteSelection: () => {
    const { clipboard, duplicateOffset, snapToGrid, gridCellSize } = get();
    if (!clipboard || clipboard.edges.length === 0) return;
    get().pushHistory();
    const nodeIdMap = new Map<string, string>();
    const newNodes: Node[] = clipboard.nodes.map((n) => {
      const id = uuid();
      nodeIdMap.set(n.id, id);
      return {
        id,
        position: maybeSnapVec3(
          [
            n.position[0] + duplicateOffset[0],
            n.position[1] + duplicateOffset[1],
            n.position[2] + duplicateOffset[2],
          ],
          snapToGrid,
          gridCellSize,
        ),
      };
    });
    const newEdges = clipboard.edges.map((e) => ({
      id: uuid(),
      fromId: nodeIdMap.get(e.fromId)!,
      toId: nodeIdMap.get(e.toId)!,
    }));
    const edgeIdMap = new Map(
      clipboard.edges.map((e, i) => [e.id, newEdges[i].id]),
    );
    const newConstraints = clipboard.constraints.map((c) => ({
      id: uuid(),
      edgeAId: edgeIdMap.get(c.edgeAId)!,
      edgeBId: edgeIdMap.get(c.edgeBId)!,
      type: c.type,
    }));
    const newEdgeIds = newEdges.map((e) => e.id);
    set((s) => ({
      nodes: [...s.nodes, ...newNodes],
      edges: [...s.edges, ...newEdges],
      constraints: [...s.constraints, ...newConstraints],
      selectedEdgeIds: newEdgeIds,
      selection:
        newEdgeIds.length > 0
          ? { type: 'edge', id: newEdgeIds[newEdgeIds.length - 1] }
          : null,
      cuttingResult: null,
    }));
  },
  applyConstraintParallelToPair: () => {
    const pair = get().getConstraintPair();
    if (pair) get().addConstraintParallel(pair.edgeAId, pair.edgeBId);
  },
  applyConstraintPerpendicularToPair: () => {
    const pair = get().getConstraintPair();
    if (pair) get().addConstraintPerpendicular(pair.edgeAId, pair.edgeBId);
  },
  setSecondEdge: (id) => set({ secondEdgeId: id }),
  setSecondNode: (id) => set({ secondNodeId: id }),

  addNode: (position) => {
    get().pushHistory();
    const id = uuid();
    const { snapToGrid, gridCellSize } = get();
    const snapped = maybeSnapVec3(position, snapToGrid, gridCellSize);
    set((s) => ({
      nodes: [...s.nodes, { id, position: snapped }],
      selection: { type: 'node', id },
      cuttingResult: null,
    }));
    return id;
  },

  moveNode: (id, position, options) => {
    const { snapToGrid, gridCellSize } = get();
    const snapped = maybeSnapVec3(position, snapToGrid, gridCellSize);
    set((s) => {
      let nodes = s.nodes.map((n) =>
        n.id === id ? { ...n, position: snapped } : n,
      );
      if (!options?.skipEnforce && s.constraints.length > 0) {
        nodes = enforceConstraints(nodes, s.edges, s.constraints);
      }
      return { nodes, cuttingResult: null };
    });
  },

  finishNodeDrag: () => {
    const { nodes, edges, constraints } = get();
    if (constraints.length === 0) return;
    const enforced = enforceConstraints(nodes, edges, constraints);
    set({ nodes: enforced });
  },

  deleteSelected: () => {
    const { selection, nodes, edges, constraints, selectedEdgeIds } = get();
    const edgeIdsToDelete = getActiveEdgeIds(selection, selectedEdgeIds);
    if (!selection && edgeIdsToDelete.length === 0) return;
    get().pushHistory();
    if (selection?.type === 'node') {
      const nid = selection.id;
      set({
        nodes: nodes.filter((n) => n.id !== nid),
        edges: edges.filter((e) => e.fromId !== nid && e.toId !== nid),
        constraints: constraints.filter((c) => {
          const ea = edges.find((e) => e.id === c.edgeAId);
          const eb = edges.find((e) => e.id === c.edgeBId);
          return (
            ea?.fromId !== nid &&
            ea?.toId !== nid &&
            eb?.fromId !== nid &&
            eb?.toId !== nid
          );
        }),
        selection: null,
        selectedEdgeIds: [],
        connectFromId: null,
        secondNodeId: null,
        secondEdgeId: null,
        cuttingResult: null,
      });
    } else if (edgeIdsToDelete.length > 0) {
      const idSet = new Set(edgeIdsToDelete);
      const remainingEdges = edges.filter((e) => !idSet.has(e.id));
      const usedNodes = new Set<string>();
      for (const e of remainingEdges) {
        usedNodes.add(e.fromId);
        usedNodes.add(e.toId);
      }
      set({
        edges: remainingEdges,
        nodes: nodes.filter((n) => usedNodes.has(n.id)),
        constraints: constraints.filter(
          (c) => !idSet.has(c.edgeAId) && !idSet.has(c.edgeBId),
        ),
        selection: null,
        selectedEdgeIds: [],
        secondEdgeId: null,
        cuttingResult: null,
      });
    }
  },

  startConnect: (nodeId) => {
    set({ connectFromId: nodeId, toolMode: 'connect' });
  },

  finishConnect: (nodeId) => {
    const { connectFromId, edges } = get();
    if (!connectFromId || connectFromId === nodeId) {
      set({ connectFromId: null });
      return;
    }
    const exists = edges.some(
      (e) =>
        (e.fromId === connectFromId && e.toId === nodeId) ||
        (e.fromId === nodeId && e.toId === connectFromId),
    );
    if (!exists) {
      get().pushHistory();
      const edge = { id: uuid(), fromId: connectFromId, toId: nodeId };
      set((s) => ({
        edges: [...s.edges, edge],
        connectFromId: null,
        selection: { type: 'edge', id: edge.id },
        selectedEdgeIds: [edge.id],
        cuttingResult: null,
      }));
    } else {
      set({ connectFromId: null, selection: { type: 'node', id: nodeId } });
    }
  },

  cancelConnect: () => set({ connectFromId: null }),

  setEdgeLengthById: (edgeId, length) => {
    const { edges, nodes, constraints } = get();
    const edge = edges.find((e) => e.id === edgeId);
    if (!edge || length <= 0) return;
    get().pushHistory();
    let newNodes = setEdgeLength(nodes, edge.fromId, edge.toId, length, 'to');
    newNodes = enforceConstraints(newNodes, edges, constraints);
    set({ nodes: newNodes, cuttingResult: null });
  },

  getEdgeLength: (edgeId) => {
    const { edges, nodes } = get();
    const edge = edges.find((e) => e.id === edgeId);
    if (!edge) return 0;
    return roundLength(edgeLength(nodes, edge.fromId, edge.toId));
  },

  getNodePairDistance: () => {
    const { selection, secondNodeId, nodes } = get();
    if (selection?.type !== 'node' || !secondNodeId) return null;
    return nodeDistance(nodes, selection.id, secondNodeId);
  },

  addConstraintParallel: (edgeAId, edgeBId) => {
    if (edgeAId === edgeBId) return;
    const { edges, nodes, constraints } = get();
    const edgeA = edges.find((e) => e.id === edgeAId);
    const edgeB = edges.find((e) => e.id === edgeBId);
    if (!edgeA || !edgeB) return;
    get().pushHistory();
    const exists = constraints.some(
      (c) =>
        c.type === 'parallel' &&
        ((c.edgeAId === edgeAId && c.edgeBId === edgeBId) ||
          (c.edgeAId === edgeBId && c.edgeBId === edgeAId)),
    );
    const newConstraints = exists
      ? constraints
      : [
          ...constraints,
          { id: uuid(), edgeAId, edgeBId, type: 'parallel' as const },
        ];
    const newNodes = alignEdgeParallel(nodes, edgeA, edgeB);
    set({ nodes: newNodes, constraints: newConstraints, cuttingResult: null });
  },

  addConstraintPerpendicular: (edgeAId, edgeBId) => {
    if (edgeAId === edgeBId) return;
    const { edges, nodes, constraints } = get();
    const edgeA = edges.find((e) => e.id === edgeAId);
    const edgeB = edges.find((e) => e.id === edgeBId);
    if (!edgeA || !edgeB) return;
    get().pushHistory();
    const exists = constraints.some(
      (c) =>
        c.type === 'perpendicular' &&
        ((c.edgeAId === edgeAId && c.edgeBId === edgeBId) ||
          (c.edgeAId === edgeBId && c.edgeBId === edgeAId)),
    );
    const newConstraints = exists
      ? constraints
      : [
          ...constraints,
          { id: uuid(), edgeAId, edgeBId, type: 'perpendicular' as const },
        ];
    const newNodes = alignEdgePerpendicular(nodes, edgeA, edgeB);
    set({ nodes: newNodes, constraints: newConstraints, cuttingResult: null });
  },

  removeConstraint: (id) => {
    get().pushHistory();
    set((s) => ({
      constraints: s.constraints.filter((c) => c.id !== id),
      cuttingResult: null,
    }));
  },

  addStockRow: () =>
    set((s) => ({
      stock: [...s.stock, { id: uuid(), length: 1000, quantity: 1 }],
    })),

  updateStock: (id, length, quantity) =>
    set((s) => ({
      stock: s.stock.map((b) =>
        b.id === id
          ? { ...b, length: Math.max(1, length), quantity: Math.max(0, quantity) }
          : b,
      ),
      cuttingResult: null,
    })),

  removeStock: (id) =>
    set((s) => ({
      stock: s.stock.filter((b) => b.id !== id),
      cuttingResult: null,
    })),

  loadBoxFrame: (width, depth, height) => {
    get().pushHistory();
    const { nodes, edges } = createBoxFrame(width, depth, height);
    set({
      nodes,
      edges,
      constraints: [],
      selection: null,
      selectedEdgeIds: [],
      connectFromId: null,
      secondEdgeId: null,
      cuttingResult: null,
    });
  },

  importStructure: ({ nodes, edges, stock, kerf, profile }) => {
    get().pushHistory();
    set((s) => ({
      nodes,
      edges,
      constraints: [],
      stock: stock && stock.length > 0 ? stock : s.stock,
      kerf: kerf ?? s.kerf,
      profile: profile ?? s.profile,
      selection: null,
      selectedEdgeIds: [],
      connectFromId: null,
      secondEdgeId: null,
      secondNodeId: null,
      cuttingResult: null,
    }));
  },

  optimize: () => {
    const { nodes, edges, stock, kerf } = get();
    const pieces = extractCutList(edges, (fromId, toId) =>
      edgeLength(nodes, fromId, toId),
    );
    const result = solveCuttingStock(pieces, stock, kerf);
    set({ cuttingResult: result });
  },

  clearCuttingResult: () => set({ cuttingResult: null }),

  saveProject: () => {
    const {
      nodes,
      edges,
      constraints,
      profile,
      stock,
      kerf,
      snap,
      workPlane,
      duplicateOffset,
      gridCellSize,
      snapToGrid,
    } = get();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        nodes,
        edges,
        constraints,
        profile,
        stock,
        kerf,
        snap,
        workPlane,
        duplicateOffset,
        gridCellSize,
        snapToGrid,
      }),
    );
  },

  loadProject: () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      set({
        nodes: data.nodes ?? [],
        edges: data.edges ?? [],
        constraints: data.constraints ?? [],
        profile: {
          ...(data.profile ?? { name: '20×20', sectionLabel: '20×20 mm' }),
          sectionSizeMm:
            data.profile?.sectionSizeMm ??
            parseSectionSizeMm(data.profile?.sectionLabel, 20),
        },
        stock: data.stock ?? defaultStock,
        kerf: data.kerf ?? 0,
        snap: data.snap ?? 5,
        workPlane: data.workPlane ?? 'xz',
        selection: null,
        selectedEdgeIds: [],
        secondEdgeId: null,
        duplicateOffset: data.duplicateOffset ?? [100, 0, 0],
        gridCellSize: data.gridCellSize ?? 5,
        snapToGrid: data.snapToGrid ?? true,
        cuttingResult: null,
        historyPast: [],
        historyFuture: [],
        canUndo: false,
        canRedo: false,
      });
      return true;
    } catch {
      return false;
    }
  },

  getStructurePayload: () => {
    const {
      nodes,
      edges,
      constraints,
      profile,
      stock,
      kerf,
      snap,
      gridCellSize,
      snapToGrid,
      workPlane,
      duplicateOffset,
    } = get();
    return {
      nodes: nodes.map((n) => ({ ...n, position: [...n.position] as Vec3 })),
      edges: edges.map((e) => ({ ...e })),
      constraints: constraints.map((c) => ({ ...c })),
      profile: { ...profile },
      stock: stock.map((s) => ({ ...s })),
      kerf,
      snap,
      gridCellSize,
      snapToGrid,
      workPlane,
      duplicateOffset: [...duplicateOffset] as Vec3,
    };
  },

  hydrateFromPayload: (payload) => {
    set({
      nodes: payload.nodes ?? [],
      edges: payload.edges ?? [],
      constraints: payload.constraints ?? [],
      profile: {
        ...(payload.profile ?? { name: '20×20', sectionLabel: '20×20 mm' }),
        sectionSizeMm:
          payload.profile?.sectionSizeMm ??
          parseSectionSizeMm(payload.profile?.sectionLabel, 20),
      },
      stock: payload.stock?.length ? payload.stock : defaultStock,
      kerf: payload.kerf ?? 0,
      snap: payload.snap ?? 5,
      gridCellSize: payload.gridCellSize ?? 5,
      snapToGrid: payload.snapToGrid ?? true,
      workPlane: payload.workPlane ?? 'xz',
      duplicateOffset: payload.duplicateOffset ?? [100, 0, 0],
      selection: null,
      selectedEdgeIds: [],
      secondEdgeId: null,
      secondNodeId: null,
      connectFromId: null,
      cuttingResult: null,
      historyPast: [],
      historyFuture: [],
      canUndo: false,
      canRedo: false,
    });
  },

  exportCutList: () => {
    const { cuttingResult } = get();
    if (!cuttingResult) {
      get().optimize();
      return formatCutList(get().cuttingResult!);
    }
    return formatCutList(cuttingResult);
  },
}));
