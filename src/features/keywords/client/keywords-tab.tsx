import { formatCurrency, formatDateTime, formatNumber } from '@src/common/ui/format'
import type { Keyword } from '@entities'
import type { KeywordScope } from '@entities/keyword/domain/keyword'
import { deriveScope } from '@entities/keyword/domain/keyword'
import { ArrowUpDown, Star } from 'lucide-react'
import { Button } from '@src/common/ui/button'
import { Input } from '@src/common/ui/input'
import { DataTable, type ColumnDef } from '@src/common/ui/data-table'
import { useMemo, useState } from 'react'

type KeywordsTabProps = {
  keywords: Keyword[]
  isLoading: boolean
  onRefresh: () => void
  onGenerate: () => void
  isGenerating: boolean
  onPlan: (keywordId: string) => void
  onToggleStar: (keywordId: string, starred: boolean) => void
  onSetScope: (keywordId: string, scope: KeywordScope) => void
}

export function KeywordsTab({
  keywords,
  isLoading,
  onRefresh,
  onGenerate,
  isGenerating,
  onPlan,
  onToggleStar,
  onSetScope
}: KeywordsTabProps) {
  const [query, setQuery] = useState('')
  const [scopeFilter, setScopeFilter] = useState<'all' | KeywordScope>('all')

  const counts = useMemo(() => {
    const tally: Record<'all' | KeywordScope, number> = { all: keywords.length, include: 0, exclude: 0, auto: 0 }
    for (const keyword of keywords) {
      const scope = (keyword.scope || 'auto') as KeywordScope
      tally[scope] += 1
    }
    return tally
  }, [keywords])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return keywords.filter((k) => {
      if (scopeFilter !== 'all') {
        const currentScope = (k.scope || 'auto') as KeywordScope
        if (currentScope !== scopeFilter) return false
      }
      if (q && !k.phrase.toLowerCase().includes(q)) return false
      return true
    })
  }, [keywords, query, scopeFilter])

  type SortKey = 'phrase' | 'difficulty' | 'searchVolume' | 'cpc' | 'competition' | 'asOf'
  const [sortBy, setSortBy] = useState<SortKey>('phrase')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // TanStack columns
  const columns = useMemo<ColumnDef<Keyword>[]>(() => {
    const SortHeader = ({ column, label }: any) => (
      <Button
        type="button"
        variant="ghost"
        className="-ml-3 h-8 px-3 text-xs font-semibold"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        {label}
        <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
      </Button>
    )
    return [
      {
        id: 'star',
        header: () => '★',
        cell: ({ row }) => {
          const k = row.original
          const starred = Boolean(k.starred)
          return (
            <Button
              type="button"
              aria-label={starred ? 'Unstar' : 'Star'}
              className={`rounded p-1 ${starred ? 'text-yellow-400' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => onToggleStar(k.id, !starred)}
            >
              <Star className={`h-4 w-4 ${starred ? 'fill-yellow-400' : ''}`} />
            </Button>
          )
        },
        enableSorting: false,
        size: 40
      },
      {
        accessorKey: 'phrase',
        header: ({ column }) => <SortHeader column={column} label="Keyword" />,
        cell: ({ row }) => <span className="font-medium text-foreground">{row.original.phrase}</span>,
        sortingFn: 'alphanumeric'
      },
      {
        id: 'scope',
        accessorFn: (k) => k.scope || 'auto',
        header: () => 'Scope',
        cell: ({ row }) => {
          const keyword = row.original
          const currentScope = (keyword.scope || 'auto') as KeywordScope
          const recommended = deriveScope(keyword.metricsJson)
          const displayScope = currentScope === 'auto' ? recommended : currentScope
          const label =
            currentScope === 'auto'
              ? `Auto · ${displayScope === 'exclude' ? 'Exclude' : 'Include'}`
              : displayScope === 'exclude'
              ? 'Exclude'
              : 'Include'
          const pillClass =
            displayScope === 'include'
              ? 'bg-emerald-500/15 text-emerald-600'
              : displayScope === 'exclude'
              ? 'bg-rose-500/15 text-rose-600'
              : 'bg-muted text-muted-foreground'
          return (
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${pillClass}`}>
                {label}
              </span>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={currentScope === 'include' ? 'default' : 'outline'}
                  onClick={() => onSetScope(keyword.id, 'include')}
                >
                  Include
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={currentScope === 'exclude' ? 'default' : 'outline'}
                  onClick={() => onSetScope(keyword.id, 'exclude')}
                >
                  Exclude
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={currentScope === 'auto' ? 'default' : 'outline'}
                  onClick={() => onSetScope(keyword.id, 'auto')}
                >
                  Auto
                </Button>
              </div>
            </div>
          )
        },
        enableSorting: false
      },
      {
        id: 'difficulty',
        accessorFn: (k) => (Number.isFinite(k.metricsJson?.difficulty as any) ? Number(k.metricsJson?.difficulty as any) : null),
        header: ({ column }) => <SortHeader column={column} label="Difficulty" />,
        cell: ({ row }) => (row.original.metricsJson?.difficulty ?? '—')
      },
      {
        id: 'searchVolume',
        accessorFn: (k) => (Number.isFinite(k.metricsJson?.searchVolume as any) ? Number(k.metricsJson?.searchVolume as any) : null),
        header: ({ column }) => <SortHeader column={column} label="Volume" />,
        cell: ({ row }) => formatNumber(row.original.metricsJson?.searchVolume)
      },
      {
        id: 'cpc',
        accessorFn: (k) => (Number.isFinite(k.metricsJson?.cpc as any) ? Number(k.metricsJson?.cpc as any) : null),
        header: ({ column }) => <SortHeader column={column} label="CPC" />,
        cell: ({ row }) => formatCurrency(row.original.metricsJson?.cpc)
      },
      {
        id: 'competition',
        accessorFn: (k) => (Number.isFinite(k.metricsJson?.competition as any) ? Number(k.metricsJson?.competition as any) : null),
        header: ({ column }) => <SortHeader column={column} label="Competition" />,
        cell: ({ row }) => row.original.metricsJson?.competition ?? '—'
      },
      {
        id: 'asOf',
        accessorFn: (k) => (k.metricsJson?.asOf ? new Date(k.metricsJson.asOf).getTime() : 0),
        header: ({ column }) => <SortHeader column={column} label="Updated" />,
        cell: ({ row }) => formatDateTime(row.original.metricsJson?.asOf)
      },
      {
        id: 'actions',
        header: () => 'Actions',
        cell: ({ row }) => (
          <Button
            type="button"
            className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow-sm"
            onClick={() => onPlan(row.original.id)}
          >
            Plan
          </Button>
        ),
        enableSorting: false
      }
    ] satisfies ColumnDef<Keyword>[]
  }, [onPlan, onToggleStar, onSetScope])

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" onClick={onGenerate} disabled={isGenerating}>
          {isGenerating ? 'Generating…' : 'Generate against crawl result'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onRefresh}
          disabled={isLoading}
        >
          {isLoading ? 'Refreshing…' : 'Refresh metrics'}
        </Button>
        <span className="hidden h-6 w-px bg-border md:block" aria-hidden="true" />
        <div className="flex items-center gap-1 rounded-md border px-1 py-1">
          {([
            ['all', `All (${counts.all})`],
            ['include', `Include (${counts.include ?? 0})`],
            ['exclude', `Exclude (${counts.exclude ?? 0})`],
            ['auto', `Auto (${counts.auto ?? 0})`]
          ] as const).map(([key, label]) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={scopeFilter === key ? 'secondary' : 'ghost'}
              className="px-2.5 text-xs font-semibold"
              onClick={() => setScopeFilter(key as any)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search keywords…"
            className="h-8 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          />
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading keywords…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No matching keywords.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
          <DataTable columns={columns} data={filtered} paginate={false} />
        </div>
      )}
    </section>
  )
}
