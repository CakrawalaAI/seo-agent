import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { log } from '@src/common/logger'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useActiveWebsite } from '@common/state/active-website'
import { useMockData } from '@common/dev/mock-data-context'
import { getWebsite } from '@entities/website/service'
import type { Keyword } from '@entities'
import { DataTable, type ColumnDef } from '@src/common/ui/data-table'
import { Badge } from '@src/common/ui/badge'
import { Button } from '@src/common/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@src/common/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@src/common/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@src/common/ui/dropdown-menu'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@src/common/ui/empty'
import { Input } from '@src/common/ui/input'
import { Label } from '@src/common/ui/label'
import { Skeleton } from '@src/common/ui/skeleton'
import { Switch } from '@src/common/ui/switch'
import { Popover, PopoverContent, PopoverTrigger } from '@src/common/ui/popover'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@src/common/ui/tooltip'
import { formatCurrency, formatNumber, extractErrorMessage } from '@src/common/ui/format'
import { cn } from '@src/common/ui/cn'
import { ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2, MoreHorizontal, Plus, RefreshCw, SlidersHorizontal, X as XIcon } from 'lucide-react'
import { toast } from 'sonner'

const MOCK_KEYWORDS: Array<Keyword & { active?: boolean | null }> = [
  {
    id: 'kw-m-1',
    websiteId: 'proj_mock',
    canonId: 'kw-m-1',
    phrase: 'interview questions for product managers',
    metricsJson: { searchVolume: 4400, difficulty: 36, cpc: 2.1, competition: 0.32, asOf: new Date().toISOString() },
    status: 'ready',
    active: true
  },
  {
    id: 'kw-m-2',
    websiteId: 'proj_mock',
    canonId: 'kw-m-2',
    phrase: 'behavioral interview examples',
    metricsJson: { searchVolume: 6600, difficulty: 62, cpc: 1.45, competition: 0.58, asOf: new Date().toISOString() },
    status: 'in_review',
    active: false
  },
  {
    id: 'kw-m-3',
    websiteId: 'proj_mock',
    canonId: 'kw-m-3',
    phrase: 'mock interview ai coach',
    metricsJson: { searchVolume: 1900, difficulty: 24, cpc: 3.4, competition: 0.41, asOf: new Date().toISOString() },
    status: 'starred',
    active: false
  }
]

type KeywordRow = Keyword & { active?: boolean | null }

type KeywordsResponse = {
  items: KeywordRow[]
  total: number
  active: number
  page: number
  pageCount: number
}

type KeywordPreview = {
  phrase: string
  searchVolume: number | null
  difficulty: number | null
  cpc: number | null
  competition: number | null
  impressions: Record<string, unknown> | null
  vol12m: Array<{ month: string; searchVolume: number }> | null
  provider: string | null
  metricsAsOf: string | null
  overview: Record<string, unknown> | null
}

type AddKeywordPayload = {
  phrase: string
  searchVolume?: number | null
  difficulty?: number | null
  cpc?: number | null
  competition?: number | null
  skipLookup?: boolean
  overview?: Record<string, unknown> | null
  provider?: string | null
  metricsAsOf?: string | null
  active?: boolean
}

type FilterState = {
  showInactive: boolean
  showZeroMetrics: boolean
  showHighDifficulty: boolean
}

const FILTER_STORAGE_KEY = 'seo-agent.keywords.filters'
const PAGE_SIZE = 100
const SEARCH_PAGE_SIZE = 1000

