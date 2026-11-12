import { useId } from 'react';
import { useStructureStore } from '../store/structureStore';
import { useSettingsStore } from '../store/settingsStore';
import { toDisplay, fromDisplay, unitInputStep } from '../core/units';
import { Modal } from './Modal';
import { CommitNumberInput } from './CommitNumberInput';
import { useCutPlan } from './useCutPlan';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function MemberDimensionModal({ open, onClose }: Props) {
  if (!open) return null;
  return <MemberDimensionBody onClose={onClose} />;
}

function MemberDimensionBody({ onClose }: { onClose: () => void }) {
  const units = useSettingsStore((s) => s.units);
  const edgeId = useStructureStore((s) =>
    s.selection?.type === 'edge' ? s.selection.id : s.selectedEdgeIds[0] ?? null,
  );
  const edges = useStructureStore((s) => s.edges);
  const getEdgeLength = useStructureStore((s) => s.getEdgeLength);
  const setEdgeLengthById = useStructureStore((s) => s.setEdgeLengthById);
  const plan = useCutPlan();
  const id = useId();

  const edge = edges.find((e) => e.id === edgeId);
  const len = edge ? getEdgeLength(edge.id) : 0;
  const part = edge ? plan.parts.get(edge.id)?.label : undefined;

  return (
    <Modal title={part ? `Member ${part}` : 'Member length'} onClose={onClose}>
      {edge ? (
        <div className="field">
          <label htmlFor={id}>Centreline length ({units})</label>
          <CommitNumberInput
            id={id}
            min={0}
            step={unitInputStep(units)}
            autoFocus
            value={toDisplay(len, units)}
            onCommit={(v) => {
              if (v > 0) setEdgeLengthById(edge.id, fromDisplay(v, units));
            }}
          />
          <p className="hint hint-compact">Press Enter to apply.</p>
        </div>
      ) : (
        <p className="hint">Select a member first.</p>
      )}
      <div className="modal-actions">
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
