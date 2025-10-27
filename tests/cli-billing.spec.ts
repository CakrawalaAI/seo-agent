import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { runCli } from '../src/cli/index'

describe('cli billing', () => {
  const originalEnv = process.env.SEO_AGENT_BASE_URL
  let logs: string[] = []

  beforeEach(() => {
    logs = []
    vi.spyOn(console, 'log').mockImplementation((msg: any) => logs.push(String(msg)))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    process.env.SEO_AGENT_BASE_URL = 'http://localhost:5173'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env.SEO_AGENT_BASE_URL = originalEnv
  })

  it('prints checkout url', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ url: 'https://checkout.example/abc' }), {
        headers: { 'content-type': 'application/json' }
      })
    ) as any
    await runCli(['billing-checkout', '--org', 'org-dev'])
    expect(logs.join('\n')).toContain('https://checkout.example/abc')
  })

  it('prints portal url', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ url: 'https://portal.example/xyz' }), {
        headers: { 'content-type': 'application/json' }
      })
    ) as any
    await runCli(['billing-portal', '--org', 'org-dev'])
    expect(logs.join('\n')).toContain('https://portal.example/xyz')
  })
})

