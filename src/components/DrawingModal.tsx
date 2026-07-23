import { useRef } from 'react';

type Props = {
  /** The full print-sheet HTML document (from bomToPrintHtml), or null. */
  html: string | null;
  onClose: () => void;
};

/**
 * In-app viewer for the technical drawing / parts list. Renders the print
 * sheet in a sandboxed-by-origin iframe (srcDoc) so nothing opens in a new
 * tab; "Print / Save PDF" prints just the sheet via the iframe's window.
 */
export function DrawingModal({ html, onClose }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);

  if (html === null) return null;

  const handlePrint = () => {
    const win = frameRef.current?.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal drawing-modal" onClick={(e) => e.stopPropagation()}>
        <div className="drawing-modal-head">
          <h2>Technical drawing &amp; parts list</h2>
          <div className="drawing-modal-actions">
            <button type="button" className="primary" onClick={handlePrint}>
              Print / Save PDF
            </button>
            <button type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <iframe
          ref={frameRef}
          className="drawing-frame"
          srcDoc={html}
          title="Technical drawing"
        />
      </div>
    </div>
  );
}
