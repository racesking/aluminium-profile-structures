import { useState } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  onApply: (width: number, depth: number, height: number) => void;
};

export function BoxFrameDialog({ open, onClose, onApply }: Props) {
  const [width, setWidth] = useState(80);
  const [depth, setDepth] = useState(50);
  const [height, setHeight] = useState(50);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Box frame</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          Rectangular tube frame (width × depth × height in mm).
        </p>
        <div className="field-row">
          <div className="field">
            <label>Width (X)</label>
            <input
              type="number"
              min={1}
              max={10000}
              value={width}
              onChange={(e) => setWidth(parseFloat(e.target.value) || 1)}
            />
          </div>
          <div className="field">
            <label>Depth (Y)</label>
            <input
              type="number"
              min={1}
              max={10000}
              value={depth}
              onChange={(e) => setDepth(parseFloat(e.target.value) || 1)}
            />
          </div>
          <div className="field">
            <label>Height (Z)</label>
            <input
              type="number"
              min={1}
              max={10000}
              value={height}
              onChange={(e) => setHeight(parseFloat(e.target.value) || 1)}
            />
          </div>
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
      </div>
    </div>
  );
}
