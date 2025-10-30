import type { KeywordExpandProvider, ExpandedKeyword } from '../../interfaces/keyword-expand'

function authHeader() {
  const login = process.env.DATAFORSEO_LOGIN || process.env.DATAFORSEO_EMAIL || ''
  const password = process.env.DATAFORSEO_PASSWORD || ''
  if (!login || !password) return null
  return 'Basic ' + Buffer.from(`${login}:${password}`).toString('base64')
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

export const dataForSeoExpand: KeywordExpandProvider = {
  async expand({ phrases, language, locationCode, limit }) {
    const auth = authHeader()
    if (!auth) return []
    const batch = phrases.slice(0, 10) // API accepts multiple; keep small
    const body = {
      data: batch.map((p) => ({
        keywords: [p],
        language_name: languageName(language || 'en'),
        location_code: Number(locationCode) || 2840
      }))
    }
    const res = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: auth },
      body: JSON.stringify(body)
    })
    if (!res.ok) return []
    const json: any = await res.json().catch(() => ({}))
    const out: ExpandedKeyword[] = []
    for (const task of json?.tasks ?? []) {
      const items = task?.result?.[0]?.items ?? []
      for (const it of items) {
        const phrase = String(it?.keyword || '')
        if (phrase) out.push({ phrase, source: 'dataforseo' })
      }
    }
    const unique: ExpandedKeyword[] = []
    const seen = new Set<string>()
    for (const k of out) {
      const key = k.phrase.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      unique.push(k)
    }
    return (typeof limit === 'number' && limit > 0) ? unique.slice(0, limit) : unique
  }
}