export function Page(): JSX.Element {
  const { id: projectId } = useActiveWebsite()
  const { enabled: mockEnabled } = useMockData()
  const queryClient = useQueryClient()
  const [deleteTarget, setDeleteTarget] = useState<KeywordRow | null>(null)
  const [activePendingId, setActivePendingId] = useState<string | null>(null)
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [keywordDraft, setKeywordDraft] = useState('')
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<FilterState>({ showInactive: true, showZeroMetrics: false, showHighDifficulty: true })
  const [preview, setPreview] = useState<KeywordPreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const debouncedSearch = useDebouncedValue(searchInput, 500)
  const filtersLoadedRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(FILTER_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<FilterState>
        setFilters((prev) => ({
          showInactive: typeof parsed.showInactive === 'boolean' ? parsed.showInactive : prev.showInactive,
          showZeroMetrics: typeof parsed.showZeroMetrics === 'boolean' ? parsed.showZeroMetrics : prev.showZeroMetrics,
          showHighDifficulty: typeof parsed.showHighDifficulty === 'boolean' ? parsed.showHighDifficulty : prev.showHighDifficulty
        }))
      }
    } catch (error) {
      log.warn('[keywords.filters] unable to restore filters', { error })
    } finally {
      filtersLoadedRef.current = true
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !filtersLoadedRef.current) return
    try {
      window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters))
    } catch (error) {
      log.warn('[keywords.filters] unable to persist filters', { error })
    }
  }, [filters])

  const projectQuery = useQuery({
    queryKey: ['keywords.project', projectId],
    queryFn: () => getWebsite(projectId!),
    enabled: Boolean(projectId && !mockEnabled),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY
  })

  const keywordsQuery = useQuery<KeywordsResponse>({
    queryKey: ['keywords.list', projectId, page, debouncedSearch],
    queryFn: async () => {
      const effectiveLimit = debouncedSearch ? SEARCH_PAGE_SIZE : PAGE_SIZE
      const params = new URLSearchParams({
        limit: String(effectiveLimit),
        page: String(page)
      })
      if (debouncedSearch) params.set('search', debouncedSearch)
      const response = await fetch(`/api/websites/${projectId}/keywords?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to load keywords')
      }
      return await response.json()
    },
    enabled: Boolean(projectId && !mockEnabled),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false
  })

  const keywordsData = useMemo(() => {
    if (mockEnabled) {
      const items = MOCK_KEYWORDS
      const activeMock = items.reduce((count, keyword) => (keyword.active ? count + 1 : count), 0)
      return { items, total: items.length, active: activeMock, page: 1, pageCount: 1 }
    }
    const data = keywordsQuery.data
    const items = data?.items ?? []
    const total = data?.total ?? items.length
    const active = data?.active ?? items.reduce((count, keyword) => (keyword.active ? count + 1 : count), 0)
    const pageFromApi = data?.page ?? page
    const pageCount = data?.pageCount ?? Math.max(1, Math.ceil(Math.max(total, 0) / (debouncedSearch ? SEARCH_PAGE_SIZE : PAGE_SIZE)))
    return { items, total, active, page: pageFromApi, pageCount }
  }, [keywordsQuery.data, mockEnabled, page, debouncedSearch])

  // no deferral: keep toggle snappy with optimistic updates
  const keywords: KeywordRow[] = keywordsData.items
  const locale = (projectQuery.data as any)?.defaultLocale ?? 'en-US'
  const normalizedDraft = normalizeKeyword(keywordDraft)
  const normalizedSearch = debouncedSearch.trim().toLowerCase()

  useEffect(() => {
    if (!keywordDraft) {
      setPreview(null)
      setPreviewError(null)
    }
  }, [keywordDraft])

  useEffect(() => {
    if (!projectId) return
    setPage(1)
  }, [projectId])

  useEffect(() => {
    if (keywordsData.pageCount && page > keywordsData.pageCount) {
      setPage(Math.max(1, keywordsData.pageCount))
    }
  }, [keywordsData.pageCount, page])

  useEffect(() => {
    if (!mockEnabled && keywordsQuery.data?.page && keywordsQuery.data.page !== page) {
      setPage(keywordsQuery.data.page)
    }
  }, [keywordsQuery.data?.page, mockEnabled, page])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  const checkKeywordMutation = useMutation({
    mutationFn: async (phrase: string): Promise<KeywordPreview> => {
      if (!projectId) throw new Error('Select a website to add keywords')
      if (mockEnabled) throw new Error('Mock data is read-only')
      const response = await fetch(`/api/websites/${projectId}/keywords`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phrase, locale, preview: true })
      })
      if (!response.ok) {
        throw new Error('FAILED')
      }
      const data = await response.json()
      return data?.preview as KeywordPreview
    },
    onMutate: () => {
      setPreview(null)
      setPreviewError(null)
    },
    onSuccess: (data) => {
      if (normalizeKeyword(data?.phrase || '') === normalizeKeyword(keywordDraft)) {
        setPreview(data)
      } else {
        setPreview(null)
      }
    },
    onError: () => {
      setPreview(null)
      setPreviewError('Error fetching keyword metrics')
    }
  })

  const refetchKeywords = keywordsQuery.refetch

  const normalizedKeywords = useMemo(() => {
    const set = new Set<string>()
    for (const kw of keywords) {
      set.add(normalizeKeyword(kw.phrase))
    }
    return set
  }, [keywords])

  const draftAlreadyExists = Boolean(normalizedDraft && normalizedKeywords.has(normalizedDraft))

  const counts = useMemo(() => {
    return {
      total: keywordsData.total,
      active: keywordsData.active
    }
  }, [keywordsData.total, keywordsData.active])

  const effectivePageSize = debouncedSearch ? SEARCH_PAGE_SIZE : PAGE_SIZE

  const filteredKeywords = useMemo(() => {
    const applySearchFilter = mockEnabled || !debouncedSearch
    return keywords.filter((keyword) => {
      if (applySearchFilter && normalizedSearch && !keyword.phrase.toLowerCase().includes(normalizedSearch)) return false
      const metrics = keyword.metricsJson || {}
      const volume = safeNumber(metrics.searchVolume)
      const difficulty = safeNumber(metrics.difficulty)
      if (!filters.showZeroMetrics) {
        if (volume == null || volume <= 0) return false
        if (difficulty == null || difficulty <= 0) return false
      }
      if (!filters.showHighDifficulty && difficulty != null && difficulty >= 70) return false
      if (!filters.showInactive && !keyword.active) return false
      return true
    })
  }, [keywords, normalizedSearch, filters, mockEnabled, debouncedSearch])

  const initialSorting = useMemo(() => [{ id: 'searchVolume', desc: true }], [])

  const addKeywordMutation = useMutation({
    mutationFn: async (payload: AddKeywordPayload) => {
      if (!projectId) throw new Error('Select a website to add keywords')
      if (mockEnabled) throw new Error('Mock data is read-only')
      logDebug('add_keyword.submit', { projectId, payload: redactPayload(payload) })
      const response = await fetch(`/api/websites/${projectId}/keywords`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...payload, locale, skipLookup: Boolean(payload.skipLookup) })
      })
      if (!response.ok) {
        logDebug('add_keyword.error_response', { status: response.status })
        const errorText = await response.text()
        throw new Error(errorText || 'Failed to add keyword')
      }
      const result = await response.json()
      logDebug('add_keyword.success_response', { item: result?.item ?? null })
      return result
    },
    onSuccess: () => {
      toast.success('Keyword added')
      setKeywordDraft('')
      setPreview(null)
      setPreviewError(null)
      setPage(1)
      queryClient.invalidateQueries({ queryKey: ['keywords.list', projectId], exact: false })
      refetchKeywords()
    },
    onError: (error) => {
      logDebug('add_keyword.mutate_error', { message: extractErrorMessage(error) })
      toast.error(extractErrorMessage(error))
    }
  })

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error('Select a website to regenerate keywords')
      if (mockEnabled) throw new Error('Mock data is read-only')
      const response = await fetch(`/api/websites/${projectId}/keywords/regenerate`, { method: 'POST' })
      let body: any = null
      try {
        body = await response.json()
      } catch {}
      if (response.status === 429 || response.status === 202) {
        return { status: response.status, body }
      }
      if (!response.ok) {
        const message = typeof body?.message === 'string' ? body.message : typeof body?.error === 'string' ? body.error : null
        throw new Error(message || 'Failed to queue keyword regeneration')
      }
      return { status: response.status, body }
    },
    onSuccess: (result) => {
      if (!result) return
      if (result.status === 202) {
        toast.success('Keyword regeneration queued')
      } else if (result.status === 429) {
        const seconds = Number(result.body?.secondsRemaining ?? 0)
        const cooldown = formatCooldown(seconds)
        const description = cooldown ? `Try again ${cooldown}.` : 'Try again later.'
        toast('Regeneration already queued', { description })
      } else {
        toast.success('Keyword regeneration requested')
      }
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error))
    }
  })

  const regenerateDisabled = !projectId || mockEnabled || regenerateMutation.isPending

  const previewMatchesDraft = Boolean(preview && normalizeKeyword(preview.phrase) === normalizedDraft)

  const handleCheckKeyword = useCallback(() => {
    const phrase = keywordDraft.trim()
    if (!phrase) {
      toast.error('Keyword is required')
      return
    }
    if (draftAlreadyExists) {
      toast.error('Keyword already exists')
      return
    }
    if (checkKeywordMutation.isPending || mockEnabled) return
    checkKeywordMutation.mutate(phrase)
  }, [keywordDraft, checkKeywordMutation, mockEnabled, draftAlreadyExists])

  const handleAddKeyword = useCallback(() => {
    const phrase = keywordDraft.trim()
    if (!phrase) {
      toast.error('Keyword is required')
      return
    }
    if (!previewMatchesDraft) {
      toast.error('Check keyword metrics before adding')
      return
    }
    if (draftAlreadyExists) {
      toast.error('Keyword already exists')
      return
    }
    const payload: AddKeywordPayload = {
      phrase,
      searchVolume: preview?.searchVolume ?? null,
      difficulty: preview?.difficulty ?? null,
      cpc: preview?.cpc ?? null,
      competition: preview?.competition ?? null,
      skipLookup: true,
      overview: preview?.overview ?? null,
      provider: preview?.provider ?? null,
      metricsAsOf: preview?.metricsAsOf ?? null,
      active: preview?.difficulty == null ? undefined : preview.difficulty < 70
    }
    addKeywordMutation.mutate(payload)
  }, [keywordDraft, previewMatchesDraft, preview, addKeywordMutation])

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ keywordId, active }: { keywordId: string; active: boolean }) => {
      if (mockEnabled) return null
      return await fetch(`/api/keywords/${keywordId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ active }) })
    },
    onMutate: async ({ keywordId, active }) => {
      setActivePendingId(keywordId)
      await queryClient.cancelQueries({ queryKey: ['keywords.list', projectId] })
      const snapshots = queryClient.getQueriesData<KeywordsResponse>({ queryKey: ['keywords.list', projectId] })
      for (const [key, prev] of snapshots) {
        if (!prev) continue
        const next: KeywordsResponse = {
          ...prev,
          items: prev.items.map((k) => (k.id === keywordId ? { ...k, active } : k)),
          active:
            prev.items.some((k) => k.id === keywordId && Boolean(k.active) !== active)
              ? prev.active + (active ? 1 : -1)
              : prev.active
        }
        // setQueryData for the exact key snapshot
        queryClient.setQueryData(key as any, next, { updatedAt: Date.now() })
      }
      return { snapshots }
    },
    onError: (_err, _vars, ctx) => {
      const entries = ctx?.snapshots || []
      for (const [key, data] of entries) {
        queryClient.setQueryData(key as any, data, { updatedAt: Date.now() })
      }
      toast.error('Failed to update keyword')
    },
    onSettled: async () => {
      queryClient.invalidateQueries({ queryKey: ['keywords.list', projectId], exact: false })
      setActivePendingId(null)
    }
  })

  const handleToggleActive = useCallback(
    (keywordId: string, active: boolean) => {
      if (mockEnabled) return
      toggleActiveMutation.mutate({ keywordId, active })
    },
    [mockEnabled, toggleActiveMutation]
  )

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
        id: 'active',
        accessorFn: (kw) => (kw.active ? 1 : 0),
        header: ({ column }) => <SortHeader column={column} label="Active" />,
        cell: ({ row }) => {
          const keyword = row.original
          const isActive = Boolean(keyword.active)
          const pending = activePendingId === keyword.id
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className={cn('h-8 w-8', isActive ? 'text-rose-500 hover:text-rose-600' : 'text-muted-foreground hover:text-foreground')}
                  aria-label={isActive ? 'Deactivate keyword' : 'Activate keyword'}
                  onClick={() => handleToggleActive(keyword.id, !isActive)}
                  disabled={mockEnabled || pending}
                >
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : isActive ? <XIcon className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isActive ? 'Remove from active plan' : 'Include in active plan'}</TooltipContent>
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
  }, [handleToggleActive, activePendingId, mockEnabled])

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
  const checkDisabled = checkKeywordMutation.isPending || !normalizedDraft || !projectId || mockEnabled || draftAlreadyExists
  const addDisabled = addKeywordMutation.isPending || checkKeywordMutation.isPending || !previewMatchesDraft || mockEnabled || draftAlreadyExists

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
          <Button
            type="button"
            variant="outline"
            onClick={() => regenerateMutation.mutate()}
            disabled={regenerateDisabled}
          >
            {regenerateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Regenerate keywords
          </Button>
        </div>
      </div>

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3">
          <Label htmlFor="manual-keyword" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add keyword</Label>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
            <Input
              id="manual-keyword"
              value={keywordDraft}
              onChange={(event) => {
                setKeywordDraft(event.target.value)
                setPreview(null)
                setPreviewError(null)
                checkKeywordMutation.reset()
              }}
              placeholder="Type a keyword..."
              disabled={mockEnabled}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  handleCheckKeyword()
                }
              }}
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCheckKeyword}
                disabled={checkDisabled}
              >
                {checkKeywordMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Check metrics
              </Button>
              <Button
                type="button"
                onClick={handleAddKeyword}
                disabled={addDisabled}
              >
                {addKeywordMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Add keyword
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setKeywordDraft('')
                  setPreview(null)
                  setPreviewError(null)
                  checkKeywordMutation.reset()
                }}
                disabled={!keywordDraft && !preview && !previewError}
              >
                Clear
              </Button>
            </div>
          </div>
          {draftAlreadyExists ? (
            <p className="text-sm text-muted-foreground">Keyword already exists in your backlog.</p>
          ) : null}
          {checkKeywordMutation.isPending && !preview ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking keyword metrics…
            </div>
          ) : null}
          {previewError ? <p className="text-sm text-destructive">{previewError}</p> : null}
          {previewMatchesDraft ? (
            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">{preview?.phrase}</CardTitle>
                <CardDescription>Live keyword metrics</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-4">
                <MetricStat label="Search volume" value={preview?.searchVolume ?? null} formatter={formatNumber} />
                <MetricDifficulty score={preview?.difficulty ?? null} asOf={preview?.metricsAsOf ?? null} />
                <MetricStat label="CPC" value={preview?.cpc ?? null} formatter={formatCurrency} />
                <MetricStat label="Competition" value={preview?.competition ?? null} formatter={formatCompetition} />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </section>

      {isLoading ? (
        <KeywordTableSkeleton />
      ) : keywords.length === 0 ? (
        <Empty className="border bg-card/70">
          <EmptyHeader>
            <EmptyTitle>No keywords yet</EmptyTitle>
            <EmptyDescription>
              {mockEnabled ? 'Toggle mock data off to view the live queue.' : 'Check metrics above to add your first keyword.'}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <section className="rounded-lg border bg-card p-0 shadow-sm">
          <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search keywords..."
                aria-label="Search keywords"
              />
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="gap-2">
                      <SlidersHorizontal className="h-4 w-4" />
                      Filters
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-64 space-y-3">
                    <FilterToggle
                      label="Show zero metrics"
                      checked={filters.showZeroMetrics}
                      onChange={(value) => setFilters((prev) => ({ ...prev, showZeroMetrics: value }))}
                    />
                    <FilterToggle
                      label="Show inactive keywords"
                      checked={filters.showInactive}
                      onChange={(value) => setFilters((prev) => ({ ...prev, showInactive: value }))}
                    />
                    <FilterToggle
                      label="Show high-difficulty keywords"
                      checked={filters.showHighDifficulty}
                      onChange={(value) => setFilters((prev) => ({ ...prev, showHighDifficulty: value }))}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <TooltipProvider>
              <div className="max-h-[540px] overflow-y-auto rounded-md border">
                <DataTable columns={columns} data={filteredKeywords} paginate={false} initialSorting={initialSorting} />
              </div>
            </TooltipProvider>
            {!mockEnabled ? (
              <PaginationControls
                page={keywordsData.page}
                pageCount={keywordsData.pageCount}
                onPageChange={setPage}
                pageSize={effectivePageSize}
                total={counts.total}
                currentCount={filteredKeywords.length}
              />
            ) : null}
          </div>
        </section>
      )}

      <KeywordDeleteDialog
        deleteTarget={deleteTarget}
        setDeleteTarget={setDeleteTarget}
        confirmDelete={confirmDelete}
        deletePendingId={deletePendingId}
      />
    </div>
  )
}

