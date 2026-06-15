import { useAppStore } from '../store/appStore';
import { useSettingsStore } from '../store/settingsStore';
import { LENGTH_UNITS, toDisplay, fromDisplay, unitInputStep } from '../core/units';
import '../styles/settings.css';

const UNIT_LABELS: Record<string, string> = {
  mm: 'Millimetres',
  cm: 'Centimetres',
  m: 'Metres',
  in: 'Inches',
};

export function SettingsPage() {
  const setView = useAppStore((s) => s.setView);

  const units = useSettingsStore((s) => s.units);
  const defaultKerf = useSettingsStore((s) => s.defaultKerf);
  const defaultBarLength = useSettingsStore((s) => s.defaultBarLength);
  const defaultSectionMm = useSettingsStore((s) => s.defaultSectionMm);
  const setUnits = useSettingsStore((s) => s.setUnits);
  const setDefaultKerf = useSettingsStore((s) => s.setDefaultKerf);
  const setDefaultBarLength = useSettingsStore((s) => s.setDefaultBarLength);
  const setDefaultSectionMm = useSettingsStore((s) => s.setDefaultSectionMm);

  const back = () => {
    if (window.history.length > 1) window.history.back();
    else setView('wizard');
  };

  return (
    <div className="settings">
      <div className="settings-inner">
        <div className="settings-head">
          <button type="button" onClick={back} title="Back">
            ‹ Back
          </button>
          <h1>Settings</h1>
        </div>

        <div className="settings-card">
          <h2>Units</h2>
          <p className="settings-hint">
            Display unit for all lengths. Profiles are always built and stored in
            millimetres internally, so switching units never changes a design.
          </p>
          <div className="unit-seg">
            {LENGTH_UNITS.map((u) => (
              <button
                key={u}
                type="button"
                className={units === u ? 'active' : ''}
                onClick={() => setUnits(u)}
              >
                <strong>{u}</strong>
                <span>{UNIT_LABELS[u]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="settings-card">
          <h2>Defaults for new designs</h2>
          <div className="settings-row">
            <label htmlFor="set-bar">Stock bar length</label>
            <div className="settings-control">
              <input
                id="set-bar"
                type="number"
                min={0}
                step={unitInputStep(units)}
                value={toDisplay(defaultBarLength, units)}
                onChange={(e) =>
                  setDefaultBarLength(fromDisplay(parseFloat(e.target.value) || 0, units))
                }
              />
              <span className="settings-unit">{units}</span>
            </div>
          </div>
          <div className="settings-row">
            <label htmlFor="set-section">Profile section</label>
            <div className="settings-control">
              <input
                id="set-section"
                type="number"
                min={1}
                max={500}
                value={defaultSectionMm}
                onChange={(e) => setDefaultSectionMm(parseFloat(e.target.value) || 40)}
              />
              <span className="settings-unit">mm</span>
            </div>
          </div>
          <div className="settings-row">
            <label htmlFor="set-kerf">Saw kerf</label>
            <div className="settings-control">
              <input
                id="set-kerf"
                type="number"
                min={0}
                step={0.5}
                value={defaultKerf}
                onChange={(e) => setDefaultKerf(parseFloat(e.target.value) || 0)}
              />
              <span className="settings-unit">mm</span>
            </div>
          </div>
          <p className="settings-hint">
            Section and kerf stay in millimetres — extrusions and blade widths are
            quoted that way. These seed new profiles; existing designs are unchanged.
          </p>
        </div>
      </div>
    </div>
  );
}
