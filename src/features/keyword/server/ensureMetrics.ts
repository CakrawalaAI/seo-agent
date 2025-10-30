import { getMetricsProvider } from '@common/providers/registry'
import { hasDatabase, getDb } from '@common/infra/db'
import { keywordMetricsSnapshot } from '@entities/keyword/db/schema.snapshots'
import { and, eq } from 'drizzle-orm'

function monthOf(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export async function ensureMetrics(opts: {
  canon: { id: string; phrase: string; language: string }
  locationCode: number
  month?: string
  force?: boolean
}) {
  const month = opts.month || monthOf()
  // 1) DB cache check
  if (hasDatabase() && !opts.force) {
    try {
      const db = getDb()
      // @ts-ignore
      const rows = await db
        .select()
        .from(keywordMetricsSnapshot)
        .where(
          and(
            eq(keywordMetricsSnapshot.canonId, opts.canon.id),
            eq(keywordMetricsSnapshot.provider, 'dataforseo'),
            eq(keywordMetricsSnapshot.locationCode, opts.locationCode as any),
            eq(keywordMetricsSnapshot.asOfMonth, month)
          )
        )
        .limit(1)
      const row = (rows as any)?.[0]
      if (row?.metricsJson) return row.metricsJson as any
    } catch {}
  }
  // 2) Provider call
  const provider = getMetricsProvider()
  const res = await provider.ensureMonthly(
    { phrase: opts.canon.phrase, language: opts.canon.language },
    opts.locationCode,
    month,
    { force: opts.force }
  )
  // 3) Upsert snapshot
  if (hasDatabase()) {
    try {
      const db = getDb()
      const id = `kms_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
      // @ts-ignore
      await db
        .insert(keywordMetricsSnapshot)
        .values({
          id,
          canonId: opts.canon.id,
          provider: 'dataforseo',
          locationCode: opts.locationCode,
          asOfMonth: month,
          metricsJson: res as any
        })
        .onConflictDoUpdate?.({
          target: [keywordMetricsSnapshot.canonId, keywordMetricsSnapshot.provider, keywordMetricsSnapshot.locationCode, keywordMetricsSnapshot.asOfMonth],
          set: { metricsJson: res as any }
        })
    } catch {}
  }
  return res
}
