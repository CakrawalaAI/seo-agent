import type { ArticleOutlineSection } from '@entities/article/domain/article'
import { log } from '@src/common/logger'
import { HTTP_TIMEOUT_MS } from '@src/common/http/timeout'
import { withRetry } from '@common/async/retry'
import {
  SUMMARIZE_SITE_SYSTEM_PROMPT,
  buildSummarizeSiteUserPrompt,
  SEED_KEYWORDS_SYSTEM_PROMPT,
  buildSeedKeywordsUserPrompt,
  DRAFT_OUTLINE_SYSTEM_PROMPT,
  buildDraftOutlineUserPrompt,
  GENERATE_BODY_SYSTEM_PROMPT,
  buildGenerateBodyUserPrompt,
  SUMMARIZE_PAGE_SYSTEM_PROMPT,
  buildSummarizePageUserPrompt
} from '@common/prompts'
import { buildPickTopFromSitemapPrompt, buildWebsiteProfileReformatPrompt } from '@common/prompts/summarize-website'

export type SiteSummary = {
  businessSummary: string
  audience?: string
  products?: string
  topicClusters: string[]
}

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-5-2025-08-07'
const LLM_MAX_CONCURRENCY = Math.max(1, Number(process.env.LLM_CONCURRENCY || 3))
let llmActive = 0
const llmQueue: Array<() => void> = []

async function acquireLlmGate(): Promise<void> {
  if (llmActive < LLM_MAX_CONCURRENCY) {
    llmActive++
    return
  }
  await new Promise<void>((resolve) => llmQueue.push(resolve))
  llmActive++
}

function releaseLlmGate() {
  llmActive = Math.max(0, llmActive - 1)
  const next = llmQueue.shift()
  if (next) next()
}

async function withLlmGate<T>(fn: () => Promise<T>): Promise<T> {
  await acquireLlmGate()
  try { return await fn() } finally { releaseLlmGate() }
}
async function getOpenAiClient() {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY missing')
  const { OpenAI } = await import('openai')
  return new OpenAI({ apiKey: key })
}

