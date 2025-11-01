import { useMemo, useState } from 'react'
import { Button } from '@src/common/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@src/common/ui/select'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell
} from '@src/common/ui/table'
import { Link } from '@tanstack/react-router'

import type { PublishState } from '@features/plan/shared/state-machines'
import {
  badgeClassForTone,
  formatDateTime,
  formatIntegrationLabel
} from '@features/projects/shared/helpers'
import type { Article, PlanItem, ProjectIntegration } from '@entities'

type ArticlesTabProps = {
  projectId: string
  articles: Article[]
  planItemMap: Map<string, PlanItem>
  integrations: ProjectIntegration[]
  onPublish: (articleId: string, integrationId: string) => void
  publishState: PublishState
  onRefresh: () => void
  isLoading: boolean
}

export function ArticlesTab({
  projectId,
  articles,
  planItemMap,
  integrations,
  onPublish,
  publishState,
  onRefresh,
  isLoading
}: ArticlesTabProps) {
  const [selections, setSelections] = useState<Record<string, string>>({})
  const [tab, setTab] = useState<'drafts' | 'published'>('drafts')

  const connected = integrations.filter((integration) => integration.status === 'connected')

  const drafts = useMemo(() => articles.filter((a) => a.status !== 'published'), [articles])
  const published = useMemo(() => articles.filter((a) => a.status === 'published'), [articles])
  const visible = tab === 'drafts' ? drafts : published

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 text-xs">
        <Button
          type="button"
          className={`rounded-full px-3 py-1 font-semibold ${tab === 'drafts' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
          onClick={() => setTab('drafts')}
        >
          Drafts ({drafts.length})
        </Button>
        <Button
          type="button"
          className={`rounded-full px-3 py-1 font-semibold ${tab === 'published' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
          onClick={() => setTab('published')}
        >
          Published ({published.length})
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onRefresh}
          disabled={isLoading}
        >
          {isLoading ? 'Refreshing…' : 'Refresh'}
        </Button>
        {connected.length === 0 ? (
          <span className="text-xs text-muted-foreground">
            Connect a webhook or CMS integration to publish drafts.
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading articles…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {tab === 'drafts'
            ? 'No drafts yet. Run the daily schedule to generate a draft for today’s plan item.'
            : 'No published articles yet.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
          <Table className="min-w-full divide-y divide-border text-sm">
            <TableHeader className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <TableRow>
                <TableHead className="px-4 py-2 text-left font-semibold">Title</TableHead>
                <TableHead className="px-4 py-2 text-left font-semibold">Planned date</TableHead>
                <TableHead className="px-4 py-2 text-left font-semibold">Status</TableHead>
                <TableHead className="px-4 py-2 text-left font-semibold">Generated</TableHead>
                <TableHead className="px-4 py-2 text-left font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border">
              {visible.map((article) => {
                const planItem = planItemMap.get(article.id)
                const chosenIntegration = selections[article.id] ?? connected[0]?.id ?? ''
                const status = article.status ?? 'unknown'
                const statusTone: 'emerald' | 'amber' | 'rose' =
                  status === 'published'
                    ? 'emerald'
                    : status === 'draft'
                      ? 'amber'
                      : 'rose'
                const publishSubmitting =
                  publishState.status === 'submitting' && publishState.articleId === article.id
                const publishQueued =
                  publishState.status === 'queued' && publishState.articleId === article.id
                const publishError =
                  publishState.status === 'error' && publishState.articleId === article.id
                    ? publishState.message
                    : null

                return (
                  <TableRow key={article.id} className="odd:bg-muted/30">
                    <TableCell className="px-4 py-3 text-sm font-medium text-foreground">
                      {article.title}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                      {planItem ? planItem.plannedDate : '—'}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${badgeClassForTone(
                          statusTone
                        )}`}
                      >
                        {status.toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDateTime(article.generationDate ?? article.createdAt)}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to="/projects/$projectId/articles/$articleId"
                          params={{ projectId, articleId: article.id }}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          Edit
                        </Link>
                        <Select
                          value={chosenIntegration || undefined}
                          onValueChange={(v) =>
                            setSelections((prev) => ({ ...prev, [article.id]: v }))
                          }
                          disabled={connected.length === 0}
                        >
                          <SelectTrigger className="w-[220px] text-xs">
                            <SelectValue placeholder="Select integration" />
                          </SelectTrigger>
                          <SelectContent>
                            {connected.map((integration) => (
                              <SelectItem key={integration.id} value={integration.id}>
                                {integration.type} · {formatIntegrationLabel(integration)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => {
                            if (!chosenIntegration || publishSubmitting) return
                            onPublish(article.id, chosenIntegration)
                          }}
                          disabled={!chosenIntegration || publishSubmitting || connected.length === 0}
                        >
                          {publishSubmitting ? 'Publishing…' : publishQueued ? 'Queued' : 'Publish'}
                        </Button>
                        {publishQueued && publishState.jobId ? (
                          <span className="text-[10px] text-muted-foreground">
                            Job {publishState.jobId} queued
                          </span>
                        ) : null}
                        {publishError ? (
                          <span className="text-[10px] font-medium text-destructive">{publishError}</span>
                        ) : null}
                      </div>
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
