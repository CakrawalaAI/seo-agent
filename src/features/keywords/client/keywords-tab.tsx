import {
  badgeClassForTone,
  computeOpportunityBadge,
  formatCurrency,
  formatDateTime,
  formatNumber
} from '@features/projects/shared/helpers'
import type { Keyword } from '@entities'

type KeywordsTabProps = {
  keywords: Keyword[]
  isLoading: boolean
  onRefresh: () => void
  onGenerate: () => void
  isGenerating: boolean
}

export function KeywordsTab({
  keywords,
  isLoading,
  onRefresh,
  onGenerate,
  isGenerating
}: KeywordsTabProps) {
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
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading keywords…</p>
      ) : keywords.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No keywords yet. Trigger the discovery workflow to populate this list.
        </p>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {keywords.map((keyword) => {
                const badge = computeOpportunityBadge(keyword)
                const metrics = keyword.metricsJson ?? {}
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
