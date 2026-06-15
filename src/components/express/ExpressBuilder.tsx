import { useMemo, useState, type CSSProperties } from 'react';
import { v4 as uuid } from 'uuid';
import { useAppStore } from '../../store/appStore';
import { useExpressStore } from '../../store/expressStore';
import { useStructureStore } from '../../store/structureStore';
import { useLayoutStore } from '../../store/layoutStore';
import { openProjectAndRoute, saveExpressProject } from '../../store/projectIO';
import { PanelResizer } from '../PanelResizer';
import {
  TEMPLATES,
  assignRoleColors,
  continuousRolesFor,
  getTemplate,
  membersToStructure,
} from '../../core/templates';
import { JOINTS, applyJointToMembers, getJoint } from '../../core/joints';
import { solveCuttingStock } from '../../core/cuttingStock';
import type { CutPiece, StockBar } from '../../core/types';
import { ParamSlider } from './ParamSlider';
import { ExpressScene } from './ExpressScene';
import { ExpressBOM } from './ExpressBOM';
import { TemplateMoreMenu } from './TemplateMoreMenu';

const featuredTemplates = TEMPLATES.filter((t) => t.featured);
const otherTemplates = TEMPLATES.filter((t) => !t.featured);
import '../../styles/express.css';

export function ExpressBuilder() {
  const setView = useAppStore((s) => s.setView);

  const templateId = useExpressStore((s) => s.templateId);
  const paramsByTemplate = useExpressStore((s) => s.paramsByTemplate);
  const stockMode = useExpressStore((s) => s.stockMode);
  const buyLength = useExpressStore((s) => s.buyLength);
  const inventory = useExpressStore((s) => s.inventory);
  const kerf = useExpressStore((s) => s.kerf);
  const profileName = useExpressStore((s) => s.profileName);
  const sectionSizeMm = useExpressStore((s) => s.sectionSizeMm);
  const jointId = useExpressStore((s) => s.jointId);
  const throughIndex = useExpressStore((s) => s.throughIndex);

  const setTemplate = useExpressStore((s) => s.setTemplate);
  const setParam = useExpressStore((s) => s.setParam);
  const resetParams = useExpressStore((s) => s.resetParams);
  const setStockMode = useExpressStore((s) => s.setStockMode);
  const setBuyLength = useExpressStore((s) => s.setBuyLength);
  const addInventoryRow = useExpressStore((s) => s.addInventoryRow);
  const updateInventory = useExpressStore((s) => s.updateInventory);
  const removeInventory = useExpressStore((s) => s.removeInventory);
  const setKerf = useExpressStore((s) => s.setKerf);
  const setProfileName = useExpressStore((s) => s.setProfileName);
  const setSectionSizeMm = useExpressStore((s) => s.setSectionSizeMm);
  const setJoint = useExpressStore((s) => s.setJoint);
  const setThroughIndex = useExpressStore((s) => s.setThroughIndex);

  const importStructure = useStructureStore((s) => s.importStructure);

  const leftWidth = useLayoutStore((s) => s.leftWidth);
  const rightWidth = useLayoutStore((s) => s.rightWidth);

  const [busy, setBusy] = useState(false);

  const template = getTemplate(templateId);
  const params = paramsByTemplate[templateId];

  // Centerline members drive the 3D preview and the Advanced hand-off (so the
  // structure stays connected); joint compensation only changes cut lengths.
  const members = useMemo(
    () => template.generate(params),
    [template, params],
  );
  const roleColors = useMemo(() => assignRoleColors(members), [members]);

  const joint = getJoint(jointId);
  // Continuity only matters for joints that have a through-member (blind).
  const effectiveThrough = joint.respectContinuity ? throughIndex : 0;
  const continuousRoles = continuousRolesFor(template, effectiveThrough);

  const cutMembers = useMemo(
    () => applyJointToMembers(members, jointId, sectionSizeMm, continuousRoles),
    [members, jointId, sectionSizeMm, continuousRoles],
  );

  const pieces: CutPiece[] = useMemo(
    () =>
      cutMembers.map((m) => ({ edgeId: m.id, length: m.length, label: m.role })),
    [cutMembers],
  );

  // In buy mode stock is effectively unlimited: one bar per piece is the
  // worst case, the optimizer consolidates onto as few bars as possible.
  const stock: StockBar[] = useMemo(
    () =>
      stockMode === 'buy'
        ? [{ id: 'buy', length: buyLength, quantity: Math.max(1, pieces.length) }]
        : inventory,
    [stockMode, buyLength, inventory, pieces.length],
  );

  const result = useMemo(
    () => solveCuttingStock(pieces, stock, kerf),
    [pieces, stock, kerf],
  );

  const handleEditInAdvanced = () => {
    const { nodes, edges } = membersToStructure(members);
    const handoffStock: StockBar[] =
      stockMode === 'buy'
        ? [
            {
              id: uuid(),
              length: buyLength,
              quantity: Math.max(result.bars.length, 1),
            },
          ]
        : inventory;
    importStructure({
      nodes,
      edges,
      stock: handoffStock,
      kerf,
      profile: {
        name: profileName,
        sectionLabel: `${profileName} mm`,
        sectionSizeMm,
      },
    });
    setView('advanced');
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      await saveExpressProject(template.id);
    } finally {
      setBusy(false);
    }
  };

  const handleOpen = async () => {
    setBusy(true);
    try {
      const res = await openProjectAndRoute();
      if (res.status === 'error') alert(res.message);
    } finally {
      setBusy(false);
    }
  };

  const DIM_KEYS = ['width', 'depth', 'height', 'length'];
  const dims = `${template.params
    .filter((d) => d.kind === 'length' && DIM_KEYS.includes(d.key))
    .map((d) => params[d.key])
    .join(' × ')} mm`;

  return (
    <div
      className="app express-app"
      style={
        {
          '--panel-w': `${leftWidth}px`,
          '--panel-w-right': `${rightWidth}px`,
        } as CSSProperties
      }
    >
      <header className="toolbar">
        <div className="toolbar-row">
          <button
            type="button"
            onClick={() => setView('wizard')}
            title="Back to start"
          >
            ‹ Start
          </button>
          <h1 className="toolbar-brand">Express Builder</h1>
          <div className="toolbar-spacer" />
          <div className="toolbar-group">
            <button
              type="button"
              onClick={handleSave}
              disabled={busy}
              title="Save this design to a file on your computer"
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleOpen}
              disabled={busy}
              title="Open a project file from your computer"
            >
              Open
            </button>
          </div>
          <span className="toolbar-sep" />
          <button
            type="button"
            className="primary"
            onClick={handleEditInAdvanced}
            disabled={members.length === 0}
            title="Convert to a free-edit project in the Advanced builder"
          >
            Edit in Advanced ↗
          </button>
        </div>
      </header>

      <div className="main">
        <div className="main-layout-anchor" aria-hidden />

        <aside className="panel">
          <div className="panel-header">Template &amp; Dimensions</div>
          <div className="panel-body">
            <div className="section">
              <p className="section-title">Template</p>
              {featuredTemplates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`tpl-option ${t.id === templateId ? 'active' : ''}`}
                  onClick={() => setTemplate(t.id)}
                >
                  <strong>{t.name}</strong>
                  <span>{t.tagline}</span>
                </button>
              ))}
              <TemplateMoreMenu
                templates={otherTemplates}
                activeId={templateId}
                onSelect={setTemplate}
              />
            </div>

            <div className="section">
              <p className="section-title">Dimensions</p>
              {template.params
                .filter((def) => !def.visibleIf || def.visibleIf(params))
                .map((def) => (
                  <ParamSlider
                    key={def.key}
                    def={def}
                    value={params[def.key] ?? def.defaultValue}
                    onChange={(v) => setParam(def.key, v)}
                  />
                ))}
              <button
                type="button"
                className="link-btn"
                style={{ marginTop: 12 }}
                onClick={resetParams}
              >
                Reset to defaults
              </button>
            </div>
          </div>
        </aside>

        <div className="viewport-wrap">
          <div className="viewport-canvas">
            <ExpressScene
              members={members}
              roleColors={roleColors}
              sectionSizeMm={sectionSizeMm}
            />
          </div>
          <div className="mode-badge">
            {template.name} · <span className="express-badge-dims">{dims}</span>
          </div>
        </div>

        <aside className="panel right">
          <div className="panel-header">Stock &amp; Bill of Materials</div>
          <div className="panel-body">
            <div className="section">
              <p className="section-title">Profile &amp; saw</p>
              <div className="field-row">
                <div className="field">
                  <label>Profile</label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Size (mm)</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={sectionSizeMm}
                    onChange={(e) =>
                      setSectionSizeMm(parseFloat(e.target.value) || 40)
                    }
                    title="Cross-section — member thickness in 3D"
                  />
                </div>
                <div className="field">
                  <label>Kerf (mm)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={kerf}
                    onChange={(e) => setKerf(parseFloat(e.target.value) || 0)}
                    title="Material lost per saw cut"
                  />
                </div>
              </div>
            </div>

            <div className="section">
              <p className="section-title">Joint type</p>
              <div className="field">
                <select
                  value={jointId}
                  onChange={(e) => setJoint(e.target.value)}
                  aria-label="Joint type"
                >
                  {JOINTS.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.name}
                    </option>
                  ))}
                </select>
              </div>
              <p className="hint hint-compact">{joint.short}</p>

              {template.continuity.length > 1 && (
                <div
                  className="through-toggle"
                  style={{
                    opacity: joint.respectContinuity ? 1 : 0.5,
                    pointerEvents: joint.respectContinuity ? 'auto' : 'none',
                  }}
                >
                  <label>Through member</label>
                  <div className="seg-toggle">
                    {template.continuity.map((opt, i) => (
                      <button
                        key={opt.label}
                        type="button"
                        className={effectiveThrough === i ? 'active' : ''}
                        onClick={() => setThroughIndex(i)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="hint hint-compact">
                    {joint.respectContinuity
                      ? `${template.continuity[effectiveThrough].label} run full length; the rest butt and are shortened.`
                      : 'Only the blind joint keeps a member running through.'}
                  </p>
                </div>
              )}
            </div>

            <div className="section">
              <p className="section-title">Stock</p>
              <div className="seg-toggle">
                <button
                  type="button"
                  className={stockMode === 'buy' ? 'active' : ''}
                  onClick={() => setStockMode('buy')}
                >
                  Buy new bars
                </button>
                <button
                  type="button"
                  className={stockMode === 'inventory' ? 'active' : ''}
                  onClick={() => setStockMode('inventory')}
                >
                  My inventory
                </button>
              </div>

              {stockMode === 'buy' ? (
                <>
                  <div className="field">
                    <label>Bar length (mm)</label>
                    <input
                      type="number"
                      min={100}
                      max={20000}
                      step={100}
                      value={buyLength}
                      onChange={(e) =>
                        setBuyLength(parseFloat(e.target.value) || 6000)
                      }
                    />
                  </div>
                  <p className="hint hint-compact">
                    Unlimited supply — the optimizer uses as few bars as
                    possible.
                  </p>
                </>
              ) : (
                <>
                  {inventory.map((bar) => (
                    <div key={bar.id} className="stock-row">
                      <input
                        type="number"
                        min={1}
                        value={bar.length}
                        onChange={(e) =>
                          updateInventory(
                            bar.id,
                            parseFloat(e.target.value) || 1,
                            bar.quantity,
                          )
                        }
                        title="Length mm"
                      />
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
                        ×
                      </span>
                      <input
                        className="qty"
                        type="number"
                        min={0}
                        value={bar.quantity}
                        onChange={(e) =>
                          updateInventory(
                            bar.id,
                            bar.length,
                            parseInt(e.target.value, 10) || 0,
                          )
                        }
                        title="Quantity"
                      />
                      <button
                        type="button"
                        onClick={() => removeInventory(bar.id)}
                        disabled={inventory.length <= 1}
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addInventoryRow}
                    style={{ marginTop: 6 }}
                  >
                    + Add bars
                  </button>
                  <p className="hint hint-compact">
                    Enter the bars and offcuts you already have — shortest
                    usable pieces are consumed first.
                  </p>
                </>
              )}
            </div>

            <ExpressBOM
              members={cutMembers}
              result={result}
              roleColors={roleColors}
              stockMode={stockMode}
              buyLength={buyLength}
            />
          </div>
        </aside>

        <PanelResizer side="left" />
        <PanelResizer side="right" />
      </div>
    </div>
  );
}
