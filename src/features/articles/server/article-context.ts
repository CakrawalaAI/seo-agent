import type {
  ArticleOutlineSection,
  ArticleFeatureFlags,
  ArticleGenerationContext
} from '@entities/article/domain/article'
import { env } from '@common/infra/env'
import { log } from '@src/common/logger'

type Citation = ArticleGenerationContext['citations'][number]
type YoutubeResult = ArticleGenerationContext['youtube'][number]
type ImageResult = ArticleGenerationContext['images'][number]
type InternalLink = ArticleGenerationContext['internalLinks'][number]

export type ArticleContextResult = ArticleGenerationContext

type SiteSettings = {
  settings?: unknown
  settingsJson?: unknown
  summary?: string | null
}

const FEATURE_KEYS: Array<keyof ArticleFeatureFlags> = ['serp', 'youtube', 'imageUnsplash', 'imageAi', 'research', 'attachments']

export function resolveArticleFeatureFlags(site?: SiteSettings | null): ArticleFeatureFlags {
  const defaults: ArticleFeatureFlags = { ...env.articleFeatures }
  const baseSettings = (site?.settings ?? site?.settingsJson ?? {}) as Record<string, any>
  const featureOverrides = (baseSettings?.articleGeneration?.features ?? {}) as Partial<ArticleFeatureFlags>
  for (const key of FEATURE_KEYS) {
    if (typeof featureOverrides[key] === 'boolean') {
      defaults[key] = featureOverrides[key] as boolean
    }
  }
  return defaults
}

export async function collectArticleContext(args: {
  articleId: string
  projectId: string
  locale: string
  keyword: string
  title: string
  outline: ArticleOutlineSection[]
  site?: SiteSettings | null
  features: ArticleFeatureFlags
  serpTopK?: number
}): Promise<ArticleContextResult> {
  const websiteSummary = typeof args.site?.summary === 'string' ? args.site.summary : undefined
  const features = args.features
  const topK = Math.max(1, Math.min(50, args.serpTopK ?? 10))
  const keyword = args.keyword || args.title
  const locale = args.locale || 'en-US'
  const projectId = String(args.projectId || args.articleId)
  const policy = ((args.site?.settings ?? args.site?.settingsJson) ?? {}) as {
    allowYoutube?: boolean
    maxImages?: number
  }

  const serpPromise = features.serp
    ? fetchSerpSnapshot({
        articleId: args.articleId,
        keyword,
        locale,
        topK
      })
    : Promise.resolve<string | undefined>(undefined)

  const researchPromise = features.research
    ? fetchResearch(keyword, features.youtube && policy.allowYoutube !== false)
    : Promise.resolve<{ citations: Citation[]; youtube: YoutubeResult[] }>({ citations: [], youtube: [] })

  const imagesPromise = features.imageUnsplash || features.imageAi
    ? fetchImages({
        keyword,
        title: args.title,
        max: Math.max(0, Math.min(6, Number(policy.maxImages ?? 3))),
        allowUnsplash: features.imageUnsplash,
        allowAi: features.imageAi
      })
    : Promise.resolve<ImageResult[]>([])

  const internalLinksPromise = fetchInternalLinks(projectId)

  const [serpDump, research, images, internalLinks] = await Promise.all([
    serpPromise,
    researchPromise,
    imagesPromise,
    internalLinksPromise
  ])

  return {
    websiteSummary,
    serpDump,
    competitorDump: undefined,
    citations: research.citations,
    youtube: research.youtube,
    images,
    internalLinks,
    features
  }
}

async function fetchSerpSnapshot(opts: { articleId: string; keyword: string; locale: string; topK: number }) {
  try {
    const { locationCodeFromLocale } = await import('@common/providers/impl/dataforseo/geo')
    const locationCode = locationCodeFromLocale(opts.locale)
    const device: 'desktop' | 'mobile' = 'desktop'
    const { keywordSerpRepo } = await import('@entities/article/repository.serp_snapshot')
    const existing = await keywordSerpRepo.get(opts.articleId)
    if (existing?.snapshotJson?.textDump) {
      log.debug('[article-context] reuse serp snapshot', { articleId: opts.articleId })
      return String(existing.snapshotJson.textDump)
    }
    const { ensureSerp } = await import('@features/serp/server/ensureSerp')
    const snapshot = await ensureSerp({
      phrase: opts.keyword,
      language: opts.locale,
      locationCode,
      device,
      topK: opts.topK
    })
    const textDump = String(snapshot?.textDump || '')
    try {
      await keywordSerpRepo.upsert({
        articleId: opts.articleId,
        phrase: opts.keyword,
        language: opts.locale,
        locationCode,
        device,
        topK: opts.topK,
        snapshotJson: snapshot,
        fetchedAt: new Date()
      })
    } catch (error) {
      log.debug('[article-context] serp snapshot cache failed', { articleId: opts.articleId, error: (error as Error)?.message })
    }
    return textDump
  } catch (error) {
    log.warn('[article-context] serp fetch failed', { articleId: opts.articleId, error: (error as Error)?.message })
    return undefined
  }
}

async function fetchResearch(keyword: string, includeYoutube: boolean) {
  try {
    const { getResearchProvider } = await import('@common/providers/registry')
    const provider = getResearchProvider()
    const citations = await provider.search(keyword, { topK: 5 })
    let youtube: YoutubeResult[] = []
    if (includeYoutube) {
      const yt = await provider.search(keyword, { topK: 3, site: 'youtube.com' })
      youtube = yt.map((item) => ({ title: item.title, url: item.url }))
    }
    return { citations, youtube }
  } catch (error) {
    log.warn('[article-context] research failed', { keyword, error: (error as Error)?.message })
    return { citations: [], youtube: [] }
  }
}

async function fetchImages(options: { keyword: string; title: string; max: number; allowUnsplash: boolean; allowAi: boolean }) {
  const target = Math.max(0, options.max)
  if (!target) return []
  const collected: ImageResult[] = []

  if (options.allowUnsplash) {
    try {
      const { searchUnsplash } = await import('@common/providers/impl/unsplash/images')
      const images = await searchUnsplash(options.title || options.keyword, target)
      collected.push(...(images || []))
    } catch (error) {
      log.warn('[article-context] unsplash lookup failed', { error: (error as Error)?.message })
    }
  }

  if (collected.length < target && options.allowAi) {
    try {
      const { generateImages } = await import('@common/providers/impl/openai/images')
      const remaining = target - collected.length
      const aiImages = await generateImages({ prompt: options.title || options.keyword, count: remaining })
      collected.push(...aiImages)
    } catch (error) {
      log.warn('[article-context] ai image generation failed', { error: (error as Error)?.message })
    }
  }

  const seen = new Set<string>()
  return collected.filter((img) => {
    const key = img.src
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function fetchInternalLinks(projectId: string) {
  try {
    const { crawlRepo } = await import('@entities/crawl/repository')
    const pages = await crawlRepo.listRecentPages(projectId, 50)
    return pages
      .filter((page: any) => {
        const url = String(page?.url || '')
        if (!url) return false
        try {
          const parsed = new URL(url)
          return parsed.pathname && parsed.pathname !== '/'
        } catch {
          return false
        }
      })
      .slice(0, 10)
      .map((page: any) => ({ anchor: page?.title || 'Related', url: page.url }))
  } catch (error) {
    log.debug('[article-context] internal link fetch failed', { projectId, error: (error as Error)?.message })
    return []
  }
}
