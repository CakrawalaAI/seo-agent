import { log } from '@src/common/logger'

const TOPIC_TOKENS = [
  'behavioral interview',
  'technical interview',
  'consulting case',
  'product manager',
  'system design',
  'ai coaching',
  'mock interview',
  'voice practice',
  'feedback rubric',
  'remote practice',
  'leadership prep',
  'graduate program',
  'executive coaching',
  'sales interview',
  'panel drill',
  'hr simulator',
  'storytelling tips',
  'confidence training',
  'competency workshop',
  'behavioral signals'
]

const ACTION_TOKENS = ['tips', 'template', 'framework', 'worksheet', 'playbook', 'guide', 'script', 'questions', 'answers', 'matrix', 'scenario', 'plan']

const AUDIENCE_TOKENS = ['ai', 'online', 'video', 'voice', 'interactive', 'live', 'async', 'bootcamp', 'accelerator', 'cohort', 'practice', 'trainer']

const BASE_VOLUMES = [6600, 5400, 4200, 3900, 3600, 3400, 3200, 3000, 2800, 2600, 2400, 2200, 2100, 2000, 1900, 1800, 1700, 1600, 1500, 1400, 1300, 1200, 1100, 1000, 900, 820, 780, 740, 700, 660, 620, 580, 540, 500, 460, 430, 410, 390, 360, 330, 310, 290, 270, 250, 230, 210, 190, 170, 150, 140, 130, 120, 110, 100, 95, 90, 85, 80, 75, 70, 65, 60, 56, 52, 48, 44]

const KEYWORD_TARGET = 100

function hashString(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function createSeededRandom(seed: string) {
  let state = hashString(seed) || 1
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return ((state >>> 0) % 1_000_000) / 1_000_000
  }
}

function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)]!
}

type SiteParams = {
  target: string
  languageCode?: string | null
  locationCode?: number | null
}

type KeywordParams = {
  keywords: string[]
  languageCode?: string | null
  locationCode?: number | null
  limit?: number | null
}

type MockMonthlySearch = { year: number; month: number; search_volume: number }

type MockKeywordItem = {
  keyword: string
  keyword_data: {
    keyword: string
  }
  keyword_info: {
    search_volume: number
    cpc: number
    competition: number
    keyword_difficulty: number
    last_updated_time: string
    monthly_searches: MockMonthlySearch[]
  }
  keyword_properties: {
    keyword_difficulty: number
  }
  impressions_info: {
    last_updated_time: string
    ad_position_min: number
    ad_position_max: number
    ad_position_prominence: number
    ad_impressions_share: number
  }
}

function toList(items: MockKeywordItem[]): string[] {
  return items.map((item) => item.keyword)
}

