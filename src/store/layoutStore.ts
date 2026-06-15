import { create } from 'zustand';

const STORAGE_KEY = 'profile-builder-layout';
const MIN_WIDTH = 180;
const MAX_WIDTH = 620;

function clampWidth(w: number): number {
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(w)));
}

type Saved = { leftWidth?: number; rightWidth?: number };

function loadSaved(): Saved {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : {};
  } catch {
    return {};
  }
}

const saved = loadSaved();

type LayoutState = {
  leftWidth: number;
  rightWidth: number;
  setLeftWidth: (w: number) => void;
  setRightWidth: (w: number) => void;
};

export const useLayoutStore = create<LayoutState>((set) => ({
  leftWidth: clampWidth(saved.leftWidth ?? 260),
  rightWidth: clampWidth(saved.rightWidth ?? 360),
  setLeftWidth: (w) => set({ leftWidth: clampWidth(w) }),
  setRightWidth: (w) => set({ rightWidth: clampWidth(w) }),
}));

useLayoutStore.subscribe((s) => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ leftWidth: s.leftWidth, rightWidth: s.rightWidth }),
    );
  } catch {
    // localStorage unavailable — widths simply won't persist.
  }
});
