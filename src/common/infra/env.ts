export const env = {
  publicationAllowed: (process.env.SEOA_PUBLICATION_ALLOWED || 'webhook').split(',').map((s) => s.trim()),
  autopublishPolicy: (process.env.SEOA_AUTOPUBLISH_POLICY || 'buffered').toLowerCase(),
  bufferDays: Number(process.env.SEOA_BUFFER_DAYS || '3'),
  crawlBudgetPages: Number(process.env.SEOA_CRAWL_BUDGET_PAGES || '50'),
  crawlMaxDepth: Number(process.env.SEOA_CRAWL_MAX_DEPTH || '2'),
  crawlRender: (process.env.SEOA_CRAWL_RENDER || 'playwright').toLowerCase(),
  blobTtlDays: Number(process.env.SEOA_BLOB_TTL_DAYS || '30')
}
