import { useId } from 'react';
import { useStructureStore } from '../store/structureStore';
import { useSettingsStore } from '../store/settingsStore';
import { toDisplay, fromDisplay, unitInputStep } from '../core/units';
import type { Vec3 } from '../core/types';

/** Offset fields + duplicate action for the current member selection. */
export function DuplicatePanel() {
  const units = useSettingsStore((s) => s.units);
  const activeCount = useStructureStore(
    (s) => s.selectedEdgeIds.length || (s.selection?.type === 'edge' ? 1 : 0),
  );
  const duplicateOffset = useStructureStore((s) => s.duplicateOffset);
  const setDuplicateOffset = useStructureStore((s) => s.setDuplicateOffset);
  const duplicateSelection = useStructureStore((s) => s.duplicateSelection);
  const selectConnectedGroup = useStructureStore((s) => s.selectConnectedGroup);
  const ids = useId();

  if (activeCount === 0) return null;

  const axis = (i: 0 | 1 | 2, name: string) => (
    <div className="field">
      <label htmlFor={`${ids}-${name}`}>
        Δ{name} ({units})
      </label>
      <input
        id={`${ids}-${name}`}
        type="number"
        step={unitInputStep(units)}
        value={toDisplay(duplicateOffset[i], units)}
        onChange={(e) => {
          const next = [...duplicateOffset] as Vec3;
          next[i] = fromDisplay(parseFloat(e.target.value) || 0, units);
          setDuplicateOffset(next);
        }}
      />
    </div>
  );

  return (
    <div className="duplicate-panel" id="translate-panel">
      <div className="field-row">
        {axis(0, 'X')}
        {axis(1, 'Y')}
        {axis(2, 'Z')}
      </div>
      <button
        type="button"
        className="primary"
        style={{ width: '100%', marginTop: 4 }}
        onClick={duplicateSelection}
      >
        Duplicate selection by offset
      </button>
      <button
        type="button"
        className="link-btn"
        onClick={selectConnectedGroup}
        style={{ marginTop: 8 }}
      >
        Select connected group
      </button>
      <p className="hint hint-compact">
        Arrow keys move the selection; Ctrl+D duplicates it.
      </p>
    </div>
  );
}
