import { createHash } from 'node:crypto'
import { chromium } from 'playwright'
import robotsParser from 'robots-parser'
import { XMLParser } from 'fast-xml-parser'

const USER_AGENT = process.env.SEO_AGENT_USER_AGENT ?? 'SEOAgentBot/1.0'
const DEFAULT_TIMEOUT_MS = 30000

export type CrawlBudget = {
  maxPages: number
  respectRobots: boolean
  includeSitemaps: boolean
}

export type CrawlPageResult = {
  url: string
  status: number
  html: string
  title?: string | null
  description?: string | null
  headings: Array<{ tag: string; content: string }>
  links: Array<{ href: string; text?: string }>
}

const toDataUrl = (html: string): string => {
  const truncated = html.length > 500_000 ? html.slice(0, 500_000) : html
  const encoded = Buffer.from(truncated, 'utf-8').toString('base64')
  return `data:text/html;base64,${encoded}`
}

const fetchRobots = async (origin: string) => {
  const robotsUrl = new URL('/robots.txt', origin).toString()
  try {
    const response = await fetch(robotsUrl)
    if (!response.ok) return null
    const text = await response.text()
    return robotsParser(robotsUrl, text)
  } catch (error) {
    return null
  }
}

const parser = new XMLParser({ ignoreAttributes: false })

const extractUrlsFromSitemap = (xml: string): string[] => {
  try {
    const data = parser.parse(xml)
    if (data.urlset?.url) {
      const items = Array.isArray(data.urlset.url) ? data.urlset.url : [data.urlset.url]
      return items
        .map((item: any) => item.loc ?? item.url)
        .filter((loc: unknown): loc is string => typeof loc === 'string')
    }
    if (data.sitemapindex?.sitemap) {
      const items = Array.isArray(data.sitemapindex.sitemap) ? data.sitemapindex.sitemap : [data.sitemapindex.sitemap]
      return items
        .map((item: any) => item.loc)
        .filter((loc: unknown): loc is string => typeof loc === 'string')
    }
  } catch (error) {
    return []
  }
  return []
}

const fetchSitemaps = async (urls: string[]): Promise<string[]> => {
  const discovered = new Set<string>()
  for (const url of urls) {
    try {
      const response = await fetch(url)
      if (!response.ok) continue
      const xml = await response.text()
      const entries = extractUrlsFromSitemap(xml)
      for (const entry of entries) {
        if (entry.endsWith('.xml')) {
          const nested = await fetchSitemaps([entry])
          nested.forEach((item) => discovered.add(item))
        } else {
          discovered.add(entry)
        }
      }
    } catch (error) {
      // ignore individual sitemap errors
    }
  }
  return [...discovered]
}

const normalizeUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    return parsed.toString()
  } catch (error) {
    return null
  }
}

export const crawlSite = async (
  startUrl: string,
  budget: CrawlBudget,
  headless = true,
): Promise<CrawlPageResult[]> => {
  const origin = new URL(startUrl).origin
  const robots = budget.respectRobots ? await fetchRobots(origin) : null
  const sitemapUrls = budget.includeSitemaps && robots ? robots.getSitemaps?.() ?? [] : []
  const sitemapEntries = budget.includeSitemaps ? await fetchSitemaps(sitemapUrls) : []

  const queue: string[] = []
  const visited = new Set<string>()
  const results: CrawlPageResult[] = []

  const pushUrl = (url: string | null | undefined) => {
    if (!url) return
    const normalized = normalizeUrl(url)
    if (!normalized) return
    if (!normalized.startsWith(origin)) return
    if (visited.has(normalized)) return
    if (queue.includes(normalized)) return
    if (robots && !robots.isAllowed(normalized, USER_AGENT)) return
    queue.push(normalized)
  }

  pushUrl(startUrl)
  sitemapEntries.forEach((url) => pushUrl(url))

  const browser = await chromium.launch({ headless })
  const context = await browser.newContext({ userAgent: USER_AGENT })

  try {
    while (queue.length > 0 && results.length < budget.maxPages) {
      const url = queue.shift()!
      visited.add(url)
      const page = await context.newPage()
      try {
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: DEFAULT_TIMEOUT_MS })
        const status = response?.status() ?? 0
        if (status >= 400) {
          await page.close()
          results.push({ url, status, html: '', headings: [], links: [] })
          continue
        }

        await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT_MS }).catch(() => {})
        const html = await page.content()
        const title = await page.title()
        const description = await page.$eval('meta[name="description"]', (element) => element.getAttribute('content') ?? '', {
          strict: false
        }).catch(() => null)

        const headings = await page.$$eval('h1, h2, h3', (nodes) =>
          nodes
            .map((node) => ({ tag: node.tagName.toLowerCase(), content: node.textContent?.trim() ?? '' }))
            .filter((heading) => heading.content.length > 0)
        )

        const links = await page.$$eval('a[href]', (anchors, baseOrigin) => {
          return anchors
            .map((anchor) => {
              const href = (anchor as HTMLAnchorElement).href
              const text = anchor.textContent?.trim() ?? undefined
              return { href, text }
            })
            .filter((link) => link.href.startsWith(baseOrigin as string))
        }, origin)

        for (const link of links) {
          pushUrl(link.href)
        }

        results.push({
          url,
          status,
          html,
          title,
          description,
          headings,
          links
        })
      } catch (error) {
        results.push({ url, status: 0, html: '', headings: [], links: [] })
      } finally {
        await page.close()
      }
    }
  } finally {
    await context.close()
    await browser.close()
  }

  return results
}

export const hashContent = (html: string): string => {
  return createHash('sha256').update(html).digest('hex')
}

export const encodeContent = toDataUrl
