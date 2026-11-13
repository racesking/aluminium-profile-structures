/**
 * Release identity of this build. Values are injected by Vite at build time;
 * shown in Settings and (from T4) attached to error reports as the release.
 */
export const APP_VERSION: string = __APP_VERSION__;
export const APP_COMMIT: string = __APP_COMMIT__;

/** "0.9.0 (abc1234)" — the string users quote when reporting a problem. */
export function versionLabel(version = APP_VERSION, commit = APP_COMMIT): string {
  return commit ? `${version} (${commit})` : version;
}
