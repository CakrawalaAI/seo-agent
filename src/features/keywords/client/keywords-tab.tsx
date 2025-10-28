import {
  badgeClassForTone,
  computeOpportunityBadge,
  formatCurrency,
  formatDateTime,
  formatNumber
} from '@features/projects/shared/helpers'
import type { Keyword } from '@entities'
import { useMemo, useState } from 'react'

type KeywordsTabProps = {
  keywords: Keyword[]
  isLoading: boolean
  onRefresh: () => void
  onGenerate: () => void
  isGenerating: boolean
  onPlan: (keywordId: string) => void
  onToggleStar: (keywordId: string, starred: boolean) => void
}

export function KeywordsTab({
  keywords,
  isLoading,
  onRefresh,
  onGenerate,
  isGenerating,
  onPlan,
  onToggleStar
}: KeywordsTabProps) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'recommended' | 'planned' | 'generated'>('all')
  const [oppFilter, setOppFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all')

  const counts = useMemo(() => {
    const base = { all: keywords.length, recommended: 0, planned: 0, generated: 0 }
    for (const k of keywords) {
      const s = (k.status || 'recommended') as 'recommended' | 'planned' | 'generated'
      if (s in base) (base as any)[s]++
    }
    return base
  }, [keywords])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return keywords.filter((k) => {
      if (statusFilter !== 'all' && (k.status || 'recommended') !== statusFilter) return false
      if (q && !k.phrase.toLowerCase().includes(q)) return false
      if (oppFilter !== 'all') {
        const b = computeOpportunityBadge(k)
        const label = b.label.toLowerCase() as 'low' | 'medium' | 'high'
        if (label !== oppFilter) return false
      }
      return true
    })
  }, [keywords, query, statusFilter, oppFilter])

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? 'Generating…' : 'Generate keywords'}
        </button>
        <button
          type="button"
          className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onRefresh}
          disabled={isLoading}
        >
          {isLoading ? 'Refreshing…' : 'Refresh'}
        </button>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            className={`rounded-full px-2.5 py-1 font-semibold ${statusFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
            onClick={() => setStatusFilter('all')}
          >
            All ({counts.all})
          </button>
          <button
            type="button"
            className={`rounded-full px-2.5 py-1 font-semibold ${statusFilter === 'recommended' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
            onClick={() => setStatusFilter('recommended')}
          >
            Recommended ({counts.recommended})
          </button>
          <button
            type="button"
            className={`rounded-full px-2.5 py-1 font-semibold ${statusFilter === 'planned' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
            onClick={() => setStatusFilter('planned')}
          >
            Planned ({counts.planned})
          </button>
          <button
            type="button"
            className={`rounded-full px-2.5 py-1 font-semibold ${statusFilter === 'generated' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
            onClick={() => setStatusFilter('generated')}
          >
            Generated ({counts.generated})
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search keywords…"
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          />
          <select
            className="rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm"
            value={oppFilter}
            onChange={(e) => setOppFilter(e.target.value as any)}
          >
            <option value="all">All opportunities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading keywords…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No matching keywords.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Keyword</th>
                <th className="px-4 py-2 text-left font-semibold">Opportunity</th>
                <th className="px-4 py-2 text-left font-semibold">Difficulty</th>
                <th className="px-4 py-2 text-left font-semibold">Volume</th>
                <th className="px-4 py-2 text-left font-semibold">CPC</th>
                <th className="px-4 py-2 text-left font-semibold">Updated</th>
                <th className="px-4 py-2 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((keyword) => {
                const badge = computeOpportunityBadge(keyword)
                const metrics = keyword.metricsJson ?? {}
                const starred = Boolean(keyword.starred)
                return (
                  <tr key={keyword.id} className="odd:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{keyword.phrase}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${badgeClassForTone(
                          badge.tone
                        )}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {metrics?.difficulty ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatNumber(metrics?.searchVolume)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatCurrency(metrics?.cpc)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDateTime(metrics?.asOf)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <button
                          type="button"
                          className="rounded-md bg-primary px-2.5 py-1 font-semibold text-primary-foreground shadow-sm"
                          onClick={() => onPlan(keyword.id)}
                        >
                          Plan
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-input px-2.5 py-1 font-medium hover:bg-muted"
                          onClick={() => onToggleStar(keyword.id, !starred)}
                        >
                          {starred ? '★ Starred' : '☆ Star'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
