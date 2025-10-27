import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { runCli } from '../src/cli/index'

describe('cli whoami', () => {
  let logs: string[] = []
  const originalEnv = process.env.SEO_AGENT_BASE_URL

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

  it('prints anonymous on missing user', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ user: null }), { headers: { 'content-type': 'application/json' } })
    ) as any
    await runCli(['whoami'])
    expect(logs.join('\n')).toContain('anonymous')
  })

  it('prints user when session exists', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ user: { email: 'dev@example.com', name: 'Dev User' } }),
        { headers: { 'content-type': 'application/json' } }
      )
    ) as any
    await runCli(['whoami'])
    expect(logs.join('\n')).toContain('Dev User <dev@example.com>')
  })
})

