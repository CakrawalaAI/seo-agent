export function formatNumber(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '-'
  return new Intl.NumberFormat('en-US').format(Number(n))
}

export function formatCurrency(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '-'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(Number(n))
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleString()
}

export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  try { return JSON.stringify(error) } catch { return String(error) }
}

export function maskSecret(secret: string, visible = 4): string {
  if (!secret) return ''
  const len = secret.length
  const tail = secret.slice(-Math.max(0, visible))
  return `${'*'.repeat(Math.max(0, len - visible))}${tail}`
}

export function badgeClassForTone(tone?: string | null): string {
  const t = (tone || '').toLowerCase()
  if (t === 'formal') return 'bg-blue-100 text-blue-800'
  if (t === 'casual') return 'bg-amber-100 text-amber-800'
  return 'bg-muted text-muted-foreground'
}

// Calendar helpers (lightweight)
export function computeNextGenerationCountdown(): string {
  return 'in 24h'
}

export function formatMonthTitle(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function formatCalendarDay(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })
}

export function buildCalendarCells(items: Array<{ scheduledDate: string }>): Array<{ iso: string; date: Date; items: any[]; withinRange: boolean }> {
  const byDate = new Map<string, any[]>()
  for (const it of items) {
    const iso = (it as any).scheduledDate
    if (!iso) continue
    const bucket = byDate.get(iso) ?? []
    bucket.push(it)
    byDate.set(iso, bucket)
  }
  const dates = Array.from(byDate.keys()).sort()
  return dates.map((iso) => ({ iso, date: new Date(iso), items: byDate.get(iso) || [], withinRange: true }))
}

export function resolvePlanStatus(item: { status?: string }, articlesByPlanId: Map<string, { status?: string }>) {
  const art = articlesByPlanId.get((item as any).id || '')
  const status = (art?.status || item.status || 'queued').toLowerCase()
  if (status === 'published') return { label: 'PUBLISHED', tone: 'emerald' }
  if (status === 'scheduled') return { label: 'SCHEDULED', tone: 'blue' }
  if (status === 'unpublished') return { label: 'UNPUBLISHED', tone: 'rose' }
  return { label: 'QUEUED', tone: 'amber' }
}
