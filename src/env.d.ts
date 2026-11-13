/** Semver from package.json, injected at build time (vite.config.ts `define`). */
declare const __APP_VERSION__: string;
/** Short git commit hash of the build, or "dev" when git is unavailable. */
declare const __APP_COMMIT__: string;
