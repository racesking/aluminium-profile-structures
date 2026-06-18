import { useStructureStore } from '../store/structureStore';
import { useSettingsStore } from '../store/settingsStore';
import { toDisplay, fromDisplay, unitInputStep } from '../core/units';

export function DuplicatePanel() {
  const units = useSettingsStore((s) => s.units);
  const activeCount = useStructureStore(
    (s) =>
      s.selectedEdgeIds.length ||
      (s.selection?.type === 'edge' ? 1 : 0),
  );
  const duplicateOffset = useStructureStore((s) => s.duplicateOffset);
  const setDuplicateOffset = useStructureStore((s) => s.setDuplicateOffset);
  const duplicateSelection = useStructureStore((s) => s.duplicateSelection);
  const selectConnectedGroup = useStructureStore((s) => s.selectConnectedGroup);

  if (activeCount === 0) return null;

  return (
    <div className="duplicate-panel" id="translate-panel">
      <p className="section-title">Translate / duplicate</p>
      <button
        type="button"
        className="link-btn"
        onClick={selectConnectedGroup}
        style={{ marginBottom: 10 }}
      >
        Select connected group
      </button>
      <div className="field-row">
        <div className="field">
          <label>ΔX ({units})</label>
          <input
            type="number"
            step={unitInputStep(units)}
            value={toDisplay(duplicateOffset[0], units)}
            onChange={(e) =>
              setDuplicateOffset([
                fromDisplay(parseFloat(e.target.value) || 0, units),
                duplicateOffset[1],
                duplicateOffset[2],
              ])
            }
          />
        </div>
        <div className="field">
          <label>ΔY ({units})</label>
          <input
            type="number"
            step={unitInputStep(units)}
            value={toDisplay(duplicateOffset[1], units)}
            onChange={(e) =>
              setDuplicateOffset([
                duplicateOffset[0],
                fromDisplay(parseFloat(e.target.value) || 0, units),
                duplicateOffset[2],
              ])
            }
          />
        </div>
        <div className="field">
          <label>ΔZ ({units})</label>
          <input
            type="number"
            step={unitInputStep(units)}
            value={toDisplay(duplicateOffset[2], units)}
            onChange={(e) =>
              setDuplicateOffset([
                duplicateOffset[0],
                duplicateOffset[1],
                fromDisplay(parseFloat(e.target.value) || 0, units),
              ])
            }
          />
        </div>
      </div>
      <button
        type="button"
        className="primary"
        style={{ width: '100%', marginTop: 4 }}
        onClick={duplicateSelection}
      >
        Duplicate selection
      </button>
      <p className="hint hint-compact">
        Arrow keys move selection. Ctrl+D duplicates.
      </p>
    </div>
  );
}
