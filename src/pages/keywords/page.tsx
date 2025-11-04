import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useActiveWebsite } from '@common/state/active-website'
import { useMockData } from '@common/dev/mock-data-context'
import { getWebsite } from '@entities/website/service'
import type { Keyword } from '@entities'
import { DataTable, type ColumnDef } from '@src/common/ui/data-table'
import { Badge } from '@src/common/ui/badge'
import { Button } from '@src/common/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@src/common/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@src/common/ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@src/common/ui/empty'
import { Input } from '@src/common/ui/input'
import { Label } from '@src/common/ui/label'
import { Skeleton } from '@src/common/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@src/common/ui/tooltip'
import { formatCurrency, formatNumber, extractErrorMessage } from '@src/common/ui/format'
import { cn } from '@src/common/ui/cn'
import { ArrowUpDown, Loader2, MoreHorizontal, Plus, X as XIcon } from 'lucide-react'

const MOCK_KEYWORDS: Array<Keyword & { include?: boolean | null }> = [
  {
    id: 'kw-m-1',
    websiteId: 'proj_mock',
    canonId: 'kw-m-1',
    phrase: 'interview questions for product managers',
    metricsJson: { searchVolume: 4400, difficulty: 36, cpc: 2.1, competition: 0.32, asOf: new Date().toISOString() },
    status: 'ready',
    include: true
  },
  {
    id: 'kw-m-2',
    websiteId: 'proj_mock',
    canonId: 'kw-m-2',
    phrase: 'behavioral interview examples',
    metricsJson: { searchVolume: 6600, difficulty: 62, cpc: 1.45, competition: 0.58, asOf: new Date().toISOString() },
    status: 'in_review',
    include: false
  },
  {
    id: 'kw-m-3',
    websiteId: 'proj_mock',
    canonId: 'kw-m-3',
    phrase: 'mock interview ai coach',
    metricsJson: { searchVolume: 1900, difficulty: 24, cpc: 3.4, competition: 0.41, asOf: new Date().toISOString() },
    status: 'starred',
    include: false
  }
]

type KeywordRow = Keyword & { include?: boolean | null }

type AddKeywordPayload = {
  phrase: string
  searchVolume?: number | null
  difficulty?: number | null
  cpc?: number | null
  competition?: number | null
}

