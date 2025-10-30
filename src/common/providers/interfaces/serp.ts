export type SerpItem = {
  rank: number
  url: string
  title?: string
  snippet?: string
  types?: string[]
}

export type SerpSnapshot = {
  fetchedAt: string
  engine: 'google'
  device: 'desktop' | 'mobile'
  topK: number
  items: SerpItem[]
  textDump: string
}

export interface SerpProvider {
  ensure(args: {
    canon: { phrase: string; language: string }
    locationCode: number
    device?: 'desktop' | 'mobile'
    topK?: number
    force?: boolean
  }): Promise<SerpSnapshot>
}

