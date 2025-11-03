import { extractKeywordsFromDataforseoResponse } from '../dataforseo/client'

type SiteParams = {
  target: string
  languageCode?: string | null
  locationCode?: number | null
}

type KeywordParams = {
  keywords: string[]
  languageCode?: string | null
  locationCode?: number | null
}

type MockKeywordItem = {
  keyword: string
  keyword_info: {
    search_volume: number
    cpc: number
    competition: number
    keyword_difficulty: number
    last_updated_time: string
  }
}

type MockPayload = {
  status_code: number
  result: Array<{ items: MockKeywordItem[] }>
}

function buildResponse(items: MockKeywordItem[]): { tasks: Array<MockPayload> } {
  return {
    tasks: [
      {
        status_code: 20000,
        result: [
          {
            items
          }
        ]
      }
    ]
  }
}

function toList(items: MockKeywordItem[]): string[] {
  const json = buildResponse(items)
  return extractKeywordsFromDataforseoResponse(json)
}

function brandFromDomain(target: string): string {
  try {
    const url = target.includes('://') ? new URL(target) : new URL(`https://${target}`)
    const host = url.hostname.replace(/^www\./, '')
    return host.replace(/\./g, ' ')
  } catch {
    return target.replace(/^https?:\/\//, '').replace(/\./g, ' ')
  }
}

function baseItems(): Array<{ seed: string; volume: number; cpc: number; competition: number; difficulty: number }> {
  return [
    { seed: 'interview prep platform', volume: 5400, cpc: 3.25, competition: 0.68, difficulty: 42 },
    { seed: 'behavioral interview practice', volume: 2900, cpc: 2.9, competition: 0.62, difficulty: 38 },
    { seed: 'ai interview coach', volume: 1700, cpc: 4.1, competition: 0.74, difficulty: 46 },
    { seed: 'mock interview questions', volume: 6600, cpc: 1.8, competition: 0.55, difficulty: 40 },
    { seed: 'job interview feedback', volume: 1200, cpc: 2.2, competition: 0.48, difficulty: 34 },
    { seed: 'practice interview answers', volume: 2200, cpc: 3.05, competition: 0.51, difficulty: 36 },
    { seed: 'interview preparation app', volume: 1500, cpc: 2.65, competition: 0.57, difficulty: 39 },
    { seed: 'ai behavioral questions', volume: 900, cpc: 3.45, competition: 0.6, difficulty: 37 },
    { seed: 'hr interview simulator', volume: 540, cpc: 1.95, competition: 0.42, difficulty: 28 },
    { seed: 'interview drill software', volume: 410, cpc: 2.15, competition: 0.39, difficulty: 26 },
    { seed: 'faang interview prep', volume: 2100, cpc: 4.55, competition: 0.7, difficulty: 44 },
    { seed: 'interview confidence training', volume: 880, cpc: 1.65, competition: 0.41, difficulty: 30 },
    { seed: 'structured interview practice', volume: 620, cpc: 1.92, competition: 0.37, difficulty: 29 },
    { seed: 'self paced interview coaching', volume: 430, cpc: 1.48, competition: 0.33, difficulty: 24 },
    { seed: 'interview rubric feedback', volume: 350, cpc: 1.76, competition: 0.35, difficulty: 25 },
    { seed: 'leadership interview scenarios', volume: 780, cpc: 2.35, competition: 0.46, difficulty: 32 },
    { seed: 'interview debrief template', volume: 560, cpc: 1.28, competition: 0.29, difficulty: 22 },
    { seed: 'product manager interview prep', volume: 3100, cpc: 3.6, competition: 0.63, difficulty: 41 },
    { seed: 'technical interview coaching', volume: 1900, cpc: 3.1, competition: 0.58, difficulty: 35 },
    { seed: 'sales interview role play', volume: 740, cpc: 1.72, competition: 0.36, difficulty: 27 },
    { seed: 'remote interview practice', volume: 820, cpc: 2.05, competition: 0.4, difficulty: 31 },
    { seed: 'interview storytelling training', volume: 460, cpc: 1.55, competition: 0.34, difficulty: 23 },
    { seed: 'executive interview preparation', volume: 1250, cpc: 4.2, competition: 0.69, difficulty: 45 },
    { seed: 'behavioral interview rubric', volume: 690, cpc: 1.88, competition: 0.38, difficulty: 28 },
    { seed: 'competency interview workshop', volume: 520, cpc: 1.97, competition: 0.4, difficulty: 27 },
    { seed: 'mock interview program', volume: 980, cpc: 2.45, competition: 0.49, difficulty: 33 },
    { seed: 'graduate interview prep course', volume: 870, cpc: 1.86, competition: 0.37, difficulty: 29 },
    { seed: 'behavioral interview matrix', volume: 430, cpc: 1.61, competition: 0.32, difficulty: 24 },
    { seed: 'interview feedback examples', volume: 1280, cpc: 1.74, competition: 0.43, difficulty: 31 },
    { seed: 'panel interview practice kit', volume: 610, cpc: 1.9, competition: 0.36, difficulty: 27 }
  ]
}

function makeItems(prefix: string, adjectives: string[] = []): MockKeywordItem[] {
  const now = Date.now()
  const base = baseItems()
  return base.map((entry, index) => {
    const modifier = adjectives[index % adjectives.length] ?? ''
    const keyword = [prefix, modifier, entry.seed].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
    return {
      keyword,
      keyword_info: {
        search_volume: entry.volume,
        cpc: Number(entry.cpc.toFixed(2)),
        competition: Number(entry.competition.toFixed(2)),
        keyword_difficulty: entry.difficulty,
        last_updated_time: new Date(now - index * 86400000).toISOString()
      }
    }
  })
}

function keywordsForSiteItems(params: SiteParams): MockKeywordItem[] {
  const brand = brandFromDomain(params.target || '')
  const adjectives = ['platform', 'tool', 'software', 'solution', 'service']
  return makeItems(brand, adjectives)
}

function relatedKeywordItems(params: KeywordParams): MockKeywordItem[] {
  const adjectives = ['best', 'top', 'guide', 'tips', 'examples']
  const seeds = params.keywords.slice(0, 3)
  if (!seeds.length) return makeItems('interview', adjectives)
  const combined = seeds.join(' ')
  return makeItems(combined, adjectives)
}

function keywordIdeasItems(params: KeywordParams): MockKeywordItem[] {
  const modifiers = ['online', 'ai', 'template', 'framework', 'worksheet']
  const seed = params.keywords[0] || 'interview'
  return makeItems(seed, modifiers)
}

export const mockKeywordGenerator = {
  async keywordsForSite(params: SiteParams): Promise<string[]> {
    const items = keywordsForSiteItems(params)
    return toList(items)
  },
  async relatedKeywords(params: KeywordParams): Promise<string[]> {
    const items = relatedKeywordItems(params)
    return toList(items)
  },
  async keywordIdeas(params: KeywordParams): Promise<string[]> {
    const items = keywordIdeasItems(params)
    return toList(items)
  }
}
