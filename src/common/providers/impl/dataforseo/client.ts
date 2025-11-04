import { getAuthHeader } from './auth'
import { log } from '@src/common/logger'
import {
  DATAFORSEO_DEFAULT_LANGUAGE_CODE,
  DATAFORSEO_DEFAULT_LOCATION_CODE,
  DATAFORSEO_LANGUAGES,
  type DataForSeoLanguage
} from './geo'

export type DFSKeywordOverview = {
  search_volume?: number
  cpc?: number
  competition?: number
  keyword_difficulty?: number
  monthly_searches?: Array<{ year: number; month: number; search_volume: number }>
}

export type DFSSerpItem = {
  rank_group?: number
  url?: string
  title?: string
  description?: string
  type?: string
  types?: string[]
}

export type KeywordDifficultyRecord = { keyword: string; difficulty?: number }
export type SearchVolumeRecord = { keyword: string; metrics: { searchVolume?: number; cpc?: number; competition?: number; asOf?: string } }

const BASE_URL = 'https://api.dataforseo.com'

type GeoParams = {
  locationCode?: number | null
  languageCode?: string | null
  languageName?: string | null
}

type KeywordArrayParams = GeoParams & { keywords: string[]; limit?: number }

type SingleKeywordParams = GeoParams & { keyword: string }

type SiteParams = GeoParams & { target: string }

function ensureKeywords(name: string, keywords: string[], max: number): string[] {
  const cleaned = keywords.map((k) => String(k || '').trim()).filter(Boolean)
  if (!cleaned.length) throw new Error(`${name}: at least one keyword required`)
  if (cleaned.length > max) {
    throw new Error(`${name}: received ${cleaned.length} keywords; max ${max}`)
  }
  return cleaned
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items.slice()]
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

function resolveLanguageName({ languageCode, languageName }: GeoParams): { name: string; record: DataForSeoLanguage | null } {
  if (languageName && languageName.trim()) {
    const trimmed = languageName.trim()
    const match = DATAFORSEO_LANGUAGES.find((l) => l.name.toLowerCase() === trimmed.toLowerCase())
    return { name: match?.name ?? trimmed, record: match ?? null }
  }
  if (languageCode && languageCode.trim()) {
    const code = languageCode.trim().toLowerCase()
    let match = DATAFORSEO_LANGUAGES.find((l) => l.code.toLowerCase() === code)
    if (!match && code.includes('-')) {
      const prefix = code.split('-')[0]!
      match = DATAFORSEO_LANGUAGES.find((l) => l.code.toLowerCase() === prefix)
    }
    if (!match) {
      match = DATAFORSEO_LANGUAGES.find((l) => l.name.toLowerCase() === code)
    }
    if (match) return { name: match.name, record: match }
  }
  const fallback = DATAFORSEO_LANGUAGES.find((l) => l.code === DATAFORSEO_DEFAULT_LANGUAGE_CODE) || { code: 'en', name: 'English' }
  return { name: fallback.name, record: fallback }
}

function resolveLocationCode(locationCode?: number | null): number {
  if (typeof locationCode === 'number' && Number.isFinite(locationCode) && locationCode > 0) {
    return Math.trunc(locationCode)
  }
  return DATAFORSEO_DEFAULT_LOCATION_CODE
}

