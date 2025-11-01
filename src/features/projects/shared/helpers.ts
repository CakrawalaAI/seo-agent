import {
  extractErrorMessage as baseExtractErrorMessage,
  fetchJson as baseFetchJson,
  patchJson as basePatchJson,
  postJson as basePostJson,
  putJson as basePutJson
} from '@common/http/json'
import { formatIntegrationLabel as baseFormatIntegrationLabel } from '@common/integrations/format'
import type { Article, Keyword, PlanItem } from '@entities'

export const fetchJson = baseFetchJson
export const postJson = basePostJson
export const putJson = basePutJson
export const patchJson = basePatchJson
export const extractErrorMessage = baseExtractErrorMessage

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

export function formatNumber(value: unknown) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat().format(value)
}

export function formatCurrency(value: unknown) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  return `$${value.toFixed(2)}`
}

export function computeOpportunityBadge(keyword: Keyword) {
  const metrics = keyword.metricsJson ?? {}
  const volume = typeof metrics?.searchVolume === 'number' ? metrics.searchVolume : 0
  const difficulty = typeof metrics?.difficulty === 'number' ? metrics.difficulty : 50

  if (!volume) {
    return { label: 'Unknown', tone: 'slate' as const }
  }

  const score = volume - difficulty * 4

  if (score >= 400) {
    return { label: 'High', tone: 'emerald' as const }
  }
  if (score >= 200) {
    return { label: 'Medium', tone: 'amber' as const }
  }
  return { label: 'Low', tone: 'blue' as const }
}

export function computeRankabilityBadge(keyword: Keyword) {
  const r = (keyword.metricsJson as any)?.rankability
  if (typeof r !== 'number' || Number.isNaN(r)) return { label: '—', tone: 'slate' as const }
  if (r >= 70) return { label: 'High', tone: 'emerald' as const }
  if (r >= 40) return { label: 'Medium', tone: 'amber' as const }
  return { label: 'Low', tone: 'blue' as const }
}

export function resolvePlanStatus(planItem: PlanItem, articlesByPlanId: Map<string, Article>) {
  const article = articlesByPlanId.get(planItem.id)
  if (article?.status === 'published') {
    return { label: 'PUBLISHED', tone: 'emerald' as const }
  }
  if (article?.status === 'draft') {
    return { label: 'DRAFT GENERATED', tone: 'amber' as const }
  }
  if (planItem.status === 'skipped') {
    return { label: 'SKIPPED', tone: 'rose' as const }
  }
  return { label: 'PLANNED', tone: 'blue' as const }
}

export function badgeClassForTone(tone: string) {
  switch (tone) {
    case 'emerald':
      return 'bg-emerald-100 text-emerald-800'
    case 'amber':
      return 'bg-amber-100 text-amber-800'
    case 'rose':
      return 'bg-rose-100 text-rose-800'
    case 'blue':
      return 'bg-blue-100 text-blue-800'
    default:
      return 'bg-muted text-foreground'
  }
}

export function computeNextGenerationCountdown() {
  const now = new Date()
  const next = new Date(now)
  next.setHours(24, 0, 0, 0)
  const diffMs = Math.max(0, next.getTime() - now.getTime())
  const hours = Math.floor(diffMs / 3_600_000)
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000)
  return `T-${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

export function parseIsoDate(value: string) {
  const parts = value?.split('-') ?? []
  if (parts.length !== 3) return null
  const [year, month, day] = parts.map((part) => Number.parseInt(part, 10))
  if ([year, month, day].some((part) => Number.isNaN(part))) return null
  return new Date(Date.UTC(year, month - 1, day))
}

export function startOfWeek(date: Date) {
  const result = new Date(date)
  const weekday = (result.getUTCDay() + 6) % 7
  result.setUTCDate(result.getUTCDate() - weekday)
  return result
}

export function endOfWeek(date: Date) {
  const result = new Date(date)
  const weekday = (result.getUTCDay() + 6) % 7
  result.setUTCDate(result.getUTCDate() + (6 - weekday))
  return result
}

export function buildCalendarCells(planItems: PlanItem[]) {
  if (!planItems?.length) return []
  const sorted = [...planItems].sort((a, b) => a.plannedDate.localeCompare(b.plannedDate))
  const firstDate = parseIsoDate(sorted[0].plannedDate)
  const lastDate = parseIsoDate(sorted[sorted.length - 1].plannedDate)
  if (!firstDate || !lastDate) return []
  const start = startOfWeek(firstDate)
  const end = endOfWeek(lastDate)
  const millisPerDay = 24 * 60 * 60 * 1000
  const cells: Array<{ iso: string; date: Date; items: PlanItem[]; withinRange: boolean }> = []
  for (let time = start.getTime(); time <= end.getTime(); time += millisPerDay) {
    const current = new Date(time)
    const iso = current.toISOString().slice(0, 10)
    const itemsForDay = sorted.filter((item) => item.plannedDate === iso)
    cells.push({
      iso,
      date: current,
      items: itemsForDay,
      withinRange: time >= firstDate.getTime() && time <= lastDate.getTime()
    })
  }
  return cells
}

export function formatCalendarDay(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: 'short'
  })
}

export function formatMonthTitle(isoDate: string) {
  const date = parseIsoDate(isoDate)
  if (!date) return null
  return date.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric'
  })
}

export const formatIntegrationLabel = baseFormatIntegrationLabel

export function maskSecret(value: string) {
  if (!value) return ''
  if (value.length <= 6) {
    return '*'.repeat(value.length)
  }
  return `${value.slice(0, 3)}…${value.slice(-3)}`
}

export function noticeKindClass(kind: 'success' | 'error' | 'info') {
  switch (kind) {
    case 'success':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'error':
      return 'border-destructive bg-destructive/10 text-destructive'
    default:
      return 'border-border bg-card text-foreground'
  }
}
