import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { runCli } from '../src/cli/index'

describe('cli integrations', () => {
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

  it('integration-add-webhook prints id', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ id: 'int_1' }), { headers: { 'content-type': 'application/json' } })
    ) as any
    await runCli(['integration-add-webhook', '--project', 'proj_1', '--url', 'https://hook'])
    expect(logs.join('\n')).toContain('integration int_1')
  })

  it('integration-test prints ok', async () => {
    globalThis.fetch = vi.fn(async () => new Response(null, { status: 204 })) as any
    await runCli(['integration-test', '--integration', 'int_1'])
    expect(logs.join('\n')).toContain('ok')
  })
})

