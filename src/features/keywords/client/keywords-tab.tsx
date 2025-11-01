import { formatCurrency, formatDateTime, formatNumber } from '@features/projects/shared/helpers'
import type { Keyword } from '@entities'
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
      return true
    })
  }, [keywords, query, statusFilter])

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
  }, [onPlan, onToggleStar])

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating…' : 'Generate keywords'}
          </Button>
          <Button
            type="button"
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onRefresh}
            disabled={isLoading}
          >
            {isLoading ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
        <div className="flex items-center gap-1 rounded-lg border bg-card p-1 text-xs">
          {([
            ['all', `All (${counts.all})`],
            ['recommended', `Recommended (${counts.recommended})`],
            ['planned', `Planned (${counts.planned})`],
            ['generated', `Generated (${counts.generated})`]
          ] as const).map(([key, label]) => (
            <Button
              key={key}
              type="button"
              className={`rounded-md px-2.5 py-1 font-semibold ${
                statusFilter === key ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60'
              }`}
              onClick={() => setStatusFilter(key as any)}
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
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
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