class DataForSeoClient {
  private async post(path: string, tasks: unknown[]): Promise<any> {
    if (!Array.isArray(tasks)) {
      throw new Error('DataForSEO payload must be an array of task objects')
    }
    const auth = getAuthHeader()
    if (!auth) throw new Error('DataForSEO credentials missing')
    const timeoutMs = 20000
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const dbg = false
    const url = `${BASE_URL}${path}`
    const bodyString = JSON.stringify(tasks)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: auth },
        body: bodyString,
        signal: controller.signal
      })
      const text = await res.text()
      if (!res.ok) {
        log.error('[dfs] http_error', {
          path,
          status: res.status,
          request: summarizeTasksPayload(tasks),
          response: summarizeErrorBody(text)
        })
        throw new Error(`DataForSEO HTTP ${res.status}`)
      }
      const json = JSON.parse(text)
      if (dbg) {
        const summary: Record<string, unknown> = {
          path,
          status: res.status,
          request: { tasks: tasks.length }
        }
        const tasksCount = typeof json?.tasks_count === 'number' ? json.tasks_count : Array.isArray(json?.tasks) ? json.tasks.length : undefined
        const tasksError = typeof json?.tasks_error === 'number' ? json.tasks_error : undefined
        if (tasksCount !== undefined) summary.tasksCount = tasksCount
        if (tasksError !== undefined) summary.tasksError = tasksError
        if (typeof json?.cost === 'number') summary.cost = json.cost
        if ((tasksError ?? 0) > 0 && Array.isArray(json?.tasks)) {
          summary.errorSamples = json.tasks
            .filter((t: any) => t?.status_code && t.status_code !== 20000)
            .slice(0, 3)
            .map((t: any) => ({ code: t.status_code, message: t.status_message }))
        }
        log.info('[dfs] ok', summary)
      }
      return json
    } finally {
      clearTimeout(timer)
    }
  }

  private resolveGeo(params: GeoParams): { locationCode: number; languageName: string } {
    const locationCode = resolveLocationCode(params.locationCode)
    const { name: languageName } = resolveLanguageName(params)
    return { locationCode, languageName }
  }

  async keywordOverview(params: KeywordArrayParams): Promise<Map<string, DFSKeywordOverview>> {
    const keywords = ensureKeywords('keywordOverview', params.keywords, 700)
    const { locationCode, languageName } = this.resolveGeo(params)
    const map = new Map<string, DFSKeywordOverview>()
    for (const chunk of chunkArray(keywords, 700)) {
      const json = await this.post('/v3/dataforseo_labs/google/keyword_overview/live', [
        { keywords: chunk, location_code: locationCode, language_name: languageName }
      ])
      if (!Array.isArray(json?.tasks) || !json.tasks.length) {
        log.warn('[dfs] keywordOverview empty', { keywords: chunk.length, locationCode, languageName })
        continue
      }
      for (const task of json.tasks) {
        const fallbackKeywords: string[] = []
        const taskData = task?.data
        if (Array.isArray(taskData?.[0]?.keywords)) {
          for (const kw of taskData[0].keywords) {
            if (kw) fallbackKeywords.push(String(kw))
          }
        }
        const buckets = task?.result ?? []
        for (const bucket of buckets) {
          const rawItems = Array.isArray(bucket?.items) ? bucket.items : [bucket]
          for (const item of rawItems) {
            const keyword = String(item?.keyword || fallbackKeywords?.[0] || '').toLowerCase()
            const info: DFSKeywordOverview | undefined = item?.keyword_info
            if (keyword && info) map.set(keyword, info)
          }
        }
      }
    }
    return map
  }

  async searchVolume(params: KeywordArrayParams): Promise<SearchVolumeRecord[]> {
    const keywords = ensureKeywords('searchVolume', params.keywords, 1000)
    const { locationCode, languageName } = this.resolveGeo(params)
    const out: SearchVolumeRecord[] = []
    for (const chunk of chunkArray(keywords, 1000)) {
      const json = await this.post('/v3/keywords_data/google_ads/search_volume/live', [
        { keywords: chunk, location_code: locationCode, language_name: languageName }
      ])
      if (!Array.isArray(json?.tasks) || !json.tasks.length) {
        log.warn('[dfs] searchVolume empty', { keywords: chunk.length, locationCode, languageName })
        continue
      }
      for (const task of json.tasks) {
        const items = task?.result?.[0]?.items ?? []
        for (const item of items) {
          const keyword = String(item?.keyword || '').toLowerCase()
          if (!keyword) continue
          out.push({
            keyword,
            metrics: {
              searchVolume: typeof item?.search_volume === 'number' ? item.search_volume : undefined,
              cpc: typeof item?.cpc === 'number' ? item.cpc : undefined,
              competition: typeof item?.competition === 'number' ? item.competition : undefined,
              asOf: new Date().toISOString()
            }
          })
        }
      }
    }
    return out
  }

  async keywordsForKeywordsDetailed(params: KeywordArrayParams): Promise<Array<{ keyword: string; keyword_info?: any; keyword_properties?: any }>> {
    const keywords = ensureKeywords('keywordsForKeywords', params.keywords, 200)
    const { locationCode, languageName } = this.resolveGeo(params)
    const payload = [
      {
        keywords,
        location_code: locationCode,
        language_name: languageName
      }
    ]
    const json = await this.post('/v3/keywords_data/google_ads/keywords_for_keywords/live', payload)
    if (!Array.isArray(json?.tasks) || !json.tasks.length) {
      log.warn('[dfs] keywordsForKeywords empty', { keywords: keywords.length, locationCode, languageName })
      return []
    }
    const out: Array<{ keyword: string; keyword_info?: any; keyword_properties?: any }> = []
    for (const task of json?.tasks ?? []) {
      const results = Array.isArray(task?.result) ? task.result : []
      for (const block of results) {
        const items = Array.isArray(block?.items) ? block.items : []
        for (const item of items) {
          const keyword = String(item?.keyword || item?.keyword_data?.keyword || '').trim()
          if (!keyword) continue
          out.push({ keyword, keyword_info: item?.keyword_info ?? null, keyword_properties: item?.keyword_properties ?? null })
        }
      }
    }
    return out
  }

  async keywordsForKeywords(params: KeywordArrayParams): Promise<string[]> {
    const rows = await this.keywordsForKeywordsDetailed(params)
    return rows.map((row) => row.keyword)
  }

  async keywordsForSite(params: SiteParams): Promise<string[]> {
    const target = String(params.target || '').trim()
    if (!target) throw new Error('keywordsForSite: target required')
    const { locationCode, languageName } = this.resolveGeo(params)
    const tasks = [{ target, location_code: locationCode, language_name: languageName }]
    const json = await this.post('/v3/dataforseo_labs/google/keywords_for_site/live', tasks)
    if (!Array.isArray(json?.tasks) || !json.tasks.length) {
      log.warn('[dfs] keywordsForSite empty', { target, locationCode, languageName })
    }
    return extractKeywordsFromDataforseoResponse(json)
  }

  async relatedKeywords(params: KeywordArrayParams): Promise<string[]> {
    const keywords = ensureKeywords('relatedKeywords', params.keywords, 20)
    const { locationCode, languageName } = this.resolveGeo(params)
    const out: string[] = []
    for (const keyword of keywords) {
      const json = await this.post('/v3/dataforseo_labs/google/related_keywords/live', [
        { keyword, location_code: locationCode, language_name: languageName }
      ])
      if (!Array.isArray(json?.tasks) || !json.tasks.length) {
        log.warn('[dfs] relatedKeywords empty', { keyword, locationCode, languageName })
        continue
      }
      out.push(...extractKeywordsFromDataforseoResponse(json))
    }
    return out
  }

  async keywordIdeas(params: KeywordArrayParams): Promise<string[]> {
    const keywords = ensureKeywords('keywordIdeas', params.keywords, 200)
    const { locationCode, languageName } = this.resolveGeo(params)
    const out: string[] = []
    for (const keyword of keywords) {
      const json = await this.post('/v3/dataforseo_labs/google/keyword_ideas/live', [
        { keywords: [keyword], location_code: locationCode, language_name: languageName }
      ])
      if (!Array.isArray(json?.tasks) || !json.tasks.length) {
        log.warn('[dfs] keywordIdeas empty', { keyword, locationCode, languageName })
        continue
      }
      out.push(...extractKeywordsFromDataforseoResponse(json))
    }
    return out
  }

  async keywordIdeasDetailed(params: KeywordArrayParams): Promise<Array<{ keyword: string; keyword_info?: any; keyword_properties?: any; impressions_info?: any }>> {
    const keywords = ensureKeywords('keywordIdeasDetailed', params.keywords, 200)
    const { locationCode, languageName } = this.resolveGeo(params)
    const payload = [
      { keywords, location_code: locationCode, language_name: languageName, include_serp_info: false, limit: typeof params.limit === 'number' ? params.limit : 30 }
    ]
    const json = await this.post('/v3/dataforseo_labs/google/keyword_ideas/live', payload)
    const out: Array<{ keyword: string; keyword_info?: any; keyword_properties?: any; impressions_info?: any }> = []
    if (!Array.isArray(json?.tasks) || !json.tasks.length) {
      log.warn('[dfs] keywordIdeasDetailed empty', { keywords: keywords.length, locationCode, languageName })
      return out
    }
    for (const task of json.tasks) {
      const results = Array.isArray(task?.result) ? task.result : []
      for (const block of results) {
        const items = Array.isArray(block?.items) ? block.items : []
        for (const item of items) {
          const kw = String(item?.keyword || item?.keyword_data?.keyword || '').trim()
          if (!kw) continue
          out.push({ keyword: kw, keyword_info: item?.keyword_info ?? null, keyword_properties: item?.keyword_properties ?? null, impressions_info: item?.impressions_info ?? null })
        }
      }
    }
    return out
  }

  async bulkKeywordDifficulty(params: KeywordArrayParams): Promise<Map<string, number | undefined>> {
    const keywords = ensureKeywords('bulkKeywordDifficulty', params.keywords, 1000)
    const { locationCode, languageName } = this.resolveGeo(params)
    const map = new Map<string, number | undefined>()
    for (const chunk of chunkArray(keywords, 1000)) {
      const json = await this.post('/v3/dataforseo_labs/google/bulk_keyword_difficulty/live', [
        { keywords: chunk, location_code: locationCode, language_name: languageName }
      ])
      if (!Array.isArray(json?.tasks) || !json.tasks.length) {
        log.warn('[dfs] bulkKeywordDifficulty empty', { keywords: chunk.length, locationCode, languageName })
        continue
      }
      for (const task of json.tasks) {
        const items = task?.result?.[0]?.items ?? []
        for (const item of items) {
          const keyword = String(item?.keyword || '').toLowerCase()
          if (!keyword) continue
          const difficulty = typeof item?.keyword_difficulty === 'number' ? item.keyword_difficulty : undefined
          map.set(keyword, difficulty)
        }
      }
    }
    return map
  }

  async keywordSuggestions(params: SingleKeywordParams): Promise<string[]> {
    const keyword = String(params.keyword || '').trim()
    if (!keyword) throw new Error('keywordSuggestions: keyword required')
    const { locationCode, languageName } = this.resolveGeo(params)
    const tasks = [{ keyword, location_code: locationCode, language_name: languageName }]
    const json = await this.post('/v3/dataforseo_labs/google/keyword_suggestions/live', tasks)
    if (!Array.isArray(json?.tasks) || !json.tasks.length) {
      log.warn('[dfs] keywordSuggestions empty', { keyword, locationCode, languageName })
    }
    return extractKeywordsFromDataforseoResponse(json)
  }

  async serpOrganic(params: SingleKeywordParams & { device?: 'desktop' | 'mobile' }): Promise<DFSSerpItem[]> {
    const keyword = String(params.keyword || '').trim()
    if (!keyword) throw new Error('serpOrganic: keyword required')
    const { locationCode, languageName } = this.resolveGeo(params)
    const device = params.device === 'mobile' ? 'mobile' : 'desktop'
    const tasks = [{ keyword, location_code: locationCode, language_name: languageName, device }]
    const json = await this.post('/v3/serp/google/organic/live/regular', tasks)
    if (!Array.isArray(json?.tasks) || !json.tasks.length) {
      log.warn('[dfs] serpOrganic empty', { keyword, locationCode, languageName, device })
    }
    const items: DFSSerpItem[] = []
    for (const task of json?.tasks ?? []) {
      const resItems = task?.result?.[0]?.items ?? []
      for (const item of resItems) {
        items.push(item)
      }
    }
    return items
  }

}

