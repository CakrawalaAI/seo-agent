import { config } from '@common/config'
import * as bundle from '@common/bundle/store'

export type ArticleEval = {
  score: number
  suggestions: string[]
  at: string
}

export async function evaluateArticle(websiteId: string, articleId: string, input: { title: string; outline?: Array<{ heading: string }>; bodyHtml: string }) {
  const key = process.env.OPENAI_API_KEY
  const now = new Date().toISOString()
  let score = 0
  let suggestions: string[] = []
  if (!key) {
    // Fallback heuristic without LLM
    const wc = input.bodyHtml.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
    score = Math.max(20, Math.min(95, Math.round((Math.min(wc, 1500) / 1500) * 100)))
    suggestions = wc < 800 ? ['Increase word count to ~1200–1800 words'] : []
  } else {
    const { OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey: key })
    const prompt = `Evaluate this draft article for SEO readiness. Return JSON {score:0-100,suggestions:["..."]}. Focus on coverage vs outline, on-page SEO basics, readability, internal/external links (if visible). Keep suggestions short, actionable.\nTitle: ${input.title}\nOutline: ${(input.outline || []).map((o) => `- ${o.heading}`).join('\n')}\nHTML:\n${input.bodyHtml.slice(0, 6000)}`
    try {
      const resp = await client.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0, response_format: { type: 'json_object' as const } })
      const text = resp.choices?.[0]?.message?.content || '{}'
      const parsed = JSON.parse(text)
      score = Math.max(0, Math.min(100, Number(parsed?.score || 0)))
      suggestions = Array.isArray(parsed?.suggestions) ? parsed.suggestions.map(String).slice(0, 8) : []
    } catch {
      score = 0
      suggestions = []
    }
  }
  const out: ArticleEval = { score, suggestions, at: now }
  try { bundle.writeJson(websiteId, `articles/eval/${articleId}.json`, out) } catch {}
  return out
}
