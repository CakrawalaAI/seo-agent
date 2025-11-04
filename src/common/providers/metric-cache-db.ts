export async function getMetricDb(_phrase: string, _locale = 'en-US') { return null }
export async function setMetricDb(
  _phrase: string,
  _metrics: { searchVolume?: number; difficulty?: number; cpc?: number; competition?: number; rankability?: number } | null,
  _locale = 'en-US',
  _ttlSeconds = 30 * 24 * 60 * 60,
  _provider = 'dataforseo'
) { return false }