export function extractKeywordsFromDataforseoResponse(json: any): string[] {
  const out: string[] = []
  for (const task of json?.tasks ?? []) {
    const items = task?.result?.[0]?.items ?? []
    for (const item of items) {
      const keyword = String(item?.keyword || item?.keyword_data?.keyword || '').trim()
      if (keyword) out.push(keyword)
    }
  }
  return out
}

function summarizeTasksPayload(tasks: unknown[]): Record<string, unknown> {
  if (!Array.isArray(tasks)) return { tasks: 0 }
  const sample = tasks
    .slice(0, 1)
    .map((task) => summarizeTask(task))
    .filter(Boolean) as Array<Record<string, unknown>>
  return sample.length ? { tasks: tasks.length, sample } : { tasks: tasks.length }
}

function summarizeTask(task: unknown): Record<string, unknown> | null {
  if (!task || typeof task !== 'object') return null
  const obj: any = task
  const out: Record<string, unknown> = {}
  if (obj.target) out.target = String(obj.target)
  if (obj.keyword) out.keyword = String(obj.keyword)
  if (Array.isArray(obj.keywords) && obj.keywords.length) {
    out.keywords = obj.keywords.slice(0, 3).map((kw: unknown) => String(kw)).filter(Boolean)
  }
  const loc = obj.location_code ?? obj.locationCode
  if (loc !== undefined && loc !== null) out.locationCode = Number(loc)
  const lang = obj.language_name ?? obj.languageName ?? obj.language_code ?? obj.languageCode
  if (lang) out.language = String(lang)
  return Object.keys(out).length ? out : null
}

function summarizeErrorBody(bodyText: string): Record<string, unknown> {
  if (!bodyText) return {}
  try {
    const json = JSON.parse(bodyText)
    const out: Record<string, unknown> = {}
    if (json && typeof json === 'object') {
      if (typeof json.status_code !== 'undefined') out.statusCode = json.status_code
      if (typeof json.status_message === 'string') out.statusMessage = json.status_message
      if (typeof json.error_code !== 'undefined') out.errorCode = json.error_code
      if (typeof json.error !== 'undefined') out.error = json.error
      if (typeof json.error_message === 'string') out.errorMessage = json.error_message
      if (typeof json.tasks_count === 'number') out.tasksCount = json.tasks_count
      if (typeof json.tasks_error === 'number') out.tasksError = json.tasks_error
      if (Array.isArray(json.tasks) && json.tasks.length) {
        out.rawTasks = json.tasks
      }
    }
    return Object.keys(out).length ? out : { raw: truncateText(bodyText, 240) }
  } catch {
    return { raw: truncateText(bodyText, 240), length: bodyText.length }
  }
}

function truncateText(value: string, max = 240): string {
  if (value.length <= max) return value
  return `${value.slice(0, max)}…`
}

export const dfsClient = new DataForSeoClient()
