import { defineConfig } from '@playwright/test'

export default defineConfig({
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173'
  },
  webServer: {
    command: 'bunx vite dev --host',
    port: 5173,
    timeout: 120_000,
    reuseExistingServer: true
  },
  testDir: 'tests/e2e',
  reporter: [['list']]
})
