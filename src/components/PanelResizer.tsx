import { useCallback, useState } from 'react';
import { useLayoutStore } from '../store/layoutStore';

type Props = { side: 'left' | 'right' };

/**
 * Draggable splitter that sits on the inner edge of a side panel and resizes
 * it (Fusion-style). Positioned within `.main`, which is the layout container.
 */
export function PanelResizer({ side }: Props) {
  const setLeftWidth = useLayoutStore((s) => s.setLeftWidth);
  const setRightWidth = useLayoutStore((s) => s.setRightWidth);
  const [dragging, setDragging] = useState(false);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      setDragging(true);
      document.body.classList.add('resizing-col');

      const move = (ev: PointerEvent) => {
        if (side === 'left') setLeftWidth(ev.clientX);
        else setRightWidth(window.innerWidth - ev.clientX);
      };
      const up = () => {
        setDragging(false);
        document.body.classList.remove('resizing-col');
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [side, setLeftWidth, setRightWidth],
  );

  return (
    <div
      className={`panel-resizer ${side} ${dragging ? 'dragging' : ''}`}
      onPointerDown={onPointerDown}
      onDoubleClick={() =>
        side === 'left' ? setLeftWidth(260) : setRightWidth(360)
      }
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${side} panel`}
      title="Drag to resize · double-click to reset"
    >
      <span className="panel-resizer-grip" aria-hidden>
        ⋮
      </span>
    </div>
  );
}
