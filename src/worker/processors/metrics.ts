import { ensureMetrics } from '@features/keyword/server/ensureMetrics'
import { ensureCanon } from '@features/keyword/server/ensureCanon'

export async function processMetrics(payload: { canonPhrase: string; language: string; locationCode: number; month?: string; force?: boolean }) {
  try {
    const { canSpend } = await import('@common/metrics/costs')
    if (!canSpend('metrics')) {
      const { appendJsonl } = await import('@common/bundle/store')
      appendJsonl('global', 'metrics/costs.jsonl', { node: 'metrics', provider: 'dataforseo', at: new Date().toISOString(), skipped: 'budget_exceeded', canonPhrase: payload.canonPhrase })
      return
    }
  } catch {}
  const canon = await ensureCanon(payload.canonPhrase, payload.language)
  await ensureMetrics({ canon: { id: canon.id, phrase: payload.canonPhrase, language: payload.language }, locationCode: payload.locationCode, month: payload.month, force: payload.force })
  try { const { appendJsonl } = await import('@common/bundle/store'); appendJsonl('global', 'metrics/costs.jsonl', { node: 'metrics', provider: 'dataforseo', at: new Date().toISOString(), canonPhrase: payload.canonPhrase, locationCode: payload.locationCode, month: payload.month || '' }) } catch {}
  try { const { updateCostSummary } = await import('@common/metrics/costs'); updateCostSummary() } catch {}
}
