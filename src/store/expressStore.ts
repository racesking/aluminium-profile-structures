import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { TEMPLATES, defaultParams, getTemplate } from '../core/templates';
import { DEFAULT_JOINT_ID, getJoint } from '../core/joints';
import {
  clampSection,
  defaultProfileStock,
  isProfileHexColor,
  makeProfile,
  type ProfileDef,
  type ProfileStock,
} from '../core/profiles';
import { isProfileShape } from '../core/profileShapes';
import type { ExpressPayload } from '../core/projectFile';
import { useSettingsStore } from './settingsStore';

const STORAGE_KEY = 'express-builder-state';

export type StockMode = 'buy' | 'inventory';

type ExpressState = {
  templateId: string;
  paramsByTemplate: Record<string, Record<string, number>>;
  kerf: number;
  jointId: string;
  /** Which continuity option (0 or 1) runs continuous through joints. */
  throughIndex: number;

  /* multi-profile */
  profiles: ProfileDef[];
  /** Per-template role → profile id. Unmapped roles use the first profile. */
  roleProfileByTemplate: Record<string, Record<string, string>>;
  stockMode: StockMode;
  stockByProfile: Record<string, ProfileStock>;

  setTemplate: (id: string) => void;
  setParam: (key: string, value: number) => void;
  resetParams: () => void;
  setKerf: (kerf: number) => void;
  setJoint: (id: string) => void;
  setThroughIndex: (index: number) => void;

  addProfile: () => void;
  removeProfile: (id: string) => void;
  updateProfile: (id: string, patch: { name?: string; sectionMm?: number }) => void;
  setRoleProfile: (role: string, profileId: string) => void;

  setStockMode: (mode: StockMode) => void;
  setProfileBuyLength: (profileId: string, length: number) => void;
  addInventoryRow: (profileId: string) => void;
  updateInventory: (profileId: string, rowId: string, length: number, quantity: number) => void;
  removeInventory: (profileId: string, rowId: string) => void;

  getExpressPayload: () => ExpressPayload;
  hydrateFromPayload: (payload: ExpressPayload) => void;
};

function allDefaultParams(): Record<string, Record<string, number>> {
  const all: Record<string, Record<string, number>> = {};
  for (const t of TEMPLATES) all[t.id] = defaultParams(t);
  return all;
}

function mergeParams(
  saved: Record<string, Record<string, number>> | undefined,
): Record<string, Record<string, number>> {
  const params = allDefaultParams();
  if (saved) {
    for (const t of TEMPLATES) params[t.id] = { ...params[t.id], ...(saved[t.id] ?? {}) };
  }
  return params;
}

type MultiProfileShape = {
  profiles: ProfileDef[];
  roleProfileByTemplate: Record<string, Record<string, string>>;
  stockMode: StockMode;
  stockByProfile: Record<string, ProfileStock>;
};

function normalizeStock(s: Partial<ProfileStock> | undefined): ProfileStock {
  const fallback = defaultProfileStock();
  return {
    buyLength:
      typeof s?.buyLength === 'number' ? Math.max(100, Math.min(20000, s.buyLength)) : fallback.buyLength,
    inventory:
      Array.isArray(s?.inventory) && s.inventory.length > 0
        ? s.inventory.map((b) => ({
            id: b.id ?? uuid(),
            length: Math.max(1, b.length),
            quantity: Math.max(0, b.quantity),
          }))
        : fallback.inventory,
  };
}

