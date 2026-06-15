import { create } from 'zustand';

export type AppView = 'wizard' | 'advanced' | 'express';

function viewFromHash(): AppView {
  const h = window.location.hash.replace('#', '');
  if (h === 'advanced' || h === 'express') return h;
  return 'wizard';
}

type AppState = {
  view: AppView;
  setView: (view: AppView) => void;
};

export const useAppStore = create<AppState>((set) => ({
  view: viewFromHash(),
  setView: (view) => {
    const hash = view === 'wizard' ? '' : `#${view}`;
    if (window.location.hash !== hash) {
      // Keeps browser back/forward working between builder views.
      window.history.pushState(null, '', `${window.location.pathname}${hash}`);
    }
    set({ view });
  },
}));

window.addEventListener('hashchange', () => {
  useAppStore.setState({ view: viewFromHash() });
});
window.addEventListener('popstate', () => {
  useAppStore.setState({ view: viewFromHash() });
});
