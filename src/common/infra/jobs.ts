// Minimal job JSONL logging for local dev; no types required
import { appendJsonl, latestRunDir } from '@common/bundle/store'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { log } from '@src/common/logger'

const LOG_FILE = 'logs/jobs.jsonl'

function writeEvent(websiteId: string, event: any & { id: string; status: string }) {
  const entry = { ...event, websiteId, at: new Date().toISOString() }
  try {
    appendJsonl(websiteId, LOG_FILE, entry)
  } catch (err) {
    log.warn('[jobs] log write failed', { websiteId, id: event.id, error: (err as Error)?.message || String(err) })
  }
}

export async function recordJobQueued(websiteId: string, type: string, id: string) {
  writeEvent(websiteId, { id, type, status: 'queued' })
}

export async function recordJobRunning(websiteId: string, id: string) {
  writeEvent(websiteId, { id, websiteId, status: 'running' })
}

export async function recordJobCompleted(websiteId: string, id: string, result?: Record<string, unknown>) {
  writeEvent(websiteId, { id, websiteId, status: 'completed', resultJson: result ?? null })
}

export async function recordJobFailed(websiteId: string, id: string, error?: Record<string, unknown>) {
  writeEvent(websiteId, { id, websiteId, status: 'failed', errorJson: error ?? null })
}

export async function listJobs(websiteId: string, limit = 25): Promise<any[]> {
  try {
    const base = latestRunDir(websiteId)
    const file = join(base, LOG_FILE)
    if (!existsSync(file)) return []
    const lines = readFileSync(file, 'utf-8').trim().split('\n').filter(Boolean)
    const parsed = lines.slice(-limit).map((line) => JSON.parse(line) as any)
    return parsed.reverse()
  } catch (err) {
    log.warn('[jobs] list failed', { websiteId, error: (err as Error)?.message || String(err) })
    return []
  }
}

export async function getJob(id: string, websiteId?: string): Promise<any | null> {
  if (websiteId) {
    const jobs = await listJobs(websiteId, 200)
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
