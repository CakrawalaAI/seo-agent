import { HTTP_TIMEOUT_MS } from '@src/common/http/timeout'
import { withRetry } from '@common/async/retry'
import { log } from '@src/common/logger'
import {
  SUMMARIZE_SITE_SYSTEM_PROMPT,
  buildSummarizeSiteUserPrompt,
  SEED_KEYWORDS_SYSTEM_PROMPT,
  buildSeedKeywordsUserPrompt,
  SUMMARIZE_PAGE_SYSTEM_PROMPT,
  buildSummarizePageUserPrompt
} from '@common/prompts'
import { buildPickTopFromSitemapPrompt, buildWebsiteProfileReformatPrompt, buildWebsiteSummaryPrompt } from '@common/prompts/summarize-website'

export type SiteSummary = { businessSummary: string; topicClusters: string[]; audience?: string; products?: string }

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-5-2025-08-07'

async function getOpenAiClient() {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY missing')
  const { OpenAI } = await import('openai')
  return new OpenAI({ apiKey: key })
}

function parseJsonLoose<T = any>(text: string): T {
  const t = String(text || '').trim()
  try { return JSON.parse(t) } catch {}
  const fence = t.match(/```\s*json\s*([\s\S]*?)```/i) || t.match(/```\s*([\s\S]*?)```/)
  if (fence?.[1]) {
    const inner = fence[1].trim()
    try { return JSON.parse(inner) } catch {}
  }
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start >= 0 && end > start) {
    const body = t.slice(start, end + 1)
    try { return JSON.parse(body) } catch {}
  }
  throw new Error('invalid_json')
}

export async function llmJson<T = any>(args: { schema: any; messages: Array<{ role: 'system' | 'user'; content: string }>; label?: string; model?: string }): Promise<T> {
  const client = await getOpenAiClient()
  const model = args.model || DEFAULT_MODEL
  const label = args.label || 'llm.json'
  try {
    const resp = await withRetry(
      () => client.chat.completions.create(
        { model, messages: args.messages, response_format: { type: 'json_schema', json_schema: { name: 'structured_output', strict: true, schema: args.schema } } as any },
        { timeout: HTTP_TIMEOUT_MS }
      ),
      { label, retryOn: isRetryable, onRetry: ({ attempt, delayMs, error }) => log.warn(`[${label}] retry`, { attempt, delayMs, message: (error as Error)?.message }) }
    )
    return parseJsonLoose<T>(resp.choices?.[0]?.message?.content || '')
  } catch (e) {
    log.debug(`[${label}] json_schema failed; trying json_object`, { message: (e as Error)?.message })
  }
  const resp2 = await withRetry(
    () => client.chat.completions.create(
      { model, messages: args.messages, response_format: { type: 'json_object' as const } },
      { timeout: HTTP_TIMEOUT_MS }
    ),
    { label, retryOn: isRetryable, onRetry: ({ attempt, delayMs, error }) => log.warn(`[${label}] retry`, { attempt, delayMs, message: (error as Error)?.message }) }
  )
  return parseJsonLoose<T>(resp2.choices?.[0]?.message?.content || '')
}

export async function summarizeSite(pages: Array<{ url: string; title?: string; text?: string }>): Promise<SiteSummary> {
  const client = await getOpenAiClient()
  const sample = pages.slice(0, 5)
  const list = sample.map((p, i) => `${i + 1}. ${p.title || ''} (${p.url})\n${(p.text || '').slice(0, 600)}`).join('\n\n')
  const resp = await withRetry(
    () => client.chat.completions.create(
      { model: DEFAULT_MODEL, messages: [ { role: 'system', content: SUMMARIZE_SITE_SYSTEM_PROMPT }, { role: 'user', content: buildSummarizeSiteUserPrompt(list) } ], response_format: { type: 'json_object' as const } },
      { timeout: HTTP_TIMEOUT_MS }
    ),
    { label: 'llm.summarizeSite', retryOn: isRetryable, onRetry: ({ attempt, delayMs, error }) => log.warn('[llm.summarizeSite] retry', { attempt, delayMs, message: (error as Error)?.message }) }
  )
  const parsed = parseJsonLoose<SiteSummary>(resp.choices?.[0]?.message?.content || '')
  if (!Array.isArray(parsed.topicClusters)) throw new Error('LLM summary invalid JSON')
  return parsed
}

export async function summarizeSiteText(siteUrl: string, pages: Array<{ url: string; title?: string; text?: string }>): Promise<string> {
  const client = await getOpenAiClient()
  const sample = pages.slice(0, 6)
  const list = sample.map((p, i) => `${i + 1}. ${p.title || ''} (${p.url})\n${(p.text || '').slice(0, 900)}`).join('\n\n')
  const userPrompt = buildWebsiteSummaryPrompt(siteUrl)
  const resp = await withRetry(
    () => client.chat.completions.create(
      { model: DEFAULT_MODEL, messages: [ { role: 'system', content: 'Write a factual, executive-style business summary. No invented facts.' }, { role: 'user', content: `${userPrompt}\n\nCONTENT SAMPLES\n${list}` } ] },
      { timeout: HTTP_TIMEOUT_MS }
    ),
    { label: 'llm.summarizeSiteText', retryOn: isRetryable, onRetry: ({ attempt, delayMs, error }) => log.warn('[llm.summarizeSiteText] retry', { attempt, delayMs, message: (error as Error)?.message }) }
  )
  return String(resp.choices?.[0]?.message?.content || '').trim()
}

