import { getAuthHeader } from './auth'
import { log } from '@src/common/logger'
import { HTTP_TIMEOUT_MS } from '@src/common/http/timeout'

const BASE_URL = 'https://api.dataforseo.com'
const ENDPOINT = '/v3/dataforseo_labs/google/keyword_overview/live'

export type KeywordOverviewItem = {
  keyword: string
  keyword_info: Record<string, unknown> | null
  keyword_properties: Record<string, unknown> | null
  impressions_info: Record<string, unknown> | null
}

export async function keywordOverview(params: { keyword: string; languageCode: string; locationCode: number }): Promise<KeywordOverviewItem | null> {
  const keyword = String(params.keyword || '').trim()
  if (!keyword) throw new Error('keywordOverview: keyword required')
  const auth = getAuthHeader()
  if (!auth) throw new Error('DataForSEO credentials missing')

  const task = {
    keyword,
    language_code: params.languageCode,
    location_code: params.locationCode
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS)

  try {
    const res = await fetch(`${BASE_URL}${ENDPOINT}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: auth
      },
      body: JSON.stringify([task]),
      signal: controller.signal
    })
    log.debug('[dfs.keywordOverview] response', { status: res.status, keyword, languageCode: params.languageCode, locationCode: params.locationCode })

    const text = await res.text()
    if (!res.ok) {
      log.error('[dfs.keywordOverview] http_error', { status: res.status, summary: summarizeBody(text) })
      throw new Error(`DataForSEO HTTP ${res.status}`)
    }

    const json = safeParseJson(text)
    if (!json) {
      log.warn('[dfs.keywordOverview] invalid_json')
      return null
    }

    for (const taskResult of Array.isArray(json?.tasks) ? json.tasks : []) {
      const results = Array.isArray(taskResult?.result) ? taskResult.result : []
      for (const result of results) {
        const overview = result?.keyword_data || result
        const formatted: KeywordOverviewItem = {
          keyword: String(overview?.keyword || overview?.keyword_info?.keyword || keyword || '').trim(),
          keyword_info: normalizeObject(overview?.keyword_info || result?.keyword_info),
          keyword_properties: normalizeObject(overview?.keyword_properties || result?.keyword_properties),
          impressions_info: normalizeObject(overview?.impressions_info || result?.impressions_info)
        }
        if (formatted.keyword) return formatted
      }
    }

    log.warn('[dfs.keywordOverview] no results', { keyword })
    return null
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
