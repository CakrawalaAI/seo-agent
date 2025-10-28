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
    const tasks = inputs.map((i) => ({
      keyword: i.phrase,
      language_name: i.locale || 'English',
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
