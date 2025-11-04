import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'

const ENABLED = (process.env.SEOA_ENABLE_BUNDLE || '0') !== '0'

const ROOT = join(process.cwd(), '.data', 'bundle')
const INDEX = join(process.cwd(), '.data', 'bundle-index.json')

function ensureDir(p: string) {
  try { mkdirSync(p, { recursive: true }) } catch {}
}

function nowStamp() {
  const d = new Date()
  const iso = d.toISOString().replace(/[:.]/g, '-')
  return iso
}

function readIndex(): Record<string, string> {
  try {
    if (!existsSync(INDEX)) return {}
    const txt = readFileSync(INDEX, 'utf-8')
    return JSON.parse(txt)
  } catch { return {} }
}

function writeIndex(idx: Record<string, string>) {
  ensureDir(dirname(INDEX))
  try { writeFileSync(INDEX, JSON.stringify(idx, null, 2), 'utf-8') } catch {}
}

export function startRun(websiteId: string) {
  const stamp = nowStamp()
  const dir = join(ROOT, websiteId, stamp)
  ensureDir(dir)
  if (!ENABLED) return dir
  const idx = readIndex()
  idx[websiteId] = dir
  writeIndex(idx)
  return dir
}

export function latestRunDir(websiteId: string) {
  if (!ENABLED) return join(ROOT, websiteId, nowStamp())
  const idx = readIndex()
  const dir = idx[websiteId]
  if (dir) ensureDir(dir)
  return dir || startRun(websiteId)
}

export function writeJson(websiteId: string, relPath: string, data: unknown) {
  if (!ENABLED) return ''
  const base = latestRunDir(websiteId)
  const file = join(base, relPath)
  ensureDir(dirname(file))
  try { writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8') } catch {}
  return file
}

export function writeJsonl(websiteId: string, relPath: string, rows: unknown[]) {
  if (!ENABLED) return ''
  const base = latestRunDir(websiteId)
  const file = join(base, relPath)
  ensureDir(dirname(file))
  try { writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf-8') } catch {}
  return file
}

export function writeText(websiteId: string, relPath: string, content: string) {
  if (!ENABLED) return ''
  const base = latestRunDir(websiteId)
  const file = join(base, relPath)
  ensureDir(dirname(file))
  try { writeFileSync(file, content, 'utf-8') } catch {}
  return file
}

export function appendJsonl(websiteId: string, relPath: string, row: unknown) {
  if (!ENABLED) return ''
  const base = latestRunDir(websiteId)
  const file = join(base, relPath)
  ensureDir(dirname(file))
  try { writeFileSync(file, JSON.stringify(row) + '\n', { encoding: 'utf-8', flag: 'a' }) } catch {}
  return file
}

export function appendLineage(websiteId: string, entry: { node: string; at?: string; outputs?: Record<string, unknown> }) {
  if (!ENABLED) return true
  const base = latestRunDir(websiteId)
  const file = join(base, 'logs', 'lineage.json')
  ensureDir(dirname(file))
  let current: { nodes?: Array<any> } = {}
  try { if (existsSync(file)) current = JSON.parse(readFileSync(file, 'utf-8')) } catch {}
  const list = Array.isArray(current?.nodes) ? current.nodes! : []
  list.push({ node: entry.node, at: entry.at || new Date().toISOString(), outputs: entry.outputs || {} })
  try { writeFileSync(file, JSON.stringify({ nodes: list }, null, 2), 'utf-8') } catch {}
  return true
}
