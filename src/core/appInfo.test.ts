import { describe, expect, it } from 'vitest';
import { APP_VERSION, versionLabel } from './appInfo';
import pkg from '../../package.json';

describe('appInfo', () => {
  it('injects the package.json version at build time', () => {
    expect(APP_VERSION).toBe(pkg.version);
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+(-[\w.]+)?$/); // semver
  });

  it('formats a version label with the commit', () => {
    expect(versionLabel('1.2.3', 'abc1234')).toBe('1.2.3 (abc1234)');
    expect(versionLabel('1.2.3', '')).toBe('1.2.3');
  });
});
