import { useEffect, useRef } from 'react';
import { useStructureStore } from '../store/structureStore';

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
  const selectAllMembers = useStructureStore((s) => s.selectAllMembers);
  const clipboard = useStructureStore((s) => s.clipboard);
  const hasSelection = useStructureStore(
    (s) =>
      s.selectedEdgeIds.length > 0 || s.selection?.type === 'edge',
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

  return (
    <div
      ref={ref}
      className="context-menu"
      style={{ left: menu.x, top: menu.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button
        type="button"
        disabled={!hasSelection}
        onClick={() => {
          onTranslate();
          onClose();
        }}
      >
        Translate…
      </button>
      <button
        type="button"
        disabled={!hasSelection}
        onClick={() => {
          copySelection();
          onClose();
        }}
      >
        Copy
      </button>
      <button
        type="button"
        disabled={!clipboard?.edges.length}
        onClick={() => {
          pasteSelection();
          onClose();
        }}
      >
        Paste
      </button>
      <div className="context-menu-sep" />
      <button
        type="button"
        onClick={() => {
          selectAllMembers();
          onClose();
        }}
      >
        Select all members
      </button>
      <button
        type="button"
        disabled={!hasSelection}
        onClick={() => {
          onMemberDimension();
          onClose();
        }}
      >
        Member dimension…
      </button>
      <div className="context-menu-sep" />
      <button
        type="button"
        onClick={() => {
          onHelp();
          onClose();
        }}
      >
        Help
      </button>
    </div>
  );
}
