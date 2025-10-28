import { useState } from 'react'
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

  const connected = integrations.filter((integration) => integration.status === 'connected')

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onRefresh}
          disabled={isLoading}
        >
          {isLoading ? 'Refreshing…' : 'Refresh'}
        </button>
        {connected.length === 0 ? (
          <span className="text-xs text-muted-foreground">
            Connect a webhook or CMS integration to publish drafts.
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading articles…</p>
      ) : articles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No drafts yet. Run the daily schedule to generate a draft for today’s plan item.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Title</th>
                <th className="px-4 py-2 text-left font-semibold">Planned date</th>
                <th className="px-4 py-2 text-left font-semibold">Status</th>
                <th className="px-4 py-2 text-left font-semibold">Generated</th>
                <th className="px-4 py-2 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {articles.map((article) => {
                const planItem = planItemMap.get(article.planItemId ?? '')
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
                  <tr key={article.id} className="odd:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-medium text-foreground">
                      {article.title}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {planItem ? planItem.plannedDate : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${badgeClassForTone(
                          statusTone
                        )}`}
                      >
                        {status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDateTime(article.generationDate ?? article.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to="/projects/$projectId/articles/$articleId"
                          params={{ projectId, articleId: article.id }}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          Edit
                        </Link>
                        <select
                          className="rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                          value={chosenIntegration}
                          onChange={(event) =>
                            setSelections((prev) => ({
                              ...prev,
                              [article.id]: event.target.value
                            }))
                          }
                          disabled={connected.length === 0}
                        >
                          <option value="">Select integration</option>
                          {connected.map((integration) => (
                            <option key={integration.id} value={integration.id}>
                              {integration.type} · {formatIntegrationLabel(integration)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => {
                            if (!chosenIntegration || publishSubmitting) return
                            onPublish(article.id, chosenIntegration)
                          }}
                          disabled={!chosenIntegration || publishSubmitting || connected.length === 0}
                        >
                          {publishSubmitting ? 'Publishing…' : publishQueued ? 'Queued' : 'Publish'}
                        </button>
                        {publishQueued && publishState.jobId ? (
                          <span className="text-[10px] text-muted-foreground">
                            Job {publishState.jobId} queued
                          </span>
                        ) : null}
                        {publishError ? (
                          <span className="text-[10px] font-medium text-destructive">{publishError}</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
