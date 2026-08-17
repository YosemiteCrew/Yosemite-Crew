import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 30_000,
  workers: 1,
  fullyParallel: false,
  // `list` for a readable CI log, `html` so a failure can be opened rather than
  // reconstructed from scrollback. Without the html reporter the CI workflow was
  // uploading a playwright-report/ directory that never existed, and
  // `if-no-files-found: ignore` quietly let that pass.
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    // Retained only on failure: a trace per passing spec is large and nobody
    // opens it. These are the artifacts that make an Electron failure on another
    // OS diagnosable at all, which matters here because the suite runs on
    // Windows and macOS runners no one can attach a debugger to.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
