import { useId } from 'react';
import { useStructureStore } from '../store/structureStore';
import { useSettingsStore } from '../store/settingsStore';
import { toDisplay, fromDisplay, formatLength, unitInputStep } from '../core/units';
import { resolveProfileColor } from '../core/profiles';
import type { ProfileDef } from '../core/profiles';
import {
  PROFILE_SHAPES,
  isProfileShape,
  profileShapeOf,
  sectionLabel,
} from '../core/profileShapes';
import { JOINTS } from '../core/joints';
import type { StockBar } from '../core/types';
import { CutStrip } from './CutStrip';
import { useCutPlan } from './useCutPlan';
import { CUT_PLAN_ID, scrollToCutPlan } from './cutPlanNav';

/**
 * What each joint does to Advanced cut lengths. Advanced cuts follow the 3D
 * joint rules (core/jointVisuals), which differ from Express's per-member
 * factors — so it gets its own, accurate wording.
 */
const ADVANCED_JOINT_HINT: Record<string, string> = {
  blind:
    'Internal connector. The larger profile runs through; members that butt into it are shortened by half its width.',
  bracket:
    'External angle bracket at right-angle corners. Butting members are shortened by half the through profile’s width.',
  mitre:
    'Where two members meet, both are cut at 45° to the outer corner.',
  butt:
    'Members butt against the through profile and are shortened by half its width (no connector).',
};

