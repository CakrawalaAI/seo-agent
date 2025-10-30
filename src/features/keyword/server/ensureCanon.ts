import { hasDatabase, getDb } from '@common/infra/db'
import { keywordCanon } from '@entities/keyword/db/schema.canon'
import { normalizePhrase } from './normalize'

export async function ensureCanon(phrase: string, language: string) {
  const phraseNorm = normalizePhrase(phrase)
  const id = `kcan_${Buffer.from(`${phraseNorm}|${language}`).toString('base64').slice(0, 20)}`
  if (hasDatabase()) {
    try {
      const db = getDb()
      // @ts-ignore drizzle .onConflictDoNothing may not exist at runtime
      await db
        .insert(keywordCanon)
        .values({ id, phraseNorm, languageCode: language })
        .onConflictDoNothing?.()
    } catch {}
  }
  return { id, phraseNorm, language }
}

