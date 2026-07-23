import { useEffect, useRef } from 'react';
import { useStructureStore } from '../store/structureStore';
import { getActiveEdgeIds } from '../core/selection';
import { useRingActions } from './markingActions';
import type { WorkPlane } from '../core/types';

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
const RING_R = 62;

const PLANES: { id: WorkPlane; label: string }[] = [
  { id: 'xz', label: 'XZ' },
  { id: 'xy', label: 'XY' },
  { id: 'yz', label: 'YZ' },
  { id: 'free', label: '3D' },
];

/**
 * Fusion-style marking menu: a radial ring of quick actions around the cursor
 * with a linear list below (part lock, work plane, deeper commands). Radial
 * picks close the menu; the segments stay open so several can be set at once.
 */
export function ContextMenu({
  menu,
  onClose,
  onTranslate,
  onMemberDimension,
  onHelp,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const ring = useRingActions();

  const workPlane = useStructureStore((s) => s.workPlane);
  const setWorkPlane = useStructureStore((s) => s.setWorkPlane);
  const optimize = useStructureStore((s) => s.optimize);
  const toggleLockSelection = useStructureStore((s) => s.toggleLockSelection);
  const edgeCount = useStructureStore((s) => s.edges.length);
  const selection = useStructureStore((s) => s.selection);
  const selectedEdgeIds = useStructureStore((s) => s.selectedEdgeIds);
  const lockedEdgeIds = useStructureStore((s) => s.lockedEdgeIds);

  const hasEdgeSelection =
    selectedEdgeIds.length > 0 || selection?.type === 'edge';
  const activeIds = getActiveEdgeIds(selection, selectedEdgeIds);
  const anyUnlocked = activeIds.some((id) => !lockedEdgeIds.includes(id));

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
  const cx = Math.min(Math.max(menu.x, RING_R + 44), window.innerWidth - RING_R - 44);
  const cy = Math.min(Math.max(menu.y, RING_R + 36), window.innerHeight - RING_R - 220);

  const run = (fn: () => void) => () => {
    fn();
    onClose();
  };

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
            onClick={run(item.run)}
          >
            {item.label}
          </button>
        );
      })}

      <div className="marking-list" style={{ left: cx, top: cy + RING_R + 24 }}>
        <button
          type="button"
          disabled={!hasEdgeSelection}
          onClick={run(toggleLockSelection)}
          title="Locked parts cannot be moved, re-dimensioned or deleted"
        >
          {anyUnlocked || !hasEdgeSelection ? '🔒 Lock part' : '🔓 Unlock part'}
        </button>
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
        <button type="button" disabled={edgeCount === 0} onClick={run(optimize)}>
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
