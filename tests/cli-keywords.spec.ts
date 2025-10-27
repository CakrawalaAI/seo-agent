import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { runCli } from '../src/cli/index'

describe('cli keywords', () => {
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

  it('keyword-generate prints job id', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ jobId: 'job_2' }), { headers: { 'content-type': 'application/json' } })
    ) as any
    await runCli(['keyword-generate', '--project', 'proj_1'])
    expect(logs.join('\n')).toContain('keyword job job_2')
  })

  it('keyword-ls prints rows', async () => {
    globalThis.fetch = vi
      .fn(async (url: any, init?: any) => {
        if (String(url).includes('/api/projects/') && String(url).includes('/keywords')) {
          return new Response(
            JSON.stringify({ items: [{ phrase: 'seo automation', status: 'recommended', metricsJson: { searchVolume: 880, difficulty: 42 } }] }),
            { headers: { 'content-type': 'application/json' } }
          )
        }
        return new Response(JSON.stringify({ jobId: 'job_3' }), { headers: { 'content-type': 'application/json' } })
      }) as any
    await runCli(['keyword-ls', '--project', 'proj_1'])
    expect(logs.join('\n')).toMatch(/recommended\t\d+\t\d+\tseo automation/)
  })
})

