import { useEffect, useRef } from 'react';
import { useStructureStore } from '../store/structureStore';
import type { AxisLock, WorkPlane } from '../core/types';

export type ContextMenuState = {
  x: number;
  y: number;
} | null;

type Props = {
  menu: ContextMenuState;
  onClose: () => void;
  onTranslate: () => void;
  onMemberDimension: () => void;
  onHelp: () => void;
};

/** Ring radius of the marking menu, px. */
const RING_R = 84;

const AXES: Exclude<AxisLock, null>[] = ['x', 'y', 'z'];
const PLANES: { id: WorkPlane; label: string }[] = [
  { id: 'xz', label: 'XZ' },
  { id: 'xy', label: 'XY' },
  { id: 'yz', label: 'YZ' },
  { id: 'free', label: '3D' },
];

/**
 * Fusion-style marking menu: right-click opens a radial ring of quick actions
 * around the cursor with a linear list of tools below (axis lock, work plane,
 * and the deeper commands). Radial picks close the menu; the lock / plane
 * segments stay open so several can be set in one visit.
 */
export function ContextMenu({
  menu,
  onClose,
  onTranslate,
  onMemberDimension,
  onHelp,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const copySelection = useStructureStore((s) => s.copySelection);
  const pasteSelection = useStructureStore((s) => s.pasteSelection);
  const duplicateSelection = useStructureStore((s) => s.duplicateSelection);
  const deleteSelected = useStructureStore((s) => s.deleteSelected);
  const selectAllMembers = useStructureStore((s) => s.selectAllMembers);
  const undo = useStructureStore((s) => s.undo);
  const redo = useStructureStore((s) => s.redo);
  const canUndo = useStructureStore((s) => s.canUndo);
  const canRedo = useStructureStore((s) => s.canRedo);
  const clipboard = useStructureStore((s) => s.clipboard);
  const axisLock = useStructureStore((s) => s.axisLock);
  const setAxisLock = useStructureStore((s) => s.setAxisLock);
  const workPlane = useStructureStore((s) => s.workPlane);
  const setWorkPlane = useStructureStore((s) => s.setWorkPlane);
  const setViewPreset = useStructureStore((s) => s.setViewPreset);
  const optimize = useStructureStore((s) => s.optimize);
  const edgeCount = useStructureStore((s) => s.edges.length);
  const hasSelection = useStructureStore(
    (s) => s.selectedEdgeIds.length > 0 || s.selection !== null,
  );
  const hasEdgeSelection = useStructureStore(
    (s) => s.selectedEdgeIds.length > 0 || s.selection?.type === 'edge',
  );

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) onClose();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [menu, onClose]);

  if (!menu) return null;

  // Keep the ring and its list on screen.
  const cx = Math.min(Math.max(menu.x, RING_R + 50), window.innerWidth - RING_R - 50);
  const cy = Math.min(Math.max(menu.y, RING_R + 40), window.innerHeight - RING_R - 260);

  const run = (fn: () => void) => () => {
    fn();
    onClose();
  };

  // Eight radial slots, clockwise from the top.
  const ring: { label: string; disabled?: boolean; onPick: () => void }[] = [
    { label: 'Iso view', onPick: run(() => setViewPreset('perspective')) },
    { label: 'Paste', disabled: !clipboard?.edges.length, onPick: run(pasteSelection) },
    { label: 'Redo', disabled: !canRedo, onPick: run(redo) },
    { label: 'Select all', disabled: edgeCount === 0, onPick: run(selectAllMembers) },
    { label: 'Duplicate', disabled: !hasEdgeSelection, onPick: run(duplicateSelection) },
    { label: 'Delete', disabled: !hasSelection, onPick: run(deleteSelected) },
    { label: 'Undo', disabled: !canUndo, onPick: run(undo) },
    { label: 'Copy', disabled: !hasEdgeSelection, onPick: run(copySelection) },
  ];

  return (
    <div ref={ref} onContextMenu={(e) => e.preventDefault()}>
      <span className="marking-center" style={{ left: cx, top: cy }} />
      {ring.map((item, i) => {
        const angle = (-90 + i * 45) * (Math.PI / 180);
        const x = cx + RING_R * Math.cos(angle);
        const y = cy + RING_R * Math.sin(angle);
        return (
          <button
            key={item.label}
            type="button"
            className="marking-item"
            style={{ left: x, top: y }}
            disabled={item.disabled}
            onClick={item.onPick}
          >
            {item.label}
          </button>
        );
      })}

      <div
        className="marking-list"
        style={{ left: cx, top: cy + RING_R + 30 }}
      >
        <div className="marking-seg">
          <span className="marking-seg-label">Lock</span>
          {AXES.map((a) => (
            <button
              key={a}
              type="button"
              className={axisLock === a ? 'active' : ''}
              onClick={() => setAxisLock(axisLock === a ? null : a)}
              title={`Lock movement to the ${a.toUpperCase()} axis (Esc clears)`}
            >
              {a.toUpperCase()}
            </button>
          ))}
          <button
            type="button"
            className={axisLock === null ? 'active' : ''}
            onClick={() => setAxisLock(null)}
            title="No axis lock"
          >
            Off
          </button>
        </div>
        <div className="marking-seg">
          <span className="marking-seg-label">Plane</span>
          {PLANES.map((p) => (
            <button
              key={p.id}
              type="button"
              className={workPlane === p.id ? 'active' : ''}
              onClick={() => setWorkPlane(p.id)}
              title={`Work plane: ${p.label}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="context-menu-sep" />
        <button
          type="button"
          disabled={!hasEdgeSelection}
          onClick={run(onTranslate)}
        >
          Translate / duplicate…
        </button>
        <button
          type="button"
          disabled={!hasEdgeSelection}
          onClick={run(onMemberDimension)}
        >
          Member dimension…
        </button>
        <button
          type="button"
          disabled={edgeCount === 0}
          onClick={run(optimize)}
        >
          Optimize cuts
        </button>
        <div className="context-menu-sep" />
        <button type="button" onClick={run(onHelp)}>
          Help &amp; shortcuts
        </button>
      </div>
    </div>
  );
}
