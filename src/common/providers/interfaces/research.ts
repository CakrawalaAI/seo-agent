export type ResearchResult = { title: string; url: string; snippet?: string }

export interface ResearchProvider {
  search(q: string, opts?: { topK?: number; site?: string }): Promise<ResearchResult[]>
}

