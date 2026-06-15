import { create } from 'zustand';
import type { LengthUnit } from '../core/units';
import { LENGTH_UNITS } from '../core/units';

const STORAGE_KEY = 'profile-builder-settings';

type SettingsState = {
  /** Display unit for all lengths (model stays in mm). */
  units: LengthUnit;
  /** Defaults seeded into new profiles / projects (stored in mm). */
  defaultKerf: number;
  defaultBarLength: number;
  defaultSectionMm: number;

  setUnits: (units: LengthUnit) => void;
  setDefaultKerf: (mm: number) => void;
  setDefaultBarLength: (mm: number) => void;
  setDefaultSectionMm: (mm: number) => void;
};

type Saved = Partial<Pick<SettingsState, 'units' | 'defaultKerf' | 'defaultBarLength' | 'defaultSectionMm'>>;

function loadSaved(): Saved {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as Saved;
    return {
      units: LENGTH_UNITS.includes(data.units as LengthUnit) ? data.units : undefined,
      defaultKerf: typeof data.defaultKerf === 'number' ? data.defaultKerf : undefined,
      defaultBarLength: typeof data.defaultBarLength === 'number' ? data.defaultBarLength : undefined,
      defaultSectionMm: typeof data.defaultSectionMm === 'number' ? data.defaultSectionMm : undefined,
    };
  } catch {
    return {};
  }
}

const saved = loadSaved();

export const useSettingsStore = create<SettingsState>((set) => ({
  units: saved.units ?? 'mm',
  defaultKerf: saved.defaultKerf ?? 3,
  defaultBarLength: saved.defaultBarLength ?? 6000,
  defaultSectionMm: saved.defaultSectionMm ?? 40,

  setUnits: (units) => set({ units }),
  setDefaultKerf: (mm) => set({ defaultKerf: Math.max(0, mm) }),
  setDefaultBarLength: (mm) => set({ defaultBarLength: Math.max(100, Math.min(20000, mm)) }),
  setDefaultSectionMm: (mm) => set({ defaultSectionMm: Math.max(1, Math.min(500, mm)) }),
}));

useSettingsStore.subscribe((s) => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        units: s.units,
        defaultKerf: s.defaultKerf,
        defaultBarLength: s.defaultBarLength,
        defaultSectionMm: s.defaultSectionMm,
      }),
    );
  } catch {
    // localStorage unavailable — settings won't persist.
  }
});
