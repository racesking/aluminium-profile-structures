import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useStructureStore } from '../store/structureStore';
import { useSettingsStore } from '../store/settingsStore';
import { openProjectAndRoute, saveStructureProject } from '../store/projectIO';
import { bomToPrintHtml, structureToExportInput } from '../core/bomExport';
import { WORK_PLANE_LABELS } from '../core/workPlane';
import type { WorkPlane } from '../core/types';
import { BoxFrameDialog } from './BoxFrameDialog';

const PLANES: WorkPlane[] = ['xz', 'xy', 'yz', 'free'];

export function Toolbar() {
  const toolMode = useStructureStore((s) => s.toolMode);
  const gridCellSize = useStructureStore((s) => s.gridCellSize);
  const snapToGrid = useStructureStore((s) => s.snapToGrid);
  const viewPreset = useStructureStore((s) => s.viewPreset);
  const workPlane = useStructureStore((s) => s.workPlane);
  const canUndo = useStructureStore((s) => s.canUndo);
  const canRedo = useStructureStore((s) => s.canRedo);
  const setToolMode = useStructureStore((s) => s.setToolMode);
  const setGridCellSize = useStructureStore((s) => s.setGridCellSize);
  const setSnapToGrid = useStructureStore((s) => s.setSnapToGrid);
  const setViewPreset = useStructureStore((s) => s.setViewPreset);
  const setWorkPlane = useStructureStore((s) => s.setWorkPlane);
  const undo = useStructureStore((s) => s.undo);
  const redo = useStructureStore((s) => s.redo);
  const loadBoxFrame = useStructureStore((s) => s.loadBoxFrame);
  const exportCutList = useStructureStore((s) => s.exportCutList);
  const edgeCount = useStructureStore((s) => s.edges.length);

  const setView = useAppStore((s) => s.setView);
  const units = useSettingsStore((s) => s.units);

  const [boxOpen, setBoxOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    setBusy(true);
    try {
      await saveStructureProject('structure');
    } finally {
      setBusy(false);
    }
  };

  const handleOpen = async () => {
    setBusy(true);
    try {
      const res = await openProjectAndRoute();
      if (res.status === 'error') alert(res.message);
    } finally {
      setBusy(false);
    }
  };

  const handleExport = () => {
    const text = exportCutList();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cut-list.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDrawing = () => {
    const { nodes, edges, profile, stock, kerf } = useStructureStore.getState();
    const input = structureToExportInput({
      nodes,
      edges,
      profile,
      stock,
      kerf,
      units,
      projectName: 'Structure',
      dateStr: new Date().toLocaleDateString(),
    });
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(bomToPrintHtml(input));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 200);
  };

  return (
    <>
      <header className="toolbar">
        <div className="toolbar-row">
          <button
            type="button"
            onClick={() => setView('wizard')}
            title="Back to start"
          >
            ‹ Start
          </button>
          <h1 className="toolbar-brand">Profile Builder</h1>

          <span className="toolbar-group-label">Tools</span>
          <div className="toolbar-group">
            <button
              type="button"
              className={toolMode === 'select' ? 'active' : ''}
              onClick={() => setToolMode('select')}
              title="Select (V)"
            >
              Select
            </button>
            <button
              type="button"
              className={toolMode === 'placeNode' ? 'active' : ''}
              onClick={() => setToolMode('placeNode')}
              title="Place node (N)"
            >
              Node
            </button>
            <button
              type="button"
              className={toolMode === 'connect' ? 'active' : ''}
              onClick={() => setToolMode('connect')}
              title="Connect (C)"
            >
              Connect
            </button>
          </div>

          <span className="toolbar-sep" />

          <span className="toolbar-group-label">Plane</span>
          <div className="toolbar-group">
            {PLANES.map((p) => (
              <button
                key={p}
                type="button"
                className={workPlane === p ? 'active' : ''}
                onClick={() => setWorkPlane(p)}
                title={WORK_PLANE_LABELS[p]}
              >
                {p === 'free' ? '3D' : p.toUpperCase()}
              </button>
            ))}
          </div>

          <span className="toolbar-sep" />

          <div className="toolbar-group">
            <button
              type="button"
              disabled={!canUndo}
              onClick={undo}
              title="Undo (Ctrl+Z)"
            >
              Undo
            </button>
            <button
              type="button"
              disabled={!canRedo}
              onClick={redo}
              title="Redo (Ctrl+Y)"
            >
              Redo
            </button>
          </div>

          <div className="toolbar-spacer" />

          <div className="toolbar-group">
            <button
              type="button"
              onClick={handleSave}
              disabled={busy}
              title="Save project to a file on your computer"
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleOpen}
              disabled={busy}
              title="Open a project file from your computer"
            >
              Open
            </button>
            <button
              type="button"
              onClick={handleExport}
              title="Export the cut list as text"
            >
              Export
            </button>
            <button
              type="button"
              onClick={handleDrawing}
              disabled={edgeCount === 0}
              title="Isometric technical drawing + parts list (Save as PDF)"
            >
              Drawing
            </button>
            <button type="button" onClick={() => setView('settings')} title="Settings">
              ⚙
            </button>
          </div>
        </div>

        <div className="toolbar-row secondary">
          <button type="button" onClick={() => setBoxOpen(true)}>
            Box frame
          </button>

          <span className="toolbar-sep" />

          <label className="toolbar-field">
            Grid mm
            <input
              type="number"
              min={0.1}
              max={10000}
              step={1}
              value={gridCellSize}
              onChange={(e) =>
                setGridCellSize(parseFloat(e.target.value) || 1)
              }
            />
          </label>
          <button
            type="button"
            className={snapToGrid ? 'active' : ''}
            onClick={() => setSnapToGrid(!snapToGrid)}
          >
            Snap
          </button>

          <span className="toolbar-sep" />

          <span className="toolbar-group-label">View</span>
          <div className="toolbar-group">
            {(['perspective', 'top', 'front', 'right'] as const).map((v) => (
              <button
                key={v}
                type="button"
                className={viewPreset === v ? 'active' : ''}
                onClick={() => setViewPreset(v)}
              >
                {v === 'perspective' ? 'Iso' : v}
              </button>
            ))}
          </div>
        </div>
      </header>
      <BoxFrameDialog
        open={boxOpen}
        onClose={() => setBoxOpen(false)}
        onApply={loadBoxFrame}
      />
    </>
  );
}
