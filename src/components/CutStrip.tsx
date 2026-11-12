import type { BarAssignment } from '../core/types';
import type { LengthUnit } from '../core/units';
import { formatLength, formatLengthValue } from '../core/units';

/** Black or white ink, whichever reads better on the given #rrggbb fill. */
function inkOn(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const L =
    0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  // Contrast against white vs against near-black; pick the stronger.
  return 1.05 / (L + 0.05) >= (L + 0.05) / 0.0559 ? '#ffffff' : '#0a0a0a';
}

/**
 * One stock bar drawn to scale: each cut is a segment proportional to its
 * length, labelled when there is room, with the waste offcut hatched.
 * Shared by the Express BOM and the Advanced cut plan.
 */
export function CutStrip({
  bar,
  colorOf,
  units,
  showLabels = false,
}: {
  bar: BarAssignment;
  /** Fill colour for a cut, keyed by its label. */
  colorOf: (label: string | undefined) => string;
  units: LengthUnit;
  /** Prefix segment text with the cut label (e.g. "A1 380"). */
  showLabels?: boolean;
}) {
  const summary = `${formatLength(bar.stockLength, units)} bar: ${bar.cuts
    .map((c) => `${c.label ? `${c.label} ` : ''}${formatLength(c.length, units)}`)
    .join(', ')}; waste ${formatLength(bar.waste, units)}`;

  return (
    <div className="cut-strip" role="img" aria-label={summary}>
      {bar.cuts.map((c, i) => {
        const pct = (c.length / bar.stockLength) * 100;
        const fill = colorOf(c.label);
        const text = showLabels && c.label
          ? `${c.label} ${formatLengthValue(c.length, units)}`
          : formatLengthValue(c.length, units);
        return (
          <div
            key={i}
            className="cut-seg"
            style={{ width: `${pct}%`, background: fill, color: inkOn(fill) }}
            title={`${c.label ?? 'Cut'} — ${formatLength(c.length, units)}`}
          >
            {pct > 8 ? text : ''}
          </div>
        );
      })}
      {bar.waste > 0.5 && (
        <div
          className="cut-seg waste"
          style={{ width: `${(bar.waste / bar.stockLength) * 100}%` }}
          title={`Waste — ${formatLength(bar.waste, units)}`}
        >
          {(bar.waste / bar.stockLength) * 100 > 10 ? formatLengthValue(bar.waste, units) : ''}
        </div>
      )}
    </div>
  );
}
