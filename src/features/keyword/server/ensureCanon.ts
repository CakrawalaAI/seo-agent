import { createHash } from 'node:crypto'

export async function ensureCanon(phrase: string, language: string) {
  const key = `${String(phrase || '').trim().toLowerCase()}|${String(language || 'en-US')}`
  const id = 'kw_' + createHash('sha1').update(key).digest('hex').slice(0, 12)
  return { id, phrase, language }
}

