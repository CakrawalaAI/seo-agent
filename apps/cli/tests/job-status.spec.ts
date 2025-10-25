import { describe, expect, it } from 'vitest'
import { describeJobStatus } from '../src/jobs.js'

describe('describeJobStatus', () => {
  it('handles queued jobs', () => {
    const result = describeJobStatus('Crawl', { jobId: 'job-123', status: 'queued' })
    expect(result).toBe('Crawl queued: job-123')
  })

  it('handles skipped jobs with status', () => {
    const result = describeJobStatus('Discovery', { jobId: 'job-456', skipped: true, status: 'recent' })
    expect(result).toBe('Discovery skipped (recent) - job job-456')
  })

  it('handles reused jobs', () => {
    const result = describeJobStatus('Plan job', { jobId: 'job-789', reused: true })
    expect(result).toBe('Plan job already running: job-789')
  })

  it('includes terminal status when provided', () => {
    const result = describeJobStatus('Publish job', { jobId: 'job-101', status: 'failed' })
    expect(result).toBe('Publish job failed: job-101')
  })
})
