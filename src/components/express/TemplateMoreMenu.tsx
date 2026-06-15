import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { TEMPLATE_CATEGORIES, type TemplateDef } from '../../core/templates';

type Props = {
  templates: TemplateDef[];
  activeId: string;
  onSelect: (id: string) => void;
};

const POPOVER_WIDTH = 290;
const POPOVER_MAX_HEIGHT = 460;
const CLOSE_DELAY = 140;

/**
 * "More templates" trigger with a floating, hover-revealed popover (portaled to
 * <body> so the panel's overflow can't clip it). Lists the non-featured
 * templates grouped by category.
 */
export function TemplateMoreMenu({ templates, activeId, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{
    left: number;
    top: number;
    maxHeight: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);

  const activeHere = templates.find((t) => t.id === activeId);

  const computePos = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 6;
    const margin = 12;
    // Prefer the right of the panel; fall back to the left if there's no room.
    let left = r.right + gap;
    if (left + POPOVER_WIDTH > window.innerWidth - 8) {
      left = r.left - gap - POPOVER_WIDTH;
      if (left < 8) left = 8;
    }
    // Align to the trigger, but lift it up if it would run off the bottom, and
    // cap the height to the remaining space so it scrolls instead of clipping.
    const available = window.innerHeight - margin * 2;
    const maxHeight = Math.min(POPOVER_MAX_HEIGHT, available);
    let top = r.top;
    if (top + maxHeight > window.innerHeight - margin) {
      top = Math.max(margin, window.innerHeight - margin - maxHeight);
    }
    setPos({ left, top, maxHeight });
  }, []);

  const openMenu = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    computePos();
    setOpen(true);
  }, [computePos]);

  const scheduleClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY);
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const reposition = () => computePos();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (
        !popoverRef.current?.contains(t) &&
        !triggerRef.current?.contains(t)
      ) {
        setOpen(false);
      }
    };
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, computePos]);

  const groups = TEMPLATE_CATEGORIES.map((cat) => ({
    cat,
    items: templates.filter((t) => t.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div
      className="more-templates"
      onMouseEnter={openMenu}
      onMouseLeave={scheduleClose}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`more-trigger ${open ? 'open' : ''} ${activeHere ? 'active' : ''}`}
        onClick={() => (open ? setOpen(false) : openMenu())}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className="more-trigger-label">
          {activeHere ? activeHere.name : 'More templates'}
        </span>
        <span className="more-count">
          {activeHere ? 'change' : `+${templates.length}`}
        </span>
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={popoverRef}
            className="more-popover"
            style={
              {
                left: pos.left,
                top: pos.top,
                width: POPOVER_WIDTH,
                maxHeight: pos.maxHeight,
              } as CSSProperties
            }
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
          >
            {groups.map((g) => (
              <div key={g.cat} className="more-group">
                <p className="tpl-category-label">{g.cat}</p>
                {g.items.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`tpl-option ${t.id === activeId ? 'active' : ''}`}
                    onClick={() => {
                      onSelect(t.id);
                      setOpen(false);
                    }}
                  >
                    <strong>{t.name}</strong>
                    <span>{t.tagline}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