function containsRefusal(response: any): boolean {
  const chunks = Array.isArray(response?.output) ? response.output : []
  for (const chunk of chunks) {
    const content = Array.isArray(chunk?.content) ? chunk.content : []
    if (content.some((item: any) => item?.type === 'refusal')) return true
  }
  return false
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

/**
 * Generic JSON-structured output helper backed by OpenAI JSON Schema mode.
 * - Tries strict json_schema first
 * - Falls back to json_object
 * - Finally tries loose JSON extraction
 */
export async function llmJson<T = any>(args: {
  schema: any
  messages: Array<{ role: 'system' | 'user'; content: string }>
  label?: string
  model?: string
}): Promise<T> {
  const client = await getOpenAiClient()
  const model = args.model || DEFAULT_MODEL
  const label = args.label || 'llm.json'
  // Attempt strict json_schema
  try {
    const resp = await withRetry(
      () => withLlmGate(() => client.chat.completions.create(
          {
            model,
            messages: args.messages,
            response_format: {
              type: 'json_schema',
              json_schema: { name: 'structured_output', strict: true, schema: args.schema }
            } as any
          },
          { timeout: HTTP_TIMEOUT_MS }
        )),
      { label, retryOn: isRetryableLlmError, onRetry: ({ attempt, delayMs, error }) => log.warn(`[${label}] retry`, { attempt, delayMs, message: (error as Error)?.message }) }
    )
    const text = resp.choices?.[0]?.message?.content || ''
    return parseJsonLoose<T>(text)
  } catch (e) {
    log.debug(`[${label}] json_schema failed; trying json_object`, { message: (e as Error)?.message })
  }
  // Fallback json_object
  const resp2 = await withRetry(
    () => withLlmGate(() => client.chat.completions.create(
        { model, messages: args.messages, response_format: { type: 'json_object' as const } },
        { timeout: HTTP_TIMEOUT_MS }
      )),
    { label, retryOn: isRetryableLlmError, onRetry: ({ attempt, delayMs, error }) => log.warn(`[${label}] retry`, { attempt, delayMs, message: (error as Error)?.message }) }
  )
  const text2 = resp2.choices?.[0]?.message?.content || ''
  return parseJsonLoose<T>(text2)
}

export async function summarizeSite(pages: Array<{ url: string; title?: string; text?: string }>): Promise<SiteSummary> {
  const client = await getOpenAiClient()
  const sample = pages.slice(0, 5)
  const list = sample
    .map((p, i) => `${i + 1}. ${p.title || ''} (${p.url})\n${(p.text || '').slice(0, 600)}`)
    .join('\n\n')
  log.debug('[llm.summarizeSite] dispatch', { sampleCount: sample.length, model: DEFAULT_MODEL })
  try {
    const resp = await withRetry(
      () => withLlmGate(() => client.chat.completions.create(
          {
            model: DEFAULT_MODEL,
            messages: [
              { role: 'system', content: SUMMARIZE_SITE_SYSTEM_PROMPT },
              { role: 'user', content: buildSummarizeSiteUserPrompt(list) }
            ],
            response_format: { type: 'json_object' as const }
          },
          { timeout: HTTP_TIMEOUT_MS }
        )),
      {
        label: 'llm.summarizeSite',
        retryOn: isRetryableLlmError,
        onRetry: ({ attempt, delayMs, error }) => {
          log.warn('[llm.summarizeSite] retry', { attempt, delayMs, message: (error as Error)?.message })
        }
      }
    )
    const text = resp.choices?.[0]?.message?.content || ''
    const parsed = parseJsonLoose<SiteSummary>(text)
    if (!parsed || !Array.isArray(parsed.topicClusters)) throw new Error('LLM summary invalid JSON')
    log.debug('[llm.summarizeSite] success', { topicClusters: parsed.topicClusters.length })
    return parsed
  } catch (e) {
    throw new Error(`LLM summarize failed: ${(e as Error)?.message || String(e)}`)
  }
}

export async function expandSeeds(topicClusters: string[], locale = 'en-US', targetCount = 200): Promise<string[]> {
  const client = await getOpenAiClient()
  const target = Math.max(50, Math.min(targetCount, 200))
  const minSeeds = 50
  log.debug('[llm.expandSeeds] dispatch', { locale, target, clusters: topicClusters.length, model: DEFAULT_MODEL })
  try {
    const resp = await withRetry(
      () => withLlmGate(() => client.chat.completions.create(
          {
            model: DEFAULT_MODEL,
            messages: [
              { role: 'system', content: SEED_KEYWORDS_SYSTEM_PROMPT },
              { role: 'user', content: buildSeedKeywordsUserPrompt({ topicClusters, locale, targetCount: target }) }
            ],
            response_format: {
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
                      items: {
                        type: 'string',
                        minLength: 2,
                        maxLength: 60
                      }
                    }
                  }
                }
              }
            }
          },
          { timeout: HTTP_TIMEOUT_MS }
        )),
      {
        label: 'llm.expandSeeds',
        retryOn: isRetryableLlmError,
        onRetry: ({ attempt, delayMs, error }) => {
          log.warn('[llm.expandSeeds] retry', { attempt, delayMs, message: (error as Error)?.message })
        }
      }
    )
    const text = resp.choices?.[0]?.message?.content || ''
    const parsed = parseJsonLoose<any>(text)
    const rawSeeds = Array.isArray(parsed?.seeds) ? (parsed.seeds as unknown[]) : []
    if (!rawSeeds.length) throw new Error('LLM seed generation returned empty payload')
    const unique = Array.from(new Set(rawSeeds.map((seed: any) => String(seed || '').trim().toLowerCase()).filter(Boolean)))
    log.debug('[llm.expandSeeds] success', { requested: target, returned: rawSeeds.length, unique: unique.length })
    return unique.slice(0, target)
  } catch (e) {
    throw new Error(`LLM expand failed: ${(e as Error)?.message || String(e)}`)
  }
}

