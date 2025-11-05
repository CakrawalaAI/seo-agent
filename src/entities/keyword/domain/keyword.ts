export type KeywordMetrics = {
  searchVolume?: number | null
  difficulty?: number | null
  cpc?: number | null
  competition?: number | null
  rankability?: number | null
  asOf?: string | null
}

export type Keyword = {
  id: string
  websiteId: string
  canonId?: string | null
  phrase: string
  status?: string | null
  scope?: KeywordScope | null
  starred?: boolean | null
  active?: boolean | null
  opportunity?: number | null
  metricsJson?: KeywordMetrics | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type KeywordScope = 'auto' | 'include' | 'exclude'

const DIFFICULTY_EXCLUDE_THRESHOLD = 70
const DIFFICULTY_INCLUDE_THRESHOLD = 55
const COMPETITION_EXCLUDE_THRESHOLD = 0.7
const COMPETITION_INCLUDE_THRESHOLD = 0.55

export function deriveScope(metrics: KeywordMetrics | null | undefined): KeywordScope {
  if (!metrics) return 'auto'
  const difficulty = typeof metrics.difficulty === 'number' ? metrics.difficulty : null
  const competition = typeof metrics.competition === 'number' ? metrics.competition : null
  const hasDifficulty = difficulty !== null
  const hasCompetition = competition !== null
  if (!hasDifficulty && !hasCompetition) return 'auto'
  const isHighDifficulty = hasDifficulty && difficulty! >= DIFFICULTY_EXCLUDE_THRESHOLD
  const isHighCompetition = hasCompetition && competition! >= COMPETITION_EXCLUDE_THRESHOLD
  if (isHighDifficulty && isHighCompetition) return 'exclude'
  const isIncludeDifficulty =
    !hasDifficulty || difficulty! <= DIFFICULTY_INCLUDE_THRESHOLD
  const isIncludeCompetition =
    !hasCompetition || competition! <= COMPETITION_INCLUDE_THRESHOLD
  if (isIncludeDifficulty && isIncludeCompetition) return 'include'
  if (isHighDifficulty || isHighCompetition) return 'exclude'
  return 'include'
}
