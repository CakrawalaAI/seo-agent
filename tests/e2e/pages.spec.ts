import { test, expect, request } from '@playwright/test'

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

  test('projects renders without crash', async ({ page }) => {
    await page.goto('/projects')
    await expect(page.getByText('Projects')).toBeVisible()
  })

  test('project detail renders after creating a project', async ({ page, baseURL }) => {
    const api = await request.newContext({ baseURL: baseURL || 'http://localhost:5173' })
    // Create a project via API
    const res = await api.post('/api/projects', {
      data: {
        orgId: 'org-dev',
        name: `E2E Site ${Date.now()}`,
        siteUrl: 'https://example.com',
        defaultLocale: 'en-US'
      }
    })
    expect(res.ok()).toBeTruthy()
    const json = (await res.json()) as { project: { id: string } }
    const id = json?.project?.id
    expect(id).toBeTruthy()

    await page.goto(`/projects/${id}`)
    // Expect Overview tab controls to exist
    await expect(page.getByRole('heading', { name: 'Automation controls' })).toBeVisible()
  })

  test('article editor renders after generating draft', async ({ page, baseURL }) => {
    const api = await request.newContext({ baseURL: baseURL || 'http://localhost:5173' })
    // 1) Create project
    const projRes = await api.post('/api/projects', {
      data: { orgId: 'org-dev', name: `E2E ${Date.now()}`, siteUrl: 'https://example.com', defaultLocale: 'en-US' }
    })
    expect(projRes.ok()).toBeTruthy()
    const proj = (await projRes.json()) as { project: { id: string } }
    const projectId = proj.project.id
    // 2) Generate keywords
    const kwRes = await api.post('/api/keywords/generate', { data: { projectId, locale: 'en-US' } })
    expect(kwRes.ok()).toBeTruthy()
    // 3) Create plan (1 day)
    const planRes = await api.post('/api/plan/create', { data: { projectId, days: 1 } })
    expect(planRes.ok()).toBeTruthy()
    // 4) Fetch plan items
    const itemsRes = await api.get(`/api/plan-items?projectId=${projectId}&limit=1`)
    expect(itemsRes.ok()).toBeTruthy()
    const items = (await itemsRes.json()) as { items: Array<{ id: string }> }
    expect(items.items.length).toBeGreaterThan(0)
    const planItemId = items.items[0]!.id
    // 5) Generate article for the plan item
    const genRes = await api.post('/api/articles/generate', { data: { planItemId } })
    expect(genRes.ok()).toBeTruthy()
    // 6) Get article id via project articles
    const artsRes = await api.get(`/api/projects/${projectId}/articles?limit=1`)
    expect(artsRes.ok()).toBeTruthy()
    const arts = (await artsRes.json()) as { items: Array<{ id: string }> }
    expect(arts.items.length).toBeGreaterThan(0)
    const articleId = arts.items[0]!.id

    await page.goto(`/projects/${projectId}/articles/${articleId}`)
    await expect(page.getByText('Save changes')).toBeVisible()
  })
})
