import { defineConfig, devices } from '@playwright/test';

const LOCAL_URL = 'http://127.0.0.1:3001';
const baseURL = process.env.E2E_BASE_URL?.trim() || LOCAL_URL;

/** Loopback only. Anything else is a deployed environment we must not try to serve. */
const isLocalTarget = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(baseURL);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ...(process.env.CI ? [{ name: 'firefox', use: { ...devices['Desktop Firefox'] } }] : []),
  ],
  // Only build and serve locally when the target IS local. Pointed at a deployed
  // environment, starting a dev server is worse than pointless: Playwright would
  // wait for a server nothing under test talks to, and a spec that silently ran
  // against localhost while reporting a remote run is exactly the false green
  // this file exists to prevent.
  ...(isLocalTarget
    ? {
        webServer: {
          command: process.env.E2E_WEB_SERVER_COMMAND ?? 'pnpm exec next dev -p 3001 -H 127.0.0.1',
          port: 3001,
          reuseExistingServer: !process.env.CI,
          timeout: 120 * 1000,
        },
      }
    : {}),
});
