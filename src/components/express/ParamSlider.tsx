import type { TemplateParamDef } from '../../core/templates';
import { useSettingsStore } from '../../store/settingsStore';
import { toDisplay, fromDisplay, unitInputStep } from '../../core/units';

type Props = {
  def: TemplateParamDef;
  value: number;
  onChange: (value: number) => void;
};

/**
 * Slider with an exact numeric input. Values are stored in mm; for length
 * params the number + label are shown in the user's display unit, while the
 * slider track keeps operating in mm.
 */
export function ParamSlider({ def, value, onChange }: Props) {
  const units = useSettingsStore((s) => s.units);

  if (def.kind === 'toggle') {
    const on = value === 1;
    return (
      <div className="param param-toggle">
        <label>{def.label}</label>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          className={`switch ${on ? 'on' : ''}`}
          onClick={() => onChange(on ? 0 : 1)}
        />
      </div>
    );
  }

  const isLength = def.kind === 'length';

  const clampMm = (mm: number) =>
    isLength
      ? Math.max(10, Math.min(20000, mm))
      : Math.max(def.min, Math.min(def.max, Math.round(mm)));

  const sliderValue = Math.max(def.min, Math.min(def.max, value));

  // The numeric field shows display units for lengths, raw value otherwise.
  const fieldValue = isLength ? toDisplay(value, units) : value;
  const onFieldChange = (raw: number) => {
    const mm = isLength ? fromDisplay(raw, units) : raw;
    onChange(clampMm(mm));
  };

  return (
    <div className="param">
      <div className="param-head">
        <label>{def.label}</label>
        <span className="param-value">
          <input
            type="number"
            min={0}
            step={isLength ? unitInputStep(units) : def.kind === 'count' ? 1 : def.step}
            value={fieldValue}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (Number.isFinite(v)) onFieldChange(v);
            }}
          />
          {isLength && <span className="unit">{units}</span>}
        </span>
      </div>
      <input
        type="range"
        min={def.min}
        max={def.max}
        step={def.step}
        value={sliderValue}
        onChange={(e) => onChange(clampMm(parseFloat(e.target.value)))}
        aria-label={def.label}
      />
    </div>
  );
}
