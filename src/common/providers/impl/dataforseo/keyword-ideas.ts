import { getAuthHeader } from './auth'
import { log } from '@src/common/logger'

const BASE_URL = 'https://api.dataforseo.com'
const ENDPOINT = '/v3/dataforseo_labs/google/keyword_ideas/live'

export type KeywordIdeaItem = {
  keyword: string
  keyword_info: Record<string, unknown> | null
  keyword_properties: Record<string, unknown> | null
  impressions_info: Record<string, unknown> | null
}

export type KeywordIdeasParams = {
  keywords: string[]
  locationCode: number
  languageCode: string
  limit?: number
}

function sanitizeKeywords(keywords: string[]): string[] {
  const cleaned = keywords.map((kw) => String(kw || '').trim()).filter(Boolean)
  if (!cleaned.length) throw new Error('keywordIdeas: at least one keyword required')
  if (cleaned.length > 200) throw new Error(`keywordIdeas: received ${cleaned.length} keywords; max 200`)
  return cleaned
}

export async function keywordIdeas(params: KeywordIdeasParams): Promise<KeywordIdeaItem[]> {
  const keywords = sanitizeKeywords(params.keywords)
  const auth = getAuthHeader()
  if (!auth) throw new Error('DataForSEO credentials missing')
  log.debug('[dfs.keywordIdeas] sanitized keywords', {
    keywords,
    locationCode: params.locationCode,
    languageCode: params.languageCode,
    limit: params.limit ?? null
  })

  const task: Record<string, unknown> = {
    keywords,
    location_code: params.locationCode,
    language_code: params.languageCode,
    include_serp_info: false
  }
  if (params.limit && params.limit > 0) task.limit = Math.floor(params.limit)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)
  const payload = JSON.stringify([task])
  log.debug('[dfs.keywordIdeas] dispatch', {
    endpoint: ENDPOINT,
    payload: task,
    timeoutMs: 20_000
  })

  try {
    const res = await fetch(`${BASE_URL}${ENDPOINT}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: auth
      },
      body: payload,
      signal: controller.signal
    })
    log.debug('[dfs.keywordIdeas] response received', { status: res.status })

    const text = await res.text()
    if (!res.ok) {
      log.error('[dfs] keywordIdeas http_error', { status: res.status, response: summarizeBody(text) })
      throw new Error(`DataForSEO HTTP ${res.status}`)
    }

    const json = safeParseJson(text)
    if (!json) {
      log.warn('[dfs] keywordIdeas invalid_json')
      return []
    }

    const items: KeywordIdeaItem[] = []
    for (const task of Array.isArray(json?.tasks) ? json.tasks : []) {
      const results = Array.isArray(task?.result) ? task.result : []
      for (const block of results) {
        const rawItems = Array.isArray(block?.items) ? block.items : []
        for (const raw of rawItems) {
          const keyword = String(raw?.keyword || raw?.keyword_data?.keyword || '').trim()
          if (!keyword) continue
          items.push({
            keyword,
            keyword_info: normalizeObject(raw?.keyword_info),
            keyword_properties: normalizeObject(raw?.keyword_properties),
            impressions_info: normalizeObject(raw?.impressions_info)
          })
        }
      }
    }
    log.debug('[dfs.keywordIdeas] parsed items', {
      total: items.length,
      keywords: items.map((item) => item.keyword)
    })
    return items
  } finally {
    clearTimeout(timeout)
  }
}

function normalizeObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

function safeParseJson(text: string): any {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function summarizeBody(text: string): Record<string, unknown> {
  if (!text) return {}
  const parsed = safeParseJson(text)
  if (parsed && typeof parsed === 'object') {
    const out: Record<string, unknown> = {}
    if (parsed.status_code !== undefined) out.statusCode = parsed.status_code
    if (parsed.status_message) out.statusMessage = parsed.status_message
    if (parsed.error) out.error = parsed.error
    if (parsed.error_message) out.errorMessage = parsed.error_message
    return Object.keys(out).length ? out : { raw: truncate(text) }
  }
  return { raw: truncate(text) }
}

function truncate(value: string, max = 240) {
  return value.length <= max ? value : `${value.slice(0, max)}…`
}
