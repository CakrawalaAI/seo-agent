import type { Job } from '@entities'

const DEFAULT_STATUS = 'unknown'

export function sortJobsByQueuedAt(jobs: Job[]): Job[] {
  return [...jobs].sort((a, b) => {
    const aTime = a.queuedAt ? new Date(a.queuedAt).getTime() : 0
    const bTime = b.queuedAt ? new Date(b.queuedAt).getTime() : 0
    return bTime - aTime
  })
}

export function normalizeStatus(value: string | null | undefined) {
  return (value ?? DEFAULT_STATUS).toLowerCase()
}

export function filterJobsByStatus(jobs: Job[], status: string) {
  if (status === 'all') return jobs
  const normalized = status.toLowerCase()
  return jobs.filter((job) => normalizeStatus(job.status) === normalized)
}

export function countJobsByStatus(jobs: Job[]) {
  return jobs.reduce<Record<string, number>>((acc, job) => {
    const key = normalizeStatus(job.status)
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
}
