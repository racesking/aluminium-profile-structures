import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end smoke tests: drive the real production build through the money
 * paths (cut list, drawing, project round-trip). Run with `npm run test:e2e`,
 * which builds first; CI builds once and runs `playwright test` directly.
 *
 * The production build uses the GitHub Pages base path, so preview serves it
 * under that path too.
 */
const BASE_PATH = '/aluminium-profile-structures/';
const PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}${BASE_PATH}`,
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort --base ${BASE_PATH}`,
    url: `http://localhost:${PORT}${BASE_PATH}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
