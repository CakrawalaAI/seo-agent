import type { SerpProvider, SerpSnapshot, SerpItem } from '../../interfaces/serp'

function authHeader() {
  const login = process.env.DATAFORSEO_LOGIN || process.env.DATAFORSEO_EMAIL || ''
  const password = process.env.DATAFORSEO_PASSWORD || ''
  if (!login || !password) return null
  return 'Basic ' + Buffer.from(`${login}:${password}`).toString('base64')
}

// Map language like 'en-US' -> 'English' for DFS language_name
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

function toTextDump(items: SerpItem[]) {
  return items
    .sort((a, b) => a.rank - b.rank)
    .map((i) => `#${i.rank} ${i.title ?? ''} ${i.url}\n${i.snippet ?? ''}`.trim())
    .join('\n\n')
}

export const dataForSeoSerp: SerpProvider = {
  async ensure({ canon, locationCode, device = 'desktop', topK = 10 }) {
    const auth = authHeader()
    const fetchedAt = new Date().toISOString()
    if (!auth) {
      // stub
      const items: SerpItem[] = Array.from({ length: topK }).map((_, i) => ({
        rank: i + 1,
        url: `https://example.com/${encodeURIComponent(canon.phrase)}/${i + 1}`,
        title: `${canon.phrase} result ${i + 1}`,
        snippet: 'Lorem ipsum dolor sit amet',
        types: ['organic']
      }))
      return { fetchedAt, engine: 'google', device, topK, items, textDump: toTextDump(items) }
    }
    const body = {
      data: [
        {
          language_name: languageName(canon.language || 'en'),
          location_code: Number(locationCode) || 2840,
          keyword: canon.phrase,
          device: device === 'mobile' ? 'mobile' : 'desktop'
        }
      ]
    }
    const url = 'https://api.dataforseo.com/v3/serp/google/organic/live/regular'
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: auth },
      body: JSON.stringify(body)
    })
    if (!res.ok) {
      const items: SerpItem[] = []
      return { fetchedAt, engine: 'google', device, topK, items, textDump: '' }
    }
    const json: any = await res.json().catch(() => ({}))
    const raw = json?.tasks?.[0]?.result?.[0]?.items ?? []
    const items: SerpItem[] = raw
      .filter((r: any) => typeof r?.rank_group === 'number' && r?.type)
      .slice(0, topK)
      .map((r: any) => ({
        rank: Number(r.rank_group),
        url: String(r.url || ''),
        title: r.title ? String(r.title) : undefined,
        snippet: r.description ? String(r.description) : undefined,
        types: Array.isArray(r?.types) ? r.types : r.type ? [String(r.type)] : []
      }))
    const snap: SerpSnapshot = { fetchedAt, engine: 'google', device, topK, items, textDump: toTextDump(items) }
    return snap
  }
}
