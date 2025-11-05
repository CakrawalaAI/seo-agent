const isPlaywright = process.env.PLAYWRIGHT_TEST === '1' || process.env.PW_TEST === '1'

if (!isPlaywright) {
  console.info('[e2e] Skipping route smoke tests outside Playwright runner')
} else {
  const { test, expect } = await import('@playwright/test')
  const { buildSmokeSessionCookie } = await import('./helpers/session')

  const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000'
  const base = new URL(baseURL)

type RouteCheck = {
  path: string
  search?: string
  navigate?: (page: import('@playwright/test').Page) => Promise<void>
  check: (page: import('@playwright/test').Page) => Promise<void> | void
}

  const PUBLIC_ROUTES: RouteCheck[] = [
    {
      path: '/',
      check: async (page) => {
        await expect(page.getByRole('heading', { name: 'Google & ChatGPT traffic on autopilot' })).toBeVisible()
      }
    }
  ]

  const AUTHENTICATED_ROUTES: RouteCheck[] = [
    {
      path: '/dashboard',
      check: async (page) => {
        await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
      }
    },
    {
      path: '/keywords',
      check: async (page) => {
        await expect(page.getByRole('heading', { name: 'Keywords' })).toBeVisible()
      }
    },
    {
      path: '/calendar',
      check: async (page) => {
        await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible()
      }
    },
    {
      path: '/articles',
      check: async (page) => {
        await expect(page.getByRole('heading', { name: 'Articles' })).toBeVisible()
      }
    },
    {
      path: '/integrations',
      search: '?website=proj_mock',
      check: async (page) => {
        await expect(page.getByText('No website selected')).toBeVisible()
      }
    },
    {
      path: '/settings',
      check: async (page) => {
        await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
      }
    }
  ]

  const collectErrors = (page: import('@playwright/test').Page) => {
    const errors: Error[] = []
    page.on('pageerror', (error) => {
      errors.push(error)
    })
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(new Error(message.text()))
      }
    })
    return errors
  }

  const attachMockSession = async (page: import('@playwright/test').Page) => {
    const cookie = buildSmokeSessionCookie()
    await page.context().addCookies([
      {
        name: cookie.name,
        value: cookie.value,
        domain: base.hostname,
        path: '/',
        httpOnly: false,
        secure: base.protocol === 'https:',
        sameSite: 'Lax'
      }
    ])
    await page.addInitScript(() => {
      window.localStorage.setItem('seo-agent:mock-data', 'on')
      ;(window as any).__E2E_NO_AUTH__ = '1'
    })
  }

  test.describe('public route smoke', () => {
    for (const route of PUBLIC_ROUTES) {
      test(`renders ${route.path}`, async ({ page }) => {
        const errors = collectErrors(page)
        if (route.navigate) {
          await route.navigate(page)
        } else {
          const href = route.search ? `${route.path}${route.search}` : route.path
          const response = await page.goto(href)
          expect(response, `No response navigating to ${route.path}`).toBeTruthy()
          expect(response!.ok(), `HTTP status for ${route.path}`).toBeTruthy()
        }
        await route.check(page)
        expect(errors, `Console/Page errors for ${route.path}`).toHaveLength(0)
      })
    }
  })

  test.describe('authenticated route smoke', () => {
    test.beforeEach(async ({ page }) => {
      await attachMockSession(page)
    })

    for (const route of AUTHENTICATED_ROUTES) {
      test(`renders ${route.path}`, async ({ page }) => {
        const errors = collectErrors(page)
        if (route.navigate) {
          await route.navigate(page)
        } else {
          const href = route.search ? `${route.path}${route.search}` : route.path
          const response = await page.goto(href)
          expect(response, `No response navigating to ${route.path}`).toBeTruthy()
          expect(response!.status(), `HTTP status for ${route.path}`).toBeLessThan(400)
        }
        await route.check(page)
        expect(errors, `Console/Page errors for ${route.path}`).toHaveLength(0)
      })
    }
  })
}
