import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { hasDatabase, getDb } from '@common/infra/db'
import { blobs } from '@entities/blob/db/schema'

const BASE = join(process.cwd(), '.data', 'blobs')

function ensureDir() {
  try { mkdirSync(BASE, { recursive: true }) } catch {}
}

export function saveHtml(html: string, projectId?: string) {
  ensureDir()
  const id = `blob_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  const path = join(BASE, `${id}.html`)
  try { writeFileSync(path, html, 'utf-8') } catch {}
  if (projectId && hasDatabase()) {
    void (async () => {
      try {
        const db = getDb()
        // @ts-ignore
        await db.insert(blobs).values({ id, projectId }).onConflictDoNothing?.()
      } catch {}
    })()
  }
  return { id, url: `/api/blobs/${id}` }
}

export function getHtml(id: string) {
  const path = join(BASE, `${id}.html`)
  if (!existsSync(path)) return null
  try { return readFileSync(path, 'utf-8') } catch { return null }
}

export function cleanupOldBlobs(olderThanDays: number): { deleted: number } {
  const days = Math.max(1, olderThanDays)
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  let deleted = 0
  try {
    const files = readdirSync(BASE)
    for (const f of files) {
      if (!f.endsWith('.html')) continue
      const full = join(BASE, f)
      try {
        const st = statSync(full)
        if (st.mtimeMs < cutoff) {
          rmSync(full, { force: true })
          deleted++
        }
      } catch {}
    }
  } catch {}
  return { deleted }
}
