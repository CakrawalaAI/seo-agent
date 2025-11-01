import type { LlmProvider } from '../../interfaces/llm'
import { config } from '@common/config'
import type { ArticleOutlineSection } from '@entities/article/domain/article'

export const openAiLlm: LlmProvider = {
  async summarize(pages) {
    const key = process.env.OPENAI_API_KEY
    const sample = pages.slice(0, 5)
    if (!key) {
      const allowStubs = Boolean(config.providers.allowStubs)
      if (!allowStubs) throw new Error('OPENAI_API_KEY missing and stubs disabled')
      try { console.warn('[OpenAI] Missing API key; using stub summary once') } catch {}
      const clusters = sample.map((p) => p.url.split('/')[3] || 'topic').slice(0, 5)
      return { businessSummary: 'Auto summary (stub)', topicClusters: Array.from(new Set(clusters)) }
    }
    const { OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey: key })
    const prompt = `Summarize the business and propose 5 topic clusters. Return JSON {businessSummary,topicClusters}.\n` +
      sample.map((p, i) => `${i + 1}. ${p.url}\n${p.text.slice(0, 400)}`).join('\n\n')
    const resp = await client.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.3 })
    const text = resp.choices?.[0]?.message?.content || ''
    try { return JSON.parse(text) } catch { return { businessSummary: text.slice(0, 200), topicClusters: [] } }
  },

  // Select up to N representative URLs from sitemap candidates
  async rankRepresentatives(siteUrl: string, candidates: string[], maxN: number): Promise<string[]> {
    const key = process.env.OPENAI_API_KEY
    const n = Math.max(1, Math.min(50, maxN || 10))
    if (!key) {
      // Heuristic: prefer homepage, /about, /pricing, /blog, then first N
      const set = new Set<string>()
      const push = (p: string) => { try { set.add(new URL(p, siteUrl).toString()) } catch {} }
      push('/')
      push('/about')
      push('/pricing')
      push('/blog')
      for (const u of candidates) { if (set.size >= n) break; set.add(u) }
      return Array.from(set).slice(0, n)
    }
    const { OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey: key })
    const list = candidates.slice(0, 200).map((u, i) => `${i + 1}. ${u}`).join('\n')
    const prompt = `You are selecting the most representative pages to understand a business website before generating SEO keywords. Given the site root ${siteUrl} and a sitemap URL list, pick the top ${n} URLs that best describe the business (home, about, pricing, product/services, key category pages; avoid paginated lists and legal pages). Return JSON: { urls: ["..."] } only.`
    const resp = await client.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: `${prompt}\n\nSitemap URLs (sample):\n${list}` }], temperature: 0 })
    const text = resp.choices?.[0]?.message?.content || ''
    try {
      const parsed = JSON.parse(text)
      const urls = Array.isArray(parsed?.urls) ? parsed.urls.filter((x: any) => typeof x === 'string') : []
      if (urls.length) return urls.slice(0, n)
    } catch {}
    return candidates.slice(0, n)
  },

  async draftOutline(keyword: string, locale: string): Promise<{ title: string; outline: ArticleOutlineSection[] }> {
    const key = process.env.OPENAI_API_KEY
    if (!key) {
      const allowStubs = Boolean(config.providers.allowStubs)
      if (!allowStubs) throw new Error('OPENAI_API_KEY missing and stubs disabled')
      try { console.warn('[OpenAI] Missing API key; using stub outline once') } catch {}
      return { title: keyword[0]?.toUpperCase() + keyword.slice(1), outline: [{ heading: `Intro to ${keyword}` }] as any }
    }
    const { OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey: key })
    const prompt = `Write a compelling SEO title and outline for an article targeting "${keyword}" in ${locale}. Return JSON {title, outline:[{heading:"..."}]}`
    const resp = await client.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.6 })
    const text = resp.choices?.[0]?.message?.content || ''
    try { return JSON.parse(text) } catch { return { title: keyword, outline: [{ heading: 'Introduction' }] as any } }
  },

  async generateBody(args) {
    const key = process.env.OPENAI_API_KEY
    if (!key) {
      const allowStubs = Boolean(config.providers.allowStubs)
      if (!allowStubs) throw new Error('OPENAI_API_KEY missing and stubs disabled')
      try { console.warn('[OpenAI] Missing API key; using stub body once') } catch {}
      return { bodyHtml: `<article><h1>${args.title}</h1><p>Draft body (stub).</p></article>` }
    }
    const { OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey: key })
    const prompt = `Write an SEO article with the given outline and evidence. Return HTML only.\nTitle: ${args.title}\nOutline: ${JSON.stringify(args.outline)}\nSERP:\n${args.serpDump ?? ''}\nCompetitors:\n${args.competitorDump ?? ''}`
    const resp = await client.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.5 })
    const html = resp.choices?.[0]?.message?.content || ''
    return { bodyHtml: html }
  },

  async factCheck({ title, bodyPreview, citations }) {
    const key = process.env.OPENAI_API_KEY
    if (!key) {
      const allowStubs = Boolean(config.providers.allowStubs)
      if (!allowStubs) throw new Error('OPENAI_API_KEY missing and stubs disabled')
      try { console.warn('[OpenAI] Missing API key; fact-check stub once') } catch {}
      return { score: 0, notes: 'no-api-key' }
    }
    try {
      const { OpenAI } = await import('openai')
      const client = new OpenAI({ apiKey: key })
      const citeList = (citations || []).map((c, i) => `${i + 1}. ${c.title || ''} ${c.url}`).join('\n')
      const prompt = `You are a meticulous fact-checker. Given the article title, an optional preview, and the list of citations, rate from 0-100 how well the claims are supported by the citations. Briefly explain. Return JSON {score,notes}.\nTitle: ${title}\nPreview: ${(bodyPreview || '').slice(0, 800)}\nCitations:\n${citeList}`
      const resp = await client.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0 })
      const text = resp.choices?.[0]?.message?.content || ''
      try { return JSON.parse(text) } catch { return { score: 0, notes: text.slice(0, 200) } }
    } catch {
      return { score: 0, notes: 'error' }
    }
  }
}
