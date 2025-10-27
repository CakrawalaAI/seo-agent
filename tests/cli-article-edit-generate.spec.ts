import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { runCli } from '../src/cli/index'

describe('cli article generate/edit', () => {
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

  it('article-generate prints article id', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ articleId: 'art_1' }), { headers: { 'content-type': 'application/json' } })
    ) as any
    await runCli(['article-generate', '--plan', 'plan_1'])
    expect(logs.join('\n')).toContain('generated art_1')
  })

  it('article-edit prints ok (file)', async () => {
    const fs = await import('node:fs/promises')
    const tmp = await fs.mkdtemp('edit-')
    const file = `${tmp}/body.html`
    await fs.writeFile(file, '<p>hello</p>')
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })) as any
    await runCli(['article-edit', '--article', 'art_1', '--file', file])
    expect(logs.join('\n')).toContain('ok')
  })
})

