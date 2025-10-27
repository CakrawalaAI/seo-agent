import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { runCli } from '../src/cli/index'

describe('cli ping', () => {
  const originalEnv = process.env.SEO_AGENT_BASE_URL
  let logs: string[] = []

  beforeEach(() => {
    logs = []
    vi.spyOn(console, 'log').mockImplementation((msg: any) => {
      logs.push(String(msg))
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    // Mock fetch
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, version: '0.1.0', service: 'seo-agent' }), {
        headers: { 'content-type': 'application/json' }
      })
    ) as any
    process.env.SEO_AGENT_BASE_URL = 'http://localhost:5173'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env.SEO_AGENT_BASE_URL = originalEnv
  })

  it('prints health ok and version', async () => {
    await runCli(['ping'])
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:5173/api/health', { method: 'GET' })
    expect(logs.join('\n')).toContain('health ok: true')
  })
})

