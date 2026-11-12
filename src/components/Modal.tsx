import { useEffect, useId, useRef, type ReactNode } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog shell for every Advanced/Express modal: dialog role with
 * its title as the accessible name, focus moved inside on open and returned
 * on close, Tab trapped within, Escape and backdrop click to dismiss.
 */
export function Modal({
  title,
  onClose,
  className = '',
  headerActions,
  children,
}: {
  title: string;
  onClose: () => void;
  className?: string;
  /** Rendered beside the title (e.g. Print / Close in the drawing viewer). */
  headerActions?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // Read the latest onClose from the key handler without re-running the
  // focus effect every render (that would steal focus while typing).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const box = ref.current;
    const autofocus = box?.querySelector<HTMLElement>('[autofocus]');
    (autofocus ?? box?.querySelector<HTMLElement>(FOCUSABLE) ?? box)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !box) return;
      const items = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      previous?.focus?.();
    };
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={ref}
        className={`modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          {headerActions}
        </div>
        {children}
      </div>
    </div>
  );
}
