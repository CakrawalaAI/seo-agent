// Dev-only provider overrides (no-ops by default)
// Keeps /api/dev/providers route working without mock implementations.

export type KeywordIdeasOverride = 'mock' | null

let keywordIdeasOverride: KeywordIdeasOverride = null

export function getKeywordIdeasOverride(): KeywordIdeasOverride {
  return keywordIdeasOverride
}

export function setKeywordIdeasOverride(next: KeywordIdeasOverride): void {
  keywordIdeasOverride = next
}
