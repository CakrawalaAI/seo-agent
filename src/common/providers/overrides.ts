type DiscoveryOverride = 'mock' | 'dataforseo' | null

type ProviderOverridesState = {
  discovery: DiscoveryOverride
}

const globalState: { store: ProviderOverridesState } = (() => {
  const g = globalThis as Record<string, unknown>
  const key = '__PROVIDER_OVERRIDES__'
  if (!g[key]) {
    g[key] = { discovery: null }
  }
  return { store: g[key] as ProviderOverridesState }
})()

export function getDiscoveryOverride(): DiscoveryOverride {
  return globalState.store.discovery ?? null
}

export function setDiscoveryOverride(next: DiscoveryOverride): void {
  globalState.store.discovery = next ?? null
}
