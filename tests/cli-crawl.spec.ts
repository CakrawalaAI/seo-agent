import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { runCli } from '../src/cli/index'

describe('cli crawl', () => {
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

  it('crawl-run prints job id', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ jobId: 'job_1' }), { headers: { 'content-type': 'application/json' } })
    ) as any
    await runCli(['crawl-run', '--project', 'proj_1'])
    expect(logs.join('\n')).toContain('crawl job job_1')
  })

  it('crawl-pages prints table', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ items: [{ url: 'https://example.com/', httpStatus: 200, metaJson: { title: 'Home' } }] }),
        { headers: { 'content-type': 'application/json' } }
      )
    ) as any
    await runCli(['crawl-pages', '--project', 'proj_1'])
    expect(logs.join('\n')).toContain('200\tHome\thttps://example.com/')
  })
})

