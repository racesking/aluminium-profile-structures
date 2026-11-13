/**
 * Production error reporting (Sentry). Inert unless the build has
 * VITE_SENTRY_DSN and runs on a real host (see core/telemetry `shouldReport`).
 *
 * The SDK is loaded lazily so it never delays the first paint; errors raised
 * before it arrives are queued and sent once it is ready. Privacy rules live in
 * core/telemetry.ts (scrubEvent / scrubBreadcrumb) and are unit-tested there.
 */
import { releaseName, scrubBreadcrumb, scrubEvent, shouldReport } from './core/telemetry';
import { APP_COMMIT, APP_VERSION } from './core/appInfo';

type SentryModule = typeof import('./sentrySdk');
type Pending = { error: unknown; componentStack?: string };

let sentry: SentryModule | null = null;
let enabled = false;
const pending: Pending[] = [];

function send(s: SentryModule, { error, componentStack }: Pending) {
  s.captureException(error, componentStack ? { contexts: { react: { componentStack } } } : undefined);
}

/** Report an error caught by our own code (error boundaries). */
export function reportError(error: unknown, componentStack?: string): void {
  if (!enabled) return;
  if (sentry) send(sentry, { error, componentStack });
  else if (pending.length < 20) pending.push({ error, componentStack });
}

export function initErrorReporting(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!shouldReport({ prod: import.meta.env.PROD, dsn, hostname: window.location.hostname })) return;
  enabled = true;

  // Until the SDK is here, its global handlers aren't either: queue what we see.
  const onError = (e: ErrorEvent) => reportError(e.error ?? e.message);
  const onRejection = (e: PromiseRejectionEvent) => reportError(e.reason);
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);

  void import('./sentrySdk')
    .then((s) => {
      s.init({
        dsn,
        release: releaseName(APP_VERSION, APP_COMMIT),
        environment: 'production',
        // SDK v11's replacement for `sendDefaultPii: false`: no user info
        // (=> infer_ip "never"), cookies, headers, bodies, query or locals.
        dataCollection: {
          userInfo: false,
          cookies: false,
          httpHeaders: false,
          httpBodies: [],
          urlQueryParams: false,
          stackFrameVariables: false,
        },
        // No performance tracing or session replay: errors only.
        tracesSampleRate: 0,
        allowUrls: [window.location.origin],
        beforeSend: (event) => scrubEvent(event),
        beforeBreadcrumb: (crumb) => scrubBreadcrumb(crumb),
      });
      // The SDK's GlobalHandlers own window errors from here on.
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      sentry = s;
      for (const p of pending.splice(0)) send(s, p);

      // Manual end-to-end check from the live site: open the app with ?telemetry-test.
      if (new URLSearchParams(window.location.search).has('telemetry-test')) {
        s.captureException(new Error(`Telemetry test ${releaseName(APP_VERSION, APP_COMMIT)}`));
      }
    })
    .catch(() => {
      // Blocked by an ad blocker or offline: reporting is best-effort.
      enabled = false;
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    });
}