export async function draftTitleOutline(keyword: string, locale = 'en-US'): Promise<{ title: string; outline: ArticleOutlineSection[] }> {
  const client = await getOpenAiClient()
  const prompt = buildDraftOutlineUserPrompt(keyword, locale)
  log.debug('[llm.draftOutline] dispatch', { keyword, locale, model: DEFAULT_MODEL })
  try {
    const resp = await withRetry(
      () => withLlmGate(() => client.chat.completions.create(
          {
            model: DEFAULT_MODEL,
            messages: [
              { role: 'system', content: DRAFT_OUTLINE_SYSTEM_PROMPT },
              { role: 'user', content: `${prompt} Return strict JSON: {"title":"...","outline":[{"heading":"..."}]}.` }
            ],
            response_format: { type: 'json_object' as const }
          },
          { timeout: HTTP_TIMEOUT_MS }
        )),
      {
        label: 'llm.draftOutline',
        retryOn: isRetryableLlmError,
        onRetry: ({ attempt, delayMs, error }) => {
          log.warn('[llm.draftOutline] retry', { attempt, delayMs, message: (error as Error)?.message })
        }
      }
    )
    const text = resp.choices?.[0]?.message?.content || ''
    const parsed = parseJsonLoose<any>(text)
    log.debug('[llm.draftOutline] success', { keyword, outlineCount: Array.isArray(parsed.outline) ? parsed.outline.length : 0 })
    return {
      title: String(parsed.title || capitalize(keyword)),
      outline: Array.isArray(parsed.outline) ? parsed.outline.map((o: any) => ({ heading: String(o.heading || '') })) : []
    }
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
  const client = await getOpenAiClient()
  const outlineHeadings = options.outline.map((s) => s.heading)
  const userPrompt = buildGenerateBodyUserPrompt({
    title: options.title,
    outlineHeadings,
    locale: options.locale ?? 'en-US'
  })
  try {
    const resp = await withRetry(
      () => withLlmGate(() => client.chat.completions.create(
          {
            model: DEFAULT_MODEL,
            messages: [
              { role: 'system', content: GENERATE_BODY_SYSTEM_PROMPT },
              { role: 'user', content: userPrompt }
            ]
          },
          { timeout: HTTP_TIMEOUT_MS }
        )),
      {
        label: 'llm.generateBody',
        retryOn: isRetryableLlmError,
        onRetry: ({ attempt, delayMs, error }) => {
          log.warn('[llm.generateBody] retry', { attempt, delayMs, message: (error as Error)?.message })
        }
      }
    )
    const text = resp.choices?.[0]?.message?.content ?? ''
    const html = text && /<\w+/.test(text) ? text : `<article><h1>${escapeHtml(options.title)}</h1><p>${escapeHtml(text || 'Draft content')}</p></article>`
    log.debug('[llm.generateBody] completed', { title: options.title, locale: options.locale ?? 'en-US', outline: outlineHeadings.length })
    return { bodyHtml: html }
  } catch (e) {
    throw new Error(`LLM generate body failed: ${(e as Error)?.message || String(e)}`)
  }
}

export async function summarizePage(text: string): Promise<string> {
  const content = String(text || '').trim()
  if (!content) return ''
  const client = await getOpenAiClient().catch(() => null)
  if (!client) return content.replace(/\s+/g, ' ').slice(0, 360)
  try {
    const resp = await withRetry(
      () => withLlmGate(() => client.chat.completions.create(
          {
            model: DEFAULT_MODEL,
            messages: [
              { role: 'system', content: SUMMARIZE_PAGE_SYSTEM_PROMPT },
              { role: 'user', content: buildSummarizePageUserPrompt(content.slice(0, 4000)) }
            ]
          },
          { timeout: HTTP_TIMEOUT_MS }
        )),
      {
        label: 'llm.summarizePage',
        retryOn: isRetryableLlmError,
        onRetry: ({ attempt, delayMs, error }) => {
          log.warn('[llm.summarizePage] retry', { attempt, delayMs, message: (error as Error)?.message })
        }
      }
    )
    const textOut = resp.choices?.[0]?.message?.content || ''
    const clean = String(textOut).trim()
    log.debug('[llm.summarizePage] success', { length: clean.length })
    return clean || content.replace(/\s+/g, ' ').slice(0, 360)
  } catch (e) {
    return content.replace(/\s+/g, ' ').slice(0, 360)
  }
}

// Structured: extract concise, information-dense bullets from a page
export async function summarizePageBullets(text: string): Promise<string[]> {
  const content = String(text || '').trim()
  if (!content) return []
  try {
    const schema = {
      type: 'object',
      additionalProperties: false,
      required: ['bullets'],
      properties: {
        bullets: {
          type: 'array',
          items: { type: 'string', maxLength: 140 }
        }
      }
    }
    const messages = [
      {
        role: 'system' as const,
        content:
          'Extract factual bullets. Be exhaustive but concise. No fluff. No speculation. Each bullet ≤140 chars.'
      },
      {
        role: 'user' as const,
        content:
          'Return JSON {"bullets":[]}. Cover where available: offering/value; ICP/users; pricing/tiers/trials; proof (logos/metrics/certs); integrations; resources (blog/docs); contact/locations; compliance.\n\nCONTENT:\n' +
          content.slice(0, 12000)
      }
    ]
    const out = await llmJson<{ bullets: string[] }>({ schema, messages, label: 'llm.page_bullets' })
    const arr = Array.isArray(out?.bullets) ? out.bullets.map((s) => String(s || '').trim()).filter(Boolean) : []
    return arr
  } catch {
    // fallback: split first 3 sentences
    const sentences = content.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).slice(0, 5)
    return sentences.map((s) => s.slice(0, 140))
  }
}

