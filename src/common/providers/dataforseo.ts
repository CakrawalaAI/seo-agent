type Credentials = { login: string; password: string }

function getCreds(): Credentials | null {
  const login = process.env.DATAFORSEO_LOGIN || process.env.DATAFORSEO_EMAIL || ''
  const password = process.env.DATAFORSEO_PASSWORD || ''
  if (!login || !password) return null
  return { login, password }
}

export type SvInput = { phrase: string; locale?: string; location?: string }
export type SvResult = { phrase: string; metrics: { searchVolume?: number; cpc?: number; competition?: number; asOf?: string } }

export async function searchVolume(inputs: SvInput[]): Promise<SvResult[]> {
  const creds = getCreds()
  if (!creds) return []
  const pRetry = (await import('p-retry')).default as any
  const request = async () => {
    const languageName = (lang?: string) => {
      const code = (lang || '').toLowerCase()
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
    const tasks = inputs.map((i) => ({
      keyword: i.phrase,
      language_name: languageName(i.locale),
      location_code: 2840
    }))
    const res = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(`${creds.login}:${creds.password}`).toString('base64')
      },
      body: JSON.stringify({ data: tasks })
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json().catch(() => ({} as any))
    const results: SvResult[] = []
    const tasksOut = json?.tasks ?? []
    for (const task of tasksOut) {
      const items = task?.result?.[0]?.items ?? []
      for (const item of items) {
        results.push({
          phrase: String(item?.keyword ?? ''),
          metrics: {
            searchVolume: typeof item?.search_volume === 'number' ? item.search_volume : undefined,
            cpc: typeof item?.cpc === 'number' ? item.cpc : undefined,
            competition: typeof item?.competition === 'number' ? item.competition : undefined,
            asOf: new Date().toISOString()
          }
        })
      }
    }
    return results
  }
  try {
    return await pRetry(request, { retries: 2, minTimeout: 500 })
  } catch {
    return []
  }
}
