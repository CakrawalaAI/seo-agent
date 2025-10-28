import {
  badgeClassForTone,
  computeOpportunityBadge,
  formatCurrency,
  formatDateTime,
  formatNumber
} from '@features/projects/shared/helpers'
import type { Keyword } from '@entities'
import { Star } from 'lucide-react'
import { Button } from '@src/common/ui/button'
import { Input } from '@src/common/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@src/common/ui/select'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell
} from '@src/common/ui/table'
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
          <Select value={oppFilter} onValueChange={(v) => setOppFilter(v as any)}>
            <SelectTrigger className="w-[180px] text-xs">
              <SelectValue placeholder="Opportunities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All opportunities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading keywords…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No matching keywords.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
          <Table className="min-w-full divide-y divide-border text-sm">
            <TableHeader className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <TableRow>
                <TableHead className="w-10 px-4 py-2 text-left font-semibold">★</TableHead>
                <TableHead className="px-2 py-2 text-left font-semibold">Keyword</TableHead>
                <TableHead className="px-2 py-2 text-left font-semibold">Opportunity</TableHead>
                <TableHead className="px-2 py-2 text-left font-semibold">Difficulty</TableHead>
                <TableHead className="px-2 py-2 text-left font-semibold">Volume</TableHead>
                <TableHead className="px-2 py-2 text-left font-semibold">CPC</TableHead>
                <TableHead className="px-2 py-2 text-left font-semibold">Updated</TableHead>
                <TableHead className="px-2 py-2 text-left font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border">
              {filtered.map((keyword) => {
                const badge = computeOpportunityBadge(keyword)
                const metrics = keyword.metricsJson ?? {}
                const starred = Boolean(keyword.starred)
                return (
                  <TableRow key={keyword.id} className="hover:bg-muted/30">
                    <TableCell className="px-4 py-3">
                      <Button
                        type="button"
                        aria-label={starred ? 'Unstar' : 'Star'}
                        className={`rounded p-1 ${starred ? 'text-yellow-400' : 'text-muted-foreground hover:text-foreground'}`}
                        onClick={() => onToggleStar(keyword.id, !starred)}
                      >
                        <Star className={`h-4 w-4 ${starred ? 'fill-yellow-400' : ''}`} />
                      </Button>
                    </TableCell>
                    <TableCell className="px-2 py-3 text-sm font-medium text-foreground">{keyword.phrase}</TableCell>
                    <TableCell className="px-2 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${badgeClassForTone(
                          badge.tone
                        )}`}
                      >
                        {badge.label}
                      </span>
                    </TableCell>
                    <TableCell className="px-2 py-3 text-sm text-muted-foreground">{metrics?.difficulty ?? '—'}</TableCell>
                    <TableCell className="px-2 py-3 text-sm text-muted-foreground">{formatNumber(metrics?.searchVolume)}</TableCell>
                    <TableCell className="px-2 py-3 text-sm text-muted-foreground">{formatCurrency(metrics?.cpc)}</TableCell>
                    <TableCell className="px-2 py-3 text-xs text-muted-foreground">{formatDateTime(metrics?.asOf)}</TableCell>
                    <TableCell className="px-2 py-3">
                      <Button
                        type="button"
                        className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow-sm"
                        onClick={() => onPlan(keyword.id)}
                      >
                        Plan
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}