export async function expandSeeds(topicClusters: string[], locale = 'en-US', targetCount = 200): Promise<string[]> {
  const client = await getOpenAiClient()
  const target = Math.max(50, Math.min(targetCount, 200))
  const minSeeds = 50
  // Build json_schema separately to avoid TS parser quirks on a single long line
  const responseFormat: any = {
    type: 'json_schema',
    json_schema: {
      name: 'seed_keyword_generation',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['seeds'],
        properties: {
          seeds: {
            type: 'array',
            minItems: minSeeds,
            maxItems: target,
            items: { type: 'string', minLength: 2, maxLength: 60 }
          }
        }
      }
    }
  }
  const resp = await withRetry(
    () => client.chat.completions.create(
      {
        model: DEFAULT_MODEL,
        messages: [
          { role: 'system', content: SEED_KEYWORDS_SYSTEM_PROMPT },
          { role: 'user', content: buildSeedKeywordsUserPrompt({ topicClusters, locale, targetCount: target }) }
        ],
        response_format: responseFormat
      },
      { timeout: HTTP_TIMEOUT_MS }
    ),
    { label: 'llm.expandSeeds', retryOn: isRetryable, onRetry: ({ attempt, delayMs, error }) => log.warn('[llm.expandSeeds] retry', { attempt, delayMs, message: (error as Error)?.message }) }
  )
  const text = resp.choices?.[0]?.message?.content || ''
  const parsed = parseJsonLoose<any>(text)
  const raw = Array.isArray(parsed?.seeds) ? parsed.seeds : []
  const mapped = raw.map((s: any) => String(s || '').trim().toLowerCase())
  const filtered: string[] = mapped.filter((s: string): s is string => Boolean(s))
  const unique: string[] = Array.from(new Set<string>(filtered))
  return unique.slice(0, target)
}

export async function summarizePageBullets(content: string): Promise<string[]> {
  const client = await getOpenAiClient()
  const schema = { type: 'object', additionalProperties: false, required: ['bullets'], properties: { bullets: { type: 'array', maxItems: 8, items: { type: 'string', minLength: 10, maxLength: 200 } } } }
  const messages = [ { role: 'system' as const, content: SUMMARIZE_PAGE_SYSTEM_PROMPT }, { role: 'user' as const, content: 'Return 5–8 bullets capturing KEY facts from the page. No opinions. Start bullets without dashes.' + '\n\nCONTENT:\n' + content.slice(0, 12000) } ]
  try {
    const out = await llmJson<{ bullets: string[] }>({ schema, messages, label: 'llm.page_bullets' })
    const arr = Array.isArray(out?.bullets) ? out.bullets.map((s) => String(s || '').trim()).filter(Boolean) : []
    return arr
  } catch {
    const sentences = content.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).slice(0, 5)
    return sentences.map((s) => s.slice(0, 140))
  }
}

export async function selectUrlsFromList(siteUrl: string, candidates: string[], maxN: number): Promise<string[]> {
  const n = Math.max(1, Math.min(maxN || 50, 500))
  const list = candidates.map((u) => String(u || '').trim()).filter(Boolean)
  if (!list.length) return []
  const schema = { type: 'object', additionalProperties: false, required: ['urls'], properties: { urls: { type: 'array', maxItems: n, items: { type: 'string' } } } }
  const prompt = buildPickTopFromSitemapPrompt(siteUrl, n)
  const messages = [ { role: 'system' as const, content: 'Select representative URLs for business understanding.' }, { role: 'user' as const, content: `${prompt}\n\nSitemap URLs (one per line):\n${list.join('\n')}` } ]
  try {
    const out = await llmJson<{ urls: string[] }>({ schema, messages, label: 'llm.url_pick' })
    const urls = Array.isArray(out?.urls) ? out.urls.map((s) => String(s || '').trim()).filter((s) => list.includes(s)) : []
    if (urls.length) return urls.slice(0, n)
  } catch {}
  return list.slice(0, n)
}

export async function reformatWebsiteProfile(siteUrl: string, bulletDump: string): Promise<string> {
  const client = await getOpenAiClient()
  const model = DEFAULT_MODEL
  const user = buildWebsiteProfileReformatPrompt(siteUrl)
  const resp = await withRetry(
    () => client.chat.completions.create(
      { model, messages: [ { role: 'system', content: 'Reformat without information loss. Do not invent facts.' }, { role: 'user', content: `${user}\n\nBULLETS BEGIN\n${bulletDump}\nBULLETS END` } ] },
      { timeout: HTTP_TIMEOUT_MS }
    ),
    { label: 'llm.website_reformat', retryOn: isRetryable, onRetry: ({ attempt, delayMs, error }) => log.warn('[llm.website_reformat] retry', { attempt, delayMs, message: (error as Error)?.message }) }
  )
  return resp.choices?.[0]?.message?.content?.trim() || ''
}

function isRetryable(error: unknown): boolean {
  const status = (error as any)?.status
  if (typeof status === 'number' && (status >= 500 || status === 429)) return true
  const code = (error as any)?.code
  if (typeof code === 'string' && ['rate_limit_exceeded', '429'].includes(code.toLowerCase())) return true
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    return msg.includes('timeout') || msg.includes('rate limit') || msg.includes('overloaded') || msg.includes('econn') || msg.includes('network')
  }
  return false
}
