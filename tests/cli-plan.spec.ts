import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { runCli } from '../src/cli/index'

describe('cli plan', () => {
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

  it('plan-ls prints rows', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ items: [{ id: 'plan_1', plannedDate: '2025-11-01', title: 'seo automation', status: 'planned' }] }),
        { headers: { 'content-type': 'application/json' } }
      )
    ) as any
    await runCli(['plan-ls', '--project', 'proj_1'])
    expect(logs.join('\n')).toContain('2025-11-01\tplanned\tplan_1\tseo automation')
  })

  it('plan-move prints ok', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ plannedDate: '2025-11-02' }))) as any
    await runCli(['plan-move', '--plan', 'plan_1', '--date', '2025-11-02'])
    expect(logs.join('\n')).toContain('ok')
  })
})

