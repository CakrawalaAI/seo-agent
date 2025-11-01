import type { Job } from '@entities/job/domain/job'
import { appendJsonl, latestRunDir } from '@common/bundle/store'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const LOG_FILE = 'logs/jobs.jsonl'

function writeEvent(projectId: string, event: Partial<Job> & { id: string; status: string }) {
  const entry = { ...event, projectId, at: new Date().toISOString() }
  try {
    appendJsonl(projectId, LOG_FILE, entry)
  } catch (err) {
    console.warn('[jobs] log write failed', { projectId, id: event.id, error: (err as Error)?.message || String(err) })
  }
}

export async function recordJobQueued(projectId: string, type: string, id: string) {
  writeEvent(projectId, { id, type, status: 'queued' })
}

export async function recordJobRunning(projectId: string, id: string) {
  writeEvent(projectId, { id, projectId, status: 'running' })
}

export async function recordJobCompleted(projectId: string, id: string, result?: Record<string, unknown>) {
  writeEvent(projectId, { id, projectId, status: 'completed', resultJson: result ?? null })
}

export async function recordJobFailed(projectId: string, id: string, error?: Record<string, unknown>) {
  writeEvent(projectId, { id, projectId, status: 'failed', errorJson: error ?? null })
}

export async function listJobs(projectId: string, limit = 25): Promise<Job[]> {
  try {
    const base = latestRunDir(projectId)
    const file = join(base, LOG_FILE)
    if (!existsSync(file)) return []
    const lines = readFileSync(file, 'utf-8').trim().split('\n').filter(Boolean)
    const parsed = lines.slice(-limit).map((line) => JSON.parse(line) as Job)
    return parsed.reverse()
  } catch (err) {
    console.warn('[jobs] list failed', { projectId, error: (err as Error)?.message || String(err) })
    return []
  }
}

export async function getJob(id: string, projectId?: string): Promise<Job | null> {
  if (projectId) {
    const jobs = await listJobs(projectId, 200)
    const found = jobs.find((j) => j.id === id)
    if (found) return found
  }
  try {
    const base = latestRunDir('global')
  } catch {}
  try {
    const root = latestRunDir('global')
    void root
  } catch {}
  try {
    const root = join(process.cwd(), '.data', 'bundle')
    const { readdirSync } = await import('node:fs')
    const entries = readdirSync(root, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const candidate = await listJobs(entry.name, 200)
      const match = candidate.find((j) => j.id === id)
      if (match) return match
    }
  } catch {}
  return null
}