/** Build the multi-profile slice from either a v2 payload or a legacy v1 one. */
function migrateProfiles(data: Partial<ExpressPayload>): MultiProfileShape {
  const stockMode: StockMode = data.stockMode === 'inventory' ? 'inventory' : 'buy';

  if (Array.isArray(data.profiles) && data.profiles.length > 0) {
    const profiles = data.profiles.map((p) => ({
      id: p.id ?? uuid(),
      name: typeof p.name === 'string' ? p.name : '40×40',
      sectionMm: clampSection(typeof p.sectionMm === 'number' ? p.sectionMm : 40),
      shape: isProfileShape(p.shape) ? p.shape : ('square' as const),
      color: isProfileHexColor(p.color) ? p.color : undefined,
    }));
    const stockByProfile: Record<string, ProfileStock> = {};
    for (const p of profiles) {
      stockByProfile[p.id] = normalizeStock(data.stockByProfile?.[p.id]);
    }
    return {
      profiles,
      roleProfileByTemplate: data.roleProfileByTemplate ?? {},
      stockMode,
      stockByProfile,
    };
  }

  // Legacy single-profile project.
  const profile = makeProfile(data.profileName ?? '40×40', data.sectionSizeMm ?? 40);
  return {
    profiles: [profile],
    roleProfileByTemplate: {},
    stockMode,
    stockByProfile: {
      [profile.id]: normalizeStock({
        buyLength: data.buyLength,
        inventory: data.inventory,
      }),
    },
  };
}

function defaultProfiles(): MultiProfileShape {
  const profile = makeProfile('40×40', 40);
  return {
    profiles: [profile],
    roleProfileByTemplate: {},
    stockMode: 'buy',
    stockByProfile: { [profile.id]: defaultProfileStock() },
  };
}

function loadSaved(): Partial<ExpressState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return {
      templateId: TEMPLATES.some((t) => t.id === data.templateId) ? data.templateId : undefined,
      paramsByTemplate: mergeParams(data.paramsByTemplate),
      kerf: typeof data.kerf === 'number' ? data.kerf : undefined,
      jointId: typeof data.jointId === 'string' ? data.jointId : undefined,
      throughIndex: data.throughIndex === 0 || data.throughIndex === 1 ? data.throughIndex : undefined,
      ...migrateProfiles(data),
    };
  } catch {
    return {};
  }
}

const saved = loadSaved();
const initialProfiles = saved.profiles ? (saved as MultiProfileShape) : defaultProfiles();

