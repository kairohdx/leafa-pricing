import { defineConfig, devices } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

// External mode is only for a disposable local stack (the tests create data).
const externalURL = process.env.E2E_BASE_URL
if (externalURL && !/^http:\/\/127\.0\.0\.1:\d+$/.test(externalURL)) throw new Error('E2E_BASE_URL must target a disposable loopback stack.')
const databaseDir = externalURL ? '' : mkdtempSync(resolve(tmpdir(), 'leafa-e2e-')).replaceAll('\\', '/')
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: externalURL || 'http://127.0.0.1:5179', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: externalURL ? undefined : {
    command: 'python e2e/start_server.py',
    url: 'http://127.0.0.1:5179/api/health',
    reuseExistingServer: false,
    timeout: 60_000,
    gracefulShutdown: process.platform === 'win32' ? undefined : { signal: 'SIGTERM', timeout: 15_000 },
    env: { DATABASE_URL: `sqlite:///${databaseDir}/test.db`, APP_ENV: 'test' },
  },
})
