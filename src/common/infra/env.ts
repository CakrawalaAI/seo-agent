// Minimal, flag-free runtime defaults
export const env = {
  publicationAllowed: ['webhook'],
  autopublishPolicy: 'buffered',
  bufferDays: 3,
  crawlBudgetPages: 50,
  crawlMaxDepth: 2,
  crawlRender: 'playwright' as 'playwright' | 'fetch',
  blobTtlDays: 30,
  competitorFetchFallback: true,
}
