import { defineConfig } from '@playwright/test'

export default defineConfig({
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000'
  },
  webServer: {
    command: 'bash -c "bunx vite build && E2E_NO_AUTH=1 bunx vite preview --strictPort --port 4000"',
    port: 4000,
    timeout: 180_000,
    reuseExistingServer: true,
    env: { HOST: '0.0.0.0', E2E_NO_AUTH: '1' }
  },
  testDir: 'tests/e2e',
  reporter: [['list']]
})
