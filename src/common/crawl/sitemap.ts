import { XMLParser } from 'fast-xml-parser'
import { log } from '@src/common/logger'
import { normalizeUrl, isHtmlLike } from '@common/crawl/url-filter'

type SitemapEntry = { loc: string; lastmod?: string | null; priority?: number | null }

export async function fetchAndParseSitemapUrls(siteUrl: string, hardCap = 100000): Promise<string[]> {
  const base = new URL(siteUrl)
  const sitemapUrl = new URL('/sitemap.xml', `${base.protocol}//${base.host}`).toString()
  const parser = new XMLParser({ ignoreAttributes: false })
  const urls: string[] = []
  const fetchText = async (url: string, timeoutMs = 15000): Promise<string | null> => {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), timeoutMs)
    try {
      const r = await fetch(url, { signal: ac.signal })
      if (!r.ok) return null
      return await r.text()
    } catch { return null } finally { clearTimeout(t) }
  }
  try {
    log.info('[sitemap] fetch root', { url: sitemapUrl })
    const xml = await fetchText(sitemapUrl)
    if (!xml) { log.warn('[sitemap] root fetch failed', { url: sitemapUrl }); return [] }
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
          const x = await fetchText(loc)
          if (!x) continue
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
  log.info('[sitemap] cleaned', { site: siteUrl, count: cleaned.length })
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
