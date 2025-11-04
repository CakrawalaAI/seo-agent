import type { ArticleOutlineSection } from '@entities/article/domain/article'
import { log } from '@src/common/logger'
import { HTTP_TIMEOUT_MS } from '@src/common/http/timeout'
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

export type SiteSummary = {
  businessSummary: string
  audience?: string
  products?: string
  topicClusters: string[]
}

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-5-2025-08-07'
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

export async function summarizeSite(pages: Array<{ url: string; title?: string; text?: string }>): Promise<SiteSummary> {
  const client = await getOpenAiClient()
  const sample = pages.slice(0, 5)
  const list = sample
    .map((p, i) => `${i + 1}. ${p.title || ''} (${p.url})\n${(p.text || '').slice(0, 600)}`)
    .join('\n\n')
  log.debug('[llm.summarizeSite] dispatch', { sampleCount: sample.length, model: DEFAULT_MODEL })
  try {
    const resp = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: SUMMARIZE_SITE_SYSTEM_PROMPT },
        { role: 'user', content: buildSummarizeSiteUserPrompt(list) }
      ],
      response_format: { type: 'json_object' as const }
    }, { timeout: HTTP_TIMEOUT_MS })
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
    const resp = await client.chat.completions.create({
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
    }, { timeout: HTTP_TIMEOUT_MS })
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
    const resp = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: DRAFT_OUTLINE_SYSTEM_PROMPT },
        { role: 'user', content: `${prompt} Return strict JSON: {"title":"...","outline":[{"heading":"..."}]}.` }
      ],
      response_format: { type: 'json_object' as const }
    }, { timeout: HTTP_TIMEOUT_MS })
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
    const resp = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: GENERATE_BODY_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ]
    }, { timeout: HTTP_TIMEOUT_MS })
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
    const resp = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: SUMMARIZE_PAGE_SYSTEM_PROMPT },
        { role: 'user', content: buildSummarizePageUserPrompt(content.slice(0, 4000)) }
      ]
    }, { timeout: HTTP_TIMEOUT_MS })
    const textOut = resp.choices?.[0]?.message?.content || ''
    const clean = String(textOut).trim()
    log.debug('[llm.summarizePage] success', { length: clean.length })
    return clean || content.replace(/\s+/g, ' ').slice(0, 360)
  } catch (e) {
    return content.replace(/\s+/g, ' ').slice(0, 360)
  }
}

function escapeHtml(input: string) {
  return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function capitalize(s: string) {
  return s.slice(0, 1).toUpperCase() + s.slice(1)
}
