import { join } from 'node:path'

import { defineConfig, devices } from '@playwright/test'

import { APP_URL, RPC_URL } from './chain'

const REPOSITORY = join(__dirname, '..', '..')

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  snapshotPathTemplate: '{testDir}/screenshots/{testFileName}/{arg}{ext}',
  outputDir: '../../test-results/visual',
  timeout: 90_000,
  workers: 1,
  retries: 0,
  maxFailures: 20,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../../playwright-report/visual' }]],
  expect: {
    timeout: 30_000,
    toHaveScreenshot: {
      pathTemplate: '{testDir}/screenshots/{projectName}/{testFileName}/{arg}{ext}',
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      threshold: 0.02,
      maxDiffPixels: 8,
      stylePath: join(__dirname, 'screenshot.css'),
    },
  },
  use: {
    baseURL: APP_URL,
    colorScheme: 'light',
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'UTC',
    serviceWorkers: 'block',
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 1000 } } },
    {
      name: 'phone',
      use: {
        ...devices['iPhone 13'],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
      },
    },
  ],
  webServer: [
    {
      command: `anvil --chain-id 1 --port ${new URL(RPC_URL).port} --silent`,
      url: RPC_URL,
      reuseExistingServer: false,
    },
    {
      command: `node e2e/visual/pages-server.mjs out .github/pages/404.html ${
        new URL(APP_URL).port
      }`,
      cwd: REPOSITORY,
      url: APP_URL,
      reuseExistingServer: false,
    },
  ],
})
