import type { ResearchProvider, ResearchResult } from '../../interfaces/research'
export const exaResearch: ResearchProvider = {
  async search(q: string, opts?: { topK?: number; site?: string }): Promise<ResearchResult[]> {
    const key = process.env.EXA_API_KEY || ''
    const topK = Math.max(1, Math.min(20, Number(opts?.topK || 5)))
    if (!key) throw new Error('EXA_API_KEY missing')
    try {
      const url = 'https://api.exa.ai/search'
      const body = { q: opts?.site ? `${q} site:${opts.site}` : q, num_results: topK }
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify(body)
      })
      if (!res.ok) return []
      const json: any = await res.json().catch(() => ({}))
      const items: ResearchResult[] = (json?.results ?? []).map((r: any) => ({ title: String(r?.title || ''), url: String(r?.url || ''), snippet: r?.text }))
      return items
    } catch {
      return []
    }
  }
}
