import type { SerpProvider, SerpSnapshot, SerpItem } from '../../interfaces/serp'
import { getAuthHeader } from './auth'
import { log } from '@src/common/logger'
import { DATAFORSEO_DEFAULT_LOCATION_CODE, languageNameFromCode } from './geo'
import { HTTP_TIMEOUT_MS } from '@src/common/http/timeout'

const BASE_URL = 'https://api.dataforseo.com'
const ENDPOINT = '/v3/serp/google/organic/live/regular'

type FetchSerpParams = {
  keyword: string
  languageCode?: string | null
  locationCode?: number | null
  device?: 'desktop' | 'mobile'
}

type RawSerpItem = {
  rank_group?: number
  rank_absolute?: number
  url?: string
  title?: string
  description?: string
  type?: string
  types?: string[]
}

async function fetchSerpOrganic(params: FetchSerpParams): Promise<RawSerpItem[]> {
  const keyword = String(params.keyword || '').trim()
  if (!keyword) throw new Error('serpOrganic: keyword required')

  const location = typeof params.locationCode === 'number' && params.locationCode > 0 ? Math.trunc(params.locationCode) : DATAFORSEO_DEFAULT_LOCATION_CODE
  const languageName = languageNameFromCode(params.languageCode || 'en')
  const device = params.device === 'mobile' ? 'mobile' : 'desktop'

  const auth = getAuthHeader()
  if (!auth) throw new Error('DataForSEO credentials missing')

  const payload = JSON.stringify([
    {
      keyword,
      location_code: location,
      language_name: languageName,
      device
    }
  ])

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS)

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

    const text = await res.text()
    if (!res.ok) {
      log.error('[dfs] serp http_error', { status: res.status, response: summarizeBody(text), device })
      throw new Error(`DataForSEO HTTP ${res.status}`)
    }

    const json = safeParseJson(text)
    if (!json || !Array.isArray(json.tasks) || !json.tasks.length) {
      log.warn('[dfs] serp empty', { keyword, location_code: location, language_name: languageName, device })
      return []
    }

    const items: RawSerpItem[] = []
    for (const task of json.tasks) {
      const resultBlocks = Array.isArray(task?.result) ? task.result : []
      for (const block of resultBlocks) {
        const blockItems = Array.isArray(block?.items) ? block.items : []
        for (const raw of blockItems) {
          items.push(raw)
        }
      }
    }
    return items
  } finally {
    clearTimeout(timer)
  }
}

function toTextDump(items: SerpItem[]) {
  return items
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .map((i) => `#${i.rank} ${i.title ?? ''} ${i.url}\n${i.snippet ?? ''}`.trim())
    .join('\n\n')
}

function normalizeSerpItems(raw: RawSerpItem[], topK: number): SerpItem[] {
  return raw
    .filter((item) => typeof item?.rank_group === 'number')
    .slice(0, topK)
    .map((item) => {
      const rank = Number(item.rank_group)
      const types = Array.isArray(item.types)
        ? item.types.map((t) => String(t))
        : item.type
          ? [String(item.type)]
          : []
      return {
        rank,
        url: String(item.url || ''),
        title: item.title ? String(item.title) : undefined,
        snippet: item.description ? String(item.description) : undefined,
        types
      }
    })
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

export const dataForSeoSerp: SerpProvider = {
  async ensure({ canon, locationCode, device = 'desktop', topK = 10 }) {
    const fetchedAt = new Date().toISOString()
    const raw = await fetchSerpOrganic({
      keyword: canon.phrase,
      languageCode: canon.language,
      locationCode: locationCode ?? DATAFORSEO_DEFAULT_LOCATION_CODE,
      device
    })
    const items = normalizeSerpItems(raw, topK)
    const snapshot: SerpSnapshot = {
      fetchedAt,
      engine: 'google',
      device,
      topK,
      items,
      textDump: toTextDump(items)
    }
    return snapshot
  }
}
