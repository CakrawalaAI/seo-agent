import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { runCli } from '../src/cli/index'

describe('cli articles', () => {
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

  it('article-ls prints rows', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ items: [{ id: 'art_1', status: 'draft', title: 'seo automation' }] }),
        { headers: { 'content-type': 'application/json' } }
      )
    ) as any
    await runCli(['article-ls', '--project', 'proj_1'])
    expect(logs.join('\n')).toContain('draft\tart_1\tseo automation')
  })

  it('article-publish prints job id', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ jobId: 'job_pub' }), { headers: { 'content-type': 'application/json' } })
    ) as any
    await runCli(['article-publish', '--article', 'art_1', '--integration', 'int_1'])
    expect(logs.join('\n')).toContain('publish job job_pub')
  })
})

