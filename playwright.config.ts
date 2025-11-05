import { defineConfig } from '@playwright/test'

export default defineConfig({
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000'
  },
  outputDir: '.test-results',
  webServer: {
    command: 'bash -c "bunx vite build && E2E_NO_AUTH=1 bunx tsx scripts/e2e-server.ts"',
    port: 4000,
    timeout: 180_000,
    reuseExistingServer: true,
    env: { HOST: '0.0.0.0', E2E_NO_AUTH: '1', PORT: '4000' }
  },
  testDir: 'tests/e2e',
  reporter: [['list']]
})
