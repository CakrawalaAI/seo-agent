import { test, expect, request } from '@playwright/test'

test('GET /api/health', async () => {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173'
  const api = await request.newContext({ baseURL })
  const res = await api.get('/api/health')
  expect(res.ok()).toBeTruthy()
  const json = await res.json()
  expect(json.ok).toBe(true)
})

