import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const BASE = join(process.cwd(), '.data', 'blobs')

function ensureDir() {
  try { mkdirSync(BASE, { recursive: true }) } catch {}
}

export function saveHtml(html: string, projectId?: string) {
  ensureDir()
  const id = `blob_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  const path = join(BASE, `${id}.html`)
  try { writeFileSync(path, html, 'utf-8') } catch {}
  void projectId
  return { id, url: `/api/blobs/${id}` }
}

export function saveText(text: string, projectId?: string) {
  ensureDir()
  const id = `blob_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  const path = join(BASE, `${id}.txt`)
  try { writeFileSync(path, text, 'utf-8') } catch {}
  void projectId
  return { id, url: `/api/blobs/${id}` }
}

export function getBlob(id: string): { content: string; contentType: string } | null {
  const textPath = join(BASE, `${id}.txt`)
  if (existsSync(textPath)) {
    try { return { content: readFileSync(textPath, 'utf-8'), contentType: 'text/plain; charset=utf-8' } } catch {}
  }
  const htmlPath = join(BASE, `${id}.html`)
  if (existsSync(htmlPath)) {
    try { return { content: readFileSync(htmlPath, 'utf-8'), contentType: 'text/html; charset=utf-8' } } catch {}
  }
  return null
}

export function cleanupOldBlobs(olderThanDays: number): { deleted: number } {
  const days = Math.max(1, olderThanDays)
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  let deleted = 0
  try {
    const files = readdirSync(BASE)
    for (const f of files) {
      if (!f.endsWith('.html') && !f.endsWith('.txt')) continue
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
