import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { runCli } from '../src/cli/index'

describe('cli projects', () => {
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

  it('project-create prints created id', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ project: { id: 'proj_1', name: 'Acme' }, crawlJobId: null }),
        { headers: { 'content-type': 'application/json' } }
      )
    ) as any
    await runCli(['project-create', '--org', 'org-dev', '--name', 'Acme', '--site', 'https://acme.com'])
    expect(logs.join('\n')).toContain('project Acme created id=proj_1')
  })

  it('project-ls prints rows', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ items: [{ id: 'proj_1', name: 'Acme', siteUrl: 'https://acme.com' }] }),
        { headers: { 'content-type': 'application/json' } }
      )
    ) as any
    await runCli(['project-ls', '--org', 'org-dev'])
    expect(logs.join('\n')).toContain('proj_1\tAcme\thttps://acme.com')
  })
})

