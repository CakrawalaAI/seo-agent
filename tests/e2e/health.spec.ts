const isPlaywright = process.env.PLAYWRIGHT_TEST === '1' || process.env.PW_TEST === '1'

if (!isPlaywright) {
  console.info('[e2e] Skipping health smoke tests outside Playwright runner')
} else {
  const { test, expect, request } = await import('@playwright/test')

  test('GET /api/health', async () => {
    const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173'
    const api = await request.newContext({ baseURL })
    const res = await api.get('/api/health')
    expect(res.ok()).toBeTruthy()
    const json = await res.json()
    expect(json.ok).toBe(true)
  })

  test('home page renders', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('SEO Agent')).toBeVisible()
  })
}
