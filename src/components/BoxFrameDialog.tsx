import { useId, useState } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { toDisplay, fromDisplay, unitInputStep } from '../core/units';
import { Modal } from './Modal';

type Props = {
  open: boolean;
  onClose: () => void;
  onApply: (width: number, depth: number, height: number) => void;
};

export function BoxFrameDialog({ open, onClose, onApply }: Props) {
  const units = useSettingsStore((s) => s.units);
  const ids = useId();
  // A real-world starting size (mm): reads as a frame, not a blob.
  const [width, setWidth] = useState(600);
  const [depth, setDepth] = useState(400);
  const [height, setHeight] = useState(400);

  if (!open) return null;

  const step = unitInputStep(units);
  const field = (
    key: string,
    label: string,
    value: number,
    set: (mm: number) => void,
  ) => (
    <div className="field">
      <label htmlFor={`${ids}-${key}`}>
        {label} ({units})
      </label>
      <input
        id={`${ids}-${key}`}
        type="number"
        min={0}
        max={20000}
        step={step}
        value={toDisplay(value, units)}
        onChange={(e) => set(fromDisplay(parseFloat(e.target.value) || 0, units) || 1)}
      />
    </div>
  );

  return (
    <Modal title="Box frame" onClose={onClose}>
      <p className="hint" style={{ marginTop: 0 }}>
        A rectangular frame of 12 members. It replaces the current structure;
        Ctrl+Z brings it back.
      </p>
      <div className="field-row">
        {field('w', 'Width', width, setWidth)}
        {field('d', 'Depth', depth, setDepth)}
        {field('h', 'Height', height, setHeight)}
      </div>
      <div className="modal-actions">
        <button type="button" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="primary"
          onClick={() => {
            onApply(width, depth, height);
            onClose();
          }}
        >
          Create frame
        </button>
      </div>
    </Modal>
  );
}
