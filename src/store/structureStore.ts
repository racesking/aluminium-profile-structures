import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { createBoxFrame } from '../core/boxFrame';
import { DEFAULT_JOINT_ID, getJoint } from '../core/joints';
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
  formatCutList,
  solveCuttingStockByProfile,
} from '../core/cuttingStock';
import type {
  MultiCuttingResult,
  ProfileCutGroup,
} from '../core/cuttingStock';
import {
  clampSection,
  isProfileHexColor,
  makeProfile,
  type ProfileDef,
} from '../core/profiles';
import { isProfileShape, type ProfileShape } from '../core/profileShapes';
import type {
  AxisLock,
  CutPiece,
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
  edgeProfile: Record<string, string>,
): HistorySnapshot {
  return {
    nodes: nodes.map((n) => ({ ...n, position: [...n.position] as Vec3 })),
    edges: edges.map((e) => ({ ...e })),
    constraints: constraints.map((c) => ({ ...c })),
    edgeProfile: { ...edgeProfile },
  };
}

type StructureState = {
  /** Version-store project this design belongs to; null until first autosave. */
  projectId: string | null;
  projectName: string;
  nodes: Node[];
  edges: { id: string; fromId: string; toId: string }[];
  constraints: EdgeConstraint[];
  profiles: ProfileDef[];
  /** edgeId → profileId. An edge not present falls back to profiles[0]. */
  edgeProfile: Record<string, string>;
  /** profileId → stock bars. */
  stockByProfile: Record<string, StockBar[]>;
  kerf: number;
  /** Joint type used for rendering members at shared nodes. */
  jointId: string;
  /** Locked members: cannot be moved, re-dimensioned, or deleted. */
  lockedEdgeIds: string[];
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
  cuttingResult: MultiCuttingResult | null;
  secondNodeId: string | null;
  historyPast: HistorySnapshot[];
  historyFuture: HistorySnapshot[];
  canUndo: boolean;
  canRedo: boolean;

  setProjectName: (name: string) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  /** Lock every selected member, or unlock them if all are already locked. */
  toggleLockSelection: () => void;
  getEdgeProfileId: (edgeId: string) => string;
  getEdgeProfile: (edgeId: string) => ProfileDef;
  addProfile: () => void;
  removeProfile: (id: string) => void;
  updateProfile: (
    id: string,
    patch: {
      name?: string;
      sectionMm?: number;
      shape?: ProfileShape;
      color?: string;
    },
  ) => void;
  assignSelectedToProfile: (profileId: string) => void;
  setSnap: (snap: number) => void;
  setGridCellSize: (size: number) => void;
  setSnapToGrid: (on: boolean) => void;
  setKerf: (kerf: number) => void;
  setJoint: (id: string) => void;
  setWorkPlane: (plane: WorkPlane) => void;
  setAxisLock: (axis: AxisLock) => void;
  setToolMode: (mode: ToolMode) => void;
  setViewPreset: (preset: ViewPreset) => void;
  setSelection: (sel: Selection) => void;
  setEdgeSelection: (edgeId: string, shiftKey: boolean, altKey?: boolean) => void;
  clearSelection: () => void;
  selectEdges: (ids: string[], additive: boolean) => void;
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

  addStockRow: (profileId: string) => void;
  updateStock: (
    profileId: string,
    rowId: string,
    length: number,
    quantity: number,
  ) => void;
  removeStock: (profileId: string, rowId: string) => void;

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

function defaultStockBars(): StockBar[] {
  return [{ id: uuid(), length: 1000, quantity: 6 }];
}

type MultiProfileSlice = {
  profiles: ProfileDef[];
  edgeProfile: Record<string, string>;
  stockByProfile: Record<string, StockBar[]>;
};

/** The initial single-profile slice for a fresh Advanced project. */
function defaultProfileSlice(): MultiProfileSlice {
  const profile = makeProfile('20×20', 20);
  return {
    profiles: [profile],
    edgeProfile: {},
    stockByProfile: { [profile.id]: defaultStockBars() },
  };
}

/**
 * Build the multi-profile slice from a payload, preferring v2 fields and
 * migrating legacy single-profile (`profile` + `stock`) data when needed.
 */
function migrateProfileSlice(data: {
  profiles?: ProfileDef[];
  edgeProfile?: Record<string, string>;
  stockByProfile?: Record<string, StockBar[]>;
  profile?: { name?: string; sectionLabel?: string; sectionSizeMm?: number };
  stock?: StockBar[];
}): MultiProfileSlice {
  if (Array.isArray(data.profiles) && data.profiles.length > 0) {
    const profiles = data.profiles.map((p) => ({
      id: p.id ?? uuid(),
      name: typeof p.name === 'string' ? p.name : '20×20',
      sectionMm: clampSection(typeof p.sectionMm === 'number' ? p.sectionMm : 20),
      shape: isProfileShape(p.shape) ? p.shape : ('square' as const),
      color: isProfileHexColor(p.color) ? p.color : undefined,
    }));
    const stockByProfile: Record<string, StockBar[]> = {};
    for (const p of profiles) {
      const bars = data.stockByProfile?.[p.id];
      stockByProfile[p.id] =
        Array.isArray(bars) && bars.length > 0
          ? bars.map((b) => ({
              id: b.id ?? uuid(),
              length: Math.max(1, b.length),
              quantity: Math.max(0, b.quantity),
            }))
          : defaultStockBars();
    }
    return {
      profiles,
      edgeProfile: data.edgeProfile ?? {},
      stockByProfile,
    };
  }

  // Legacy single-profile project → one profile carrying the old section + stock.
  const section =
    data.profile?.sectionSizeMm ??
    parseSectionSizeMm(data.profile?.sectionLabel, 20);
  const profile = makeProfile(data.profile?.name ?? '20×20', section);
  return {
    profiles: [profile],
    edgeProfile: {},
    stockByProfile: {
      [profile.id]:
        data.stock && data.stock.length > 0 ? data.stock : defaultStockBars(),
    },
  };
}

/** Node ids pinned in place because they belong to a locked member. */
function lockedNodeIds(
  edges: { id: string; fromId: string; toId: string }[],
  lockedEdgeIds: string[],
): Set<string> {
  const locked = new Set(lockedEdgeIds);
  const pinned = new Set<string>();
  for (const e of edges) {
    if (locked.has(e.id)) {
      pinned.add(e.fromId);
      pinned.add(e.toId);
    }
  }
  return pinned;
}

function applySnapshot(snapshot: HistorySnapshot): Partial<StructureState> {
  return {
    nodes: snapshot.nodes,
    edges: snapshot.edges,
    constraints: snapshot.constraints,
    edgeProfile: { ...snapshot.edgeProfile },
    cuttingResult: null,
  };
}

export const useStructureStore = create<StructureState>((set, get) => ({
  projectId: null,
  projectName: 'Untitled structure',
  nodes: [],
  edges: [],
  constraints: [],
  ...defaultProfileSlice(),
  kerf: 0,
  jointId: DEFAULT_JOINT_ID,
  lockedEdgeIds: [],
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

  setProjectName: (name) =>
    set({ projectName: name.trim() || 'Untitled structure' }),

  pushHistory: () => {
    const { nodes, edges, constraints, edgeProfile, historyPast } = get();
    const snap = cloneSnapshot(nodes, edges, constraints, edgeProfile);
    const past = [...historyPast, snap].slice(-MAX_HISTORY);
    set({
      historyPast: past,
      historyFuture: [],
      canUndo: past.length > 0,
      canRedo: false,
    });
  },

  undo: () => {
    const { historyPast, historyFuture, nodes, edges, constraints, edgeProfile } = get();
    if (historyPast.length === 0) return;
    const current = cloneSnapshot(nodes, edges, constraints, edgeProfile);
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
    const { historyFuture, historyPast, nodes, edges, constraints, edgeProfile } = get();
    if (historyFuture.length === 0) return;
    const current = cloneSnapshot(nodes, edges, constraints, edgeProfile);
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

  toggleLockSelection: () => {
    const ids = getActiveEdgeIds(get().selection, get().selectedEdgeIds);
    if (ids.length === 0) return;
    set((s) => {
      const locked = new Set(s.lockedEdgeIds);
      const anyUnlocked = ids.some((id) => !locked.has(id));
      if (anyUnlocked) {
        for (const id of ids) locked.add(id);
      } else {
        for (const id of ids) locked.delete(id);
      }
      return { lockedEdgeIds: [...locked] };
    });
  },

  getEdgeProfileId: (edgeId) => {
    const { edgeProfile, profiles } = get();
    return edgeProfile[edgeId] ?? profiles[0].id;
  },
  getEdgeProfile: (edgeId) => {
    const { profiles } = get();
    const id = get().getEdgeProfileId(edgeId);
    return profiles.find((p) => p.id === id) ?? profiles[0];
  },
  addProfile: () =>
    set((s) => {
      const profile = makeProfile(`Profile ${s.profiles.length + 1}`, 20);
      return {
        profiles: [...s.profiles, profile],
        stockByProfile: {
          ...s.stockByProfile,
          [profile.id]: defaultStockBars(),
        },
      };
    }),
  removeProfile: (id) => {
    if (get().profiles.length <= 1) return;
    get().pushHistory();
    set((s) => {
      const profiles = s.profiles.filter((p) => p.id !== id);
      const fallbackId = profiles[0].id;
      // Reassign that profile's edges to the fallback; drop its stock.
      const edgeProfile = { ...s.edgeProfile };
      for (const [edgeId, pid] of Object.entries(edgeProfile)) {
        if (pid === id) edgeProfile[edgeId] = fallbackId;
      }
      const stockByProfile = { ...s.stockByProfile };
      delete stockByProfile[id];
      return { profiles, edgeProfile, stockByProfile, cuttingResult: null };
    });
  },
  updateProfile: (id, patch) =>
    set((s) => ({
      profiles: s.profiles.map((p) =>
        p.id === id
          ? {
              ...p,
              name: patch.name ?? p.name,
              sectionMm:
                patch.sectionMm !== undefined
                  ? clampSection(patch.sectionMm)
                  : p.sectionMm,
              shape: patch.shape ?? p.shape,
              color: isProfileHexColor(patch.color) ? patch.color : p.color,
            }
          : p,
      ),
      cuttingResult: null,
    })),
  assignSelectedToProfile: (profileId) => {
    const ids = getActiveEdgeIds(get().selection, get().selectedEdgeIds);
    if (ids.length === 0) return;
    get().pushHistory();
    set((s) => {
      const edgeProfile = { ...s.edgeProfile };
      for (const id of ids) edgeProfile[id] = profileId;
      return { edgeProfile, cuttingResult: null };
    });
  },
  setSnap: (snap) => set({ snap }),
  setGridCellSize: (size) =>
    set({ gridCellSize: Math.max(0.1, Math.min(10000, size)) }),
  setSnapToGrid: (on) => set({ snapToGrid: on }),
  setKerf: (kerf) => set({ kerf: Math.max(0, kerf) }),
  setJoint: (id) => set({ jointId: getJoint(id).id }),
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
  clearSelection: () =>
    set({ selection: null, selectedEdgeIds: [], secondEdgeId: null }),
  selectEdges: (ids, additive) =>
    set((s) => {
      const next = additive
        ? Array.from(new Set([...s.selectedEdgeIds, ...ids]))
        : ids;
      return {
        selectedEdgeIds: next,
        selection: next.length
          ? { type: 'edge', id: next[next.length - 1] }
          : null,
        secondEdgeId: null,
        cuttingResult: null,
      };
    }),
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
    // Carry each source edge's profile onto its duplicate. duplicateEdges keeps
    // the original `edges` array order, so source[i] ↔ result.newEdgeIds[i].
    const idSet = new Set(edgeIds);
    const sourceEdges = edges.filter((e) => idSet.has(e.id));
    set((s) => {
      const edgeProfile = { ...s.edgeProfile };
      sourceEdges.forEach((src, i) => {
        const assigned = s.edgeProfile[src.id];
        if (assigned) edgeProfile[result.newEdgeIds[i]] = assigned;
      });
      return {
        nodes: [...s.nodes, ...result.nodes],
        edges: [...s.edges, ...result.edges],
        constraints: [...s.constraints, ...result.constraints],
        edgeProfile,
        selectedEdgeIds: result.newEdgeIds,
        selection:
          result.newEdgeIds.length > 0
            ? { type: 'edge', id: result.newEdgeIds[result.newEdgeIds.length - 1] }
            : null,
        cuttingResult: null,
      };
    });
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
    const pinned = lockedNodeIds(get().edges, get().lockedEdgeIds);
    const nodeIds = getSelectedNodeIds(get().edges, edgeIds).filter(
      (id) => !pinned.has(id),
    );
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
    set((s) => {
      // Best-effort: carry the source edge's profile (if it still exists) onto
      // the paste. Falls back to the default profile when unknown.
      const edgeProfile = { ...s.edgeProfile };
      clipboard.edges.forEach((src, i) => {
        const assigned = s.edgeProfile[src.id];
        if (assigned) edgeProfile[newEdges[i].id] = assigned;
      });
      return {
        nodes: [...s.nodes, ...newNodes],
        edges: [...s.edges, ...newEdges],
        constraints: [...s.constraints, ...newConstraints],
        edgeProfile,
        selectedEdgeIds: newEdgeIds,
        selection:
          newEdgeIds.length > 0
            ? { type: 'edge', id: newEdgeIds[newEdgeIds.length - 1] }
            : null,
        cuttingResult: null,
      };
    });
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
    const { snapToGrid, gridCellSize, edges, lockedEdgeIds } = get();
    if (lockedEdgeIds.length > 0 && lockedNodeIds(edges, lockedEdgeIds).has(id)) {
      return; // endpoint of a locked member — pinned in place
    }
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
    const { selection, nodes, edges, constraints, selectedEdgeIds, lockedEdgeIds } =
      get();
    const lockedSet = new Set(lockedEdgeIds);
    const edgeIdsToDelete = getActiveEdgeIds(selection, selectedEdgeIds).filter(
      (id) => !lockedSet.has(id),
    );
    if (!selection && edgeIdsToDelete.length === 0) return;
    if (selection?.type === 'node') {
      // Deleting a node would take its incident members with it — refuse when
      // any of them is locked.
      const nid = selection.id;
      const touchesLocked = edges.some(
        (e) => lockedSet.has(e.id) && (e.fromId === nid || e.toId === nid),
      );
      if (touchesLocked) return;
    } else if (edgeIdsToDelete.length === 0) {
      return; // everything selected is locked
    }
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
    const { edges, nodes, constraints, lockedEdgeIds } = get();
    const edge = edges.find((e) => e.id === edgeId);
    if (!edge || length <= 0) return;
    // A locked member keeps its length; a member whose far endpoint belongs to
    // a locked member cannot push that endpoint around either.
    if (lockedEdgeIds.includes(edgeId)) return;
    if (lockedNodeIds(edges, lockedEdgeIds).has(edge.toId)) return;
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

  addStockRow: (profileId) =>
    set((s) => ({
      stockByProfile: {
        ...s.stockByProfile,
        [profileId]: [
          ...(s.stockByProfile[profileId] ?? []),
          { id: uuid(), length: 1000, quantity: 1 },
        ],
      },
    })),

  updateStock: (profileId, rowId, length, quantity) =>
    set((s) => ({
      stockByProfile: {
        ...s.stockByProfile,
        [profileId]: (s.stockByProfile[profileId] ?? []).map((b) =>
          b.id === rowId
            ? { ...b, length: Math.max(1, length), quantity: Math.max(0, quantity) }
            : b,
        ),
      },
      cuttingResult: null,
    })),

  removeStock: (profileId, rowId) =>
    set((s) => ({
      stockByProfile: {
        ...s.stockByProfile,
        [profileId]: (s.stockByProfile[profileId] ?? []).filter(
          (b) => b.id !== rowId,
        ),
      },
      cuttingResult: null,
    })),

  loadBoxFrame: (width, depth, height) => {
    get().pushHistory();
    const { nodes, edges } = createBoxFrame(width, depth, height);
    set({
      nodes,
      edges,
      constraints: [],
      edgeProfile: {},
      lockedEdgeIds: [],
      selection: null,
      selectedEdgeIds: [],
      connectFromId: null,
      secondEdgeId: null,
      cuttingResult: null,
    });
  },

  importStructure: ({ nodes, edges, stock, kerf, profile }) => {
    get().pushHistory();
    set((s) => {
      // Express hands off a single profile → one Advanced profile carrying it.
      const slice: MultiProfileSlice = profile
        ? (() => {
            const section = profile.sectionSizeMm ?? 40;
            const p = makeProfile(profile.name, section);
            return {
              profiles: [p],
              edgeProfile: {},
              stockByProfile: {
                [p.id]: stock && stock.length > 0 ? stock : defaultStockBars(),
              },
            };
          })()
        : {
            profiles: s.profiles,
            edgeProfile: {},
            stockByProfile: s.stockByProfile,
          };
      return {
        nodes,
        edges,
        constraints: [],
        ...slice,
        kerf: kerf ?? s.kerf,
        lockedEdgeIds: [],
        // Hand-off starts a fresh project; the next autosave creates it.
        projectId: null,
        projectName: 'Imported design',
        selection: null,
        selectedEdgeIds: [],
        connectFromId: null,
        secondEdgeId: null,
        secondNodeId: null,
        cuttingResult: null,
      };
    });
  },

  optimize: () => {
    const { nodes, edges, profiles, edgeProfile, stockByProfile, kerf } = get();
    const fallbackId = profiles[0].id;
    // Group edges by their assigned profile, preserving member numbering (M<i>)
    // across the whole structure so labels stay stable.
    const piecesByProfile = new Map<string, CutPiece[]>();
    edges.forEach((e, i) => {
      const pid = edgeProfile[e.id] ?? fallbackId;
      const list = piecesByProfile.get(pid) ?? [];
      list.push({
        edgeId: e.id,
        length: roundLength(edgeLength(nodes, e.fromId, e.toId)),
        label: `M${i + 1}`,
      });
      piecesByProfile.set(pid, list);
    });

    const groups: ProfileCutGroup[] = profiles
      .filter((p) => (piecesByProfile.get(p.id)?.length ?? 0) > 0)
      .map((p) => ({
        profileId: p.id,
        profileName: p.name,
        sectionMm: p.sectionMm,
        pieces: piecesByProfile.get(p.id) ?? [],
        stock: stockByProfile[p.id] ?? [],
      }));

    set({ cuttingResult: solveCuttingStockByProfile(groups, kerf) });
  },

  clearCuttingResult: () => set({ cuttingResult: null }),

  saveProject: () => {
    const {
      nodes,
      edges,
      constraints,
      profiles,
      edgeProfile,
      stockByProfile,
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
        profiles,
        edgeProfile,
        stockByProfile,
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
        ...migrateProfileSlice(data),
        kerf: data.kerf ?? 0,
        jointId: getJoint(data.jointId ?? DEFAULT_JOINT_ID).id,
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
      profiles,
      edgeProfile,
      stockByProfile,
      kerf,
      jointId,
      lockedEdgeIds,
      snap,
      gridCellSize,
      snapToGrid,
      workPlane,
      duplicateOffset,
    } = get();
    const stockClone: Record<string, StockBar[]> = {};
    for (const [pid, bars] of Object.entries(stockByProfile)) {
      stockClone[pid] = bars.map((b) => ({ ...b }));
    }
    return {
      nodes: nodes.map((n) => ({ ...n, position: [...n.position] as Vec3 })),
      edges: edges.map((e) => ({ ...e })),
      constraints: constraints.map((c) => ({ ...c })),
      profiles: profiles.map((p) => ({ ...p })),
      edgeProfile: { ...edgeProfile },
      stockByProfile: stockClone,
      kerf,
      jointId,
      lockedEdges: [...lockedEdgeIds],
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
      ...migrateProfileSlice(payload),
      kerf: payload.kerf ?? 0,
      jointId: getJoint(payload.jointId ?? DEFAULT_JOINT_ID).id,
      lockedEdgeIds: Array.isArray(payload.lockedEdges)
        ? payload.lockedEdges.filter((id): id is string => typeof id === 'string')
        : [],
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
    const result = cuttingResult ?? (get().optimize(), get().cuttingResult);
    if (!result || result.byProfile.length === 0) {
      return 'CUT LIST — Aluminium Profile Builder\n\n(no members to cut)';
    }
    // One formatted block per profile; multi-profile shows a section heading.
    const multi = result.byProfile.length > 1;
    const blocks = result.byProfile.map((p) => {
      const heading = multi
        ? `=== ${p.profileName} (${p.sectionMm}×${p.sectionMm} mm) ===\n`
        : '';
      return heading + formatCutList(p.result);
    });
    return blocks.join('\n\n');
  },
}));
