export function computeOpportunity(input: {
  searchVolume?: number
  difficulty?: number
  competition?: number
  cpc?: number
  rankability?: number
}): number {
  const v = Number(input.searchVolume ?? 0)
  const d = Number(input.difficulty ?? (input.competition ?? 0) * 100)
  const volScore = Math.min(100, Math.max(0, Math.log10(1 + v) * 20))
  const diffScore = 100 - Math.min(100, Math.max(0, d))
  const base = Math.round(0.6 * volScore + 0.4 * diffScore)
  const r = typeof input.rankability === 'number' && isFinite(input.rankability) ? Math.max(0, Math.min(100, input.rankability)) : null
  const score = r == null ? base : Math.round(0.5 * base + 0.5 * r)
  return Math.max(0, Math.min(100, score))
}
