import { Component, type CSSProperties, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  /** Custom fallback; receives a reset callback and the caught error. */
  fallback?: (reset: () => void, error: Error) => ReactNode;
  /** Hook for an error-reporting service (e.g. Sentry) later on. */
  onError?: (error: Error, info: ErrorInfo) => void;
};

type State = { error: Error | null };

/**
 * Catches render-time errors in its subtree so a crash (e.g. inside the
 * three.js scene) shows a recoverable fallback instead of a blank page.
 * Styling is inline on purpose — the fallback must render even if app CSS broke.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
    console.error('ErrorBoundary caught an error:', error, info);
  }

  reset = (): void => this.setState({ error: null });

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(this.reset, error);
    return <DefaultFallback error={error} onReset={this.reset} />;
  }
}

const wrap: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 14,
  height: '100%',
  minHeight: '100vh',
  padding: 24,
  textAlign: 'center',
  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
  color: '#0a0a0a',
  background: '#ececec',
};

const btn: CSSProperties = {
  cursor: 'pointer',
  border: '1px solid #0a0a0a',
  background: '#0a0a0a',
  color: '#fff',
  padding: '8px 16px',
  borderRadius: 4,
  fontSize: 13,
};

function DefaultFallback({
  error,
  onReset,
}: {
  error: Error;
  onReset: () => void;
}) {
  return (
    <div style={wrap}>
      <h1 style={{ fontSize: 20, margin: 0 }}>Something went wrong</h1>
      <p style={{ color: '#5c5c5c', maxWidth: 420, margin: 0, fontSize: 14 }}>
        The app hit an unexpected error. Your last saved project file is safe —
        reloading usually fixes this.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" style={btn} onClick={() => window.location.reload()}>
          Reload app
        </button>
        <button
          type="button"
          style={{ ...btn, background: '#fff', color: '#0a0a0a' }}
          onClick={onReset}
        >
          Try again
        </button>
      </div>
      <details style={{ maxWidth: 480, fontSize: 12, color: '#5c5c5c' }}>
        <summary style={{ cursor: 'pointer' }}>Error details</summary>
        <pre style={{ whiteSpace: 'pre-wrap', textAlign: 'left', marginTop: 8 }}>
          {error.message}
        </pre>
      </details>
    </div>
  );
}

/** Compact fallback for the 3D viewport — keeps the rest of the UI usable. */
export function CanvasErrorFallback({ onReset }: { onReset: () => void }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        textAlign: 'center',
        padding: 24,
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        color: '#5c5c5c',
        background: '#f4f4f4',
      }}
    >
      <p style={{ margin: 0, fontSize: 14 }}>
        The 3D preview failed to render.
      </p>
      <button type="button" style={btn} onClick={onReset}>
        Reload preview
      </button>
    </div>
  );
}
