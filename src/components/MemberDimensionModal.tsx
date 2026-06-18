import { useStructureStore } from '../store/structureStore';
import { useSettingsStore } from '../store/settingsStore';
import { toDisplay, fromDisplay, unitInputStep } from '../core/units';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function MemberDimensionModal({ open, onClose }: Props) {
  const units = useSettingsStore((s) => s.units);
  const edgeId = useStructureStore((s) =>
    s.selection?.type === 'edge'
      ? s.selection.id
      : s.selectedEdgeIds[0] ?? null,
  );
  const edges = useStructureStore((s) => s.edges);
  const getEdgeLength = useStructureStore((s) => s.getEdgeLength);
  const setEdgeLengthById = useStructureStore((s) => s.setEdgeLengthById);

  if (!open) return null;
  const edge = edges.find((e) => e.id === edgeId);
  const len = edge ? getEdgeLength(edge.id) : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Member dimension</h2>
        {edge ? (
          <div className="field">
            <label>Length ({units})</label>
            <input
              type="number"
              min={0}
              step={unitInputStep(units)}
              autoFocus
              value={toDisplay(len, units)}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v > 0) setEdgeLengthById(edge.id, fromDisplay(v, units));
              }}
            />
          </div>
        ) : (
          <p className="hint">Select a member first.</p>
        )}
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
