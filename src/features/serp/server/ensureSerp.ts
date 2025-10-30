import { getSerpProvider } from '@common/providers/registry'
import { hasDatabase, getDb } from '@common/infra/db'
import { serpSnapshot } from '@entities/serp/db/schema'
import { and, eq, gt } from 'drizzle-orm'

function monthOf(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export async function ensureSerp(opts: {
  canon: { id: string; phrase: string; language: string }
  locationCode: number
  device?: 'desktop' | 'mobile'
  topK?: number
  anchorMonthly?: boolean
  force?: boolean
}) {
  // 1) DB cache check (TTL)
  const ttlDays = Math.max(1, Number(process.env.SEOA_SERP_TTL_DAYS || '14'))
  const defaultTopK = Math.max(1, Number(process.env.SEOA_SERP_K || '10'))
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000
  if (hasDatabase() && !opts.force) {
    try {
      const db = getDb()
      // @ts-ignore
      const rows = await db
        .select()
        .from(serpSnapshot)
        .where(
          and(
            eq(serpSnapshot.canonId, opts.canon.id),
            eq(serpSnapshot.engine, 'google'),
            eq(serpSnapshot.locationCode, opts.locationCode as any),
            eq(serpSnapshot.device, (opts.device || 'desktop') as any),
            eq(serpSnapshot.topK, (opts.topK || defaultTopK) as any)
          )
        )
        .limit(1)
      const row = (rows as any)?.[0]
      if (row?.itemsJson && row?.fetchedAt) {
        const age = Date.now() - new Date(row.fetchedAt as any).getTime()
        if (age < ttlMs) {
          return {
            fetchedAt: new Date(row.fetchedAt as any).toISOString(),
            engine: 'google',
            device: (row.device as any) || 'desktop',
            topK: Number(row.topK || 10),
            items: row.itemsJson as any,
            textDump: String(row.textDump || '')
          }
        }
      }
    } catch {}
  }
  // 2) Provider call
  const provider = getSerpProvider()
  const snap = await provider.ensure({
    canon: { phrase: opts.canon.phrase, language: opts.canon.language },
    locationCode: opts.locationCode,
    device: opts.device,
    topK: opts.topK ?? defaultTopK,
    force: opts.force
  })
  // 3) Upsert latest + optional monthly anchor
  if (hasDatabase()) {
    const id = `serp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    try {
      const db = getDb()
      // latest upsert key on canon+engine+location+device+topK
      // @ts-ignore
      await db
        .insert(serpSnapshot)
        .values({
          id,
          canonId: opts.canon.id,
          engine: 'google',
          locationCode: opts.locationCode,
          device: snap.device,
          topK: snap.topK,
          itemsJson: snap.items as any,
          textDump: snap.textDump
        })
        .onConflictDoUpdate?.({
          target: [serpSnapshot.canonId, serpSnapshot.engine, serpSnapshot.locationCode, serpSnapshot.device, serpSnapshot.topK],
          set: { itemsJson: snap.items as any, textDump: snap.textDump, fetchedAt: new Date() as any }
        })
      if (opts.anchorMonthly) {
        const month = monthOf()
        const anchorId = `${id}_m` 
        // attempt insert if missing
        // @ts-ignore
        await db
          .insert(serpSnapshot)
          .values({
            id: anchorId,
            canonId: opts.canon.id,
            engine: 'google',
            locationCode: opts.locationCode,
            device: snap.device,
            topK: snap.topK,
            itemsJson: snap.items as any,
            textDump: snap.textDump,
            anchorMonth: month
          })
          .onConflictDoNothing?.()
      }
    } catch {}
  }
  return snap
}
