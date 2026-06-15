import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// GitHub Pages serves this project at /aluminium-profile-structures/. The base
// path is only needed for the production build; dev and preview tooling stay at /.
const REPO_BASE = '/aluminium-profile-structures/'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? REPO_BASE : '/',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    open: true,
  },
  build: {
    // three.js is intentionally a large, lazily-loaded vendor chunk.
    chunkSizeWarningLimit: 800,
  },
  test: {
    // Core logic is framework-free, so the fast Node environment is enough.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}))
