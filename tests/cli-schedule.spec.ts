import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { runCli } from '../src/cli/index'

describe('cli schedule', () => {
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

  it('schedule-run prints generated count', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ result: { generatedDrafts: 1 } }), {
        headers: { 'content-type': 'application/json' }
      })
    ) as any
    await runCli(['schedule-run', '--project', 'proj_1'])
    expect(logs.join('\n')).toContain('generated 1')
  })
})