export function Page(): JSX.Element {
  const { id: projectId } = useActiveWebsite()
  const { enabled: mockEnabled } = useMockData()
  const [addOpen, setAddOpen] = useState(false)
  const [formValues, setFormValues] = useState({ phrase: '', volume: '', difficulty: '', cpc: '', competition: '' })
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<KeywordRow | null>(null)
  const [includePendingId, setIncludePendingId] = useState<string | null>(null)
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null)

  const projectQuery = useQuery({
    queryKey: ['keywords.project', projectId],
    queryFn: () => getWebsite(projectId!),
    enabled: Boolean(projectId && !mockEnabled)
  })

  const keywordsQuery = useQuery({
    queryKey: ['keywords.list', projectId],
    queryFn: async () => (await (await fetch(`/api/websites/${projectId}/keywords?limit=200`)).json()).items,
    enabled: Boolean(projectId && !mockEnabled),
    refetchInterval: 45_000
  })

  const refetchKeywords = keywordsQuery.refetch

  const keywords: KeywordRow[] = mockEnabled ? MOCK_KEYWORDS : keywordsQuery.data ?? []
  const counts = useMemo(() => {
    let active = 0
    for (const kw of keywords) {
      if (kw?.include) active += 1
    }
    return { total: keywords.length, active }
  }, [keywords])

  const locale = (projectQuery.data as any)?.defaultLocale ?? 'en-US'

  const resetForm = () => {
    setFormValues({ phrase: '', volume: '', difficulty: '', cpc: '', competition: '' })
    setFormError(null)
  }

  const addKeywordMutation = useMutation({
    mutationFn: async (payload: AddKeywordPayload) => {
      if (!projectId) throw new Error('Select a website to add keywords')
      if (mockEnabled) throw new Error('Mock data is read-only')
      const response = await fetch(`/api/websites/${projectId}/keywords`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...payload, locale })
      })
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Failed to add keyword')
      }
      return await response.json()
    },
    onSuccess: () => {
      resetForm()
      setAddOpen(false)
      refetchKeywords()
    },
    onError: (error) => {
      setFormError(extractErrorMessage(error))
    }
  })

  const handleToggleInclude = useCallback(async (keywordId: string, include: boolean) => {
    if (mockEnabled) return
    setIncludePendingId(keywordId)
    try {
      await fetch(`/api/keywords/${keywordId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ include })
      })
      await refetchKeywords()
    } finally {
      setIncludePendingId(null)
    }
  }, [mockEnabled, refetchKeywords])

  const confirmDelete = async () => {
    const target = deleteTarget
    if (!target || mockEnabled) return
    setDeletePendingId(target.id)
    try {
      await fetch(`/api/keywords/${target.id}`, { method: 'DELETE' })
      await refetchKeywords()
      setDeleteTarget(null)
    } finally {
      setDeletePendingId(null)
    }
  }

  const columns = useMemo<ColumnDef<KeywordRow>[]>(() => {
    const SortHeader = ({ column, label }: { column: any; label: string }) => (
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
        accessorKey: 'phrase',
        header: ({ column }) => <SortHeader column={column} label="Keyword" />,
        cell: ({ row }) => <span className="font-medium text-foreground">{row.original.phrase}</span>,
        sortingFn: 'alphanumeric'
      },
      {
        id: 'searchVolume',
        accessorFn: (kw) => safeNumber(kw.metricsJson?.searchVolume),
        header: ({ column }) => <SortHeader column={column} label="Volume" />,
        cell: ({ row }) => formatNumber(row.original.metricsJson?.searchVolume)
      },
      {
        id: 'difficulty',
        accessorFn: (kw) => safeNumber(kw.metricsJson?.difficulty),
        header: ({ column }) => <SortHeader column={column} label="Difficulty" />,
        cell: ({ row }) => {
          const score = safeNumber(row.original.metricsJson?.difficulty)
          if (score == null) return '—'
          const tier = difficultyTier(score)
          const asOf = row.original.metricsJson?.asOf
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge className={cn('cursor-default px-2 py-0.5 text-xs font-semibold', tier.className)}>
                  {tier.label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>{`${score}/100${asOf ? ` • ${formatAsOf(asOf)}` : ''}`}</TooltipContent>
            </Tooltip>
          )
        }
      },
      {
        id: 'cpc',
        accessorFn: (kw) => safeNumber(kw.metricsJson?.cpc),
        header: ({ column }) => <SortHeader column={column} label="CPC" />,
        cell: ({ row }) => formatCurrency(row.original.metricsJson?.cpc)
      },
      {
        id: 'competition',
        accessorFn: (kw) => safeNumber(kw.metricsJson?.competition),
        header: ({ column }) => <SortHeader column={column} label="Competition" />,
        cell: ({ row }) => {
          const value = safeNumber(row.original.metricsJson?.competition)
          if (value == null) return '—'
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="font-medium">{formatCompetition(value)}</span>
              </TooltipTrigger>
              <TooltipContent>Paid search competition index (0-1)</TooltipContent>
            </Tooltip>
          )
        }
      },
      {
        id: 'include',
        accessorFn: (kw) => (kw.include ? 1 : 0),
        header: ({ column }) => <SortHeader column={column} label="Active" />,
        cell: ({ row }) => {
          const keyword = row.original
          const included = Boolean(keyword.include)
          const pending = includePendingId === keyword.id
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className={cn('h-8 w-8', included ? 'text-rose-500 hover:text-rose-600' : 'text-muted-foreground hover:text-foreground')}
                  aria-label={included ? 'Remove keyword' : 'Include keyword'}
                  onClick={() => handleToggleInclude(keyword.id, !included)}
                  disabled={mockEnabled || pending}
                >
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : included ? <XIcon className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{included ? 'Remove from active plan' : 'Include in active plan'}</TooltipContent>
            </Tooltip>
          )
        }
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Open actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setDeleteTarget(row.original)} className="text-destructive">
                Delete keyword
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        enableSorting: false
      }
    ]
  }, [handleToggleInclude, includePendingId, mockEnabled])

  if (!projectId) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Keywords</h1>
          <p className="text-sm text-muted-foreground">Surface patterns that align with the selected website.</p>
        </header>
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No website selected</EmptyTitle>
            <EmptyDescription>Pick a website from the sidebar to view its keyword backlog.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  const isLoading = !mockEnabled && keywordsQuery.isLoading

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Keywords</h1>
        <p className="text-sm text-muted-foreground">Triage and prioritize opportunities for {mockEnabled ? 'Prep Interview' : (projectQuery.data as any)?.url ?? 'your website'}.</p>
      </header>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4 shadow-sm">
        <span className="text-xs font-semibold text-muted-foreground">{`${counts.active} / ${counts.total || 0} keywords active`}</span>
        <div className="ml-auto flex items-center gap-3">
          {mockEnabled ? <Badge variant="outline">Mock data is read-only</Badge> : null}
          <Button type="button" onClick={() => { resetForm(); setAddOpen(true) }} disabled={!projectId || mockEnabled}>
            <Plus className="h-4 w-4" />
            Add Keyword
          </Button>
        </div>
      </div>

      {isLoading ? (
        <KeywordTableSkeleton />
      ) : keywords.length === 0 ? (
        <Empty className="border bg-card/70">
          <EmptyHeader>
            <EmptyTitle>No keywords yet</EmptyTitle>
            <EmptyDescription>
              {mockEnabled ? 'Toggle mock data off to view the live queue.' : 'Use Add Keyword to bring in targets from recent research.'}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <section className="rounded-lg border bg-card p-0 shadow-sm">
          <TooltipProvider>
            <DataTable columns={columns} data={keywords} paginate={false} initialSorting={[{ id: 'phrase', desc: false }]} />
          </TooltipProvider>
        </section>
      )}

      <Dialog open={addOpen} onOpenChange={(next) => { setAddOpen(next); if (!next) resetForm() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add keyword</DialogTitle>
            <DialogDescription>Manually add a keyword with optional performance metrics.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(event) => {
            event.preventDefault()
            const phrase = formValues.phrase.trim()
            if (!phrase) {
              setFormError('Keyword phrase is required')
              return
            }
            setFormError(null)
            addKeywordMutation.mutate({
              phrase,
              searchVolume: toOptionalInt(formValues.volume),
              difficulty: toOptionalInt(formValues.difficulty),
              cpc: toOptionalFloat(formValues.cpc),
              competition: toOptionalFloat(formValues.competition)
            })
          }}>
            <div className="space-y-2">
              <Label htmlFor="keyword-phrase">Keyword</Label>
              <Input
                id="keyword-phrase"
                placeholder="e.g. behavioral interview framework"
                value={formValues.phrase}
                onChange={(event) => setFormValues((prev) => ({ ...prev, phrase: event.target.value }))}
                disabled={addKeywordMutation.isPending}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="keyword-volume">Search volume</Label>
                <Input
                  id="keyword-volume"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  placeholder="e.g. 5400"
                  value={formValues.volume}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, volume: event.target.value }))}
                  disabled={addKeywordMutation.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="keyword-difficulty">Difficulty (0-100)</Label>
                <Input
                  id="keyword-difficulty"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="100"
                  placeholder="e.g. 45"
                  value={formValues.difficulty}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, difficulty: event.target.value }))}
                  disabled={addKeywordMutation.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="keyword-cpc">CPC (USD)</Label>
                <Input
                  id="keyword-cpc"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 2.15"
                  value={formValues.cpc}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, cpc: event.target.value }))}
                  disabled={addKeywordMutation.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="keyword-competition">Competition (0-1)</Label>
                <Input
                  id="keyword-competition"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="1"
                  step="0.01"
                  placeholder="e.g. 0.42"
                  value={formValues.competition}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, competition: event.target.value }))}
                  disabled={addKeywordMutation.isPending}
                />
              </div>
            </div>
            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { resetForm(); setAddOpen(false) }} disabled={addKeywordMutation.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={addKeywordMutation.isPending}>
                {addKeywordMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Add keyword
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(next) => { if (!next) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete keyword?</DialogTitle>
            <DialogDescription>This removes {deleteTarget?.phrase || 'the keyword'} from the backlog. This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={Boolean(deletePendingId)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDelete} disabled={Boolean(deletePendingId)}>
              {deletePendingId ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function KeywordTableSkeleton(): JSX.Element {
  return (
    <section className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="grid grid-cols-6 items-center gap-4">
            <Skeleton className="col-span-2 h-4" />
            <Skeleton className="h-4" />
            <Skeleton className="h-4" />
            <Skeleton className="h-4" />
            <Skeleton className="h-9 rounded-md" />
          </div>
        ))}
      </div>
    </section>
  )
}

function safeNumber(value: unknown): number | null {
  if (value == null) return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function difficultyTier(score: number): { label: string; className: string } {
  if (score >= 70) return { label: 'High', className: 'bg-rose-500/15 text-rose-600' }
  if (score >= 30) return { label: 'Medium', className: 'bg-amber-500/20 text-amber-600' }
  return { label: 'Low', className: 'bg-emerald-500/15 text-emerald-600' }
}

function formatCompetition(value: number): string {
  return `${Math.round(value * 100)}%`
}

function formatAsOf(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function toOptionalInt(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function toOptionalFloat(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}
