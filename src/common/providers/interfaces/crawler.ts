export type PageExtract = {
  url: string
  title?: string
  headings?: string[]
  textDump: string
}

export interface WebCrawler {
  crawl(siteUrl: string, opts: { maxPages: number; maxDepth: number; respectRobots: boolean }): Promise<PageExtract[]>
}

