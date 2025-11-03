import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs'
import { join, dirname } from 'node:path'

const ROOT = join(process.cwd(), '.data', 'bundle', 'global', 'metrics')

function ensureDir(p: string) {
  try { mkdirSync(p, { recursive: true }) } catch {}
}

export function updateCostSummary() {
  ensureDir(ROOT)
  const jsonl = join(ROOT, 'costs.jsonl')
  const out = join(ROOT, 'costs.json')
  if (!existsSync(jsonl)) return false
  const txt = readFileSync(jsonl, 'utf-8')
  const lines = txt.split(/\r?\n/).filter(Boolean)
  const rows: Array<{ node: string; provider: string; at: string }> = []
  for (const line of lines) {
    try { rows.push(JSON.parse(line)) } catch {}
  }
  const perDay: Record<string, { counts: Record<string, number>; costUsd: number }> = {}
  const serpCost = 0.01
  const metricsCost = 0.005
  const llmCost = 0
  const researchCost = 0
  for (const r of rows) {
    const day = (r.at || '').slice(0, 10) || 'unknown'
    if (!perDay[day]) perDay[day] = { counts: {}, costUsd: 0 }
    const key = `${r.node}:${r.provider}`
    perDay[day].counts[key] = (perDay[day].counts[key] || 0) + 1
    if (r.node === 'serp') perDay[day].costUsd += serpCost
    if (r.node === 'metrics') perDay[day].costUsd += metricsCost
    if (r.node === 'llm') perDay[day].costUsd += llmCost
    if (r.node === 'research') perDay[day].costUsd += researchCost
  }
  const summary = { updatedAt: new Date().toISOString(), perDay }
  // atomic write: tmp then rename
  const tmp = out + '.tmp'
  writeFileSync(tmp, JSON.stringify(summary, null, 2), 'utf-8')
  try { renameSync(tmp, out) } catch { writeFileSync(out, JSON.stringify(summary, null, 2), 'utf-8') }
  return true
}

function readRows(): Array<{ node: string; provider: string; at: string }> {
  const jsonl = join(ROOT, 'costs.jsonl')
  if (!existsSync(jsonl)) return []
  try {
    const txt = readFileSync(jsonl, 'utf-8')
    return txt
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => {
        try { return JSON.parse(l) } catch { return null }
      })
      .filter(Boolean) as any
  } catch {
    return []
  }
}

export function getTodayCounts() {
  const rows = readRows()
  const today = new Date().toISOString().slice(0, 10)
  const counts: Record<string, number> = {}
  for (const r of rows) {
    const day = (r.at || '').slice(0, 10)
    if (day !== today) continue
    const key = `${r.node}:${r.provider}`
    counts[key] = (counts[key] || 0) + 1
  }
  return counts
}

export function canSpend(node: 'serp' | 'metrics') {
  const counts = getTodayCounts()
  const caps = { serp: 0, metrics: 0 }
  const provider = 'dataforseo'
  const key = `${node}:${provider}`
  if (!caps[node]) return true // zero or unset means unlimited
  const used = counts[key] || 0
  return used < caps[node]
}
