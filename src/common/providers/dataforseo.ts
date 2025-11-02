import { dfsClient } from './impl/dataforseo/client'
import { DATAFORSEO_DEFAULT_LOCATION_CODE } from './impl/dataforseo/geo'

export type SvInput = { phrase: string; locale?: string; location?: string }
export type SvResult = { phrase: string; metrics: { searchVolume?: number; cpc?: number; competition?: number; asOf?: string } }

export async function searchVolume(inputs: SvInput[]): Promise<SvResult[]> {
  if (!inputs.length) return []
  const primary = inputs[0]
  const locationCode = primary?.location ? Number(primary.location) || DATAFORSEO_DEFAULT_LOCATION_CODE : DATAFORSEO_DEFAULT_LOCATION_CODE
  const languageCode = primary?.locale
  const keywords = inputs.map((i) => i.phrase)
  const records = await dfsClient.searchVolume({
    keywords,
    languageCode,
    locationCode
  })
  const map = new Map(records.map((r) => [r.keyword.toLowerCase(), r.metrics]))
  return inputs.map((input) => {
    const metrics = map.get(input.phrase.toLowerCase()) || {}
    return { phrase: input.phrase, metrics }
  })
}
