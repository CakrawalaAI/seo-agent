import { DATAFORSEO_DEFAULT_LANGUAGE_CODE, DATAFORSEO_DEFAULT_LOCATION_CODE, DATAFORSEO_LANGUAGES, DATAFORSEO_LOCATIONS } from './geo'

export function languageCodeFromLocale(locale?: string | null): string {
  if (!locale) return DATAFORSEO_DEFAULT_LANGUAGE_CODE
  const code = String(locale).split(/[-_]/)[0]?.toLowerCase() || DATAFORSEO_DEFAULT_LANGUAGE_CODE
  const match = DATAFORSEO_LANGUAGES.find((l) => l.code.toLowerCase() === code)
  return match ? match.code : DATAFORSEO_DEFAULT_LANGUAGE_CODE
}

export function languageNameFromCode(code?: string | null): string {
  if (!code) return 'English'
  const match = DATAFORSEO_LANGUAGES.find((l) => l.code.toLowerCase() === String(code).toLowerCase())
  return match?.name || 'English'
}

export function locationCodeFromLocale(locale?: string | null): number {
  if (!locale) return DATAFORSEO_DEFAULT_LOCATION_CODE
  const parts = String(locale).split(/[-_]/)
  const country = parts[1]?.toUpperCase() || 'US'
  const match = DATAforSEOByCountryIso(country)
  return match?.code || DATAFORSEO_DEFAULT_LOCATION_CODE
}

export function locationNameFromCode(code?: number | null): string {
  if (!code) return 'United States'
  const loc = DATAFORSEO_LOCATIONS.find((l) => l.code === code)
  return loc?.name || 'United States'
}

export function DATAforSEOByCountryIso(iso2: string): { code: number; name: string } | null {
  const rec = DATAFORSEO_LOCATIONS.find((l) => (l.countryIsoCode || '').toUpperCase() === iso2.toUpperCase())
  return rec ? { code: rec.code, name: rec.name } : null
}

