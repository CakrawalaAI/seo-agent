import { describe, expect, it } from 'vitest'

import type { Job } from '@entities'

import {
  countJobsByStatus,
  filterJobsByStatus,
  normalizeStatus,
  sortJobsByQueuedAt
} from '../../src/features/projects/client/jobs-utils'

const job = (overrides: Partial<Job> = {}): Job => ({
  ...baseJob(),
  ...overrides
})

function baseJob(): Job {
  return {
    id: 'job-1',
    projectId: 'proj-1',
    type: 'crawl',
    status: 'queued',
    queuedAt: '2024-09-01T10:00:00Z',
    startedAt: null,
    finishedAt: null,
    resultJson: null,
    errorJson: null
  }
}

describe('jobs utils', () => {
  it('normalizes status strings', () => {
    expect(normalizeStatus('Completed')).toBe('completed')
    expect(normalizeStatus(null)).toBe('unknown')
  })

  it('sorts jobs newest first', () => {
    const sorted = sortJobsByQueuedAt([
      job({ id: 'a', queuedAt: '2024-09-01T08:00:00Z' }),
      job({ id: 'b', queuedAt: '2024-09-01T12:00:00Z' }),
      job({ id: 'c', queuedAt: null })
    ])
    expect(sorted.map((item) => item.id)).toEqual(['b', 'a', 'c'])
  })

  it('filters jobs by status', () => {
    const jobs = [
      job({ id: 'queued', status: 'queued' }),
      job({ id: 'running', status: 'running' }),
      job({ id: 'done', status: 'completed' })
    ]
    expect(filterJobsByStatus(jobs, 'all')).toHaveLength(3)
    expect(filterJobsByStatus(jobs, 'running').map((item) => item.id)).toEqual(['running'])
  })

  it('counts jobs by status', () => {
    const counts = countJobsByStatus([
      job({ status: 'queued' }),
      job({ status: 'queued' }),
      job({ status: 'completed' })
    ])
    expect(counts).toMatchObject({ queued: 2, completed: 1 })
  })
})
