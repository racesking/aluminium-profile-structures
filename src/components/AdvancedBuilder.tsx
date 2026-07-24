import { useEffect, useCallback, type CSSProperties } from 'react';
import { Toolbar } from './Toolbar';
import { Sidebar } from './Sidebar';
import { Viewport } from './Viewport';
import { StockPanel } from './StockPanel';
import { PanelResizer } from './PanelResizer';
import { useLayoutStore } from '../store/layoutStore';
import { useStructureStore } from '../store/structureStore';
import { restoreLastStructureProject, startAutosave } from '../store/autosave';

function KeyboardShortcuts() {
  const setToolMode = useStructureStore((s) => s.setToolMode);
  const deleteSelected = useStructureStore((s) => s.deleteSelected);
  const cancelConnect = useStructureStore((s) => s.cancelConnect);
  const undo = useStructureStore((s) => s.undo);
  const redo = useStructureStore((s) => s.redo);
  const setAxisLock = useStructureStore((s) => s.setAxisLock);
  const duplicateSelection = useStructureStore((s) => s.duplicateSelection);
  const translateSelection = useStructureStore((s) => s.translateSelection);
  const copySelection = useStructureStore((s) => s.copySelection);
  const pasteSelection = useStructureStore((s) => s.pasteSelection);
  const gridCellSize = useStructureStore((s) => s.gridCellSize);
  const snap = useStructureStore((s) => s.snap);

  const nudgeStep = useCallback(
    (mult: number) => Math.max(gridCellSize, snap) * mult,
    [gridCellSize, snap],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      // While a modal (Drawing/History/Box frame/Member dimension/Help) or
      // the marking menu is open, editing hotkeys must not reach the scene —
      // Delete/arrows/Ctrl+Z were mutating the structure invisibly behind
      // the overlay. Escape stays with the overlay's own close handler.
      if (document.querySelector('.modal-overlay, .marking-list')) {
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
          return;
        }
        if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          redo();
          return;
        }
        if (e.key.toLowerCase() === 'd') {
          e.preventDefault();
          duplicateSelection();
          return;
        }
        if (e.key.toLowerCase() === 'c') {
          e.preventDefault();
          copySelection();
          return;
        }
        if (e.key.toLowerCase() === 'v') {
          e.preventDefault();
          pasteSelection();
          return;
        }
      }

      const step = nudgeStep(e.shiftKey ? 10 : 1);
      const hasSelection =
        useStructureStore.getState().getActiveEdgeIds().length > 0;

      if (hasSelection && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const d: [number, number, number] = [0, 0, 0];
        if (e.key === 'ArrowRight') d[0] = step;
        if (e.key === 'ArrowLeft') d[0] = -step;
        if (e.key === 'ArrowUp') d[2] = step;
        if (e.key === 'ArrowDown') d[2] = -step;
        translateSelection(d);
        return;
      }
      if (hasSelection && e.key === 'PageUp') {
        e.preventDefault();
        translateSelection([0, step, 0]);
        return;
      }
      if (hasSelection && e.key === 'PageDown') {
        e.preventDefault();
        translateSelection([0, -step, 0]);
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'v':
          if (!e.ctrlKey && !e.metaKey) setToolMode('select');
          break;
        case 'b':
          if (!e.ctrlKey && !e.metaKey) setToolMode('box');
          break;
        case 'n':
          setToolMode('placeNode');
          break;
        case 'c':
          if (!e.ctrlKey && !e.metaKey) setToolMode('connect');
          break;
        case 'x':
          setAxisLock('x');
          break;
        case 'y':
          setAxisLock('y');
          break;
        case 'z':
          if (!e.ctrlKey && !e.metaKey) setAxisLock('z');
          break;
        case 'delete':
        case 'backspace':
          e.preventDefault();
          deleteSelected();
          break;
        case 'escape':
          cancelConnect();
          setAxisLock(null);
          break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (['x', 'y', 'z'].includes(e.key.toLowerCase())) {
        setAxisLock(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
    setToolMode,
    deleteSelected,
    cancelConnect,
    undo,
    redo,
    setAxisLock,
    duplicateSelection,
    translateSelection,
    copySelection,
    pasteSelection,
    nudgeStep,
  ]);

  return null;
}

export function AdvancedBuilder() {
  const leftWidth = useLayoutStore((s) => s.leftWidth);
  const rightWidth = useLayoutStore((s) => s.rightWidth);

  // Autosave + reload continuity: reopen the last project when mounting empty.
  useEffect(() => {
    startAutosave();
    void restoreLastStructureProject();
  }, []);

  const focusTranslate = () => {
    document
      .getElementById('translate-panel')
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  return (
    <div
      className="app"
      style={
        {
          '--panel-w': `${leftWidth}px`,
          '--panel-w-right': `${rightWidth}px`,
        } as CSSProperties
      }
    >
      <Toolbar />
      <div className="main">
        <div className="main-layout-anchor" aria-hidden />
        <Sidebar />
        <Viewport onFocusTranslate={focusTranslate} />
        <StockPanel />
        <PanelResizer side="left" />
        <PanelResizer side="right" />
      </div>
      <KeyboardShortcuts />
    </div>
  );
}
