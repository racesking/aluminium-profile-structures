import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { TEMPLATES, defaultParams, getTemplate } from '../core/templates';
import { DEFAULT_JOINT_ID, getJoint } from '../core/joints';
import type { StockBar } from '../core/types';
import type { ExpressPayload } from '../core/projectFile';

const STORAGE_KEY = 'express-builder-state';

export type StockMode = 'buy' | 'inventory';

type ExpressState = {
  templateId: string;
  paramsByTemplate: Record<string, Record<string, number>>;
  stockMode: StockMode;
  /** Bar length used in 'buy' mode — unlimited quantity, optimizer minimizes count. */
  buyLength: number;
  inventory: StockBar[];
  kerf: number;
  profileName: string;
  sectionSizeMm: number;
  jointId: string;
  /** Which continuity option (0 or 1) runs continuous through joints. */
  throughIndex: number;

  setTemplate: (id: string) => void;
  setParam: (key: string, value: number) => void;
  resetParams: () => void;
  setStockMode: (mode: StockMode) => void;
  setBuyLength: (length: number) => void;
  addInventoryRow: () => void;
  updateInventory: (id: string, length: number, quantity: number) => void;
  removeInventory: (id: string) => void;
  setKerf: (kerf: number) => void;
  setProfileName: (name: string) => void;
  setSectionSizeMm: (size: number) => void;
  setJoint: (id: string) => void;
  setThroughIndex: (index: number) => void;
  getExpressPayload: () => ExpressPayload;
  hydrateFromPayload: (payload: ExpressPayload) => void;
};

function allDefaultParams(): Record<string, Record<string, number>> {
  const all: Record<string, Record<string, number>> = {};
  for (const t of TEMPLATES) {
    all[t.id] = defaultParams(t);
  }
  return all;
}

function loadSaved(): Partial<ExpressState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    const params = allDefaultParams();
    if (data.paramsByTemplate) {
      for (const t of TEMPLATES) {
        params[t.id] = { ...params[t.id], ...(data.paramsByTemplate[t.id] ?? {}) };
      }
    }
    return {
      templateId: TEMPLATES.some((t) => t.id === data.templateId)
        ? data.templateId
        : undefined,
      paramsByTemplate: params,
      stockMode: data.stockMode === 'inventory' ? 'inventory' : 'buy',
      buyLength: typeof data.buyLength === 'number' ? data.buyLength : undefined,
      inventory: Array.isArray(data.inventory) && data.inventory.length > 0
        ? data.inventory
        : undefined,
      kerf: typeof data.kerf === 'number' ? data.kerf : undefined,
      profileName:
        typeof data.profileName === 'string' ? data.profileName : undefined,
      sectionSizeMm:
        typeof data.sectionSizeMm === 'number' ? data.sectionSizeMm : undefined,
      jointId: typeof data.jointId === 'string' ? data.jointId : undefined,
      throughIndex:
        data.throughIndex === 0 || data.throughIndex === 1
          ? data.throughIndex
          : undefined,
    };
  } catch {
    return {};
  }
}

const saved = loadSaved();

export const useExpressStore = create<ExpressState>((set, get) => ({
  templateId: saved.templateId ?? TEMPLATES[0].id,
  paramsByTemplate: saved.paramsByTemplate ?? allDefaultParams(),
  stockMode: saved.stockMode ?? 'buy',
  buyLength: saved.buyLength ?? 6000,
  inventory: saved.inventory ?? [{ id: uuid(), length: 6000, quantity: 4 }],
  kerf: saved.kerf ?? 3,
  profileName: saved.profileName ?? '40×40',
  sectionSizeMm: saved.sectionSizeMm ?? 40,
  jointId: saved.jointId ?? DEFAULT_JOINT_ID,
  throughIndex: saved.throughIndex ?? 0,

  setTemplate: (id) => set({ templateId: id }),
  setParam: (key, value) =>
    set((s) => ({
      paramsByTemplate: {
        ...s.paramsByTemplate,
        [s.templateId]: {
          ...s.paramsByTemplate[s.templateId],
          [key]: value,
        },
      },
    })),
  resetParams: () =>
    set((s) => ({
      paramsByTemplate: {
        ...s.paramsByTemplate,
        [s.templateId]: defaultParams(getTemplate(s.templateId)),
      },
    })),
  setStockMode: (mode) => set({ stockMode: mode }),
  setBuyLength: (length) =>
    set({ buyLength: Math.max(100, Math.min(20000, length)) }),
  addInventoryRow: () =>
    set((s) => ({
      inventory: [...s.inventory, { id: uuid(), length: 6000, quantity: 1 }],
    })),
  updateInventory: (id, length, quantity) =>
    set((s) => ({
      inventory: s.inventory.map((b) =>
        b.id === id
          ? { ...b, length: Math.max(1, length), quantity: Math.max(0, quantity) }
          : b,
      ),
    })),
  removeInventory: (id) =>
    set((s) => ({
      inventory: s.inventory.filter((b) => b.id !== id),
    })),
  setKerf: (kerf) => set({ kerf: Math.max(0, kerf) }),
  setProfileName: (name) => set({ profileName: name }),
  setSectionSizeMm: (size) =>
    set({ sectionSizeMm: Math.max(1, Math.min(500, size)) }),
  setJoint: (id) => set({ jointId: getJoint(id).id }),
  setThroughIndex: (index) => set({ throughIndex: index === 1 ? 1 : 0 }),

  getExpressPayload: () => {
    const s = get();
    return {
      templateId: s.templateId,
      paramsByTemplate: JSON.parse(JSON.stringify(s.paramsByTemplate)),
      stockMode: s.stockMode,
      buyLength: s.buyLength,
      inventory: s.inventory.map((b) => ({ ...b })),
      kerf: s.kerf,
      profileName: s.profileName,
      sectionSizeMm: s.sectionSizeMm,
      jointId: s.jointId,
      throughIndex: s.throughIndex,
    };
  },

  hydrateFromPayload: (payload) => {
    const params = allDefaultParams();
    if (payload.paramsByTemplate) {
      for (const t of TEMPLATES) {
        params[t.id] = { ...params[t.id], ...(payload.paramsByTemplate[t.id] ?? {}) };
      }
    }
    set({
      templateId: TEMPLATES.some((t) => t.id === payload.templateId)
        ? payload.templateId
        : TEMPLATES[0].id,
      paramsByTemplate: params,
      stockMode: payload.stockMode === 'inventory' ? 'inventory' : 'buy',
      buyLength: payload.buyLength ?? 6000,
      inventory:
        payload.inventory?.length > 0
          ? payload.inventory.map((b) => ({ ...b }))
          : [{ id: uuid(), length: 6000, quantity: 4 }],
      kerf: payload.kerf ?? 3,
      profileName: payload.profileName ?? '40×40',
      sectionSizeMm: payload.sectionSizeMm ?? 40,
      jointId: payload.jointId ? getJoint(payload.jointId).id : DEFAULT_JOINT_ID,
      throughIndex: payload.throughIndex === 1 ? 1 : 0,
    });
  },
}));

useExpressStore.subscribe((s) => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        templateId: s.templateId,
        paramsByTemplate: s.paramsByTemplate,
        stockMode: s.stockMode,
        buyLength: s.buyLength,
        inventory: s.inventory,
        kerf: s.kerf,
        profileName: s.profileName,
        sectionSizeMm: s.sectionSizeMm,
        jointId: s.jointId,
        throughIndex: s.throughIndex,
      }),
    );
  } catch {
    // localStorage unavailable (private mode) — state simply won't persist.
  }
});
