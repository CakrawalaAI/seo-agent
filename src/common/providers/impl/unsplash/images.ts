export type UnsplashImage = { src: string; alt?: string; caption?: string }

export async function searchUnsplash(query: string, topK = 3): Promise<UnsplashImage[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY || ''
  if (!key) return []
  try {
    const url = new URL('https://api.unsplash.com/search/photos')
    url.searchParams.set('query', query)
    url.searchParams.set('per_page', String(Math.max(1, Math.min(10, topK))))
    const res = await fetch(url.toString(), { headers: { Authorization: `Client-ID ${key}` } })
    if (!res.ok) return []
    const json: any = await res.json().catch(() => ({}))
    const items = Array.isArray(json?.results) ? json.results : []
    return items.map((it: any) => ({ src: it?.urls?.regular || it?.urls?.full || '', alt: it?.alt_description || it?.description || '', caption: it?.user?.name ? `Photo by ${it.user.name} on Unsplash` : 'Unsplash' })).filter((i: any) => i.src)
  } catch {
    return []
  }
}

