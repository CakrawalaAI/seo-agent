import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useActiveProject } from '@common/state/active-project'
import { useMockData } from '@common/dev/mock-data-context'
import { getPlanItems, getProjectArticles } from '@entities/project/service'
import type { Article, PlanItem } from '@entities'
import { Button } from '@src/common/ui/button'
import { Badge } from '@src/common/ui/badge'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@src/common/ui/table'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@src/common/ui/empty'

type TimelineItem = {
  id: string
  title: string
  date: string
  status: NonNullable<Article['status'] | PlanItem['status']>
  url?: string | null
}

const MOCK_ARTICLES: Article[] = [
  {
    id: 'art-m-1',
    projectId: 'proj_mock',
    title: 'How To Ace Behavioral Interviews',
    plannedDate: new Date(Date.now() - 86_400_000 * 2).toISOString(),
    publishDate: new Date(Date.now() - 86_400_000).toISOString(),
    status: 'published',
    url: 'https://prepinterview.ai/blog/behavioral-interview'
  },
  {
    id: 'art-m-2',
    projectId: 'proj_mock',
    title: 'STAR Method Templates For Product Leaders',
    plannedDate: new Date().toISOString(),
    status: 'scheduled'
  }
]

const MOCK_PLAN: PlanItem[] = [
  {
    id: 'art-m-3',
    projectId: 'proj_mock',
    title: 'Interview Debrief Checklist',
    plannedDate: new Date(Date.now() + 86_400_000 * 3).toISOString(),
    status: 'queued'
  }
]

export function Page(): JSX.Element {
  const { id: projectId } = useActiveProject()
  const { enabled: mockEnabled } = useMockData()

  const articlesQuery = useQuery({
    queryKey: ['articles.list', projectId],
    queryFn: async () => (await getProjectArticles(projectId!, 200)).items,
    enabled: Boolean(projectId && !mockEnabled),
    refetchInterval: 60_000
  })

  const planQuery = useQuery({
    queryKey: ['articles.plan', projectId],
    queryFn: async () => (await getPlanItems(projectId!, 200)).items,
    enabled: Boolean(projectId && !mockEnabled),
    refetchInterval: 120_000
  })

  const articles = mockEnabled ? MOCK_ARTICLES : articlesQuery.data ?? []
  const plan = mockEnabled ? MOCK_PLAN : planQuery.data ?? []

  const timeline = useMemo(() => buildTimeline(articles, plan), [articles, plan])

  if (!projectId) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Articles</h1>
          <p className="text-sm text-muted-foreground">See drafts, scheduled posts, and published content.</p>
        </header>
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No project selected</EmptyTitle>
            <EmptyDescription>Choose a project from the sidebar to load its article queue.</EmptyDescription>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[45%]">Title</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Link</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {timeline.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-foreground">{item.title}</TableCell>
                  <TableCell>{formatDate(item.date)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(item.status)} className="uppercase">
                      {statusLabel(item.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {item.url ? (
                      <a
                        href={item.url}
                        className="text-xs font-medium text-primary underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        View
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableCaption>{timeline.length} item{timeline.length === 1 ? '' : 's'} in the timeline</TableCaption>
          </Table>
        </section>
      )}
    </div>
  )
}

function buildTimeline(articles: Article[], plan: PlanItem[]): TimelineItem[] {
  const byId = new Map<string, Article>()
  for (const article of articles) byId.set(article.id, article)

  const combined: TimelineItem[] = []

  for (const article of articles) {
    const date = article.publishDate ?? article.plannedDate ?? article.createdAt ?? new Date().toISOString()
    combined.push({
      id: `article-${article.id}`,
      title: article.title ?? 'Untitled article',
      date,
      status: (article.status ?? 'queued') as NonNullable<Article['status']>,
      url: article.url
    })
  }

  for (const item of plan) {
    if (byId.has(item.id)) continue
    combined.push({
      id: `plan-${item.id}`,
      title: item.title ?? 'Untitled plan item',
      date: item.plannedDate ?? new Date().toISOString(),
      status: (item.status ?? 'queued') as NonNullable<PlanItem['status']>
    })
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
  return 'outline'
}

function statusLabel(status: string) {
  if (status === 'published') return 'Published'
  if (status === 'scheduled') return 'Scheduled'
  if (status === 'queued') return 'Queued'
  return status.replace(/_/g, ' ')
}
