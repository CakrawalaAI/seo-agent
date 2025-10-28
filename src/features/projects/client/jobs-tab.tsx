import { useMemo, useState } from 'react'

import { formatDateTime } from '@features/projects/shared/helpers'
import type { Job } from '@entities'
import {
  countJobsByStatus,
  filterJobsByStatus,
  sortJobsByQueuedAt
} from './jobs-utils'

type ProjectJobsTabProps = {
  jobs: Job[]
  isLoading: boolean
  onRefresh: () => void
}

const STATUS_FILTERS = ['all', 'queued', 'running', 'completed', 'failed'] as const

export function ProjectJobsTab({ jobs, isLoading, onRefresh }: ProjectJobsTabProps) {
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('all')

  const orderedJobs = useMemo(() => sortJobsByQueuedAt(jobs), [jobs])

  const filteredJobs = useMemo(
    () => filterJobsByStatus(orderedJobs, statusFilter),
    [orderedJobs, statusFilter]
  )

  const jobCounts = useMemo(() => countJobsByStatus(orderedJobs), [orderedJobs])

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onRefresh}
          disabled={isLoading}
        >
          {isLoading ? 'Refreshing…' : 'Refresh jobs'}
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setStatusFilter(option)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                statusFilter === option
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {option.toUpperCase()}
              {option === 'all'
                ? ` (${jobs.length})`
                : jobCounts[option] != null
                  ? ` (${jobCounts[option]})`
                  : ''}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading jobs…</p>
      ) : jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No jobs recorded yet.</p>
      ) : filteredJobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No jobs matching this filter.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Type</th>
                <th className="px-4 py-2 text-left font-semibold">Status</th>
                <th className="px-4 py-2 text-left font-semibold">Queued</th>
                <th className="px-4 py-2 text-left font-semibold">Started</th>
                <th className="px-4 py-2 text-left font-semibold">Finished</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredJobs.map((job) => (
                <tr key={job.id} className="odd:bg-muted/30">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{job.type}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${statusBadgeClass(job.status)}`}>
                      {job.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(job.queuedAt)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(job.startedAt)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(job.finishedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export function statusBadgeClass(status: string) {
  switch (status) {
    case 'completed':
      return 'bg-emerald-100 text-emerald-800'
    case 'running':
      return 'bg-amber-100 text-amber-800'
    case 'failed':
      return 'bg-rose-100 text-rose-800'
    default:
      return 'bg-muted text-foreground'
  }
}