function KeywordDeleteDialog({ deleteTarget, setDeleteTarget, confirmDelete, deletePendingId }: {
  deleteTarget: KeywordRow | null
  setDeleteTarget: (value: KeywordRow | null) => void
  confirmDelete: () => void
  deletePendingId: string | null
}): JSX.Element {
  return (
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
  )
}

function PaginationControls({
  page,
  pageCount,
  pageSize,
  total,
  currentCount,
  onPageChange
}: {
  page: number
  pageCount: number
  pageSize: number
  total: number
  currentCount: number
  onPageChange: (next: number) => void
}): JSX.Element {
  if (pageCount <= 1) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-muted-foreground">
        <span>Showing all {total} keywords</span>
      </div>
    )
  }

  const clampedPage = Math.min(Math.max(page, 1), pageCount)
  const windowSize = 5
  const halfWindow = Math.floor(windowSize / 2)
  let start = Math.max(1, clampedPage - halfWindow)
  let end = start + windowSize - 1
  if (end > pageCount) {
    end = pageCount
    start = Math.max(1, end - windowSize + 1)
  }
  const pages: number[] = []
  for (let p = start; p <= end; p++) pages.push(p)

  const goTo = (next: number) => {
    onPageChange(Math.min(Math.max(next, 1), pageCount))
  }

  const startIndex = total === 0 ? 0 : (clampedPage - 1) * pageSize + 1
  const endIndex = total === 0 ? 0 : Math.min(total, startIndex + Math.max(currentCount, 0) - 1)
  let summaryText: string
  if (total === 0) {
    summaryText = 'Showing 0 of 0'
  } else if (currentCount <= 0) {
    summaryText = `Showing 0 results (of ${total})`
  } else {
    summaryText = `Showing ${startIndex}-${Math.max(startIndex, endIndex)} of ${total}`
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs">
      <span className="text-muted-foreground">{summaryText}</span>
      <div className="flex items-center gap-1">
        <Button type="button" variant="outline" size="icon" className="h-7 w-7" disabled={clampedPage === 1} onClick={() => goTo(1)}>
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="icon" className="h-7 w-7" disabled={clampedPage === 1} onClick={() => goTo(clampedPage - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pages.map((p) => (
          <Button
            key={p}
            type="button"
            variant={p === clampedPage ? 'default' : 'outline'}
            size="icon"
            className="h-7 w-7"
            onClick={() => goTo(p)}
          >
            {p}
          </Button>
        ))}
        <Button type="button" variant="outline" size="icon" className="h-7 w-7" disabled={clampedPage === pageCount} onClick={() => goTo(clampedPage + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="icon" className="h-7 w-7" disabled={clampedPage === pageCount} onClick={() => goTo(pageCount)}>
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function logDebug(event: string, data: Record<string, unknown>): void {
  log.debug(`[keywords.${event}]`, data)
}

function redactPayload(payload: AddKeywordPayload): Record<string, unknown> {
  const clone: Record<string, unknown> = { phrase: payload.phrase }
  if (payload.searchVolume != null) clone.searchVolume = payload.searchVolume
  if (payload.difficulty != null) clone.difficulty = payload.difficulty
  if (payload.cpc != null) clone.cpc = payload.cpc
  if (payload.competition != null) clone.competition = payload.competition
  clone.skipLookup = Boolean(payload.skipLookup)
  clone.active = payload.active ?? null
  clone.hasOverview = Boolean(payload.overview)
  clone.provider = payload.provider ?? null
  clone.metricsAsOf = payload.metricsAsOf ?? null
  return clone
}

function MetricStat({ label, value, formatter }: { label: string; value: number | null; formatter: (val: number | null) => string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-foreground">{value == null ? '—' : formatter(value)}</p>
    </div>
  )
}

function MetricDifficulty({ score, asOf }: { score: number | null; asOf: string | null }) {
  if (score == null) {
    return <MetricStat label="Difficulty" value={null} formatter={() => '—'} />
  }
  const tier = difficultyTier(score)
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Difficulty</p>
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-semibold text-foreground">{score}</span>
        <Badge className={cn('px-2 py-0.5 text-xs font-semibold', tier.className)}>{tier.label}</Badge>
      </div>
      {asOf ? <p className="text-xs text-muted-foreground">As of {formatAsOf(asOf)}</p> : null}
    </div>
  )
}

function FilterToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
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

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timeout)
  }, [value, delay])

  return debouncedValue
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

function formatCompetition(value: number | null): string {
  if (value == null) return '—'
  return `${Math.round(value * 100)}%`
}

function formatAsOf(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatCooldown(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return ''
  if (seconds >= 3600) {
    const hours = Math.ceil(seconds / 3600)
    return `in about ${hours} hour${hours === 1 ? '' : 's'}`
  }
  if (seconds >= 60) {
    const minutes = Math.ceil(seconds / 60)
    return `in about ${minutes} minute${minutes === 1 ? '' : 's'}`
  }
  const secs = Math.max(1, Math.ceil(seconds))
  return `in about ${secs} second${secs === 1 ? '' : 's'}`
}

function normalizeKeyword(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}
