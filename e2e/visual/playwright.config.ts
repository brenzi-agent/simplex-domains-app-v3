import { join } from 'node:path'

import { defineConfig } from '@playwright/test'

import { APP_URL, RPC_URL } from './chain'

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  snapshotPathTemplate: '{testDir}/screenshots/{testFileName}/{arg}{ext}',
  outputDir: '../../test-results/visual',
  timeout: 240_000,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../../playwright-report/visual' }]],
  expect: {
    timeout: 30_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      threshold: 0.01,
      maxDiffPixels: 0,
      stylePath: join(__dirname, 'screenshot.css'),
    },
  },
  use: {
    baseURL: APP_URL,
    viewport: { width: 1280, height: 1000 },
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme: 'light',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: `anvil --chain-id 1337 --port ${new URL(RPC_URL).port} --silent`,
      url: RPC_URL,
      reuseExistingServer: false,
    },
    {
      command: `pnpm start --port ${new URL(APP_URL).port}`,
      cwd: join(__dirname, '..', '..'),
      url: APP_URL,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
