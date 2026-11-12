import { Modal } from './Modal';

type Props = {
  open: boolean;
  onClose: () => void;
};

/** Keys and gestures, kept in step with AdvancedBuilder's KeyboardShortcuts. */
export function HelpModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <Modal title="Help & shortcuts" onClose={onClose} className="modal-wide">
      <div className="help-content">
        <h3>Build a structure</h3>
        <ul>
          <li>Start from <strong>+ Box frame</strong>, or press <kbd>N</kbd> and click to place nodes, then <kbd>C</kbd> and click two nodes to connect a member.</li>
          <li>Give each profile a shape, section and colour in the right panel; select members and assign them to a profile.</li>
          <li>The <strong>cut plan</strong> updates live: joint type and kerf are included in every cut length.</li>
        </ul>
        <h3>Tools</h3>
        <ul>
          <li><kbd>V</kbd> Select · <kbd>B</kbd> Box select · <kbd>N</kbd> Place node · <kbd>C</kbd> Connect</li>
          <li>Box select: drag left → right to select members fully inside; right → left to select anything crossed. <kbd>Shift</kbd> adds.</li>
        </ul>
        <h3>Mouse</h3>
        <ul>
          <li>Left-drag orbits · middle-drag pans · scroll zooms</li>
          <li><strong>Right-click</strong> opens the quick-action ring; <strong>right-drag</strong> in a direction runs that action without opening it (a flick).</li>
          <li><kbd>Shift</kbd>+click adds to the selection · <kbd>Alt</kbd>+click sets the constraint reference member</li>
        </ul>
        <h3>Keyboard</h3>
        <ul>
          <li><kbd>Shift</kbd>+<kbd>F10</kbd> or the Menu key — open the quick-action ring</li>
          <li>Arrows move the selection on X/Z, <kbd>PgUp</kbd>/<kbd>PgDn</kbd> on Y; hold <kbd>Shift</kbd> for 10× steps</li>
          <li>Hold <kbd>X</kbd>, <kbd>Y</kbd> or <kbd>Z</kbd> while dragging a node to lock it to that axis</li>
          <li><kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Y</kbd> undo / redo · <kbd>Ctrl</kbd>+<kbd>C</kbd> / <kbd>Ctrl</kbd>+<kbd>V</kbd> copy / paste · <kbd>Ctrl</kbd>+<kbd>D</kbd> duplicate · <kbd>Del</kbd> delete</li>
          <li><kbd>Esc</kbd> cancels a connection, clears the axis lock, or closes a dialog</li>
        </ul>
        <h3>Parts and locking</h3>
        <ul>
          <li>Members with the same profile and cut length form a part (A, B, …); each member is numbered within its part (A1, A2). The same IDs appear on the drawing.</li>
          <li><strong>Lock part</strong> (quick-action ring) pins members: they can&apos;t be moved, re-dimensioned or deleted until unlocked.</li>
        </ul>
        <h3>Constraints</h3>
        <ul>
          <li>Select two members, then ∥ Parallel or ⊥ Perpendicular in the left panel. The second member moves to match the first.</li>
        </ul>
      </div>
      <div className="modal-actions">
        <button type="button" className="primary" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
