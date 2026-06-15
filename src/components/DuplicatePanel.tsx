import { useStructureStore } from '../store/structureStore';

export function DuplicatePanel() {
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
          <label>ΔX</label>
          <input
            type="number"
            step={1}
            value={duplicateOffset[0]}
            onChange={(e) =>
              setDuplicateOffset([
                parseFloat(e.target.value) || 0,
                duplicateOffset[1],
                duplicateOffset[2],
              ])
            }
          />
        </div>
        <div className="field">
          <label>ΔY</label>
          <input
            type="number"
            step={1}
            value={duplicateOffset[1]}
            onChange={(e) =>
              setDuplicateOffset([
                duplicateOffset[0],
                parseFloat(e.target.value) || 0,
                duplicateOffset[2],
              ])
            }
          />
        </div>
        <div className="field">
          <label>ΔZ</label>
          <input
            type="number"
            step={1}
            value={duplicateOffset[2]}
            onChange={(e) =>
              setDuplicateOffset([
                duplicateOffset[0],
                duplicateOffset[1],
                parseFloat(e.target.value) || 0,
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
