import { defineConfig } from '@playwright/test'

export default defineConfig({
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000'
  },
  webServer: {
    command: 'bash -c "bunx vite build && PORT=4000 E2E_NO_AUTH=1 node .output/server/index.mjs"',
    port: 4000,
    timeout: 180_000,
    reuseExistingServer: true,
    env: { PORT: '4000', HOST: '0.0.0.0', E2E_NO_AUTH: '1' }
  },
  testDir: 'tests/e2e',
  reporter: [['list']]
})