export const useExpressStore = create<ExpressState>((set, get) => ({
  templateId: saved.templateId ?? TEMPLATES[0].id,
  paramsByTemplate: saved.paramsByTemplate ?? allDefaultParams(),
  kerf: saved.kerf ?? 3,
  jointId: saved.jointId ?? DEFAULT_JOINT_ID,
  throughIndex: saved.throughIndex ?? 0,
  profiles: initialProfiles.profiles,
  roleProfileByTemplate: initialProfiles.roleProfileByTemplate,
  stockMode: initialProfiles.stockMode,
  stockByProfile: initialProfiles.stockByProfile,

  setTemplate: (id) => set({ templateId: id }),
  setParam: (key, value) =>
    set((s) => ({
      paramsByTemplate: {
        ...s.paramsByTemplate,
        [s.templateId]: { ...s.paramsByTemplate[s.templateId], [key]: value },
      },
    })),
  resetParams: () =>
    set((s) => ({
      paramsByTemplate: {
        ...s.paramsByTemplate,
        [s.templateId]: defaultParams(getTemplate(s.templateId)),
      },
    })),
  setKerf: (kerf) => set({ kerf: Math.max(0, kerf) }),
  setJoint: (id) => set({ jointId: getJoint(id).id }),
  setThroughIndex: (index) => set({ throughIndex: index === 1 ? 1 : 0 }),

  addProfile: () =>
    set((s) => {
      const n = s.profiles.length + 1;
      const { defaultSectionMm, defaultBarLength } = useSettingsStore.getState();
      const profile = makeProfile(`Profile ${n}`, defaultSectionMm);
      const stock = defaultProfileStock();
      stock.buyLength = defaultBarLength;
      stock.inventory = stock.inventory.map((b) => ({ ...b, length: defaultBarLength }));
      return {
        profiles: [...s.profiles, profile],
        stockByProfile: { ...s.stockByProfile, [profile.id]: stock },
      };
    }),
  removeProfile: (id) =>
    set((s) => {
      if (s.profiles.length <= 1) return s;
      const profiles = s.profiles.filter((p) => p.id !== id);
      const stockByProfile = { ...s.stockByProfile };
      delete stockByProfile[id];
      // Drop role assignments that pointed at the removed profile.
      const roleProfileByTemplate: Record<string, Record<string, string>> = {};
      for (const [tid, map] of Object.entries(s.roleProfileByTemplate)) {
        const next: Record<string, string> = {};
        for (const [role, pid] of Object.entries(map)) {
          if (pid !== id) next[role] = pid;
        }
        roleProfileByTemplate[tid] = next;
      }
      return { profiles, stockByProfile, roleProfileByTemplate };
    }),
  updateProfile: (id, patch) =>
    set((s) => ({
      profiles: s.profiles.map((p) =>
        p.id === id
          ? {
              ...p,
              name: patch.name ?? p.name,
              sectionMm: patch.sectionMm !== undefined ? clampSection(patch.sectionMm) : p.sectionMm,
            }
          : p,
      ),
    })),
  setRoleProfile: (role, profileId) =>
    set((s) => ({
      roleProfileByTemplate: {
        ...s.roleProfileByTemplate,
        [s.templateId]: { ...(s.roleProfileByTemplate[s.templateId] ?? {}), [role]: profileId },
      },
    })),

  setStockMode: (mode) => set({ stockMode: mode }),
  setProfileBuyLength: (profileId, length) =>
    set((s) => ({
      stockByProfile: {
        ...s.stockByProfile,
        [profileId]: {
          ...s.stockByProfile[profileId],
          buyLength: Math.max(100, Math.min(20000, length)),
        },
      },
    })),
  addInventoryRow: (profileId) =>
    set((s) => ({
      stockByProfile: {
        ...s.stockByProfile,
        [profileId]: {
          ...s.stockByProfile[profileId],
          inventory: [
            ...s.stockByProfile[profileId].inventory,
            { id: uuid(), length: 6000, quantity: 1 },
          ],
        },
      },
    })),
  updateInventory: (profileId, rowId, length, quantity) =>
    set((s) => ({
      stockByProfile: {
        ...s.stockByProfile,
        [profileId]: {
          ...s.stockByProfile[profileId],
          inventory: s.stockByProfile[profileId].inventory.map((b) =>
            b.id === rowId
              ? { ...b, length: Math.max(1, length), quantity: Math.max(0, quantity) }
              : b,
          ),
        },
      },
    })),
  removeInventory: (profileId, rowId) =>
    set((s) => ({
      stockByProfile: {
        ...s.stockByProfile,
        [profileId]: {
          ...s.stockByProfile[profileId],
          inventory: s.stockByProfile[profileId].inventory.filter((b) => b.id !== rowId),
        },
      },
    })),

  getExpressPayload: () => {
    const s = get();
    return {
      templateId: s.templateId,
      paramsByTemplate: JSON.parse(JSON.stringify(s.paramsByTemplate)),
      kerf: s.kerf,
      jointId: s.jointId,
      throughIndex: s.throughIndex,
      stockMode: s.stockMode,
      profiles: s.profiles.map((p) => ({ ...p })),
      roleProfileByTemplate: JSON.parse(JSON.stringify(s.roleProfileByTemplate)),
      stockByProfile: JSON.parse(JSON.stringify(s.stockByProfile)),
    };
  },

  hydrateFromPayload: (payload) => {
    set({
      templateId: TEMPLATES.some((t) => t.id === payload.templateId)
        ? payload.templateId
        : TEMPLATES[0].id,
      paramsByTemplate: mergeParams(payload.paramsByTemplate),
      kerf: payload.kerf ?? 3,
      jointId: payload.jointId ? getJoint(payload.jointId).id : DEFAULT_JOINT_ID,
      throughIndex: payload.throughIndex === 1 ? 1 : 0,
      ...migrateProfiles(payload),
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
        kerf: s.kerf,
        jointId: s.jointId,
        throughIndex: s.throughIndex,
        stockMode: s.stockMode,
        profiles: s.profiles,
        roleProfileByTemplate: s.roleProfileByTemplate,
        stockByProfile: s.stockByProfile,
      } satisfies Partial<ExpressPayload>),
    );
  } catch {
    // localStorage unavailable (private mode) — state simply won't persist.
  }
});
