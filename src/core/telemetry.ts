/**
 * Privacy rules for error reports. Pure and SDK-free so they are unit-tested
 * in Node; `src/sentry.ts` wires them into the Sentry browser SDK.
 *
 * Goal: a report says WHAT broke and WHERE in the code, never what the user
 * was designing. Project payloads, file contents and long free text are
 * removed before an event leaves the browser.
 */

export const FILTERED = '[Filtered]';
/** Longer strings are cut: stack frames and messages don't need more. */
export const MAX_STRING = 500;

/** Anything shaped like a JSON object/array (a project payload, a file) is dropped. */
export function looksLikeJson(s: string): boolean {
  const t = s.trim();
  return (
    (t.startsWith('{') && t.includes(':')) ||
    (t.startsWith('[') && (t.includes('{') || t.includes(',')) && t.length > 40)
  );
}

/** Start of JSON embedded in a longer message, e.g. `Bad file: {"app":…`. */
const EMBEDDED_JSON = /[{[]\s*"[^"]*"\s*:/;

export function scrubString(s: string): string {
  if (looksLikeJson(s)) return FILTERED;
  const m = EMBEDDED_JSON.exec(s);
  if (m) s = `${s.slice(0, m.index)}${FILTERED}`;
  return s.length > MAX_STRING ? `${s.slice(0, MAX_STRING)}…` : s;
}

/** Deep-scrub any value: strings are filtered/truncated, depth is capped. */
export function scrubValue(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return scrubString(value);
  if (value === null || typeof value !== 'object') return value;
  if (depth >= 4) return FILTERED;
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((v) => scrubValue(v, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = scrubValue(v, depth + 1);
  return out;
}

/** The subset of a Sentry event this module touches (structurally typed). */
export type ScrubbableEvent = {
  message?: string;
  user?: unknown;
  extra?: unknown;
  request?: { url?: string; data?: unknown; cookies?: unknown; headers?: Record<string, string> };
  exception?: { values?: { value?: string }[] };
  breadcrumbs?: ScrubbableBreadcrumb[];
  contexts?: Record<string, unknown>;
};

export type ScrubbableBreadcrumb = { category?: string; message?: string; data?: unknown };

/** The page URL without query (could hold tokens later) — the hash is just the view name. */
export function scrubUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}${u.hash}`;
  } catch {
    return scrubString(url);
  }
}

/** Remove personal and project data from an event before it is sent. */
export function scrubEvent<E extends ScrubbableEvent>(event: E): E {
  delete event.user;
  delete event.extra;
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    if (event.request.headers) {
      // Keep only the browser identity, useful for triage.
      const ua = event.request.headers['User-Agent'];
      event.request.headers = ua ? { 'User-Agent': ua } : {};
    }
    if (event.request.url) event.request.url = scrubUrl(event.request.url);
  }
  if (event.message) event.message = scrubString(event.message);
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = scrubString(ex.value);
  }
  if (event.contexts) event.contexts = scrubValue(event.contexts) as Record<string, unknown>;
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs
      .map(scrubBreadcrumb)
      .filter((b): b is ScrubbableBreadcrumb => b !== null);
  }
  return event;
}

/** Console output is the likeliest leak of project data: drop it entirely. */
export function scrubBreadcrumb<B extends ScrubbableBreadcrumb>(crumb: B): B | null {
  if (crumb.category === 'console') return null;
  if (crumb.message) crumb.message = scrubString(crumb.message);
  if (crumb.data !== undefined) crumb.data = scrubValue(crumb.data);
  return crumb;
}

/** Reports are only sent from the real site: not dev, not local E2E runs. */
export function shouldReport(opts: { prod: boolean; dsn: string | undefined; hostname: string }): boolean {
  if (!opts.prod || !opts.dsn) return false;
  const h = opts.hostname;
  return !(h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h.endsWith('.localhost'));
}

/** One release string for the SDK and the source-map upload (they must match). */
export function releaseName(version: string, commit: string): string {
  return `profile-builder@${version}+${commit}`;
}
