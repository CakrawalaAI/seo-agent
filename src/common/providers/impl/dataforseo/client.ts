import { getAuthHeader } from './auth'

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

function languageName(lang: string) {
  if (!lang) return 'English'
  const code = lang.toLowerCase()
  if (code.startsWith('en')) return 'English'
  if (code.startsWith('ja')) return 'Japanese'
  if (code.startsWith('es')) return 'Spanish'
  if (code.startsWith('fr')) return 'French'
  if (code.startsWith('de')) return 'German'
  if (code.startsWith('pt')) return 'Portuguese'
  if (code.startsWith('it')) return 'Italian'
  if (code.startsWith('nl')) return 'Dutch'
  if (code.startsWith('sv')) return 'Swedish'
  if (code.startsWith('no') || code.startsWith('nb') || code.startsWith('nn')) return 'Norwegian'
  if (code.startsWith('da')) return 'Danish'
  if (code.startsWith('fi')) return 'Finnish'
  if (code.startsWith('ko')) return 'Korean'
  if (code.startsWith('zh')) return 'Chinese (Simplified)'
  if (code.startsWith('ru')) return 'Russian'
  return 'English'
}

async function request(path: string, body: unknown) {
  const auth = getAuthHeader()
  if (!auth) throw new Error('DataForSEO credentials missing')
  const url = `https://api.dataforseo.com${path}`
  const timeoutMs = Math.max(5000, Number(process.env.SEOA_DFS_TIMEOUT_MS || '20000'))
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  const dbg = process.env.SEOA_DFS_DEBUG === '1'
  if (dbg) try { console.info('[dfs] request', { url, body: Array.isArray((body as any)?.data) ? `data[${(body as any).data.length}]` : typeof body }) } catch {}
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: auth },
      body: JSON.stringify(body),
      signal: ctrl.signal
    })
    const text = await res.text()
    if (!res.ok) {
      if (dbg) try { console.error('[dfs] http_error', { status: res.status, body: text.slice(0, 500) }) } catch {}
      throw new Error(`DataForSEO HTTP ${res.status}`)
    }
    const json = JSON.parse(text)
    if (dbg) try { console.info('[dfs] ok', { status: res.status }) } catch {}
    return json
  } finally {
    clearTimeout(t)
  }
}

