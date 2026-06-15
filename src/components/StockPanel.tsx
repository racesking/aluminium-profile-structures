import { useStructureStore } from '../store/structureStore';

export function StockPanel() {
  const profile = useStructureStore((s) => s.profile);
  const stock = useStructureStore((s) => s.stock);
  const kerf = useStructureStore((s) => s.kerf);
  const cuttingResult = useStructureStore((s) => s.cuttingResult);
  const setProfile = useStructureStore((s) => s.setProfile);
  const setSectionSizeMm = useStructureStore((s) => s.setSectionSizeMm);
  const sectionSize =
    profile.sectionSizeMm ??
    (parseFloat(profile.sectionLabel?.match(/\d+/)?.[0] ?? '20') || 20);
  const setKerf = useStructureStore((s) => s.setKerf);
  const addStockRow = useStructureStore((s) => s.addStockRow);
  const updateStock = useStructureStore((s) => s.updateStock);
  const removeStock = useStructureStore((s) => s.removeStock);
  const optimize = useStructureStore((s) => s.optimize);

  const totalCuts = useStructureStore((s) =>
    s.edges.reduce((sum, e) => sum + s.getEdgeLength(e.id), 0),
  );

  return (
    <aside className="panel right">
      <div className="panel-header">Profile &amp; Stock</div>
      <div className="panel-body">
        <div className="section">
          <p className="section-title">Profile</p>
          <div className="field">
            <label>Name</label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile(e.target.value, profile.sectionLabel)}
            />
          </div>
          <div className="field">
            <label>Section label</label>
            <input
              type="text"
              value={profile.sectionLabel ?? ''}
              onChange={(e) => setProfile(profile.name, e.target.value)}
            />
          </div>
          <div className="field">
            <label>Size (mm)</label>
            <input
              type="number"
              min={1}
              max={10000}
              step={1}
              value={sectionSize}
              onChange={(e) => setSectionSizeMm(parseFloat(e.target.value) || 20)}
              title="Cross-section — member thickness in 3D"
            />
          </div>
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
        </div>

        <div className="section">
          <p className="section-title">Cut summary</p>
          <div className="stat-card">
            <strong>Total length</strong>
            <span>{Math.round(totalCuts * 10) / 10} mm</span>
          </div>
        </div>

        <div className="section">
          <p className="section-title">Available stock</p>
          {stock.map((bar) => (
            <div key={bar.id} className="stock-row">
              <input
                type="number"
                min={1}
                value={bar.length}
                onChange={(e) =>
                  updateStock(
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
                    bar.id,
                    bar.length,
                    parseInt(e.target.value, 10) || 0,
                  )
                }
              />
              <button
                type="button"
                onClick={() => removeStock(bar.id)}
                disabled={stock.length <= 1}
                title="Remove"
              >
                ×
              </button>
            </div>
          ))}
          <button type="button" onClick={addStockRow} style={{ marginTop: 6 }}>
            + Row
          </button>
          <button
            type="button"
            className="primary"
            style={{ width: '100%', marginTop: 12 }}
            onClick={optimize}
            disabled={stock.every((s) => s.quantity === 0)}
          >
            Optimize cuts
          </button>
        </div>

        {cuttingResult && (
          <div className="section">
            <p className="section-title">Cut plan</p>
            {cuttingResult.bars.map((bar) => (
              <div key={bar.barIndex} className="cut-bar">
                <div>
                  <strong>Bar {bar.barIndex}</strong> · {bar.stockLength} mm
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
            <div className="stat-card" style={{ marginTop: 8 }}>
              <strong>Waste total</strong>
              <span>
                {cuttingResult.totalWaste} mm ({cuttingResult.wastePercent}%)
              </span>
            </div>
            {cuttingResult.unplaced.length > 0 ? (
              <div className="shortage">
                Need {cuttingResult.shortageMm} mm more.
                {cuttingResult.suggestedBars && (
                  <>
                    <br />
                    Buy {cuttingResult.suggestedBars.quantity}×{' '}
                    {cuttingResult.suggestedBars.length} mm
                  </>
                )}
              </div>
            ) : (
              <div className="ok">All cuts fit stock.</div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
