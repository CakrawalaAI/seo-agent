const isPlaywright = process.env.PLAYWRIGHT_TEST === '1' || process.env.PW_TEST === '1'

if (!isPlaywright) {
  console.info('[e2e] Skipping Playwright smoke tests outside Playwright runner')
} else {
  const { test, expect, request } = await import('@playwright/test')

  test.describe('page smoke', () => {
    test('home renders without crash', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByText('Programmatic SEO autopilot')).toBeVisible()
    })

    test('dashboard renders without crash', async ({ page }) => {
      await page.goto('/dashboard')
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    })

    test('login renders without crash', async ({ page }) => {
      await page.goto('/login')
      await expect(page.getByText('Sign in with Google')).toBeVisible()
    })

    test('keywords renders without crash', async ({ page }) => {
      await page.goto('/keywords')
      await expect(page.getByText('Keywords')).toBeVisible()
    })

    test('dashboard shows after creating a website', async ({ page, baseURL }) => {
      const api = await request.newContext({ baseURL: baseURL || 'http://localhost:5173' })
      const res = await api.post('/api/websites', {
        data: {
          url: 'https://example.com',
          defaultLocale: 'en-US'
        }
      })
      expect(res.ok()).toBeTruthy()
      const json = (await res.json()) as { website: { id: string } }
      const id = json?.website?.id
      expect(id).toBeTruthy()

      await page.goto(`/dashboard?website=${encodeURIComponent('https://example.com')}`)
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    })

    test('article editor renders after generating draft', async ({ page, baseURL }) => {
      const api = await request.newContext({ baseURL: baseURL || 'http://localhost:5173' })
      const projRes = await api.post('/api/websites', {
        data: { url: 'https://example.com', defaultLocale: 'en-US' }
      })
      expect(projRes.ok()).toBeTruthy()
      const proj = (await projRes.json()) as { website: { id: string } }
      const projectId = proj.website.id
      const kwRes = await api.post('/api/keywords/generate', { data: { websiteId: projectId, locale: 'en-US' } })
      expect(kwRes.ok()).toBeTruthy()
      const planRes = await api.post('/api/plan/create', { data: { websiteId: projectId, days: 1 } })
      expect(planRes.ok()).toBeTruthy()
      const itemsRes = await api.get(`/api/plan-items?websiteId=${projectId}&limit=1`)
      expect(itemsRes.ok()).toBeTruthy()
      const items = (await itemsRes.json()) as { items: Array<{ id: string }> }
      expect(items.items.length).toBeGreaterThan(0)
      const planItemId = items.items[0]!.id
      const genRes = await api.post('/api/articles/generate', { data: { planItemId } })
      expect(genRes.ok()).toBeTruthy()
      const artsRes = await api.get(`/api/websites/${projectId}/articles?limit=1`)
      expect(artsRes.ok()).toBeTruthy()
      const arts = (await artsRes.json()) as { items: Array<{ id: string }> }
      expect(arts.items.length).toBeGreaterThan(0)
      const articleId = arts.items[0]!.id

      await page.goto(`/articles?website=${projectId}`)
      await expect(page.getByText('Articles')).toBeVisible()
    })
  })
}
