import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useActiveProject } from '@common/state/active-project'
import { useMockData } from '@common/dev/mock-data-context'
import { getProject } from '@entities/project/service'
import { generateKeywords, getProjectKeywords } from '@entities/project/service'
import type { Keyword, Project } from '@entities'
import { Button } from '@src/common/ui/button'
import { Input } from '@src/common/ui/input'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@src/common/ui/table'
import { Badge } from '@src/common/ui/badge'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@src/common/ui/empty'

const MOCK_KEYWORDS: Keyword[] = [
  {
    id: 'kw-m-1',
    projectId: 'proj_mock',
    canonId: 'kw-m-1',
    phrase: 'interview questions for product managers',
    metricsJson: { searchVolume: 4400, difficulty: 36, asOf: new Date().toISOString() },
    status: 'ready'
  },
  {
    id: 'kw-m-2',
    projectId: 'proj_mock',
    canonId: 'kw-m-2',
    phrase: 'behavioral interview examples',
    metricsJson: { searchVolume: 6600, difficulty: 41, asOf: new Date().toISOString() },
    status: 'in_review'
  },
  {
    id: 'kw-m-3',
    projectId: 'proj_mock',
    canonId: 'kw-m-3',
    phrase: 'mock interview ai coach',
    metricsJson: { searchVolume: 1900, difficulty: 28, asOf: new Date().toISOString() },
    status: 'starred'
  }
]

export function Page(): JSX.Element {
  const { id: projectId } = useActiveProject()
  const { enabled: mockEnabled } = useMockData()
  const [query, setQuery] = useState('')

  const projectQuery = useQuery({
    queryKey: ['keywords.project', projectId],
    queryFn: () => getProject(projectId!),
    enabled: Boolean(projectId && !mockEnabled)
  })

  const keywordsQuery = useQuery({
    queryKey: ['keywords.list', projectId],
    queryFn: async () => (await getProjectKeywords(projectId!, 200)).items,
    enabled: Boolean(projectId && !mockEnabled),
    refetchInterval: 45_000
  })

  const keywords = mockEnabled ? MOCK_KEYWORDS : keywordsQuery.data ?? []

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return keywords
    return keywords.filter((item) => item.phrase.toLowerCase().includes(term))
  }, [keywords, query])

  const locale = (projectQuery.data as Project | undefined)?.defaultLocale ?? 'en-US'

  const generateMutation = useMutation({
    mutationFn: () => generateKeywords(projectId!, locale),
    onSuccess: () => keywordsQuery.refetch()
  })

  const actionLabel = keywords.length === 0 ? 'Generate keywords' : 'Refresh metrics'
  const isPending = generateMutation.isPending || keywordsQuery.isRefetching

  if (!projectId) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Keywords</h1>
          <p className="text-sm text-muted-foreground">Discover patterns that align with the selected project.</p>
        </header>
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No project selected</EmptyTitle>
            <EmptyDescription>Pick a project from the sidebar to view its keyword backlog.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  const handlePrimary = () => {
    if (mockEnabled) return
    if (keywords.length === 0) {
      generateMutation.mutate()
    } else {
      keywordsQuery.refetch()
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Keywords</h1>
        <p className="text-sm text-muted-foreground">Triage and prioritize opportunities for {mockEnabled ? 'Prep Interview' : projectQuery.data?.name ?? 'your project'}.</p>
      </header>

      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search keywords…"
          className="md:max-w-xs"
        />
        <Button
          type="button"
          onClick={handlePrimary}
          disabled={mockEnabled || isPending || !projectId}
        >
          {isPending ? 'Working…' : actionLabel}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Empty className="border bg-card/70">
          <EmptyHeader>
            <EmptyTitle>No keywords yet</EmptyTitle>
            <EmptyDescription>
              {mockEnabled
                ? 'Toggle mock data off to view the live queue.'
                : keywordsQuery.isFetching
                ? 'Fetching latest keyword metrics…'
                : 'Generate a discovery batch to start prioritizing opportunities.'}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <section className="rounded-lg border bg-card p-0 shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Keyword</TableHead>
                <TableHead>Volume</TableHead>
                <TableHead>Difficulty</TableHead>
                <TableHead>Last updated</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((keyword) => (
                <TableRow key={keyword.id}>
                  <TableCell className="font-medium text-foreground">{keyword.phrase}</TableCell>
                  <TableCell>{formatNumber(keyword.metricsJson?.searchVolume)}</TableCell>
                  <TableCell>{formatNumber(keyword.metricsJson?.difficulty)}</TableCell>
                  <TableCell>{formatDate(keyword.metricsJson?.asOf)}</TableCell>
                  <TableCell>
                    <Badge variant={resolveVariant(keyword.status)} className="uppercase">
                      {statusLabel(keyword.status)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableCaption>{filtered.length} keyword{filtered.length === 1 ? '' : 's'} in view</TableCaption>
          </Table>
        </section>
      )}
    </div>
  )
}

function formatNumber(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('en-US').format(value)
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function statusLabel(status?: string | null) {
  if (!status) return 'New'
  if (status === 'starred') return 'Pinned'
  if (status === 'ready') return 'Ready'
  if (status === 'in_plan' || status === 'scheduled') return 'Scheduled'
  return status.replace(/_/g, ' ')
}

function resolveVariant(status?: string | null) {
  if (status === 'starred') return 'outline'
  if (status === 'ready') return 'default'
  if (status === 'scheduled' || status === 'in_plan') return 'secondary'
  return 'secondary'
}
