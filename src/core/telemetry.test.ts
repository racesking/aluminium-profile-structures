import { describe, expect, it } from 'vitest';
import {
  FILTERED,
  MAX_STRING,
  looksLikeJson,
  releaseName,
  scrubBreadcrumb,
  scrubEvent,
  scrubString,
  scrubUrl,
  shouldReport,
  type ScrubbableEvent,
} from './telemetry';

const PROJECT_JSON = JSON.stringify({
  app: 'profile-builder',
  payload: { nodes: [{ id: 'a', position: [0, 0, 0] }], edges: [] },
});

describe('looksLikeJson / scrubString', () => {
  it('filters JSON objects and arrays of objects', () => {
    expect(looksLikeJson(PROJECT_JSON)).toBe(true);
    expect(scrubString(PROJECT_JSON)).toBe(FILTERED);
    expect(scrubString('[{"id":"a"},{"id":"b"},{"id":"c"},{"id":"d"}]')).toBe(FILTERED);
  });

  it('cuts JSON embedded in a longer message', () => {
    expect(scrubString(`Bad file: ${PROJECT_JSON}`)).toBe(`Bad file: ${FILTERED}`);
  });

  it('keeps ordinary error messages', () => {
    const msg = "Cannot read properties of undefined (reading 'position')";
    expect(scrubString(msg)).toBe(msg);
    expect(scrubString('[object Object]')).toBe('[object Object]');
  });

  it('truncates long strings', () => {
    const out = scrubString('x'.repeat(MAX_STRING + 100));
    expect(out.length).toBe(MAX_STRING + 1);
  });
});

describe('scrubEvent', () => {
  it('removes user, extra, request body/cookies and filters JSON everywhere', () => {
    const event: ScrubbableEvent = {
      message: PROJECT_JSON,
      user: { ip_address: '1.2.3.4' },
      extra: { file: PROJECT_JSON },
      request: {
        url: 'https://example.com/app/?token=secret#advanced',
        data: PROJECT_JSON,
        cookies: { a: 'b' },
        headers: { 'User-Agent': 'UA', Referer: 'https://elsewhere/?q=1' },
      },
      exception: { values: [{ value: `Bad file: ${PROJECT_JSON}` }, { value: PROJECT_JSON }] },
      contexts: { react: { componentStack: 'at App' }, deep: { a: { b: { c: { d: { e: 1 } } } } } },
      breadcrumbs: [
        { category: 'console', message: PROJECT_JSON },
        { category: 'ui.click', message: 'button.primary' },
        { category: 'navigation', data: { to: PROJECT_JSON } },
      ],
    };
    const out = scrubEvent(event);
    expect(out.user).toBeUndefined();
    expect(out.extra).toBeUndefined();
    expect(out.request?.data).toBeUndefined();
    expect(out.request?.cookies).toBeUndefined();
    expect(out.request?.headers).toEqual({ 'User-Agent': 'UA' });
    expect(out.request?.url).toBe('https://example.com/app/#advanced');
    expect(out.message).toBe(FILTERED);
    expect(out.exception?.values?.[1].value).toBe(FILTERED);
    expect((out.contexts?.react as { componentStack: string }).componentStack).toBe('at App');
    expect(JSON.stringify(out.contexts)).toContain(FILTERED); // depth cap
    expect(out.breadcrumbs).toHaveLength(2);
    expect(out.breadcrumbs?.some((b) => b.category === 'console')).toBe(false);
    expect((out.breadcrumbs?.[1].data as { to: string }).to).toBe(FILTERED);
    // Nothing that identifies the project survives anywhere.
    expect(JSON.stringify(out)).not.toContain('profile-builder');
    expect(JSON.stringify(out)).not.toContain('1.2.3.4');
  });

  it('drops console breadcrumbs', () => {
    expect(scrubBreadcrumb({ category: 'console', message: 'hi' })).toBeNull();
    expect(scrubBreadcrumb({ category: 'ui.click', message: 'hi' })).toEqual({ category: 'ui.click', message: 'hi' });
  });
});

describe('scrubUrl', () => {
  it('drops the query string, keeps path and hash', () => {
    expect(scrubUrl('https://a.b/x/?q=1#express')).toBe('https://a.b/x/#express');
  });
});

describe('shouldReport', () => {
  const base = { prod: true, dsn: 'https://k@o1.ingest.de.sentry.io/1', hostname: 'racesking.github.io' };
  it('only reports from a production build with a DSN on a real host', () => {
    expect(shouldReport(base)).toBe(true);
    expect(shouldReport({ ...base, prod: false })).toBe(false);
    expect(shouldReport({ ...base, dsn: undefined })).toBe(false);
    expect(shouldReport({ ...base, dsn: '' })).toBe(false);
    expect(shouldReport({ ...base, hostname: 'localhost' })).toBe(false);
    expect(shouldReport({ ...base, hostname: '127.0.0.1' })).toBe(false);
    expect(shouldReport({ ...base, hostname: 'app.localhost' })).toBe(false);
  });
});

describe('releaseName', () => {
  it('combines version and commit', () => {
    expect(releaseName('0.9.0', 'abc1234')).toBe('profile-builder@0.9.0+abc1234');
  });
});
