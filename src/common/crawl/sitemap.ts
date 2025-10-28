import { XMLParser } from 'fast-xml-parser'

export async function discoverFromSitemap(siteUrl: string, limit = 10): Promise<string[]> {
  try {
    const root = new URL(siteUrl)
    const sitemapUrl = new URL('/sitemap.xml', `${root.protocol}//${root.host}`).toString()
    const res = await fetch(sitemapUrl)
    if (!res.ok) return []
    const xml = await res.text()
    const parser = new XMLParser({ ignoreAttributes: false })
    const data = parser.parse(xml)
    const urls: string[] = []
    // sitemap index
    if (data?.sitemapindex?.sitemap) {
      const maps = Array.isArray(data.sitemapindex.sitemap) ? data.sitemapindex.sitemap : [data.sitemapindex.sitemap]
      for (const sm of maps) {
        const loc = sm.loc
        if (typeof loc !== 'string') continue
        try {
          const r = await fetch(loc)
          if (!r.ok) continue
          const x = await r.text()
          const d = parser.parse(x)
          if (d?.urlset?.url) {
            const entries = Array.isArray(d.urlset.url) ? d.urlset.url : [d.urlset.url]
            for (const entry of entries) {
              const u = entry.loc || entry['#text'] || entry['_']
              if (typeof u === 'string') urls.push(u)
              if (urls.length >= limit) break
            }
          }
        } catch {}
        if (urls.length >= limit) break
      }
    }
    // regular sitemap
    if (urls.length < limit && data?.urlset?.url) {
      const entries = Array.isArray(data.urlset.url) ? data.urlset.url : [data.urlset.url]
      for (const entry of entries) {
        const loc = entry.loc || entry['#text'] || entry['_']
        if (typeof loc === 'string') urls.push(loc)
        if (urls.length >= limit) break
      }
    }
    return urls.slice(0, limit)
  } catch {
    return []
  }
}
