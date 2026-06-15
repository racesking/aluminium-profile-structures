import { useMemo } from 'react';
import type { BarAssignment } from '../../core/types';
import type {
  MultiCuttingResult,
  ProfileCutResult,
} from '../../core/cuttingStock';
import type { CutMember } from '../../core/joints';
import type { ProfileDef } from '../../core/profiles';
import { useSettingsStore } from '../../store/settingsStore';
import { formatLength, formatLengthValue } from '../../core/units';
import type { LengthUnit } from '../../core/units';

type Props = {
  multi: MultiCuttingResult;
  cutMembers: CutMember[];
  profileOf: (role: string) => ProfileDef;
  roleColors: Map<string, string>;
  stockMode: 'buy' | 'inventory';
  buyLengthOf: (profileId: string) => number;
};

function CutStrip({
  bar,
  roleColors,
  units,
}: {
  bar: BarAssignment;
  roleColors: Map<string, string>;
  units: LengthUnit;
}) {
  return (
    <div className="cut-strip">
      {bar.cuts.map((c, i) => {
        const pct = (c.length / bar.stockLength) * 100;
        return (
          <div
            key={i}
            className="cut-seg"
            style={{ width: `${pct}%`, background: roleColors.get(c.label ?? '') ?? '#888888' }}
            title={`${c.label ?? 'Cut'} — ${formatLength(c.length, units)}`}
          >
            {pct > 8 ? formatLengthValue(c.length, units) : ''}
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

function ProfileBOMSection({
  group,
  members,
  roleColors,
  stockMode,
  buyLength,
  showHeader,
  units,
}: {
  group: ProfileCutResult;
  members: CutMember[];
  roleColors: Map<string, string>;
  stockMode: 'buy' | 'inventory';
  buyLength: number;
  showHeader: boolean;
  units: LengthUnit;
}) {
  const { result } = group;

  const memberRows = useMemo(() => {
    const groups = new Map<string, { role: string; length: number; qty: number }>();
    for (const m of members) {
      const key = `${m.role}|${m.length}`;
      const g = groups.get(key);
      if (g) g.qty += 1;
      else groups.set(key, { role: m.role, length: m.length, qty: 1 });
    }
    return [...groups.values()].sort((a, b) => b.length - a.length);
  }, [members]);

  // Identical bars collapse into one diagram with a × count.
  const barGroups = useMemo(() => {
    const groups = new Map<string, { bar: BarAssignment; qty: number }>();
    for (const bar of result.bars) {
      const sig = `${bar.stockLength}|${bar.cuts.map((c) => `${c.length}:${c.label ?? ''}`).join(',')}`;
      const g = groups.get(sig);
      if (g) g.qty += 1;
      else groups.set(sig, { bar, qty: 1 });
    }
    return [...groups.values()];
  }, [result.bars]);

  const barsUsed = result.bars.length;

  return (
    <div className="profile-bom">
      {showHeader && (
        <p className="profile-bom-head">
          {group.profileName} · {group.sectionMm} mm
        </p>
      )}

      {stockMode === 'buy' && barsUsed > 0 && result.unplaced.length === 0 && (
        <div className="buy-line">
          <span>Bars to buy</span>
          <strong>
            {barsUsed} × {formatLength(buyLength, units)}
          </strong>
        </div>
      )}

      <table className="bom-table">
        <tbody>
          {memberRows.map((g) => (
            <tr key={`${g.role}|${g.length}`}>
              <td>
                <span className="role-dot" style={{ background: roleColors.get(g.role) ?? '#888' }} />
                {g.role}
              </td>
              <td className="num">{formatLength(g.length, units)}</td>
              <td className="num">× {g.qty}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 10 }}>
        {barGroups.map(({ bar, qty }, i) => (
          <div key={i} className="cut-group">
            <div className="cut-group-head">
              <strong>
                {qty > 1 ? `${qty} × ` : ''}Bar {formatLength(bar.stockLength, units)}
              </strong>
              <span>waste {formatLength(bar.waste, units)}</span>
            </div>
            <CutStrip bar={bar} roleColors={roleColors} units={units} />
          </div>
        ))}

        {result.unplaced.length > 0 ? (
          <div className="shortage">
            {result.unplaced.length} piece{result.unplaced.length > 1 ? 's' : ''} won&apos;t fit (
            {formatLength(result.shortageMm, units)} missing).
            {stockMode === 'buy' ? (
              <>
                <br />
                Longest piece is {formatLength(Math.max(...result.unplaced.map((p) => p.length)), units)} —
                increase the bar length.
              </>
            ) : (
              result.suggestedBars && (
                <>
                  <br />
                  Add {result.suggestedBars.quantity} × {formatLength(result.suggestedBars.length, units)} to
                  this profile&apos;s stock.
                </>
              )
            )}
          </div>
        ) : (
          barsUsed > 0 && <div className="ok">All cuts fit. Kerf included between cuts.</div>
        )}
      </div>
    </div>
  );
}

export function ExpressBOM({
  multi,
  cutMembers,
  profileOf,
  roleColors,
  stockMode,
  buyLengthOf,
}: Props) {
  const units = useSettingsStore((s) => s.units);
  const multiProfile = multi.byProfile.length > 1;

  return (
    <>
      <div className="bom-stats">
        <div className="stat-card">
          <strong>Members</strong>
          <span>{cutMembers.length}</span>
        </div>
        <div className="stat-card">
          <strong>Total cut</strong>
          <span>{formatLength(multi.totalCutLength, units)}</span>
        </div>
        <div className="stat-card">
          <strong>Bars used</strong>
          <span>{multi.totalBars}</span>
        </div>
        <div className="stat-card">
          <strong>Waste</strong>
          <span>{multi.wastePercent}%</span>
        </div>
      </div>

      <div className="section">
        <p className="section-title">
          Bill of materials{multiProfile ? ' — by profile' : ' — cut lengths'}
        </p>
        {multi.byProfile.map((group) => (
          <ProfileBOMSection
            key={group.profileId}
            group={group}
            members={cutMembers.filter((m) => profileOf(m.role).id === group.profileId)}
            roleColors={roleColors}
            stockMode={stockMode}
            buyLength={buyLengthOf(group.profileId)}
            showHeader={multiProfile}
            units={units}
          />
        ))}
      </div>
    </>
  );
}
