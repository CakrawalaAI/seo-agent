import { publishJob } from '@common/infra/queue'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

type Recipe = { nodes: Record<string, { onSuccess?: string[] }> }

const DEFAULT_RECIPE: Recipe = {
  nodes: {
    crawl: { onSuccess: ['discovery'] },
    // Per-website model: discovery → plan
    discovery: { onSuccess: ['plan'] },
    plan: { onSuccess: [] },
    generate: { onSuccess: [] },
    enrich: { onSuccess: [] }
  }
}

async function loadRecipe(): Promise<Recipe> {
  try {
    const p = join(process.cwd(), 'src', 'common', 'workflow', 'recipe.json')
    if (existsSync(p)) {
      const txt = readFileSync(p, 'utf-8')
      const json = JSON.parse(txt)
      if (json && json.nodes) return json as Recipe
    }
  } catch {}
  // Optional YAML fallback (minimal parser for our simple shape)
  try {
    const py = join(process.cwd(), 'src', 'common', 'workflow', 'recipe.yaml')
    if (existsSync(py)) {
      const ytxt = readFileSync(py, 'utf-8')
      const out: Recipe = { nodes: {} }
      // Expect shape:
      // nodes:\n  name:\n    onSuccess: [a,b]
      const lines = ytxt.split(/\r?\n/)
      let inNodes = false
      let current: string | null = null
      for (const raw of lines) {
        const line = raw.replace(/\t/g, '  ')
        if (/^\s*nodes\s*:/i.test(line)) { inNodes = true; continue }
        if (!inNodes) continue
        const nodeMatch = line.match(/^\s{2}([a-zA-Z0-9_-]+)\s*:\s*$/)
        if (nodeMatch) { current = nodeMatch[1]; out.nodes[current] = { onSuccess: [] }; continue }
        const succMatch = line.match(/^\s{4}onSuccess\s*:\s*\[(.*)\]\s*$/)
        if (succMatch && current) {
          const arr = succMatch[1]
            .split(',')
            .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
            .filter(Boolean)
          out.nodes[current] = { onSuccess: arr }
        }
      }
      if (Object.keys(out.nodes).length) return out
    }
  } catch {}
  return DEFAULT_RECIPE
}

export async function onJobSuccess(currentType: string, payload: Record<string, unknown>) {
  const recipe = await loadRecipe()
  const node = recipe.nodes[currentType]
  if (!node || !Array.isArray(node.onSuccess) || node.onSuccess.length === 0) return
  const websiteId = String((payload as any)?.websiteId || (payload as any)?.projectId || '')
  for (const next of node.onSuccess) {
    // Avoid double-queueing enrich: generate processor already enqueues
    if (currentType === 'generate' && next === 'enrich') continue
    const nextPayload: Record<string, unknown> = { websiteId }
    if (next === 'plan') nextPayload.days = 30
    await publishJob({ type: next as any, payload: nextPayload })
  }
}
