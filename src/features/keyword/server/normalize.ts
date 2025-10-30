export function normalizePhrase(raw: string) {
  return raw.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
}

