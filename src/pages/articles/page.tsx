import { useCallback, useMemo } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useActiveWebsite } from '@common/state/active-website'
import { getPlanItems, getWebsiteArticles, getWebsiteSnapshot, publishArticle as publishArticleApi } from '@entities/website/service'
import type { Article } from '@entities'
import type { PlanItem } from '@entities/article/planner'
import { Button } from '@src/common/ui/button'
import { Badge } from '@src/common/ui/badge'
import { DataTable, type ColumnDef } from '@src/common/ui/data-table'
import type { Row } from '@tanstack/react-table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@src/common/ui/dropdown-menu'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@src/common/ui/empty'
import { useArticleActions } from '@features/articles/shared/use-article-actions'
import { useArticleNavigation } from '@features/articles/shared/use-article-navigation'
import { log } from '@src/common/logger'
import { ArrowUpDown, Ban, Eye, ExternalLink, Loader2, MoreHorizontal, Trash2 } from 'lucide-react'

type TimelineItem = {
  id: string
  entityId: string
  source: 'article' | 'plan'
  title: string
  date: string
  status: NonNullable<Article['status'] | PlanItem['status']>
  url?: string | null
  scheduledDate?: string | null
  publishDate?: string | null
}

// Removed UI mocks; always fetch from API

export function Page(): JSX.Element {
  const { id: projectId } = useActiveWebsite()
  const {
    deleteArticle: deleteArticleAction,
    unpublishArticle: unpublishArticleAction,
    deletingId,
    statusMutatingId
  } = useArticleActions()
  const { viewArticle } = useArticleNavigation()

  const snapshotQuery = useQuery({
    queryKey: ['integrations.snapshot', projectId],
    queryFn: () => getWebsiteSnapshot(projectId!, { cache: 'no-store' }),
    enabled: Boolean(projectId),
    refetchInterval: 60_000
  })

  const activeWebhookId = useMemo(() => {
    const list = (snapshotQuery.data?.integrations ?? []) as Array<any>
    const w = list.find((i) => i.status === 'connected' && i.type === 'webhook')
    return w?.id ? String(w.id) : null
  }, [snapshotQuery.data])

  const publishMutation = useMutation({
    mutationFn: async (args: { articleId: string }) => {
      const integrations = (snapshotQuery.data?.integrations ?? []) as Array<any>
      const active = integrations.filter((i) => i.status === 'connected') as Array<any>
      for (const integ of active) {
        try {
          await publishArticleApi(args.articleId, String(integ.id))
        } catch {}
      }
    }
  })

  const articlesQuery = useQuery({
    queryKey: ['articles.list', projectId],
    queryFn: async () => (await getWebsiteArticles(projectId!, 200)).items,
    enabled: Boolean(projectId),
    refetchInterval: 60_000
  })

  const planQuery = useQuery({
    queryKey: ['articles.plan', projectId],
    queryFn: async () => (await getPlanItems(projectId!, 200)).items,
    enabled: Boolean(projectId),
    refetchInterval: 120_000
  })
  const articles = articlesQuery.data ?? []
  const plan = planQuery.data ?? []

  const timeline = useMemo(() => buildTimeline(articles, plan), [articles, plan])
  const columns = useMemo<ColumnDef<TimelineItem>[]>(() => {
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
        accessorKey: 'title',
        header: ({ column }) => <SortHeader column={column} label="Title" />,
        cell: ({ row }) => (
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-left text-sm font-semibold"
            onClick={(event) => {
              event.stopPropagation()
              log.info('[articles.page] title_click', {
                articleId: row.original.entityId,
                source: row.original.source,
                scheduledDate: row.original.scheduledDate ?? null,
                publishDate: row.original.publishDate ?? null
              })
              viewArticle(row.original.entityId)
            }}
          >
            <span className="line-clamp-2 text-left">{row.original.title}</span>
          </Button>
        ),
        sortingFn: 'alphanumeric'
      },
      {
        accessorKey: 'date',
        header: ({ column }) => <SortHeader column={column} label="Date" />,
        cell: ({ row }) => <span className="text-sm text-foreground/80">{formatDate(row.original.date)}</span>,
        sortingFn: (rowA: any, rowB: any) => {
          const a = new Date(rowA.original.date).getTime()
          const b = new Date(rowB.original.date).getTime()
          return a === b ? 0 : a > b ? 1 : -1
        }
      },
      {
        accessorKey: 'status',
        header: ({ column }) => <SortHeader column={column} label="Status" />,
        cell: ({ row }) => (
          <Badge variant={statusVariant(row.original.status)} className="uppercase">
            {statusLabel(row.original.status)}
          </Badge>
        ),
        sortingFn: 'alphanumeric'
      },
      {
        id: 'link',
        header: () => <span className="sr-only">Link</span>,
        cell: ({ row }) => {
          if (!row.original.url) {
            return <span className="text-xs text-muted-foreground">—</span>
          }
          return (
            <a
              href={row.original.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              <ExternalLink className="h-3 w-3" />
              View
            </a>
          )
        },
        enableSorting: false
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const isDeleting = deletingId === row.original.entityId
          const isStatusPending = statusMutatingId === row.original.entityId
          const canMutate = !mockEnabled && !isDeleting && !isStatusPending
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                <DropdownMenuItem
                  onClick={(event) => {
                    event.stopPropagation()
                    log.info('[articles.page] menu_open_click', {
                      articleId: row.original.entityId,
                      source: row.original.source
                    })
                    viewArticle(row.original.entityId)
                  }}
                >
                  <Eye className="h-4 w-4" />
                  Open
                </DropdownMenuItem>
                {row.original.status !== 'published' ? (
                  <DropdownMenuItem
                    onClick={async (event) => {
                      event.stopPropagation()
                      if (mockEnabled) return
                      publishMutation.mutate({ articleId: row.original.entityId })
                    }}
                  >
                    {publishMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpDown className="h-4 w-4" />}
                    Publish now
                  </DropdownMenuItem>
                ) : null}
                {row.original.status !== 'published' && activeWebhookId ? (
                  <DropdownMenuItem
                    onClick={async (event) => {
                      event.stopPropagation()
                      if (mockEnabled) return
                      try { await publishArticleApi(row.original.entityId, activeWebhookId) } catch {}
                    }}
                  >
                    <ArrowUpDown className="h-4 w-4" />
                    Publish via Webhook
                  </DropdownMenuItem>
                ) : null}
                {row.original.status === 'published' ? (
                  <DropdownMenuItem
                    onClick={async (event) => {
                      event.stopPropagation()
                      if (isStatusPending || mockEnabled) return
                      log.info('[articles.page] menu_unpublish_click', {
                        articleId: row.original.entityId
                      })
                      await unpublishArticleAction(row.original.entityId)
                    }}
                    disabled={!canMutate}
                  >
                    {isStatusPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                    Unpublish
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    disabled={isDeleting || mockEnabled}
                    onClick={async (event) => {
                      event.stopPropagation()
                      if (isDeleting || mockEnabled) return
                      const confirmed = window.confirm('Delete this article and remove it from the schedule?')
                      if (!confirmed) return
                      log.info('[articles.page] menu_delete_confirmed', {
                        articleId: row.original.entityId
                      })
                      await deleteArticleAction(row.original.entityId)
                    }}
                  >
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }
      }
    ]
  }, [deleteArticleAction, deletingId, mockEnabled, statusMutatingId, unpublishArticleAction, viewArticle])
  const handleRowClick = useCallback(
    (row: Row<TimelineItem>) => {
      log.info('[articles.page] row_click', {
        articleId: row.original.entityId,
        source: row.original.source,
        scheduledDate: row.original.scheduledDate ?? null,
        publishDate: row.original.publishDate ?? null
      })
      viewArticle(row.original.entityId)
    },
    [viewArticle]
  )

  if (!projectId) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Articles</h1>
          <p className="text-sm text-muted-foreground">See drafts, scheduled posts, and published content.</p>
        </header>
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No website selected</EmptyTitle>
            <EmptyDescription>Choose a website from the sidebar to load its article queue.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Articles</h1>
          <p className="text-sm text-muted-foreground">Chronological list of scheduled and published content.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (mockEnabled) return
            articlesQuery.refetch()
            planQuery.refetch()
          }}
          disabled={mockEnabled || articlesQuery.isRefetching || planQuery.isRefetching}
        >
          {articlesQuery.isRefetching || planQuery.isRefetching ? 'Refreshing…' : mockEnabled ? 'Mock data' : 'Refresh data'}
        </Button>
      </header>

      {timeline.length === 0 ? (
        <Empty className="border bg-card/70">
          <EmptyHeader>
            <EmptyTitle>No articles yet</EmptyTitle>
            <EmptyDescription>
              {mockEnabled
                ? 'Disable mock data to view the live feed.'
                : articlesQuery.isFetching
                ? 'Loading your articles and plan…'
                : 'Generate plan items to populate the publishing queue.'}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <section className="rounded-lg border bg-card p-0 shadow-sm">
          <DataTable
            columns={columns}
            data={timeline}
            paginate={false}
            initialSorting={[{ id: 'date', desc: false }]}
            onRowClick={handleRowClick}
          />
          <div className="border-t px-4 py-2 text-xs text-muted-foreground">
            {timeline.length} item{timeline.length === 1 ? '' : 's'} in the timeline
          </div>
        </section>
      )}
    </div>
  )
}

