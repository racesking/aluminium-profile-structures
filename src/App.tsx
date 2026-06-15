import { lazy, Suspense, type CSSProperties } from 'react';
import { WizardPage } from './components/WizardPage';
import { useAppStore } from './store/appStore';

// The 3D builders pull in three.js/react-three-fiber (~1 MB). Lazy-loading them
// keeps the wizard's initial bundle tiny — three.js only loads once a builder opens.
const ExpressBuilder = lazy(() =>
  import('./components/express/ExpressBuilder').then((m) => ({ default: m.ExpressBuilder })),
);
const AdvancedBuilder = lazy(() =>
  import('./components/AdvancedBuilder').then((m) => ({ default: m.AdvancedBuilder })),
);

const loadingStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  minHeight: '100vh',
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 12,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#5c5c5c',
  background: '#ececec',
};

function LoadingScreen() {
  return (
    <div style={loadingStyle} role="status" aria-live="polite">
      Loading builder…
    </div>
  );
}

export default function App() {
  const view = useAppStore((s) => s.view);

  if (view === 'wizard') return <WizardPage />;

  return (
    <Suspense fallback={<LoadingScreen />}>
      {view === 'express' ? <ExpressBuilder /> : <AdvancedBuilder />}
    </Suspense>
  );
}
