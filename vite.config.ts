import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { releaseName } from './src/core/telemetry'

// GitHub Pages serves this project at /aluminium-profile-structures/. The base
// path is only needed for the production build; dev and preview tooling stay at /.
const REPO_BASE = '/aluminium-profile-structures/'

// Release identity baked into the bundle: semver from package.json plus the
// short commit hash, so users and error reports can name the exact build.
const APP_VERSION: string = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
).version
function gitCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'dev'
  }
}

// Source maps exist ONLY to be uploaded to Sentry, then deleted from dist so
// they are never deployed publicly. Without the token (CI, forks, local builds)
// no maps are generated at all.
const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN
const uploadSourceMaps = Boolean(
  SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT,
)

const COMMIT = gitCommit()

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? REPO_BASE : '/',
  plugins: [
    react(),
    uploadSourceMaps &&
      sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: SENTRY_AUTH_TOKEN,
        // Must equal the SDK's release (src/sentry.ts) or stacks stay minified.
        release: { name: releaseName(APP_VERSION, COMMIT) },
        sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
        telemetry: false,
      }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __APP_COMMIT__: JSON.stringify(COMMIT),
  },
  server: {
    port: 5173,
    strictPort: false,
    open: true,
  },
  build: {
    // three.js is intentionally a large, lazily-loaded vendor chunk.
    chunkSizeWarningLimit: 800,
    sourcemap: uploadSourceMaps ? 'hidden' : false,
  },
  test: {
    // Core logic is framework-free, so the fast Node environment is enough.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}))