function toDetailed(items: MockKeywordItem[]): Array<{ keyword: string; keyword_info: MockKeywordItem['keyword_info']; keyword_properties: MockKeywordItem['keyword_properties']; impressions_info: MockKeywordItem['impressions_info'] }> {
  return items.map((item) => ({
    keyword: item.keyword,
    keyword_info: item.keyword_info,
    keyword_properties: item.keyword_properties,
    impressions_info: item.impressions_info
  }))
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

function buildBaseMetrics(index: number, rand: () => number) {
  const baseVolume = BASE_VOLUMES[index % BASE_VOLUMES.length] ?? 400
  const volumeJitter = 0.75 + rand() * 0.6
  const searchVolume = Math.max(40, Math.round(baseVolume * volumeJitter))
  const cpc = Number((1.2 + rand() * 3.8).toFixed(2))
  const competition = Number((0.25 + rand() * 0.55).toFixed(2))
  const difficulty = Math.max(18, Math.min(72, Math.round(25 + rand() * 45)))
  return { searchVolume, cpc, competition, difficulty }
}

function buildMonthlySearches(now: number, seedVolume: number, rand: () => number): MockMonthlySearch[] {
  const months: MockMonthlySearch[] = []
  const base = Math.max(50, Math.round(seedVolume / 12))
  for (let i = 0; i < 12; i++) {
    const date = new Date(now - i * 30 * 24 * 60 * 60 * 1000)
    const seasonal = 0.6 + rand() * 0.9
    const monthVolume = Math.max(20, Math.round(base * seasonal))
    months.push({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, search_volume: monthVolume })
  }
  return months
}

function buildImpressions(now: number, rand: () => number) {
  const positionMin = 1 + Math.floor(rand() * 3)
  const positionMax = positionMin + Math.floor(1 + rand() * 3)
  return {
    last_updated_time: new Date(now - Math.floor(rand() * 72) * 3600 * 1000).toISOString(),
    ad_position_min: positionMin,
    ad_position_max: positionMax,
    ad_position_prominence: Number((0.6 + rand() * 0.3).toFixed(2)),
    ad_impressions_share: Number((0.28 + rand() * 0.3).toFixed(2))
  }
}

function makeItems(prefix: string, adjectives: string[] = [], seedTokens: string[] = []): MockKeywordItem[] {
  const now = Date.now()
  const rand = createSeededRandom([prefix, ...adjectives, ...seedTokens].filter(Boolean).join('|') || 'seed')
  const baseTokens = prefix.split(/\s+/).filter(Boolean)
  const seen = new Set<string>()
  const items: MockKeywordItem[] = []
  let guard = 0
  while (items.length < KEYWORD_TARGET && guard < KEYWORD_TARGET * 6) {
    guard++
    const topic = pick(TOPIC_TOKENS, rand)
    const action = pick(ACTION_TOKENS, rand)
    const audience = pick(AUDIENCE_TOKENS, rand)
    const modifier = adjectives.length ? adjectives[items.length % adjectives.length] : ''
    const parts = [...baseTokens, modifier, topic, audience, action]
    const keyword = parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
    if (!keyword) continue
    const key = keyword.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const metrics = buildBaseMetrics(items.length, rand)
    const infoLastUpdated = new Date(now - Math.floor(rand() * 96) * 3600 * 1000).toISOString()
    items.push({
      keyword,
      keyword_data: {
        keyword
      },
      keyword_info: {
        search_volume: metrics.searchVolume,
        cpc: metrics.cpc,
        competition: metrics.competition,
        keyword_difficulty: metrics.difficulty,
        last_updated_time: infoLastUpdated,
        monthly_searches: buildMonthlySearches(now, metrics.searchVolume, rand)
      },
      keyword_properties: {
        keyword_difficulty: metrics.difficulty
      },
      impressions_info: buildImpressions(now, rand)
    })
  }
  return items
}

function keywordsForSiteItems(params: SiteParams): MockKeywordItem[] {
  log.debug('[mock.keywordGenerator] keywordsForSiteItems input', { target: params.target, languageCode: params.languageCode ?? null, locationCode: params.locationCode ?? null })
  const brand = brandFromDomain(params.target || '')
  const adjectives = ['platform', 'tool', 'software', 'solution', 'service']
  const items = makeItems(brand, adjectives, [params.target || ''])
  log.debug('[mock.keywordGenerator] keywordsForSiteItems generated', { target: params.target, total: items.length, keywords: items.map((item) => item.keyword) })
  return items
}

function relatedKeywordItems(params: KeywordParams): MockKeywordItem[] {
  const adjectives = ['best', 'top', 'guide', 'tips', 'examples']
  const seeds = params.keywords.slice(0, 3)
  const limit = typeof params.limit === 'number' && params.limit > 0 ? params.limit : undefined
  if (!seeds.length) {
    const fallback = makeItems('interview', adjectives, []).slice(0, limit)
    log.debug('[mock.keywordGenerator] relatedKeywordItems fallback', { limit: limit ?? null, keywords: fallback.map((item) => item.keyword) })
    return fallback
  }
  const combined = seeds.join(' ')
  const items = makeItems(combined, adjectives, seeds)
  log.debug('[mock.keywordGenerator] relatedKeywordItems generated', { seeds, limit: limit ?? null, keywords: items.map((item) => item.keyword) })
  return typeof limit === 'number' ? items.slice(0, limit) : items
}

function keywordIdeasItems(params: KeywordParams): MockKeywordItem[] {
  const modifiers = ['online', 'ai', 'template', 'framework', 'worksheet']
  const seed = params.keywords[0] || 'interview'
  const limit = typeof params.limit === 'number' && params.limit > 0 ? params.limit : undefined
  const items = makeItems(seed, modifiers, params.keywords)
  log.debug('[mock.keywordGenerator] keywordIdeasItems generated', { seed, seeds: params.keywords, limit: limit ?? null, keywords: items.map((item) => item.keyword) })
  return typeof limit === 'number' ? items.slice(0, limit) : items
}

export const mockKeywordGenerator = {
  async keywordsForSite(params: SiteParams): Promise<string[]> {
    const items = keywordsForSiteItems(params)
    const list = toList(items)
    log.debug('[mock.keywordGenerator] keywordsForSite result', { target: params.target, total: list.length, keywords: list })
    return list
  },
  async relatedKeywords(params: KeywordParams): Promise<string[]> {
    const items = relatedKeywordItems(params)
    const list = toList(items)
    log.debug('[mock.keywordGenerator] relatedKeywords result', { seeds: params.keywords, total: list.length, keywords: list })
    return list
  },
  async keywordIdeas(params: KeywordParams): Promise<string[]> {
    const items = keywordIdeasItems(params)
    const list = toList(items)
    log.debug('[mock.keywordGenerator] keywordIdeas result', { seeds: params.keywords, total: list.length, keywords: list })
    return list
  },
  async keywordIdeasDetailed(params: KeywordParams): Promise<Array<{ keyword: string; keyword_info: MockKeywordItem['keyword_info']; keyword_properties: MockKeywordItem['keyword_properties']; impressions_info: MockKeywordItem['impressions_info'] }>> {
    const items = keywordIdeasItems(params)
    const detailed = toDetailed(items)
    log.debug('[mock.keywordGenerator] keywordIdeasDetailed result', { seeds: params.keywords, total: detailed.length, keywords: detailed.map((item) => item.keyword) })
    return detailed
  }
}
