import { XMLParser } from 'fast-xml-parser'

type SitemapEntry = { loc: string; lastmod?: string | null; priority?: number | null }

function normalizeUrl(u: string, base: URL): string | null {
  try {
    const url = new URL(u, base)
    if (url.host !== base.host) return null
    url.hash = ''
    url.search = ''
    let href = url.toString()
    // collapse trailing slash
    if (href.endsWith('/') && href !== `${url.protocol}//${url.host}/`) href = href.slice(0, -1)
    return href
  } catch {
    return null
  }
}

function isHtmlLike(u: string): boolean {
  const lowered = u.toLowerCase()
  if (/\.(pdf|jpg|jpeg|png|gif|webp|svg|zip|csv|xls|xlsx|doc|docx|ppt|pptx|mp4|mp3)(?:$|\?)/.test(lowered)) return false
  if (/(?:\/wp-|\/feed|\/tag\/|\/category\/|\/page\/\d+|\/login|\/admin|\/cart|\/checkout|\/account|\/search|\/api)(?:$|\/|\?)/.test(lowered)) return false
  return true
}

export async function fetchAndParseSitemapUrls(siteUrl: string, hardCap = 100000): Promise<string[]> {
  const base = new URL(siteUrl)
  const sitemapUrl = new URL('/sitemap.xml', `${base.protocol}//${base.host}`).toString()
  const parser = new XMLParser({ ignoreAttributes: false })
  const urls: string[] = []
  try {
    const res = await fetch(sitemapUrl)
    if (!res.ok) return []
    const xml = await res.text()
    const data = parser.parse(xml)
    const enqueueUrlset = (rawXml: string) => {
      try {
        const d = parser.parse(rawXml)
        if (d?.urlset?.url) {
          const entries = Array.isArray(d.urlset.url) ? d.urlset.url : [d.urlset.url]
          for (const entry of entries) {
            const loc = entry.loc || entry['#text'] || entry['_']
            if (typeof loc !== 'string') continue
            const norm = normalizeUrl(loc, base)
            if (!norm || !isHtmlLike(norm)) continue
            urls.push(norm)
            if (urls.length >= hardCap) break
          }
        }
      } catch {}
    }
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
          enqueueUrlset(x)
        } catch {}
        if (urls.length >= hardCap) break
      }
    }
    // regular sitemap
    if (urls.length < hardCap && data?.urlset?.url) {
      const entries = Array.isArray(data.urlset.url) ? data.urlset.url : [data.urlset.url]
      for (const entry of entries) {
        const loc = entry.loc || entry['#text'] || entry['_']
        if (typeof loc !== 'string') continue
        const norm = normalizeUrl(loc, base)
        if (!norm || !isHtmlLike(norm)) continue
        urls.push(norm)
        if (urls.length >= hardCap) break
      }
    }
  } catch {}
  // dedupe while preserving order
  const seen = new Set<string>()
  const cleaned: string[] = []
  for (const u of urls) {
    if (!seen.has(u)) { seen.add(u); cleaned.push(u) }
  }
  return cleaned
}

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
