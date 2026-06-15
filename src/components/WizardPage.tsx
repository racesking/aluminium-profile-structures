import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import '../styles/wizard.css';

function ExpressArt() {
  return (
    <svg width="210" height="110" viewBox="0 0 210 110" fill="none">
      {/* iso box frame */}
      <g strokeWidth="2.5" strokeLinecap="round">
        {/* hidden edges */}
        <g stroke="#c9c9c9" strokeDasharray="3 4" strokeWidth="1.5">
          <path d="M78 64 L30 76 M78 64 L106 76 M78 26 L78 64" />
        </g>
        {/* bottom */}
        <g stroke="#5b8c5a">
          <path d="M30 76 L58 88 L106 76" />
        </g>
        {/* posts */}
        <g stroke="#3b6ea5">
          <path d="M30 38 L30 76 M58 50 L58 88 M106 38 L106 76" />
        </g>
        {/* top */}
        <g stroke="#c0793b">
          <path d="M30 38 L78 26 L106 38 L58 50 Z" />
        </g>
      </g>
      {/* sliders */}
      <g>
        {[
          { y: 34, fill: 0.72 },
          { y: 56, fill: 0.45 },
          { y: 78, fill: 0.6 },
        ].map((s, i) => (
          <g key={i}>
            <line x1="136" y1={s.y} x2="196" y2={s.y} stroke="#d4d4d4" strokeWidth="4" strokeLinecap="round" />
            <line x1="136" y1={s.y} x2={136 + 60 * s.fill} y2={s.y} stroke="#0a0a0a" strokeWidth="4" strokeLinecap="round" />
            <circle cx={136 + 60 * s.fill} cy={s.y} r="6" fill="#ffffff" stroke="#0a0a0a" strokeWidth="2" />
          </g>
        ))}
      </g>
    </svg>
  );
}

function AdvancedArt() {
  const nodes: [number, number][] = [
    [38, 78],
    [88, 26],
    [138, 68],
    [182, 34],
  ];
  return (
    <svg width="210" height="110" viewBox="0 0 210 110" fill="none">
      <g stroke="#e0e0e0" strokeWidth="1">
        {Array.from({ length: 7 }, (_, i) => (
          <line key={`v${i}`} x1={14 + i * 30} y1="10" x2={14 + i * 30} y2="100" />
        ))}
        {Array.from({ length: 4 }, (_, i) => (
          <line key={`h${i}`} x1="14" y1={16 + i * 26} x2="194" y2={16 + i * 26} />
        ))}
      </g>
      <g stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round">
        <path d="M38 78 L88 26 L138 68 L182 34 M38 78 L138 68" />
      </g>
      <line x1="88" y1="14" x2="182" y2="22" stroke="#9a9a9a" strokeWidth="1" strokeDasharray="4 3" />
      <rect x="118" y="6" width="38" height="14" rx="2" fill="#ffffff" stroke="#c8c8c8" />
      <text x="137" y="16.5" textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="#0a0a0a">
        1240
      </text>
      {nodes.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r="6"
          fill={i === 2 ? '#0a0a0a' : '#ffffff'}
          stroke="#0a0a0a"
          strokeWidth="2"
        />
      ))}
    </svg>
  );
}

export function WizardPage() {
  const setView = useAppStore((s) => s.setView);
  const [busy, setBusy] = useState(false);

  const handleOpen = async () => {
    setBusy(true);
    try {
      // Lazy-loaded so the wizard's initial bundle stays free of the stores,
      // core logic and zod (they arrive only when a project is opened).
      const { openProjectAndRoute } = await import('../store/projectIO');
      const res = await openProjectAndRoute();
      if (res.status === 'error') alert(res.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wizard">
      <button
        type="button"
        className="wizard-settings"
        onClick={() => setView('settings')}
        title="Settings"
      >
        ⚙ Settings
      </button>
      <div className="wizard-inner">
        <div className="wizard-brand">Profile Builder · Aluminium Structures</div>
        <h1>What are you building today?</h1>
        <p className="wizard-sub">
          Choose how you want to work — you can switch at any time.
        </p>

        <div className="wizard-cards">
          <button
            type="button"
            className="wizard-card express"
            onClick={() => setView('express')}
          >
            <span className="wizard-badge">Quick start</span>
            <span className="wizard-art">
              <ExpressArt />
            </span>
            <h2>Express Builder</h2>
            <p className="wizard-card-desc">
              Pick a template and shape it with sliders. The 3D preview, cut
              optimization and bill of materials update live as you drag.
            </p>
            <ul className="wizard-features">
              <li>Box frame, table &amp; shelving rack templates</li>
              <li>Sliders plus exact dimension inputs</li>
              <li>Optimized cut plan with visual bar diagrams</li>
              <li>Hand off to the Advanced builder anytime</li>
            </ul>
            <span className="wizard-cta">
              Start building <span className="arrow">→</span>
            </span>
          </button>

          <button
            type="button"
            className="wizard-card advanced"
            onClick={() => setView('advanced')}
          >
            <span className="wizard-badge">Full control</span>
            <span className="wizard-art">
              <AdvancedArt />
            </span>
            <h2>Advanced Builder</h2>
            <p className="wizard-card-desc">
              Free 3D editor for custom geometry. Place nodes, connect members,
              set exact lengths, constrain and duplicate — every joint is yours.
            </p>
            <ul className="wizard-features">
              <li>Node-by-node modeling on work planes</li>
              <li>Parallel / perpendicular constraints</li>
              <li>Duplicate, copy-paste, undo history</li>
              <li>Same stock optimizer and cut-list export</li>
            </ul>
            <span className="wizard-cta">
              Open editor <span className="arrow">→</span>
            </span>
          </button>
        </div>

        <div className="wizard-open">
          <span>Already have a project?</span>
          <button
            type="button"
            className="wizard-open-btn"
            onClick={handleOpen}
            disabled={busy}
          >
            Open a saved project
          </button>
        </div>

        <p className="wizard-foot">
          Express structures convert to Advanced projects with one click.
          <br />
          Everything runs locally — projects save as files on your computer.
        </p>
      </div>
    </div>
  );
}
