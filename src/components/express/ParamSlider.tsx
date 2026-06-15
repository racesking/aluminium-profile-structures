import type { TemplateParamDef } from '../../core/templates';

type Props = {
  def: TemplateParamDef;
  value: number;
  onChange: (value: number) => void;
};

/** Slider with an exact numeric input. The input accepts values beyond the slider range. */
export function ParamSlider({ def, value, onChange }: Props) {
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

  const clampNumeric = (v: number) =>
    def.kind === 'length'
      ? Math.max(10, Math.min(20000, v))
      : Math.max(def.min, Math.min(def.max, Math.round(v)));

  const sliderValue = Math.max(def.min, Math.min(def.max, value));

  return (
    <div className="param">
      <div className="param-head">
        <label>{def.label}</label>
        <span className="param-value">
          <input
            type="number"
            min={def.kind === 'length' ? 10 : def.min}
            max={def.kind === 'length' ? 20000 : def.max}
            step={def.kind === 'count' ? 1 : def.step}
            value={value}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (Number.isFinite(v)) onChange(clampNumeric(v));
            }}
          />
          {def.kind === 'length' && <span className="unit">mm</span>}
        </span>
      </div>
      <input
        type="range"
        min={def.min}
        max={def.max}
        step={def.step}
        value={sliderValue}
        onChange={(e) => onChange(clampNumeric(parseFloat(e.target.value)))}
        aria-label={def.label}
      />
    </div>
  );
}
