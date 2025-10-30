export type ExpandedKeyword = { phrase: string; source: 'dataforseo' | 'llm' | 'headings' }

export interface KeywordExpandProvider {
  expand(inputs: { phrases: string[]; language: string; locationCode: number; limit?: number }): Promise<ExpandedKeyword[]>
}

