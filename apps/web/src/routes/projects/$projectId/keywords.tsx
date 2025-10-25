// @ts-nocheck
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { Keyword } from '@seo-agent/domain'
import { useProjectLayout } from './__layout'

type KeywordResponse = {
  items: Keyword[]
  nextCursor?: string
}

const fetchKeywords = async (projectId: string): Promise<KeywordResponse> => {
  const params = new URLSearchParams({ projectId, limit: '100' })
  const response = await fetch(`/api/keywords?${params.toString()}`, {
    credentials: 'include'
  })
  if (!response.ok) {
    throw new Error('Failed to load keywords')
  }
  return (await response.json()) as KeywordResponse
}

export const Route = createFileRoute('/projects/$projectId/keywords')({
  component: KeywordsPage
})

function KeywordsPage() {
  const { projectId } = useProjectLayout()

  const keywordQuery = useQuery({
    queryKey: ['project', projectId, 'keywords'],
    queryFn: () => fetchKeywords(projectId),
    staleTime: 60_000,
    refetchInterval: 180_000
  })

  const keywords = keywordQuery.data?.items ?? []
  const totals = useMemo(
    () =>
      keywords.reduce(
        (acc, keyword) => {
          if (keyword.status === 'planned') acc.planned += 1
          if (keyword.status === 'generated') acc.generated += 1
          if (keyword.status === 'recommended') acc.recommended += 1
          return acc
        },
        { recommended: 0, planned: 0, generated: 0 }
      ),
    [keywords]
  )

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Keywords</p>
        <h2 className="text-2xl font-semibold">Opportunities sourced from crawl + discovery</h2>
        <p className="text-sm text-muted-foreground">
          Prioritize the highest opportunity keywords, then add them to the plan to lock in publishing dates.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border bg-card p-3">
            <p className="text-xs text-muted-foreground">Recommended</p>
            <p className="text-lg font-semibold text-foreground">{totals.recommended}</p>
          </div>
          <div className="rounded-md border bg-card p-3">
            <p className="text-xs text-muted-foreground">Planned</p>
            <p className="text-lg font-semibold text-foreground">{totals.planned}</p>
          </div>
          <div className="rounded-md border bg-card p-3">
            <p className="text-xs text-muted-foreground">Draft generated</p>
            <p className="text-lg font-semibold text-foreground">{totals.generated}</p>
          </div>
        </div>
      </header>

      {keywordQuery.isLoading ? (
        <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
          Loading keywords…
        </div>
      ) : keywordQuery.isError ? (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-6 text-sm text-destructive">
          Unable to load keywords. Check the worker logs or rerun discovery.
        </div>
      ) : keywords.length === 0 ? (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          No keywords yet. Run <code>seo keyword generate --project {projectId}</code> to seed the list.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Keyword</th>
                <th className="px-4 py-2 text-left">Opportunity</th>
                <th className="px-4 py-2 text-left">Volume</th>
                <th className="px-4 py-2 text-left">Difficulty</th>
                <th className="px-4 py-2 text-left">CPC</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {keywords.map((keyword) => (
                <tr key={keyword.id} className="hover:bg-muted/10">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{keyword.phrase}</div>
                    <div className="text-xs text-muted-foreground">Locale: {keyword.locale}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                      {keyword.metricsJson?.opportunity ?? 'High'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatNumber(keyword.metricsJson?.searchVolume)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatNumber(keyword.metricsJson?.difficulty)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatCurrency(keyword.metricsJson?.cpc)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{keyword.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

const formatNumber = (value: unknown) => {
  if (typeof value === 'number') {
    return value.toLocaleString()
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed.toLocaleString() : '—'
  }
  return '—'
}

const formatCurrency = (value: unknown) => {
  if (typeof value !== 'number') {
    return '—'
  }
  return `$${value.toFixed(2)}`
}