// Structured: pick up to N representative URLs from a candidate list
export async function selectUrlsFromList(siteUrl: string, candidates: string[], maxN: number): Promise<string[]> {
  const n = Math.max(1, Math.min(maxN || 50, 500))
  const list = candidates.map((u) => String(u || '').trim()).filter(Boolean)
  if (!list.length) return []
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['urls'],
    properties: {
      urls: { type: 'array', maxItems: n, items: { type: 'string' } }
    }
  }
  const prompt = buildPickTopFromSitemapPrompt(siteUrl, n)

  // If the sitemap list is huge, batch it to avoid token overflow
  const BATCH = 400
  if (list.length > BATCH) {
    // 1) Per-batch selection in parallel
    const batches: string[][] = []
    for (let i = 0; i < list.length; i += BATCH) batches.push(list.slice(i, i + BATCH))
    const batchPromises = batches.map((chunk, idx) => {
      const messages = [
        { role: 'system' as const, content: 'Select representative URLs for business understanding.' },
        { role: 'user' as const, content: `${prompt}\n\nSitemap URLs (one per line):\n${chunk.join('\n')}` }
      ]
      return llmJson<{ urls: string[] }>({ schema, messages, label: `llm.url_pick.batch_${idx + 1}` }).catch(() => ({ urls: [] }))
    })
    const results = await Promise.all(batchPromises)
    const unionSet = new Set<string>()
    for (const r of results) {
      for (const u of (Array.isArray(r?.urls) ? r.urls : [])) {
        const s = String(u || '').trim()
        if (chunkContains(list, s)) unionSet.add(s)
      }
    }
    const union = list.filter((u) => unionSet.has(u))
    if (union.length <= n) return union
    // 2) Final downselect pass on the union (capped to 1000 to be safe)
    const finalCandidates = union.slice(0, 1000)
    const finalMessages = [
      { role: 'system' as const, content: 'Select representative URLs for business understanding.' },
      { role: 'user' as const, content: `${prompt}\n\nSitemap URLs (one per line):\n${finalCandidates.join('\n')}` }
    ]
    try {
      const out = await llmJson<{ urls: string[] }>({ schema, messages: finalMessages, label: 'llm.url_pick.reduce' })
      const urls = Array.isArray(out?.urls) ? out.urls.map((s) => String(s || '').trim()).filter((s) => finalCandidates.includes(s)) : []
      if (urls.length) return urls.slice(0, n)
      return finalCandidates.slice(0, n)
    } catch {
      return finalCandidates.slice(0, n)
    }
  }

  // Small list → single pass
  const messages = [
    { role: 'system' as const, content: 'Select representative URLs for business understanding.' },
    { role: 'user' as const, content: `${prompt}\n\nSitemap URLs (one per line):\n${list.join('\n')}` }
  ]
  try {
    const out = await llmJson<{ urls: string[] }>({ schema, messages, label: 'llm.url_pick' })
    const urls = Array.isArray(out?.urls) ? out.urls.map((s) => String(s || '').trim()).filter((s) => list.includes(s)) : []
    if (urls.length) return urls.slice(0, n)
  } catch {}
  return list.slice(0, n)
}

function chunkContains(arr: string[], value: string): boolean {
  if (!value) return false
  // Strict match only; LLM must return exact URLs from input
  return arr.includes(value)
}

// Reformat a concatenated bullet dump into an informative profile (no new facts)
export async function reformatWebsiteProfile(siteUrl: string, bulletDump: string): Promise<string> {
  const client = await getOpenAiClient()
  const model = DEFAULT_MODEL
  const user = buildWebsiteProfileReformatPrompt(siteUrl)
  const resp = await withRetry(
    () => withLlmGate(() => client.chat.completions.create(
        {
          model,
          messages: [
            { role: 'system', content: 'Reformat without information loss. Do not invent facts.' },
            { role: 'user', content: `${user}\n\nBULLETS BEGIN\n${bulletDump}\nBULLETS END` }
          ]
        },
        { timeout: HTTP_TIMEOUT_MS }
      )),
    { label: 'llm.website_reformat', retryOn: isRetryableLlmError, onRetry: ({ attempt, delayMs, error }) => log.warn('[llm.website_reformat] retry', { attempt, delayMs, message: (error as Error)?.message }) }
  )
  return resp.choices?.[0]?.message?.content?.trim() || ''
}

function escapeHtml(input: string) {
  return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function capitalize(s: string) {
  return s.slice(0, 1).toUpperCase() + s.slice(1)
}

function isRetryableLlmError(error: unknown): boolean {
  const status = (error as any)?.status
  if (typeof status === 'number' && (status >= 500 || status === 429)) {
    return true
  }
  const code = (error as any)?.code
  if (typeof code === 'string' && ['rate_limit_exceeded', '429'].includes(code.toLowerCase())) {
    return true
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    return msg.includes('timeout') || msg.includes('rate limit') || msg.includes('overloaded') || msg.includes('econn') || msg.includes('network')
  }
  return false
}
