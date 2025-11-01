const OUT_OF_SCOPE = [
  // Obvious outdoor/camping bleed
  'camp', 'camping', 'hiking', 'wilderness', 'outdoor', 'trail', 'gear', 'backpacking', 'survival',
  // Cooking/recipes bleed
  'recipe', 'cooking', 'kitchen',
  // Generic ecommerce terms
  'price', 'deal', 'coupon'
]

function tokenize(s: string) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').split(/\s+/).filter(Boolean)
}

export function filterSeeds(seeds: string[], summary: { businessSummary?: string; topicClusters?: string[] }) {
  const allowedTopics = new Set<string>()
  tokenize(summary?.businessSummary || '').forEach((t) => allowedTopics.add(t))
  for (const c of summary?.topicClusters || []) tokenize(c).forEach((t) => allowedTopics.add(t))
  const out: string[] = []
  for (const s of seeds) {
    const toks = tokenize(s)
    if (!toks.length) continue
    // blacklist hard filters
    if (toks.some((t) => OUT_OF_SCOPE.includes(t))) continue
    // require at least one overlap with allowed topics when present
    const hasLock = allowedTopics.size > 0 ? toks.some((t) => allowedTopics.has(t)) : true
    if (!hasLock) continue
    out.push(s)
  }
  // dedupe preserve order
  const seen = new Set<string>()
  const unique: string[] = []
  for (const s of out) { const k = s.toLowerCase(); if (!seen.has(k)) { seen.add(k); unique.push(s) } }
  return unique
}

