import type { ArticleOutlineSection } from '@entities/article/domain/article'

export type SiteSummary = {
  businessSummary: string
  audience?: string
  products?: string
  topicClusters: string[]
}

function parseJsonLoose<T = any>(text: string): T {
  const t = String(text || '').trim()
  try { return JSON.parse(t) } catch {}
  // code fence ```json ... ```
  const fence = t.match(/```\s*json\s*([\s\S]*?)```/i) || t.match(/```\s*([\s\S]*?)```/)
  if (fence?.[1]) {
    const inner = fence[1].trim()
    try { return JSON.parse(inner) } catch {}
  }
  // fallback: first {...} block
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start >= 0 && end > start) {
    const body = t.slice(start, end + 1)
    try { return JSON.parse(body) } catch {}
  }
  throw new Error('invalid_json')
}

export async function summarizeSite(pages: Array<{ url: string; title?: string; text?: string }>): Promise<SiteSummary> {
  const key = process.env.OPENAI_API_KEY
  const sample = pages.slice(0, 5)
  if (!key) throw new Error('OPENAI_API_KEY missing')
  try {
    const { OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey: key })
    const list = sample
      .map((p, i) => `${i + 1}. ${p.title || ''} (${p.url})\n${(p.text || '').slice(0, 600)}`)
      .join('\n\n')
    const prompt = `You are an SEO strategist. Read the page snippets below and summarize the business. Then propose exactly 5 topical clusters tightly aligned with the business (no generic outdoors/recipes/etc). Return strict JSON: {"businessSummary":"...","topicClusters":["..."]}. No markdown or code fences.\n\n${list}`
    const resp = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      response_format: { type: 'json_object' as const }
    })
    const text = resp.choices?.[0]?.message?.content || ''
    const parsed = parseJsonLoose<SiteSummary>(text)
    if (!parsed || !Array.isArray(parsed.topicClusters)) throw new Error('LLM summary invalid JSON')
    return parsed
  } catch (e) {
    throw new Error(`LLM summarize failed: ${(e as Error)?.message || String(e)}`)
  }
}

export async function expandSeeds(topicClusters: string[], locale = 'en-US'): Promise<string[]> {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY missing')
  try {
    const { OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const prompt = `Generate 30 SEO keywords for these topic clusters in ${locale}. Output JSON array of strings only. No markdown.`
    const resp = await client.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: `${prompt}\nClusters: ${topicClusters.join(', ')}` }], temperature: 0.5, response_format: { type: 'json_object' as const } }).catch(async () => {
      // some models require array type; fallback without response_format
      return await client.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: `${prompt}\nClusters: ${topicClusters.join(', ')}` }], temperature: 0.5 })
    })
    const text = resp.choices?.[0]?.message?.content || '[]'
    const parsed = parseJsonLoose<any>(text)
    const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.keywords) ? parsed.keywords : [])
    return Array.isArray(arr) ? arr.map(String) : []
  } catch (e) {
    throw new Error(`LLM expand failed: ${(e as Error)?.message || String(e)}`)
  }
}

export async function draftTitleOutline(keyword: string, locale = 'en-US'): Promise<{ title: string; outline: ArticleOutlineSection[] }> {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY missing')
  try {
    const { OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const prompt = `Write an SEO-friendly article title and 5-7 H2 section headings (no descriptions) for the keyword: "${keyword}" in ${locale}. Return strict JSON: {"title":"...","outline":[{"heading":"..."}]}. No markdown.`
    const resp = await client.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.5, response_format: { type: 'json_object' as const } })
    const text = resp.choices?.[0]?.message?.content || ''
    const parsed = parseJsonLoose<any>(text)
    return { title: String(parsed.title || capitalize(keyword)), outline: Array.isArray(parsed.outline) ? parsed.outline.map((o: any) => ({ heading: String(o.heading || '') })) : [] }
  } catch (e) {
    throw new Error(`LLM draft outline failed: ${(e as Error)?.message || String(e)}`)
  }
}

export async function generateBody(options: {
  title: string
  outline: ArticleOutlineSection[]
  keyword?: string
  locale?: string
}): Promise<{ bodyHtml: string }> {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY missing')

  try {
    const { OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey: key })
    const outlineBullets = options.outline.map((s) => `- ${s.heading}`).join('\n')
    const prompt = `Write an HTML article in ${options.locale ?? 'en-US'} titled "${options.title}" following this outline:\n${outlineBullets}. Output raw HTML only. No markdown.`
    const resp = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    })
    const text = resp.choices?.[0]?.message?.content ?? ''
    const html = text && /<\w+/.test(text) ? text : `<article><h1>${escapeHtml(options.title)}</h1><p>${escapeHtml(text || 'Draft content')}</p></article>`
    return { bodyHtml: html }
  } catch (e) {
    throw new Error(`LLM generate body failed: ${(e as Error)?.message || String(e)}`)
  }
}

function escapeHtml(input: string) {
  return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function capitalize(s: string) {
  return s.slice(0, 1).toUpperCase() + s.slice(1)
}

// removed path-based stub fallback
