import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

/**
 * Defaults to a locally built preview. Set E2E_BASE_URL to point the same
 * suite at a deployed environment instead — the post-deploy smoke check:
 *
 *     E2E_BASE_URL=https://therostory.com npx playwright test
 *
 * The local web server is skipped entirely in that mode, so nothing is built
 * and nothing is served; the tests talk only to the deployment.
 */
const EXTERNAL = process.env.E2E_BASE_URL;
const BASE_URL = EXTERNAL ?? `http://127.0.0.1:${PORT}`;

/**
 * Runs against the real production build, not the dev server.
 *
 * The two differ in ways that matter to what these tests check: the dev
 * server does not minify, does not apply the manualChunks split, and skips
 * the service worker entirely. An accessibility or layout problem introduced
 * by the build itself would be invisible against `vite dev`.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  outputDir: './e2e/.results',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],

  webServer: EXTERNAL ? undefined : {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    // A cold production build on this project is roughly a minute.
    timeout: 240_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