export const dfsClient = {
  languageName,
  async keywordOverviewLive(phrase: string, language: string, locationCode: number) {
    const body = {
      data: [
        {
          keyword: phrase,
          location_code: Number(locationCode) || 2840,
          language_name: languageName(language)
        }
      ]
    }
    const json: any = await request('/v3/dataforseo_labs/google/keyword_overview/live', body)
    const info: DFSKeywordOverview | undefined = json?.tasks?.[0]?.result?.[0]?.keyword_info
    return info
  },
  async keywordOverviewBatchLive(phrases: string[], language: string, locationCode: number) {
    const data = phrases.slice(0, 200).map((p) => ({
      keyword: p,
      location_code: Number(locationCode) || 2840,
      language_name: languageName(language)
    }))
    const json: any = await request('/v3/dataforseo_labs/google/keyword_overview/live', { data })
    const out = new Map<string, DFSKeywordOverview>()
    for (const task of json?.tasks ?? []) {
      const keyword = String(task?.data?.keyword || '')
      const info: DFSKeywordOverview | undefined = task?.result?.[0]?.keyword_info
      if (keyword && info) out.set(keyword.toLowerCase(), info)
    }
    return out
  },
  async keywordsForKeywordsLive(phrases: string[], language: string, locationCode: number) {
    const data = phrases.slice(0, 10).map((p) => ({ keywords: [p], language_name: languageName(language), location_code: Number(locationCode) || 2840 }))
    const json: any = await request('/v3/keywords_data/google_ads/keywords_for_keywords/live', { data })
    const out: Array<{ phrase: string }> = []
    for (const task of json?.tasks ?? []) {
      const items = task?.result?.[0]?.items ?? []
      for (const it of items) {
        const phrase = String(it?.keyword || '')
        if (phrase) out.push({ phrase })
      }
    }
    return out
  },
  async keywordsForSiteLive(domain: string, language: string, locationCode: number) {
    const data = [{
      target: domain,
      location_code: Number(locationCode) || 2840,
      language_name: languageName(language)
    }]
    const json: any = await request('/v3/dataforseo_labs/google/keywords_for_site/live', { data })
    const out: Array<{ phrase: string }> = []
    for (const task of json?.tasks ?? []) {
      const items = task?.result?.[0]?.items ?? []
      for (const it of items) {
        const phrase = String(it?.keyword || '')
        if (phrase) out.push({ phrase })
      }
    }
    return out
  },
  async relatedKeywordsLive(seeds: string[], language: string, locationCode: number) {
    const data = seeds.slice(0, 20).map((p) => ({
      keyword: p,
      location_code: Number(locationCode) || 2840,
      language_name: languageName(language)
    }))
    const json: any = await request('/v3/dataforseo_labs/google/related_keywords/live', { data })
    const out: Array<{ phrase: string }> = []
    for (const task of json?.tasks ?? []) {
      const items = task?.result?.[0]?.items ?? []
      for (const it of items) {
        const phrase = String(it?.keyword || '')
        if (phrase) out.push({ phrase })
      }
    }
    return out
  },
  async keywordIdeasLive(seeds: string[], language: string, locationCode: number) {
    const data = seeds.slice(0, 10).map((p) => ({
      keywords: [p],
      location_code: Number(locationCode) || 2840,
      language_name: languageName(language)
    }))
    const json: any = await request('/v3/keywords_data/google_ads/keyword_ideas/live', { data })
    const out: Array<{ phrase: string }> = []
    for (const task of json?.tasks ?? []) {
      const items = task?.result?.[0]?.items ?? []
      for (const it of items) {
        const phrase = String(it?.keyword || '')
        if (phrase) out.push({ phrase })
      }
    }
    return out
  },
  async bulkKeywordDifficultyLive(phrases: string[], language: string, locationCode: number) {
    const data = phrases.slice(0, 1000).map((p) => ({
      keywords: [p],
      location_code: Number(locationCode) || 2840,
      language_name: languageName(language)
    }))
    const json: any = await request('/v3/dataforseo_labs/google/bulk_keyword_difficulty/live', { data })
    const out: Array<{ phrase: string; difficulty?: number }> = []
    for (const task of json?.tasks ?? []) {
      const items = task?.result?.[0]?.items ?? []
      for (const it of items) {
        const phrase = String(it?.keyword || '')
        const difficulty = typeof it?.keyword_difficulty === 'number' ? it.keyword_difficulty : undefined
        if (phrase) out.push({ phrase, difficulty })
      }
    }
    return out
  },
  async keywordSuggestionsLive(phrase: string, language: string, locationCode: number) {
    const body = {
      data: [
        {
          keyword: phrase,
          location_code: Number(locationCode) || 2840,
          language_name: languageName(language)
        }
      ]
    }
    const json: any = await request('/v3/dataforseo_labs/google/keyword_suggestions/live', body)
    const items = json?.tasks?.[0]?.result?.[0]?.items ?? []
    return items.map((it: any) => ({ phrase: String(it?.keyword || '') })).filter((r: any) => r.phrase)
  },
  async serpOrganicLive(phrase: string, language: string, locationCode: number, device: 'desktop'|'mobile' = 'desktop') {
    const body = {
      data: [
        {
          language_name: languageName(language || 'en'),
          location_code: Number(locationCode) || 2840,
          keyword: phrase,
          device: device === 'mobile' ? 'mobile' : 'desktop'
        }
      ]
    }
    const json: any = await request('/v3/serp/google/organic/live/regular', body)
    const items: DFSSerpItem[] = (json?.tasks?.[0]?.result?.[0]?.items ?? [])
    return items
  }
}
