import type { ReactNode } from 'react'
import { Button } from '@src/common/ui/button'

import { formatDateTime } from '@features/projects/shared/helpers'
import type { Job, ProjectSnapshot, Project } from '@entities'

type OverviewTabProps = {
  projectId: string
  snapshot: ProjectSnapshot | null
  jobs: Job[]
  onStartCrawl: () => void
  onGenerateKeywords: () => void
  onCreatePlan: () => void
  onRunSchedule: () => void
  isStartingCrawl: boolean
  isGeneratingKeywords: boolean
  isCreatingPlan: boolean
  isRunningSchedule: boolean
  onWarmSerp?: () => void
  onWarmCompetitors?: () => void
  isWarmingSerp?: boolean
  isWarmingCompetitors?: boolean
  project: Project
  onUpdateProject?: (patch: Partial<Project>) => void
  isUpdatingProject?: boolean
  costs?: { updatedAt: string | null; perDay: Record<string, { counts: Record<string, number>; costUsd: number }> }
  logs?: Array<Record<string, unknown>>
}

export function OverviewTab({
  projectId,
  snapshot,
  jobs,
  onStartCrawl,
  onGenerateKeywords,
  onCreatePlan,
  onRunSchedule,
  isStartingCrawl,
  isGeneratingKeywords,
  isCreatingPlan,
  isRunningSchedule,
  onWarmSerp,
  onWarmCompetitors,
  isWarmingSerp,
  isWarmingCompetitors,
  project,
  onUpdateProject,
  isUpdatingProject,
  costs,
  logs
}: OverviewTabProps) {
  const summary = snapshot?.latestDiscovery?.summaryJson ?? {}
  const topicClusters = Array.isArray(summary?.topicClusters)
    ? summary.topicClusters
    : []
  const representatives: string[] = Array.isArray((snapshot as any)?.representatives)
    ? ((snapshot as any).representatives as string[])
    : []

  return (
    <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Automation controls</h2>
        <p className="text-sm text-muted-foreground">
          Kick off jobs and refresh the content pipeline for this project.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <ActionButton
            label="Start crawl"
            description="Fetch the latest snapshot of the site."
            onClick={onStartCrawl}
            disabled={isStartingCrawl}
            loading={isStartingCrawl}
          />
          <ActionButton
            label="Generate keywords"
            description="Run discovery (crawl ➝ summary ➝ metrics)."
            onClick={onGenerateKeywords}
            disabled={isGeneratingKeywords}
            loading={isGeneratingKeywords}
          />
          <ActionButton
            label="Build 30-day plan"
            description="Draft titles and outlines from the top keywords."
            onClick={onCreatePlan}
            disabled={isCreatingPlan}
            loading={isCreatingPlan}
          />
          <ActionButton
            label="Run schedule now"
            description="Generate today’s drafts and auto-publish if eligible."
            onClick={onRunSchedule}
            disabled={isRunningSchedule}
            loading={isRunningSchedule}
          />
          {onWarmSerp ? (
            <ActionButton
              label="Warm SERP cache"
              description="Queue SERP snapshots for top keywords."
              onClick={onWarmSerp}
              disabled={Boolean(isWarmingSerp)}
              loading={Boolean(isWarmingSerp)}
            />
          ) : null}
          {onWarmCompetitors ? (
            <ActionButton
              label="Warm competitors"
              description="Queue competitor snapshots for top keywords."
              onClick={onWarmCompetitors}
              disabled={Boolean(isWarmingCompetitors)}
              loading={Boolean(isWarmingCompetitors)}
            />
          ) : null}
        </div>

        <div className="mt-6 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Recent jobs</h3>
          {jobs.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No jobs yet. Kick off automation to populate history.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-md border">
              {jobs.map((job) => (
                <li key={job.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">{job.type}</span>
                    <span className="text-muted-foreground">Queued {formatDateTime(job.queuedAt)}</span>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(job.status)}`}>
                    {job.status.toUpperCase()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <aside className="rounded-lg border bg-card p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground">Latest discovery</h3>
        {snapshot?.latestDiscovery ? (
          <dl className="mt-3 space-y-2 text-xs text-muted-foreground">
            <div>
              <dt>Started</dt>
              <dd className="font-medium text-foreground">
                {formatDateTime(snapshot.latestDiscovery.startedAt)}
              </dd>
            </div>
            <div>
              <dt>Providers</dt>
              <dd className="font-medium text-foreground">
                {snapshot.latestDiscovery.providersUsed.join(', ')}
              </dd>
            </div>
            {topicClusters.length > 0 ? (
              <div>
                <dt>Topic clusters</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {topicClusters.map((cluster: string) => (
                    <span
                      key={cluster}
                      className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground"
                    >
                      {cluster}
                    </span>
                  ))}
                </dd>
              </div>
            ) : null}
            {summary?.businessSummary ? (
              <div>
                <dt>Business summary</dt>
                <dd className="mt-1 text-xs leading-snug text-foreground">
                  {summary.businessSummary}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            No discovery run yet. Start the keyword generation workflow to populate this summary.
          </p>
        )}

        {representatives.length ? (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-foreground">Representative URLs</h3>
            <ul className="mt-2 grid list-disc gap-1 pl-4 text-xs">
              {representatives.slice(0, 10).map((u) => (
                <li key={u} className="text-muted-foreground">
                  <a href={u} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    {u}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-foreground">Project settings</h3>
          <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">SERP device</p>
              <p className="font-medium text-foreground">{project.serpDevice ?? 'desktop'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">SERP location</p>
              <p className="font-medium text-foreground">{project.serpLocationCode ?? 2840}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Metrics location</p>
              <p className="font-medium text-foreground">{project.metricsLocationCode ?? 2840}</p>
            </div>
          </div>
          {onUpdateProject ? (
            <div className="mt-3 flex items-center gap-2">
              <Button
                type="button"
                className="rounded-md border border-input px-3 py-1.5 text-xs font-medium"
                disabled={Boolean(isUpdatingProject)}
                onClick={() => onUpdateProject({ serpDevice: project.serpDevice === 'mobile' ? 'desktop' : 'mobile' })}
              >
                Toggle device ({project.serpDevice ?? 'desktop'})
              </Button>
              <Button
                type="button"
                className="rounded-md border border-input px-3 py-1.5 text-xs font-medium"
                disabled={Boolean(isUpdatingProject)}
                onClick={() => onUpdateProject({ serpLocationCode: 2840, metricsLocationCode: 2840 })}
              >
                Use US (2840)
              </Button>
            </div>
          ) : null}
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-semibold text-foreground">Provider costs</h3>
          <p className="mt-1 text-xs text-muted-foreground">Daily aggregated from bundle/global/metrics/costs.json</p>
          {costs?.perDay ? (
            <ul className="mt-2 divide-y divide-border rounded-md border">
              {Object.entries(costs.perDay).slice(-3).map(([day, row]) => (
                <li key={day} className="flex items-center justify-between px-3 py-2 text-xs">
                  <span className="text-muted-foreground">{day}</span>
                  <span className="font-medium text-foreground">${row.costUsd.toFixed(4)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No entries yet.</p>
          )}
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-semibold text-foreground">Recent job events</h3>
          {Array.isArray(logs) && logs.length ? (
            <ul className="mt-2 max-h-48 space-y-1 overflow-auto rounded-md border px-3 py-2 text-[11px]">
              {logs.slice(-20).map((row, i) => (
                <li key={i} className="font-mono text-muted-foreground">{JSON.stringify(row)}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No logs yet.</p>
          )}
        </div>
      </aside>
    </section>
  )
}

function statusBadgeClass(status: string) {
  if (status === 'completed') return 'bg-emerald-100 text-emerald-800'
  if (status === 'failed') return 'bg-rose-100 text-rose-800'
  if (status === 'running') return 'bg-amber-100 text-amber-800'
  return 'bg-muted text-foreground'
}

type ActionButtonProps = {
  label: string
  description: string
  onClick: () => void
  disabled: boolean
  loading: boolean
  icon?: ReactNode
}

function ActionButton({ label, description, onClick, disabled, loading, icon }: ActionButtonProps) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-start gap-2 rounded-lg border border-input bg-background px-4 py-3 text-left shadow-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {icon}
        {loading ? `${label}…` : label}
      </span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </Button>
  )
}
