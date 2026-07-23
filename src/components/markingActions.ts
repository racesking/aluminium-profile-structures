import { useStructureStore } from '../store/structureStore';

export type RingAction = {
  label: string;
  disabled: boolean;
  run: () => void;
};

/**
 * The eight radial quick actions of the marking menu, clockwise from the top
 * (N, NE, E, …, NW). Shared by the menu (click) and the viewport flick
 * gesture, so a flick in a direction always matches the item rendered there.
 */
export function useRingActions(): RingAction[] {
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
  const setViewPreset = useStructureStore((s) => s.setViewPreset);
  const edgeCount = useStructureStore((s) => s.edges.length);
  const hasSelection = useStructureStore(
    (s) => s.selectedEdgeIds.length > 0 || s.selection !== null,
  );
  const hasEdgeSelection = useStructureStore(
    (s) => s.selectedEdgeIds.length > 0 || s.selection?.type === 'edge',
  );

  return [
    { label: 'Iso view', disabled: false, run: () => setViewPreset('perspective') },
    { label: 'Paste', disabled: !clipboard?.edges.length, run: pasteSelection },
    { label: 'Redo', disabled: !canRedo, run: redo },
    { label: 'Select all', disabled: edgeCount === 0, run: selectAllMembers },
    { label: 'Duplicate', disabled: !hasEdgeSelection, run: duplicateSelection },
    { label: 'Delete', disabled: !hasSelection, run: deleteSelected },
    { label: 'Undo', disabled: !canUndo, run: undo },
    { label: 'Copy', disabled: !hasEdgeSelection, run: copySelection },
  ];
}

/** The marking-menu sector index (0 = N, clockwise) for a drag vector. */
export function flickSector(dx: number, dy: number): number {
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  return Math.round(((deg + 90 + 360) % 360) / 45) % 8;
}
