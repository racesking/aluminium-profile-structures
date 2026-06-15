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
import {
  solveCuttingStockByProfile,
  type ProfileCutGroup,
} from '../../core/cuttingStock';
import { profileForRole } from '../../core/profiles';
import { bomToCsv, bomToPrintHtml, type BomExportInput } from '../../core/bomExport';
import { formatLengthValue } from '../../core/units';
import { useSettingsStore } from '../../store/settingsStore';
import type { CutPiece } from '../../core/types';
import { ParamSlider } from './ParamSlider';
import { ExpressScene } from './ExpressScene';
import { ExpressBOM } from './ExpressBOM';
import { ProfilesPanel } from './ProfilesPanel';
import { TemplateMoreMenu } from './TemplateMoreMenu';
import { ErrorBoundary, CanvasErrorFallback } from '../ErrorBoundary';
import '../../styles/express.css';

const featuredTemplates = TEMPLATES.filter((t) => t.featured);
const otherTemplates = TEMPLATES.filter((t) => !t.featured);

export function ExpressBuilder() {
  const setView = useAppStore((s) => s.setView);

  const templateId = useExpressStore((s) => s.templateId);
  const paramsByTemplate = useExpressStore((s) => s.paramsByTemplate);
  const kerf = useExpressStore((s) => s.kerf);
  const jointId = useExpressStore((s) => s.jointId);
  const throughIndex = useExpressStore((s) => s.throughIndex);
  const profiles = useExpressStore((s) => s.profiles);
  const roleProfileByTemplate = useExpressStore((s) => s.roleProfileByTemplate);
  const stockMode = useExpressStore((s) => s.stockMode);
  const stockByProfile = useExpressStore((s) => s.stockByProfile);
  const units = useSettingsStore((s) => s.units);

  const setTemplate = useExpressStore((s) => s.setTemplate);
  const setParam = useExpressStore((s) => s.setParam);
  const resetParams = useExpressStore((s) => s.resetParams);
  const setKerf = useExpressStore((s) => s.setKerf);
  const setJoint = useExpressStore((s) => s.setJoint);
  const setThroughIndex = useExpressStore((s) => s.setThroughIndex);

  const importStructure = useStructureStore((s) => s.importStructure);

  const leftWidth = useLayoutStore((s) => s.leftWidth);
  const rightWidth = useLayoutStore((s) => s.rightWidth);

  const [busy, setBusy] = useState(false);

  const template = getTemplate(templateId);
  const params = paramsByTemplate[templateId];
  const roleMap = roleProfileByTemplate[templateId] ?? {};

  // Centerline members drive the 3D preview and the Advanced hand-off (so the
  // structure stays connected); joint compensation only changes cut lengths.
  const members = useMemo(() => template.generate(params), [template, params]);
  const roleColors = useMemo(() => assignRoleColors(members), [members]);
  const roles = useMemo(
    () => [...new Set(members.map((m) => m.role))],
    [members],
  );

  const profileOf = (role: string) => profileForRole(profiles, roleMap, role);
  const sectionOf = (member: { role: string }) => profileOf(member.role).sectionMm;

  const joint = getJoint(jointId);
  // Continuity only matters for joints that have a through-member (blind).
  const effectiveThrough = joint.respectContinuity ? throughIndex : 0;
  const continuousRoles = continuousRolesFor(template, effectiveThrough);

  const cutMembers = useMemo(
    () => applyJointToMembers(members, jointId, sectionOf, continuousRoles),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [members, jointId, continuousRoles, profiles, roleMap],
  );

  // Group cut pieces by profile and give each its own stock — pieces of one
  // section can never be cut from another section's bars.
  const groups: ProfileCutGroup[] = useMemo(() => {
    const piecesByProfile = new Map<string, CutPiece[]>();
    for (const m of cutMembers) {
      const pid = profileOf(m.role).id;
      const arr = piecesByProfile.get(pid) ?? [];
      arr.push({ edgeId: m.id, length: m.length, label: m.role });
      piecesByProfile.set(pid, arr);
    }
    return profiles
      .filter((p) => piecesByProfile.has(p.id))
      .map((p) => {
        const pieces = piecesByProfile.get(p.id)!;
        const st = stockByProfile[p.id];
        const stock =
          stockMode === 'buy'
            ? [{ id: `buy-${p.id}`, length: st.buyLength, quantity: Math.max(1, pieces.length) }]
            : st.inventory;
        return {
          profileId: p.id,
          profileName: p.name,
          sectionMm: p.sectionMm,
          pieces,
          stock,
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cutMembers, profiles, roleMap, stockMode, stockByProfile]);

  const multi = useMemo(
    () => solveCuttingStockByProfile(groups, kerf),
    [groups, kerf],
  );

  // The Advanced builder is single-profile; hand off the most-used profile.
  const dominantProfile = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of members) {
      const pid = profileOf(m.role).id;
      counts.set(pid, (counts.get(pid) ?? 0) + 1);
    }
    let best = profiles[0];
    let bestN = -1;
    for (const p of profiles) {
      const n = counts.get(p.id) ?? 0;
      if (n > bestN) {
        bestN = n;
        best = p;
      }
    }
    return best;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, profiles, roleMap]);

  const handleEditInAdvanced = () => {
    const { nodes, edges } = membersToStructure(members);
    const dpStock = stockByProfile[dominantProfile.id];
    const handoffStock =
      stockMode === 'buy'
        ? [{ id: uuid(), length: dpStock.buyLength, quantity: Math.max(members.length, 1) }]
        : dpStock.inventory.map((b) => ({ ...b }));
    importStructure({
      nodes,
      edges,
      stock: handoffStock,
      kerf,
      profile: {
        name: dominantProfile.name,
        sectionLabel: `${dominantProfile.name} mm`,
        sectionSizeMm: dominantProfile.sectionMm,
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

  const exportInput = (): BomExportInput => ({
    multi,
    cutMembers,
    profileOf,
    units,
    projectName: template.name,
    dateStr: new Date().toLocaleDateString(),
  });

  const handleExportCsv = () => {
    const blob = new Blob([bomToCsv(exportInput())], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.id}-bom.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(bomToPrintHtml(exportInput()));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 200);
  };

  const DIM_KEYS = ['width', 'depth', 'height', 'length'];
  const dims = `${template.params
    .filter((d) => d.kind === 'length' && DIM_KEYS.includes(d.key))
    .map((d) => formatLengthValue(params[d.key], units))
    .join(' × ')} ${units}`;

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
          <button type="button" onClick={() => setView('wizard')} title="Back to start">
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
            <button type="button" onClick={handleExportCsv} title="Export the BOM as CSV">
              CSV
            </button>
            <button type="button" onClick={handlePrint} title="Printable cut sheet (Save as PDF)">
              Print
            </button>
            <button type="button" onClick={() => setView('settings')} title="Settings">
              ⚙
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
            <ErrorBoundary fallback={(reset) => <CanvasErrorFallback onReset={reset} />}>
              <ExpressScene members={members} roleColors={roleColors} sectionOf={sectionOf} />
            </ErrorBoundary>
          </div>
          <div className="mode-badge">
            {template.name} · <span className="express-badge-dims">{dims}</span>
          </div>
        </div>

        <aside className="panel right">
          <div className="panel-header">Profiles, Stock &amp; BOM</div>
          <div className="panel-body">
            <div className="section">
              <p className="section-title">Joint &amp; saw</p>
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

              <div className="field" style={{ marginTop: 12 }}>
                <label>Kerf / blade (mm)</label>
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

            <ProfilesPanel roles={roles} />

            <ExpressBOM
              multi={multi}
              cutMembers={cutMembers}
              profileOf={profileOf}
              roleColors={roleColors}
              stockMode={stockMode}
              buyLengthOf={(pid) => stockByProfile[pid]?.buyLength ?? 6000}
            />
          </div>
        </aside>

        <PanelResizer side="left" />
        <PanelResizer side="right" />
      </div>
    </div>
  );
}
