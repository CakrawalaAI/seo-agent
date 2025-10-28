import type { ArticleOutlineSection } from '@entities/article/domain/article'

export type SiteSummary = {
  businessSummary: string
  audience?: string
  products?: string
  topicClusters: string[]
}

export async function summarizeSite(pages: Array<{ url: string; title?: string; text?: string }>): Promise<SiteSummary> {
  const key = process.env.OPENAI_API_KEY
  const sample = pages.slice(0, 5)
  if (!key) {
    const clusters = sample.map((p) => (p.title || p.url).split(' ')[0]).filter(Boolean).slice(0, 5)
    return { businessSummary: 'Auto summary (stub)', topicClusters: Array.from(new Set(clusters)) }
  }
  try {
    const { OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey: key })
    const prompt = `You are an SEO strategist. Given these page titles/URLs, summarize the business and propose 5 topic clusters. Return JSON with keys businessSummary and topicClusters.\n` +
      sample.map((p, i) => `${i + 1}. ${p.title || ''} (${p.url})`).join('\n')
    const resp = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    })
    const text = resp.choices?.[0]?.message?.content || ''
    try { return JSON.parse(text) as SiteSummary } catch { return { businessSummary: text.slice(0, 200), topicClusters: [] } }
  } catch {
    return { businessSummary: 'Auto summary (stub)', topicClusters: [] }
  }
}

export async function expandSeeds(topicClusters: string[], locale = 'en-US'): Promise<string[]> {
  if (!process.env.OPENAI_API_KEY) {
    return topicClusters.flatMap((t) => [`${t} guide`, `${t} tips`, `${t} checklist`]).slice(0, 30)
  }
  try {
    const { OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const prompt = `Generate 30 SEO keywords for these topic clusters in ${locale}. Output as a JSON array of strings only.\nClusters: ${topicClusters.join(', ')}`
    const resp = await client.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.5 })
    const text = resp.choices?.[0]?.message?.content || '[]'
    const arr = JSON.parse(text)
    return Array.isArray(arr) ? arr.map(String) : []
  } catch {
    return topicClusters.flatMap((t) => [`${t} ideas`, `${t} strategy`, `${t} best practices`]).slice(0, 30)
  }
}

export async function draftTitleOutline(keyword: string, locale = 'en-US'): Promise<{ title: string; outline: ArticleOutlineSection[] }> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      title: capitalize(keyword),
      outline: [
        { heading: `Introduction to ${keyword}` },
        { heading: `${keyword}: Key Concepts` },
        { heading: `${keyword}: Step-by-Step` },
        { heading: `Common Mistakes with ${keyword}` },
        { heading: `Conclusion` }
      ]
    }
  }
  try {
    const { OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const prompt = `Write an SEO-friendly article title and 5-7 H2 section headings (no descriptions) for the keyword: "${keyword}" in ${locale}. Output JSON: {"title":"...","outline":[{"heading":"..."}, ...]}`
    const resp = await client.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.5 })
    const text = resp.choices?.[0]?.message?.content || ''
    const parsed = JSON.parse(text)
    return { title: String(parsed.title || capitalize(keyword)), outline: Array.isArray(parsed.outline) ? parsed.outline.map((o: any) => ({ heading: String(o.heading || '') })) : [] }
  } catch {
    return { title: capitalize(keyword), outline: [{ heading: `About ${keyword}` }, { heading: `${keyword} Techniques` }, { heading: `FAQs` }] }
  }
}

export async function generateBody(options: {
  title: string
  outline: ArticleOutlineSection[]
  keyword?: string
  locale?: string
}): Promise<{ bodyHtml: string }> {
  const key = process.env.OPENAI_API_KEY
  if (!key) {
    const body = [`<article><h1>${escapeHtml(options.title)}</h1>`,
      ...options.outline.map((s) => `<h2>${escapeHtml(s.heading)}</h2><p>${escapeHtml('Draft content…')}</p>`),
      `</article>`
    ].join('')
    return { bodyHtml: body }
  }

  try {
    const { OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey: key })
    const outlineBullets = options.outline.map((s) => `- ${s.heading}`).join('\n')
    const prompt = `Write an HTML article in ${options.locale ?? 'en-US'} titled "${options.title}" following this outline:\n${outlineBullets}. Keep it well structured with <h2> sections.`
    const resp = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    })
    const text = resp.choices?.[0]?.message?.content ?? ''
    const html = text && /<\w+/.test(text) ? text : `<article><h1>${escapeHtml(options.title)}</h1><p>${escapeHtml(text || 'Draft content')}</p></article>`
    return { bodyHtml: html }
  } catch {
    const body = `<article><h1>${escapeHtml(options.title)}</h1><p>Generated draft body...</p></article>`
    return { bodyHtml: body }
  }
}

function escapeHtml(input: string) {
  return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function capitalize(s: string) {
  return s.slice(0, 1).toUpperCase() + s.slice(1)
}
