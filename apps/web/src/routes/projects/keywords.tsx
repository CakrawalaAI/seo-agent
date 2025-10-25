// @ts-nocheck
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { Keyword } from '@seo-agent/domain'
import { useProjectLayout } from './__layout'

type KeywordResponse = {
  items: Keyword[]
  nextCursor?: string
}

const fetchKeywords = async (projectId: string, status: string): Promise<KeywordResponse> => {
  const params = new URLSearchParams({ projectId, limit: '100' })
  if (status && status !== 'all') {
    params.set('status', status)
  }
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

const STATUS_OPTIONS: Array<'all' | 'recommended' | 'planned' | 'generated'> = [
  'all',
  'recommended',
  'planned',
  'generated'
]

function KeywordsPage() {
  const { projectId } = useProjectLayout()
  const queryClient = useQueryClient()

  const [statusFilter, setStatusFilter] = useState<'all' | 'recommended' | 'planned' | 'generated'>('all')
  const [phrase, setPhrase] = useState('')
  const [topic, setTopic] = useState('')
  const [locale, setLocale] = useState('en-US')
  const [volume, setVolume] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [cpc, setCpc] = useState('')
  const [competition, setCompetition] = useState('')

  const keywordQuery = useQuery({
    queryKey: ['project', projectId, 'keywords', statusFilter],
    queryFn: () => fetchKeywords(projectId, statusFilter),
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
          if (keyword.isStarred) acc.starred += 1
          return acc
        },
        { recommended: 0, planned: 0, generated: 0, starred: 0 }
      ),
    [keywords]
  )

  const invalidateKeywords = () =>
    queryClient.invalidateQueries({ queryKey: ['project', projectId, 'keywords'] })

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        projectId,
        phrase,
        locale,
        primaryTopic: topic || undefined
      }

      const metrics: Record<string, number> = {}
      if (volume.trim()) metrics.searchVolume = Number.parseInt(volume, 10)
      if (difficulty.trim()) metrics.difficulty = Number.parseFloat(difficulty)
      if (cpc.trim()) metrics.cpc = Number.parseFloat(cpc)
      if (competition.trim()) metrics.competition = Number.parseFloat(competition)
      if (Object.keys(metrics).length > 0) {
        payload.metricsJson = metrics
      }

      const response = await fetch('/api/keywords', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      })
      if (!response.ok) {
        throw new Error('Failed to create keyword')
      }
      return (await response.json()) as Keyword
    },
    onSuccess: () => {
      setPhrase('')
      setTopic('')
      setVolume('')
      setDifficulty('')
      setCpc('')
      setCompetition('')
      invalidateKeywords()
    }
  })

  const starMutation = useMutation({
    mutationFn: async ({ keywordId, star }: { keywordId: string; star: boolean }) => {
      const response = await fetch(`/api/keywords/${keywordId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isStarred: star })
      })
      if (!response.ok) {
        throw new Error('Failed to update keyword')
      }
      return (await response.json()) as Keyword
    },
    onSuccess: () => invalidateKeywords()
  })

  const deleteMutation = useMutation({
    mutationFn: async (keywordId: string) => {
      const response = await fetch(`/api/keywords/${keywordId}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      if (!response.ok) {
        throw new Error('Failed to delete keyword')
      }
    },
    onSuccess: () => invalidateKeywords()
  })

  const handleCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!phrase.trim()) return
    createMutation.mutate()
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Keywords</p>
        <h2 className="text-2xl font-semibold">Opportunities sourced from crawl + discovery</h2>
        <p className="text-sm text-muted-foreground">
          Prioritize the highest opportunity keywords, then add them to the plan to lock in publishing dates.
        </p>
        <div className="grid gap-3 sm:grid-cols-4">
          <StatCard label="Starred" value={totals.starred} accent="text-amber-600" />
          <StatCard label="Recommended" value={totals.recommended} />
          <StatCard label="Planned" value={totals.planned} />
          <StatCard label="Draft generated" value={totals.generated} />
        </div>
      </header>

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground">Add keyword</h3>
        <form className="mt-3 grid gap-3 md:grid-cols-5" onSubmit={handleCreate}>
          <InputField
            label="Keyword"
            value={phrase}
            onChange={setPhrase}
            required
            placeholder="e.g. best crm for startups"
            disabled={createMutation.isPending}
          />
          <InputField
            label="Topic"
            value={topic}
            onChange={setTopic}
            placeholder="Content pillar"
            disabled={createMutation.isPending}
          />
          <InputField
            label="Locale"
            value={locale}
            onChange={setLocale}
            disabled={createMutation.isPending}
          />
          <InputField
            label="Volume"
            value={volume}
            onChange={setVolume}
            type="number"
            disabled={createMutation.isPending}
          />
          <InputField
            label="Difficulty"
            value={difficulty}
            onChange={setDifficulty}
            type="number"
            disabled={createMutation.isPending}
          />
          <InputField
            label="CPC ($)"
            value={cpc}
            onChange={setCpc}
            type="number"
            step="0.01"
            disabled={createMutation.isPending}
          />
          <InputField
            label="Competition"
            value={competition}
            onChange={setCompetition}
            type="number"
            step="0.01"
            disabled={createMutation.isPending}
          />
          <div className="flex items-end">
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={createMutation.isPending || !phrase.trim()}
            >
              {createMutation.isPending ? 'Adding…' : 'Add keyword'}
            </button>
          </div>
        </form>
        {createMutation.isError ? (
          <p className="mt-3 text-sm text-destructive">Unable to add keyword. Try a unique phrase.</p>
        ) : null}
      </section>

      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          Status filter
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option === 'all' ? 'All' : option.charAt(0).toUpperCase() + option.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
          onClick={() => invalidateKeywords()}
          disabled={keywordQuery.isFetching}
        >
          Refresh
        </button>
      </div>

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
          No keywords yet. Use the form above or run <code>seo keyword generate --project {projectId}</code>.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Star</th>
                <th className="px-4 py-2 text-left">Keyword</th>
                <th className="px-4 py-2 text-left">Opportunity</th>
                <th className="px-4 py-2 text-left">Volume</th>
                <th className="px-4 py-2 text-left">Difficulty</th>
                <th className="px-4 py-2 text-left">CPC</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {keywords.map((keyword) => (
                <tr key={keyword.id} className="hover:bg-muted/10">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${keyword.isStarred ? 'border-amber-500 bg-amber-500/10 text-amber-600' : 'border-muted-foreground/20 text-muted-foreground hover:text-foreground'}`}
                      aria-label={keyword.isStarred ? 'Unstar keyword' : 'Star keyword'}
                      onClick={() => starMutation.mutate({ keywordId: keyword.id, star: !keyword.isStarred })}
                      disabled={starMutation.isPending}
                    >
                      {keyword.isStarred ? '★' : '☆'}
                    </button>
                  </td>
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
                  <td className="px-4 py-3 text-xs">
                    <button
                      type="button"
                      className="text-destructive hover:underline disabled:opacity-50"
                      onClick={() => deleteMutation.mutate(keyword.id)}
                      disabled={deleteMutation.isPending}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

const InputField = ({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
  disabled,
  step
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  step?: string
}) => (
  <label className="flex flex-col text-xs font-medium text-muted-foreground">
    {label}
    <input
      type={type}
      value={value}
      required={required}
      placeholder={placeholder}
      step={step}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
      disabled={disabled}
    />
  </label>
)

const StatCard = ({ label, value, accent }: { label: string; value: number; accent?: string }) => (
  <div className="rounded-md border bg-card p-3">
    <p className={`text-xs ${accent ?? 'text-muted-foreground'}`}>{label}</p>
    <p className="text-lg font-semibold text-foreground">{value}</p>
  </div>
)

const formatNumber = (value: unknown) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toLocaleString() : '—'
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed.toLocaleString() : '—'
  }
  return '—'
}

const formatCurrency = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `$${value.toFixed(2)}`
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? `$${parsed.toFixed(2)}` : '—'
  }
  return '—'
}

export default KeywordsPage
