type Props = {
  open: boolean;
  onClose: () => void;
};

export function HelpModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h2>Help</h2>
        <div className="help-content">
          <h3>Tools</h3>
          <ul>
            <li><strong>V</strong> — Select</li>
            <li><strong>N</strong> — Place node</li>
            <li><strong>C</strong> — Connect members</li>
          </ul>
          <h3>Selection</h3>
          <ul>
            <li>Click member — select</li>
            <li><strong>Shift+click</strong> — add/remove from selection (2 selected → constraints)</li>
            <li><strong>Alt+click</strong> — set constraint reference member</li>
            <li>Right-click — context menu</li>
          </ul>
          <h3>Move selection</h3>
          <ul>
            <li><strong>Arrow keys</strong> — translate selection on X/Z (Up/Down = Z, Left/Right = X)</li>
            <li><strong>Shift+arrows</strong> — larger step</li>
            <li><strong>PgUp / PgDn</strong> — Y axis</li>
          </ul>
          <h3>Edit</h3>
          <ul>
            <li><strong>Ctrl+Z / Ctrl+Y</strong> — undo / redo</li>
            <li><strong>Ctrl+C / Ctrl+V</strong> — copy / paste selection</li>
            <li><strong>Ctrl+D</strong> — duplicate at offset</li>
            <li><strong>Del</strong> — delete</li>
          </ul>
          <h3>Constraints</h3>
          <ul>
            <li>Select two members (Shift+click or dropdown), then ∥ Parallel or ⊥ Perpendicular</li>
          </ul>
          <h3>Work planes</h3>
          <ul>
            <li>XZ / XY / YZ / 3D — placement and drag plane</li>
            <li>Grid size &amp; Snap to grid — toolbar</li>
          </ul>
        </div>
        <div className="modal-actions">
          <button type="button" className="primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