function ProfileStockBlock({
  profile,
  stock,
  showHeader,
  color,
}: {
  profile: ProfileDef;
  stock: StockBar[];
  showHeader: boolean;
  color: string;
}) {
  const units = useSettingsStore((s) => s.units);
  const addStockRow = useStructureStore((s) => s.addStockRow);
  const updateStock = useStructureStore((s) => s.updateStock);
  const removeStock = useStructureStore((s) => s.removeStock);

  return (
    <div className="profile-stock">
      {showHeader && (
        <p className="profile-stock-head">
          <span className="profile-swatch" style={{ background: color }} />
          {profile.name} · {sectionLabel(profile)}
        </p>
      )}
      <div className="stock-row stock-row-head" aria-hidden>
        <span>Length ({units})</span>
        <span />
        <span>Qty</span>
        <span />
      </div>
      {stock.map((bar) => (
        <div key={bar.id} className="stock-row">
          <input
            type="number"
            min={0}
            step={unitInputStep(units)}
            value={toDisplay(bar.length, units)}
            onChange={(e) =>
              updateStock(
                profile.id,
                bar.id,
                fromDisplay(parseFloat(e.target.value) || 0, units),
                bar.quantity,
              )
            }
            aria-label={`${profile.name} bar length (${units})`}
          />
          <span className="stock-times" aria-hidden>
            ×
          </span>
          <input
            className="qty"
            type="number"
            min={0}
            value={bar.quantity}
            onChange={(e) =>
              updateStock(
                profile.id,
                bar.id,
                bar.length,
                parseInt(e.target.value, 10) || 0,
              )
            }
            aria-label={`${profile.name} bars in stock`}
          />
          <button
            type="button"
            onClick={() => removeStock(profile.id, bar.id)}
            disabled={stock.length <= 1}
            aria-label="Remove this stock row"
            title="Remove this stock row"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => addStockRow(profile.id)}
        style={{ marginTop: 6 }}
      >
        + Add bar length
      </button>
    </div>
  );
}

export function StockPanel() {
  const units = useSettingsStore((s) => s.units);
  const profiles = useStructureStore((s) => s.profiles);
  const edges = useStructureStore((s) => s.edges);
  const stockByProfile = useStructureStore((s) => s.stockByProfile);
  const kerf = useStructureStore((s) => s.kerf);
  const jointId = useStructureStore((s) => s.jointId);

  const setKerf = useStructureStore((s) => s.setKerf);
  const setJoint = useStructureStore((s) => s.setJoint);
  const addProfile = useStructureStore((s) => s.addProfile);
  const removeProfile = useStructureStore((s) => s.removeProfile);
  const updateProfile = useStructureStore((s) => s.updateProfile);
  const assignSelectedToProfile = useStructureStore(
    (s) => s.assignSelectedToProfile,
  );
  const selectedCount = useStructureStore((s) => s.getActiveEdgeIds().length);

  const plan = useCutPlan();
  const nodes = useStructureStore((s) => s.nodes);
  // Mitres only apply where exactly two members meet (core/jointVisuals).
  const hasThreeWayNode =
    jointId === 'mitre' &&
    nodes.some(
      (n) => edges.filter((e) => e.fromId === n.id || e.toId === n.id).length >= 3,
    );
  const result = plan.multi;
  const ids = useId();

  const memberCount = (profileId: string) =>
    edges.reduce((n, e) => n + (plan.profileOf(e.id).id === profileId ? 1 : 0), 0);

  const multi = profiles.length > 1;
  const colorById = new Map(
    profiles.map((p, i) => [p.id, resolveProfileColor(p, i)]),
  );
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const hasPlan = edges.length > 0 && result.byProfile.length > 0;
  const shortage = result.byProfile.reduce((n, g) => n + g.result.shortageMm, 0);

  return (
    <aside className="panel right" aria-label="Profiles, stock and cut plan">
      <div className="panel-header">Profiles &amp; Stock</div>
      <div className="panel-body">
        {hasPlan && (
          <button
            type="button"
            className={`cut-summary ${result.anyUnplaced ? 'short' : ''}`}
            onClick={scrollToCutPlan}
          >
            <span>
              <strong>
                {result.totalBars} {result.totalBars === 1 ? 'bar' : 'bars'}
              </strong>{' '}
              · {result.wastePercent}% waste
            </span>
            <span>
              {result.anyUnplaced
                ? `Short ${formatLength(shortage, units)}`
                : 'All cuts fit'}{' '}
              ↓
            </span>
          </button>
        )}

        <div className="section">
          <p className="section-title">Profiles</p>
          {profiles.map((p, i) => {
            const count = memberCount(p.id);
            return (
              <div key={p.id} className="profile-row">
                <input
                  type="color"
                  className="profile-color-input"
                  value={resolveProfileColor(p, i)}
                  onChange={(e) => updateProfile(p.id, { color: e.target.value })}
                  aria-label={`${p.name} colour`}
                  title="Profile colour — used in the 3D view and cut plan"
                />
                <input
                  type="text"
                  value={p.name}
                  onChange={(e) => updateProfile(p.id, { name: e.target.value })}
                  aria-label="Profile name"
                />
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={p.sectionMm}
                  onChange={(e) =>
                    updateProfile(p.id, {
                      sectionMm: parseFloat(e.target.value) || 20,
                    })
                  }
                  aria-label={`${p.name} section size (mm)`}
                />
                <span className="profile-row-unit" aria-hidden>
                  mm
                </span>
                <span
                  className="profile-row-count"
                  title={`${count} member${count === 1 ? '' : 's'} use this profile`}
                >
                  {count}
                  <span className="visually-hidden">
                    {' '}
                    member{count === 1 ? '' : 's'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => removeProfile(p.id)}
                  disabled={profiles.length <= 1}
                  aria-label={`Remove profile ${p.name}`}
                  title="Remove profile"
                >
                  ×
                </button>
                <select
                  className="profile-shape-select"
                  value={profileShapeOf(p)}
                  onChange={(e) => {
                    if (isProfileShape(e.target.value)) {
                      updateProfile(p.id, { shape: e.target.value });
                    }
                  }}
                  aria-label={`${p.name} cross-section shape`}
                >
                  {PROFILE_SHAPES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
          <button type="button" onClick={addProfile} style={{ marginTop: 6 }}>
            + Add profile
          </button>
        </div>

        <div className="section">
          <p className="section-title">Assign selection</p>
          <p className="hint hint-compact" style={{ marginTop: 0 }}>
            {selectedCount > 0
              ? `${selectedCount} member${selectedCount === 1 ? '' : 's'} selected — assign to:`
              : 'Select members in the viewport to assign a profile.'}
          </p>
          <div className="assign-row">
            {profiles.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => assignSelectedToProfile(p.id)}
                disabled={selectedCount === 0}
                title={`Assign selection to ${p.name}`}
              >
                <span
                  className="profile-swatch"
                  style={{ background: resolveProfileColor(p, i) }}
                />
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="section">
          <p className="section-title">Cut settings</p>
          <div className="field">
            <label htmlFor={`${ids}-joint`}>Joint type</label>
            <select
              id={`${ids}-joint`}
              value={jointId}
              onChange={(e) => setJoint(e.target.value)}
            >
              {JOINTS.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}
                </option>
              ))}
            </select>
          </div>
          <p className="hint hint-compact" style={{ marginTop: 0 }}>
            {ADVANCED_JOINT_HINT[jointId] ?? ''}
            {hasThreeWayNode && ' Corners where three or more members meet are butted instead.'}{' '}
            Cut lengths below include this.
          </p>
          <div className="field">
            <label htmlFor={`${ids}-kerf`}>Kerf / blade (mm)</label>
            <input
              id={`${ids}-kerf`}
              type="number"
              min={0}
              step={0.5}
              value={kerf}
              onChange={(e) => setKerf(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="stat-card">
            <strong>Total cut length</strong>
            <span>{formatLength(plan.totalCut, units)}</span>
          </div>
        </div>

        <div className="section">
          <p className="section-title">Available stock</p>
          {profiles.map((p, i) => (
            <ProfileStockBlock
              key={p.id}
              profile={p}
              stock={stockByProfile[p.id] ?? []}
              showHeader={multi}
              color={resolveProfileColor(p, i)}
            />
          ))}
        </div>

        <section
          className="section cut-plan"
          id={CUT_PLAN_ID}
          tabIndex={-1}
          aria-labelledby={`${ids}-plan`}
        >
          <h2 className="section-title" id={`${ids}-plan`}>
            Cut plan
          </h2>
          {!hasPlan ? (
            <p className="hint hint-compact" style={{ marginTop: 0 }}>
              Draw members and the cut plan builds itself here: which bars to
              cut, in which order, and what is left over.
            </p>
          ) : (
            <>
              {result.byProfile.map((pr) => {
                const r = pr.result;
                const color = colorById.get(pr.profileId) ?? '#888888';
                const profile = profileById.get(pr.profileId);
                return (
                  <div key={pr.profileId} className="cut-plan-profile">
                    {multi && (
                      <p className="cut-profile-head">
                        <span className="profile-swatch" style={{ background: color }} />
                        {pr.profileName} ·{' '}
                        {profile ? sectionLabel(profile) : `${pr.sectionMm} mm`}
                      </p>
                    )}
                    {r.bars.map((bar) => (
                      <div key={bar.barIndex} className="cut-group">
                        <div className="cut-group-head">
                          <strong>
                            Bar {bar.barIndex} · {formatLength(bar.stockLength, units)}
                          </strong>
                          <span>waste {formatLength(bar.waste, units)}</span>
                        </div>
                        <CutStrip bar={bar} colorOf={() => color} units={units} showLabels />
                        <p className="cut-legend">
                          {bar.cuts
                            .map((c) => `${c.label ?? '—'} ${formatLength(c.length, units)}`)
                            .join(' · ')}
                        </p>
                      </div>
                    ))}
                    {r.unplaced.length > 0 ? (
                      <div className="shortage" role="status">
                        {r.unplaced.length} piece{r.unplaced.length === 1 ? '' : 's'}{' '}
                        won&apos;t fit ({formatLength(r.shortageMm, units)} short).
                        {r.suggestedBars && (
                          <>
                            <br />
                            Add {r.suggestedBars.quantity} ×{' '}
                            {formatLength(r.suggestedBars.length, units)} to this
                            profile&apos;s stock.
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="ok">All cuts fit. Kerf included between cuts.</div>
                    )}
                  </div>
                );
              })}
              <div className="stat-card" style={{ marginTop: 8 }}>
                <strong>Waste</strong>
                <span>
                  {formatLength(result.totalWaste, units)} ({result.wastePercent}%)
                </span>
              </div>
              <p className="hint hint-compact">
                {plan.cutLengths.size} member{plan.cutLengths.size === 1 ? '' : 's'} ·{' '}
                {result.totalBars} {result.totalBars === 1 ? 'bar' : 'bars'} ·{' '}
                {formatLength(result.totalCutLength, units)} cut
              </p>
            </>
          )}
        </section>
      </div>
    </aside>
  );
}
