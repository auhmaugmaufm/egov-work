import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['part-a.spec.ts', 'part-b.spec.ts'],
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false, workers: 1, retries: 0,
  timeout: 180_000, expect: { timeout: 7_000 },
  reporter: [['list'], ['json', { outputFile: 'test-report/results.json' }], ['html', { outputFolder: 'test-report/html', open: 'never' }]],
  outputDir: 'test-results',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on', video: { mode: 'on', size: { width: 1280, height: 800 } }, screenshot: 'only-on-failure',
    acceptDownloads: true, locale: 'th-TH', timezoneId: 'Asia/Bangkok',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, ...(process.env.CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.CHROMIUM_PATH } } : {}) } }],
});
