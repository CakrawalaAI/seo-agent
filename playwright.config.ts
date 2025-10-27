import { defineConfig } from '@playwright/test'

export default defineConfig({
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173'
  },
  testDir: 'tests/e2e',
  reporter: [['list']]
})

