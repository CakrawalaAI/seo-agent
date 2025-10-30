import { ensureSerp } from '@features/serp/server/ensureSerp'
import { ensureCanon } from '@features/keyword/server/ensureCanon'
import * as bundle from '@common/bundle/store'
import { createHash } from 'node:crypto'

function kwHash(phrase: string, language: string, locationCode: number, device?: string, topK?: number) {
  const h = createHash('sha1').update(`${phrase}|${language}|${locationCode}|${device || 'desktop'}|${topK || 10}`).digest('hex').slice(0, 12)
  return h
}

export async function processSerp(payload: { canonPhrase: string; language: string; locationCode: number; device?: 'desktop'|'mobile'; topK?: number; anchorMonthly?: boolean; force?: boolean }) {
  try {
    const { canSpend } = await import('@common/metrics/costs')
    if (!canSpend('serp')) {
      const { appendJsonl } = await import('@common/bundle/store')
      appendJsonl('global', 'metrics/costs.jsonl', { node: 'serp', provider: 'dataforseo', at: new Date().toISOString(), skipped: 'budget_exceeded', canonPhrase: payload.canonPhrase })
      return
    }
  } catch {}
  const canon = await ensureCanon(payload.canonPhrase, payload.language)
  const snap = await ensureSerp({ canon: { id: canon.id, phrase: payload.canonPhrase, language: payload.language }, locationCode: payload.locationCode, device: payload.device, topK: payload.topK, anchorMonthly: payload.anchorMonthly, force: payload.force })
  try {
    const hash = kwHash(payload.canonPhrase, payload.language, payload.locationCode, payload.device, payload.topK)
    bundle.writeJson('global', `serp/${hash}.json`, { keyword: payload.canonPhrase, language: payload.language, locationCode: payload.locationCode, device: snap.device, topK: snap.topK, fetchedAt: snap.fetchedAt, items: snap.items })
    // lineage as global (no project)
    // no-op for lineage; SERP is global and not tied to a single project bundle
  } catch {}
  try { const { appendJsonl } = await import('@common/bundle/store'); appendJsonl('global', 'metrics/costs.jsonl', { node: 'serp', provider: 'dataforseo', at: new Date().toISOString(), canonPhrase: payload.canonPhrase, locationCode: payload.locationCode }) } catch {}
  try { const { updateCostSummary } = await import('@common/metrics/costs'); updateCostSummary() } catch {}
}
