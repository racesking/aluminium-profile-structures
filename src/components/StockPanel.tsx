import { useStructureStore } from '../store/structureStore';
import { profileColorAt } from '../core/profiles';
import type { ProfileDef } from '../core/profiles';
import type { StockBar } from '../core/types';

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
  const addStockRow = useStructureStore((s) => s.addStockRow);
  const updateStock = useStructureStore((s) => s.updateStock);
  const removeStock = useStructureStore((s) => s.removeStock);

  return (
    <div className="profile-stock">
      {showHeader && (
        <p className="profile-stock-head">
          <span className="profile-swatch" style={{ background: color }} />
          {profile.name} · {profile.sectionMm} mm
        </p>
      )}
      {stock.map((bar) => (
        <div key={bar.id} className="stock-row">
          <input
            type="number"
            min={1}
            value={bar.length}
            onChange={(e) =>
              updateStock(
                profile.id,
                bar.id,
                parseFloat(e.target.value) || 1,
                bar.quantity,
              )
            }
            title="Length mm"
          />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>×</span>
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
          />
          <button
            type="button"
            onClick={() => removeStock(profile.id, bar.id)}
            disabled={stock.length <= 1}
            title="Remove"
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
        + Row
      </button>
    </div>
  );
}

export function StockPanel() {
  const profiles = useStructureStore((s) => s.profiles);
  const edges = useStructureStore((s) => s.edges);
  const edgeProfile = useStructureStore((s) => s.edgeProfile);
  const stockByProfile = useStructureStore((s) => s.stockByProfile);
  const kerf = useStructureStore((s) => s.kerf);
  const cuttingResult = useStructureStore((s) => s.cuttingResult);

  const setKerf = useStructureStore((s) => s.setKerf);
  const addProfile = useStructureStore((s) => s.addProfile);
  const removeProfile = useStructureStore((s) => s.removeProfile);
  const updateProfile = useStructureStore((s) => s.updateProfile);
  const assignSelectedToProfile = useStructureStore(
    (s) => s.assignSelectedToProfile,
  );
  const optimize = useStructureStore((s) => s.optimize);

  const selectedCount = useStructureStore((s) => s.getActiveEdgeIds().length);
  const totalCuts = useStructureStore((s) =>
    s.edges.reduce((sum, e) => sum + s.getEdgeLength(e.id), 0),
  );

  const fallbackId = profiles[0]?.id;
  const memberCount = (profileId: string) =>
    edges.reduce(
      (n, e) => n + ((edgeProfile[e.id] ?? fallbackId) === profileId ? 1 : 0),
      0,
    );

  const multi = profiles.length > 1;
  const colorById = new Map(profiles.map((p, i) => [p.id, profileColorAt(i)]));

  const noStock = profiles.every((p) =>
    (stockByProfile[p.id] ?? []).every((b) => b.quantity === 0),
  );

  return (
    <aside className="panel right">
      <div className="panel-header">Profiles &amp; Stock</div>
      <div className="panel-body">
        <div className="section">
          <p className="section-title">Profiles</p>
          {profiles.map((p, i) => (
            <div key={p.id} className="profile-row">
              <span
                className="profile-swatch"
                style={{ background: profileColorAt(i) }}
              />
              <input
                type="text"
                value={p.name}
                onChange={(e) => updateProfile(p.id, { name: e.target.value })}
                title="Profile name"
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
                title="Section size (mm)"
              />
              <span className="profile-row-unit">mm</span>
              <span
                className="profile-row-count"
                title="Members assigned to this profile"
              >
                {memberCount(p.id)}
              </span>
              <button
                type="button"
                onClick={() => removeProfile(p.id)}
                disabled={profiles.length <= 1}
                title="Remove profile"
              >
                ×
              </button>
            </div>
          ))}
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
                  style={{ background: profileColorAt(i) }}
                />
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="section">
          <p className="section-title">Cut settings</p>
          <div className="field">
            <label>Kerf / blade (mm)</label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={kerf}
              onChange={(e) => setKerf(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="stat-card">
            <strong>Total length</strong>
            <span>{Math.round(totalCuts * 10) / 10} mm</span>
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
              color={profileColorAt(i)}
            />
          ))}
          <button
            type="button"
            className="primary"
            style={{ width: '100%', marginTop: 12 }}
            onClick={optimize}
            disabled={edges.length === 0 || noStock}
          >
            Optimize cuts
          </button>
        </div>

        {cuttingResult && cuttingResult.byProfile.length > 0 && (
          <div className="section">
            <p className="section-title">Cut plan</p>
            {cuttingResult.byProfile.map((pr) => {
              const r = pr.result;
              return (
                <div key={pr.profileId}>
                  {multi && (
                    <p className="cut-profile-head">
                      <span
                        className="profile-swatch"
                        style={{
                          background:
                            colorById.get(pr.profileId) ?? profileColorAt(0),
                        }}
                      />
                      {pr.profileName} · {pr.sectionMm}×{pr.sectionMm} mm
                    </p>
                  )}
                  {r.bars.map((bar) => (
                    <div key={bar.barIndex} className="cut-bar">
                      <div>
                        <strong>Bar {bar.barIndex}</strong> · {bar.stockLength}{' '}
                        mm
                      </div>
                      {bar.cuts.map((c, i) => (
                        <span key={i}>
                          {i > 0 ? ' + ' : ''}
                          {c.length}
                          {c.label ? ` (${c.label})` : ''}
                        </span>
                      ))}
                      <div className="waste">Waste {bar.waste} mm</div>
                    </div>
                  ))}
                  {r.unplaced.length > 0 ? (
                    <div className="shortage">
                      Need {r.shortageMm} mm more.
                      {r.suggestedBars && (
                        <>
                          <br />
                          Buy {r.suggestedBars.quantity}× {r.suggestedBars.length}{' '}
                          mm
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="ok">All cuts fit stock.</div>
                  )}
                </div>
              );
            })}
            <div className="stat-card" style={{ marginTop: 8 }}>
              <strong>Waste total</strong>
              <span>
                {cuttingResult.totalWaste} mm ({cuttingResult.wastePercent}%)
              </span>
            </div>
            <p className="hint hint-compact">
              {cuttingResult.byProfile.reduce(
                (n, p) => n + p.result.bars.reduce((m, b) => m + b.cuts.length, 0),
                0,
              )}{' '}
              members · {cuttingResult.totalBars} bar
              {cuttingResult.totalBars === 1 ? '' : 's'} · {cuttingResult.totalCutLength} mm cut
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
