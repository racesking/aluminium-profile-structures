import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAppStore } from '../store/appStore';
import { useStructureStore } from '../store/structureStore';
import { useSettingsStore } from '../store/settingsStore';
import { toDisplay, fromDisplay, unitInputStep } from '../core/units';
import { openProjectAndRoute, saveStructureProject } from '../store/projectIO';
import { bomToPrintHtml, structureToExportInput } from '../core/bomExport';
import { WORK_PLANE_LABELS } from '../core/workPlane';
import type { ToolMode, ViewPreset, WorkPlane } from '../core/types';
import { BoxFrameDialog } from './BoxFrameDialog';
import { HistoryPanel } from './HistoryPanel';
import { DrawingModal } from './DrawingModal';

const PLANES: WorkPlane[] = ['xz', 'xy', 'yz', 'free'];
const PLANE_SHORT: Record<WorkPlane, string> = {
  xz: 'XZ',
  xy: 'XY',
  yz: 'YZ',
  free: '3D',
};

const VIEWS: ViewPreset[] = ['perspective', 'top', 'front', 'right'];
const VIEW_SHORT: Record<ViewPreset, string> = {
  perspective: 'Iso',
  top: 'Top',
  front: 'Front',
  right: 'Right',
};

const TOOLS: { mode: ToolMode; label: string; title: string }[] = [
  { mode: 'select', label: 'Select', title: 'Select (V)' },
  { mode: 'box', label: 'Box', title: 'Box select — drag a rectangle (B)' },
  { mode: 'placeNode', label: 'Node', title: 'Place node (N)' },
  { mode: 'connect', label: 'Connect', title: 'Connect (C)' },
];

type MenuItem = {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

/** Compact dropdown for the toolbar; closes on outside click or Escape. */
function ToolbarMenu({
  label,
  title,
  items,
}: {
  label: ReactNode;
  title?: string;
  items: MenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="toolbar-menu" ref={rootRef}>
      <button
        type="button"
        className={open ? 'active' : ''}
        onClick={() => setOpen((v) => !v)}
        title={title}
      >
        {label}
        <span className="menu-caret">▾</span>
      </button>
      {open && (
        <div className="toolbar-menu-list" role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={item.active ? 'active' : ''}
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
  const projectName = useStructureStore((s) => s.projectName);
  const setProjectName = useStructureStore((s) => s.setProjectName);

  const setView = useAppStore((s) => s.setView);
  const units = useSettingsStore((s) => s.units);

  const [boxOpen, setBoxOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [drawingHtml, setDrawingHtml] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    setBusy(true);
    try {
      await saveStructureProject(projectName);
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
    const state = useStructureStore.getState();
    const { nodes, edges, profiles, stockByProfile, kerf } = state;
    const input = structureToExportInput({
      nodes,
      edges,
      profiles,
      edgeProfileId: (id) => state.getEdgeProfileId(id),
      stockByProfile,
      kerf,
      units,
      projectName,
      dateStr: new Date().toLocaleDateString(),
    });
    setDrawingHtml(bomToPrintHtml(input));
  };

  return (
    <>
      <header className="toolbar">
        <div className="toolbar-row compact">
          <button
            type="button"
            onClick={() => setView('wizard')}
            title="Back to start"
          >
            ‹ Start
          </button>
          <h1 className="toolbar-brand">Profile Builder</h1>

          <div className="toolbar-group">
            {TOOLS.map((t) => (
              <button
                key={t.mode}
                type="button"
                className={toolMode === t.mode ? 'active' : ''}
                onClick={() => setToolMode(t.mode)}
                title={t.title}
              >
                {t.label}
              </button>
            ))}
          </div>

          <ToolbarMenu
            label={PLANE_SHORT[workPlane]}
            title="Work plane for node placement"
            items={PLANES.map((p) => ({
              label: WORK_PLANE_LABELS[p],
              active: workPlane === p,
              onSelect: () => setWorkPlane(p),
            }))}
          />

          <ToolbarMenu
            label={VIEW_SHORT[viewPreset]}
            title="Camera view preset"
            items={VIEWS.map((v) => ({
              label: VIEW_SHORT[v],
              active: viewPreset === v,
              onSelect: () => setViewPreset(v),
            }))}
          />

          <div className="toolbar-group">
            <button
              type="button"
              disabled={!canUndo}
              onClick={undo}
              title="Undo (Ctrl+Z)"
            >
              ↶
            </button>
            <button
              type="button"
              disabled={!canRedo}
              onClick={redo}
              title="Redo (Ctrl+Y)"
            >
              ↷
            </button>
          </div>

          <div className="toolbar-group">
            <button
              type="button"
              onClick={() => setBoxOpen(true)}
              title="Create a rectangular box frame"
            >
              + Box frame
            </button>
          </div>

          <label className="toolbar-field" title="Grid cell size">
            {units}
            <input
              type="number"
              min={0}
              max={10000}
              step={unitInputStep(units)}
              value={toDisplay(gridCellSize, units)}
              onChange={(e) =>
                setGridCellSize(
                  fromDisplay(parseFloat(e.target.value) || 0, units) || 1,
                )
              }
            />
          </label>
          <div className="toolbar-group">
            <button
              type="button"
              className={snapToGrid ? 'active' : ''}
              onClick={() => setSnapToGrid(!snapToGrid)}
              title="Snap to grid"
            >
              Snap
            </button>
          </div>

          <div className="toolbar-spacer" />

          <input
            className="toolbar-project-name"
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            title="Project name"
          />
          <div className="toolbar-group">
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              title="Version history — autosaves and checkpoints"
            >
              History
            </button>
            <button
              type="button"
              onClick={handleDrawing}
              disabled={edgeCount === 0}
              title="Technical drawing + parts list (print / save as PDF)"
            >
              Drawing
            </button>
          </div>

          <ToolbarMenu
            label="File"
            title="Project files, export and settings"
            items={[
              {
                label: 'Save project file…',
                disabled: busy,
                onSelect: () => void handleSave(),
              },
              {
                label: 'Open project file…',
                disabled: busy,
                onSelect: () => void handleOpen(),
              },
              {
                label: 'Export cut list (.txt)',
                disabled: edgeCount === 0,
                onSelect: handleExport,
              },
              { label: 'Settings', onSelect: () => setView('settings') },
            ]}
          />
        </div>
      </header>
      <BoxFrameDialog
        open={boxOpen}
        onClose={() => setBoxOpen(false)}
        onApply={loadBoxFrame}
      />
      <HistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        kind="structure"
      />
      <DrawingModal html={drawingHtml} onClose={() => setDrawingHtml(null)} />
    </>
  );
}
