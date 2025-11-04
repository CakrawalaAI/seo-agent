export type KeywordIdeasOverride = 'mock' | 'dataforseo' | null

type ProviderOverridesState = {
  keywordIdeas: KeywordIdeasOverride
}

const globalState: { store: ProviderOverridesState } = (() => {
  const g = globalThis as Record<string, unknown>
  const key = '__PROVIDER_OVERRIDES__'
  if (!g[key]) {
    g[key] = { keywordIdeas: null }
  }
  return { store: g[key] as ProviderOverridesState }
})()

export function getKeywordIdeasOverride(): KeywordIdeasOverride {
  return globalState.store.keywordIdeas ?? null
}

export function setKeywordIdeasOverride(next: KeywordIdeasOverride): void {
  globalState.store.keywordIdeas = next ?? null
}