function buildTimeline(articles: Article[], plan: PlanItem[]): TimelineItem[] {
  const seen = new Set<string>()
  const combined: TimelineItem[] = []

  for (const article of articles) {
    const scheduled = (article as any).scheduledDate ?? null
    const publishDate = article.publishDate ?? null
    const effectiveDate = publishDate ?? scheduled ?? article.createdAt ?? new Date().toISOString()
    combined.push({
      id: article.id,
      entityId: article.id,
      source: 'article',
      title: article.title ?? 'Untitled article',
      date: effectiveDate,
      status: (article.status ?? 'queued') as NonNullable<Article['status']>,
      url: article.url ?? null,
      scheduledDate: scheduled,
      publishDate
    })
    seen.add(article.id)
  }

  for (const item of plan) {
    if (seen.has(item.id)) continue
    const scheduled = (item as any).scheduledDate ?? new Date().toISOString()
    combined.push({
      id: item.id,
      entityId: item.id,
      source: 'plan',
      title: item.title ?? 'Untitled plan item',
      date: scheduled,
      status: (item.status ?? 'queued') as NonNullable<PlanItem['status']>,
      url: null,
      scheduledDate: scheduled,
      publishDate: null
    })
    seen.add(item.id)
  }

  return combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

function formatDate(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function statusVariant(status: string) {
  if (status === 'published') return 'default'
  if (status === 'scheduled') return 'secondary'
  if (status === 'unpublished') return 'destructive'
  return 'outline'
}

function statusLabel(status: string) {
  if (status === 'published') return 'Published'
  if (status === 'scheduled') return 'Scheduled'
  if (status === 'queued') return 'Queued'
  if (status === 'unpublished') return 'Unpublished'
  return status.replace(/_/g, ' ')
}
