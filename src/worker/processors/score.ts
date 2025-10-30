import { keywordsRepo } from '@entities/keyword/repository'
import * as bundle from '@common/bundle/store'
import { clusterKey } from '@common/keyword/cluster'

export async function processScore(payload: { projectId: string }) {
  const projectId = String(payload.projectId)
  const list = keywordsRepo.list(projectId, { status: 'all', limit: 1000 })
  const clusters = new Map<string, Array<{ phrase: string; opportunity: number }>>()
  for (const k of list) {
    const key = clusterKey(k.phrase)
    const opp = Number(k.opportunity ?? 0)
    const arr = clusters.get(key) ?? []
    arr.push({ phrase: k.phrase, opportunity: opp })
    clusters.set(key, arr)
  }
  const prioritized: Array<{ phrase: string; opportunity: number; cluster: string; role: 'primary'|'secondary' }> = []
  for (const [key, arr] of clusters.entries()) {
    const sorted = arr.sort((a, b) => (b.opportunity ?? 0) - (a.opportunity ?? 0))
    if (sorted.length === 0) continue
    prioritized.push({ phrase: sorted[0]!.phrase, opportunity: sorted[0]!.opportunity, cluster: key, role: 'primary' })
    for (const sec of sorted.slice(1, 3)) {
      prioritized.push({ phrase: sec.phrase, opportunity: sec.opportunity, cluster: key, role: 'secondary' })
    }
  }
  // Sort primaries first by opportunity, then secondaries
  const primaries = prioritized.filter((p) => p.role === 'primary').sort((a, b) => b.opportunity - a.opportunity)
  const secondaries = prioritized.filter((p) => p.role === 'secondary').sort((a, b) => b.opportunity - a.opportunity)
  try { bundle.writeJsonl(projectId, 'keywords/prioritized.jsonl', [...primaries, ...secondaries]) } catch {}
  try { bundle.appendLineage(projectId, { node: 'score' }) } catch {}
}
