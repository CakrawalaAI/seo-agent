export const env = {
  publicationAllowed: (process.env.SEOA_PUBLICATION_ALLOWED || 'webhook').split(',').map((s) => s.trim()),
  autopublishPolicy: (process.env.SEOA_AUTOPUBLISH_POLICY || 'buffered').toLowerCase(),
  bufferDays: Number(process.env.SEOA_BUFFER_DAYS || '3')
}

