import { getSerpProvider } from '@common/providers/registry'
import { config } from '@common/config'
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

function monthOf(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export async function ensureSerp(opts: {
  phrase: string
  language: string
  locationCode: number
  device?: 'desktop' | 'mobile'
  topK?: number
  anchorMonthly?: boolean
  force?: boolean
}) {
  // 1) File cache
  const ttlDays = Math.max(1, Number(config.serp.ttlDays))
  const defaultTopK = Math.max(1, Number(config.serp.topKDefault))
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000
  if (!opts.force) {
    const cached = readCache(cacheKey(opts, defaultTopK))
    if (cached && Date.now() - new Date(cached.fetchedAt).getTime() < ttlMs) {
      return cached
    }
  }
  // 2) Provider call
  const provider = getSerpProvider()
  const snap = await provider.ensure({
    canon: { phrase: opts.phrase, language: opts.language },
    locationCode: opts.locationCode,
    device: opts.device,
    topK: opts.topK ?? defaultTopK,
    force: opts.force
  })
  writeCache(cacheKey(opts, defaultTopK), snap)
  if (opts.anchorMonthly) {
    writeAnchorCache(cacheKey(opts, defaultTopK), snap)
  }
  return snap
}

const CACHE_ROOT = join(process.cwd(), '.data', 'serp-cache')

function ensureDir(dir: string) {
  try { mkdirSync(dir, { recursive: true }) } catch {}
}

function cacheKey(opts: { phrase: string; language: string; locationCode: number; device?: string; topK?: number }, defaultTopK: number) {
  const keyBase = `${opts.phrase}|${opts.language}`
  const hash = createHash('sha1').update(keyBase).digest('hex').slice(0, 12)
  return `${hash}_${opts.locationCode}_${opts.device || 'desktop'}_${opts.topK ?? defaultTopK}`
}

function cachePath(key: string) {
  return join(CACHE_ROOT, `${key}.json`)
}

function readCache(key: string) {
  const file = cachePath(key)
  try {
    if (!existsSync(file)) return null
    const parsed = JSON.parse(readFileSync(file, 'utf-8'))
    if (!parsed?.fetchedAt) parsed.fetchedAt = new Date().toISOString()
    return parsed
  } catch {
    return null
  }
}

function writeCache(key: string, snap: any) {
  ensureDir(CACHE_ROOT)
  const file = cachePath(key)
  try {
    writeFileSync(file, JSON.stringify({ ...snap, fetchedAt: new Date().toISOString() }, null, 2), 'utf-8')
  } catch {}
}

function writeAnchorCache(key: string, snap: any) {
  const month = monthOf()
  const dir = join(CACHE_ROOT, 'anchors')
  ensureDir(dir)
  const file = join(dir, `${key}_${month}.json`)
  if (existsSync(file)) return
  try {
    writeFileSync(file, JSON.stringify({ ...snap, fetchedAt: new Date().toISOString(), anchorMonth: month }, null, 2), 'utf-8')
  } catch {}
}
