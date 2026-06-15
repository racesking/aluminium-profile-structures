import { useMemo } from 'react';
import type { BarAssignment, CuttingResult } from '../../core/types';
import type { ExpressMember } from '../../core/templates';

type Props = {
  members: ExpressMember[];
  result: CuttingResult;
  roleColors: Map<string, string>;
  stockMode: 'buy' | 'inventory';
  buyLength: number;
};

type MemberGroup = { role: string; length: number; qty: number };

function CutStrip({
  bar,
  roleColors,
}: {
  bar: BarAssignment;
  roleColors: Map<string, string>;
}) {
  return (
    <div className="cut-strip">
      {bar.cuts.map((c, i) => {
        const pct = (c.length / bar.stockLength) * 100;
        return (
          <div
            key={i}
            className="cut-seg"
            style={{
              width: `${pct}%`,
              background: roleColors.get(c.label ?? '') ?? '#888888',
            }}
            title={`${c.label ?? 'Cut'} — ${c.length} mm`}
          >
            {pct > 8 ? c.length : ''}
          </div>
        );
      })}
      {bar.waste > 0.5 && (
        <div
          className="cut-seg waste"
          style={{ width: `${(bar.waste / bar.stockLength) * 100}%` }}
          title={`Waste — ${bar.waste} mm`}
        >
          {(bar.waste / bar.stockLength) * 100 > 10 ? bar.waste : ''}
        </div>
      )}
    </div>
  );
}

export function ExpressBOM({
  members,
  result,
  roleColors,
  stockMode,
  buyLength,
}: Props) {
  const memberGroups = useMemo(() => {
    const groups = new Map<string, MemberGroup>();
    for (const m of members) {
      const key = `${m.role}|${m.length}`;
      const g = groups.get(key);
      if (g) g.qty += 1;
      else groups.set(key, { role: m.role, length: m.length, qty: 1 });
    }
    return [...groups.values()].sort((a, b) => b.length - a.length);
  }, [members]);

  const totalCutLength = useMemo(
    () => Math.round(members.reduce((s, m) => s + m.length, 0)),
    [members],
  );

  const barsUsed = result.bars.length;
  const usedStockTotal = result.bars.reduce((s, b) => s + b.stockLength, 0);
  const wastePct =
    usedStockTotal > 0
      ? Math.round((result.totalWaste / usedStockTotal) * 1000) / 10
      : 0;

  // Identical bars collapse into one diagram with a × count.
  const barGroups = useMemo(() => {
    const groups = new Map<string, { bar: BarAssignment; qty: number }>();
    for (const bar of result.bars) {
      const signature = `${bar.stockLength}|${bar.cuts
        .map((c) => `${c.length}:${c.label ?? ''}`)
        .join(',')}`;
      const g = groups.get(signature);
      if (g) g.qty += 1;
      else groups.set(signature, { bar, qty: 1 });
    }
    return [...groups.values()];
  }, [result.bars]);

  return (
    <>
      {stockMode === 'buy' && barsUsed > 0 && result.unplaced.length === 0 && (
        <div className="buy-line">
          <span>Bars to buy</span>
          <strong>
            {barsUsed} × {buyLength} mm
          </strong>
        </div>
      )}

      <div className="bom-stats">
        <div className="stat-card">
          <strong>Members</strong>
          <span>{members.length}</span>
        </div>
        <div className="stat-card">
          <strong>Total cut</strong>
          <span>{(totalCutLength / 1000).toFixed(2)} m</span>
        </div>
        <div className="stat-card">
          <strong>Bars used</strong>
          <span>{barsUsed}</span>
        </div>
        <div className="stat-card">
          <strong>Waste</strong>
          <span>{wastePct}%</span>
        </div>
      </div>

      <div className="section">
        <p className="section-title">Members — cut lengths</p>
        <table className="bom-table">
          <tbody>
            {memberGroups.map((g) => (
              <tr key={`${g.role}|${g.length}`}>
                <td>
                  <span
                    className="role-dot"
                    style={{ background: roleColors.get(g.role) ?? '#888' }}
                  />
                  {g.role}
                </td>
                <td className="num">{g.length} mm</td>
                <td className="num">× {g.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section">
        <p className="section-title">Cut plan</p>
        {barGroups.map(({ bar, qty }, i) => (
          <div key={i} className="cut-group">
            <div className="cut-group-head">
              <strong>
                {qty > 1 ? `${qty} × ` : ''}Bar {bar.stockLength} mm
              </strong>
              <span>waste {bar.waste} mm</span>
            </div>
            <CutStrip bar={bar} roleColors={roleColors} />
          </div>
        ))}

        {result.unplaced.length > 0 && (
          <div className="shortage">
            {result.unplaced.length} piece
            {result.unplaced.length > 1 ? 's' : ''} won&apos;t fit (
            {result.shortageMm} mm missing).
            {stockMode === 'buy' ? (
              <>
                <br />
                Longest piece is{' '}
                {Math.max(...result.unplaced.map((p) => p.length))} mm — increase
                the bar length.
              </>
            ) : (
              result.suggestedBars && (
                <>
                  <br />
                  Add {result.suggestedBars.quantity} ×{' '}
                  {result.suggestedBars.length} mm to your stock.
                </>
              )
            )}
          </div>
        )}
        {result.unplaced.length === 0 && barsUsed > 0 && (
          <div className="ok">All cuts fit. Kerf included between cuts.</div>
        )}
      </div>
    </>
  );
}
