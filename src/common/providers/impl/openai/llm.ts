import type { LlmProvider } from '../../interfaces/llm'
import type { ArticleOutlineSection } from '@entities/article/domain/article'
import { buildPickTopFromSitemapPrompt, buildWebsiteSummaryPrompt } from '@common/prompts/summarize-website'
import { HTTP_TIMEOUT_MS } from '@src/common/http/timeout'

export const openAiLlm: LlmProvider = {
  async summarize(pages) {
    const key = process.env.OPENAI_API_KEY
    const sample = pages.slice(0, 5)
    if (!key) throw new Error('OPENAI_API_KEY missing')
    const { OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey: key })
    const prompt = `Summarize the business and propose 5 topic clusters. Return JSON {businessSummary,topicClusters}.\n` +
      sample.map((p, i) => `${i + 1}. ${p.url}\n${p.text.slice(0, 400)}`).join('\n\n')
    const resp = await client.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }] }, { timeout: HTTP_TIMEOUT_MS })
    const text = resp.choices?.[0]?.message?.content || ''
    try { return JSON.parse(text) } catch { return { businessSummary: text.slice(0, 200), topicClusters: [] } }
  },

  // Select up to N representative URLs from sitemap candidates
  async rankRepresentatives(siteUrl: string, candidates: string[], maxN: number): Promise<string[]> {
    const key = process.env.OPENAI_API_KEY
    const n = Math.max(1, Math.min(50, maxN || 10))
    if (!key) throw new Error('OPENAI_API_KEY missing')
    const { OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey: key })
    const list = candidates.slice(0, 200).map((u, i) => `${i + 1}. ${u}`).join('\n')
    const prompt = `You are selecting the most representative pages to understand a business website before generating SEO keywords. Given the site root ${siteUrl} and a sitemap URL list, pick the top ${n} URLs that best describe the business (home, about, pricing, product/services, key category pages; avoid paginated lists and legal pages). Return JSON: { urls: ["..."] } only.`
    const resp = await client.chat.completions.create(
      {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: `${prompt}\n\nSitemap URLs (sample):\n${list}` }]
      },
      { timeout: HTTP_TIMEOUT_MS }
    )
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
    if (!key) throw new Error('OPENAI_API_KEY missing')
    const { OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey: key })
    const prompt = `Write a compelling SEO title and outline for an article targeting "${keyword}" in ${locale}. Return JSON {title, outline:[{heading:"..."}]}`
    const resp = await client.chat.completions.create(
      {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }]
      },
      { timeout: HTTP_TIMEOUT_MS }
    )
    const text = resp.choices?.[0]?.message?.content || ''
    try { return JSON.parse(text) } catch { return { title: keyword, outline: [{ heading: 'Introduction' }] as any } }
  },

  async generateBody(args) {
    const key = process.env.OPENAI_API_KEY
    if (!key) throw new Error('OPENAI_API_KEY missing')
    const { OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey: key })
    const citeList = (args.citations || []).map((c, i) => `${i + 1}. ${c.title || ''} — ${c.url} — ${(c.snippet || '').slice(0,140)}`).join('\n')
    const ytList = (args.youtube || []).map((y, i) => `${i + 1}. ${y.title || ''} — ${y.url}`).join('\n')
    const imgList = (args.images || []).map((img, i) => `${i + 1}. ${img.src} ${img.alt ? '('+img.alt+')' : ''}`).join('\n')
    const internalList = (args.internalLinks || []).map((l) => `${l.anchor || 'Related'} — ${l.url}`).join('\n')
    const prompt = `You are writing a production‑ready SEO article. Return valid semantic HTML only. Requirements:\n- H1 title must equal the Title.\n- Use provided Outline as H2/H3.\n- Naturally cite sources with numbered footnotes [1], [2] inline; append a References section with links.\n- Embed 1–2 Unsplash images as <figure> with <img src alt> and <figcaption>.\n- Embed the first YouTube URL as a responsive <iframe>.\n- Add 3–5 internal links where relevant.\n- Include JSON‑LD Article schema (script[type=application/ld+json]).\n- No markdown.\n\nBusiness Summary:\n${args.websiteSummary || ''}\n\nTitle: ${args.title}\nOutline JSON: ${JSON.stringify(args.outline)}\n\nSERP (top results excerpts):\n${args.serpDump ?? ''}\n\nCompetitors (optional):\n${args.competitorDump ?? ''}\n\nCitations:\n${citeList}\n\nYouTube:\n${ytList}\n\nUnsplash Images:\n${imgList}\n\nInternal Links:\n${internalList}`
    const resp = await client.chat.completions.create(
      {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }]
      },
      { timeout: HTTP_TIMEOUT_MS }
    )
    const html = resp.choices?.[0]?.message?.content || ''
    return { bodyHtml: html }
  },

  async factCheck({ title, bodyPreview, citations }) {
    const key = process.env.OPENAI_API_KEY
    if (!key) throw new Error('OPENAI_API_KEY missing')
    try {
      const { OpenAI } = await import('openai')
      const client = new OpenAI({ apiKey: key })
      const citeList = (citations || []).map((c, i) => `${i + 1}. ${c.title || ''} ${c.url}`).join('\n')
      const prompt = `You are a meticulous fact-checker. Given the article title, an optional preview, and the list of citations, rate from 0-100 how well the claims are supported by the citations. Briefly explain. Return JSON {score,notes}.\nTitle: ${title}\nPreview: ${(bodyPreview || '').slice(0, 800)}\nCitations:\n${citeList}`
      const resp = await client.chat.completions.create(
        {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }]
        },
        { timeout: HTTP_TIMEOUT_MS }
      )
      const text = resp.choices?.[0]?.message?.content || ''
      try { return JSON.parse(text) } catch { return { score: 0, notes: text.slice(0, 200) } }
    } catch {
      return { score: 0, notes: 'error' }
    }
  }
  ,

  // Pick top-N URLs from a raw sitemap string
  async pickTopFromSitemapString(siteUrl: string, listString: string, maxN: number): Promise<string[]> {
    const key = process.env.OPENAI_API_KEY
    const n = Math.max(1, Math.min(100, maxN || 100))
    const fallback = () => listString
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, n)
    if (!key) throw new Error('OPENAI_API_KEY missing')
    const { OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey: key })
    const model = 'gpt-5-2025-08-07'
    const prompt = buildPickTopFromSitemapPrompt(siteUrl, n)
    try {
      const resp = await client.chat.completions.create(
        {
          model,
          messages: [{ role: 'user', content: `${prompt}\n\nSite: ${siteUrl}\n\nSitemap URLs (one per line):\n${listString}` }],
          response_format: { type: 'json_object' as const }
        },
        { timeout: HTTP_TIMEOUT_MS }
      ).catch(async (e) => {
        // fallback to gpt-4o-mini if model unavailable
        const fallbackModel = 'gpt-4o-mini'
        return await client.chat.completions.create(
          {
            model: fallbackModel,
            messages: [{ role: 'user', content: `${prompt}\n\nSite: ${siteUrl}\n\nSitemap URLs (one per line):\n${listString}` }],
            response_format: { type: 'json_object' as const }
          },
          { timeout: HTTP_TIMEOUT_MS }
        )
      })
      const text = resp.choices?.[0]?.message?.content || ''
      try {
        const parsed = JSON.parse(text)
        const urls = Array.isArray(parsed?.urls) ? parsed.urls.filter((x: any) => typeof x === 'string') : []
        if (urls.length) return urls.slice(0, n)
      } catch {}
      return fallback()
    } catch {
      return fallback()
    }
  },

  // Summarize a single big dump string into one plain-text business context
  async summarizeWebsiteDump(siteUrl: string, dumpString: string): Promise<string> {
    const key = process.env.OPENAI_API_KEY
    if (!key) throw new Error('OPENAI_API_KEY missing')
    const { OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey: key })
    const model = 'gpt-5-2025-08-07'
    const prompt = buildWebsiteSummaryPrompt(siteUrl)
    try {
      const resp = await client.chat.completions.create(
        {
          model,
          messages: [
            { role: 'system', content: 'You are an SEO strategist. Be precise and extract concrete facts only.' },
            { role: 'user', content: `${prompt}\n\nDUMP BEGIN\n${dumpString}\nDUMP END` }
          ]
        },
        { timeout: HTTP_TIMEOUT_MS }
      ).catch(async () => {
        const fallbackModel = 'gpt-4o-mini'
        return await client.chat.completions.create(
          {
            model: fallbackModel,
            messages: [
              { role: 'system', content: 'You are an SEO strategist. Be precise and extract concrete facts only.' },
              { role: 'user', content: `${prompt}\n\nDUMP BEGIN\n${dumpString}\nDUMP END` }
            ]
          },
          { timeout: HTTP_TIMEOUT_MS }
        )
      })
      return resp.choices?.[0]?.message?.content?.trim() || ''
    } catch (e) {
      throw new Error(`LLM summarize dump failed: ${(e as Error)?.message || String(e)}`)
    }
  }
}
