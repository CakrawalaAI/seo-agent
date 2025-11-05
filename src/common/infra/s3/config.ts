export type BackblazeS3Config = {
  bucket: string
  endpoint: string
  region: string
  keyId: string
  applicationKey: string
  urlTtlSeconds: number
}

const DEFAULT_TTL_SECONDS = 60 * 10

export function getBackblazeConfig(): BackblazeS3Config | null {
  const bucket = read('S3_BUCKET')
  const endpoint = read('S3_ENDPOINT')
  const region = read('S3_REGION') || 'us-west-004'
  const keyId = read('S3_KEY')
  const applicationKey = read('S3_SECRET')
  const ttlRaw = Number(read('S3_URL_TTL') || DEFAULT_TTL_SECONDS)
  const urlTtlSeconds = Number.isFinite(ttlRaw) && ttlRaw > 0 ? Math.min(ttlRaw, 60 * 60) : DEFAULT_TTL_SECONDS

  if (!bucket || !endpoint || !keyId || !applicationKey) return null
  return {
    bucket,
    endpoint,
    region,
    keyId,
    applicationKey,
    urlTtlSeconds
  }
}

function read(key: string): string {
  return (process.env[key] || '').trim()
}
