import {
  DATAFORSEO_LOCATIONS,
  DATAFORSEO_DEFAULT_LOCATION_CODE,
  type DataForSeoLanguage,
  type DataForSeoLocation
} from './geo'

// loose, deterministic normalization for names/codes
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// lightweight aliases for common country/language synonyms
const LOCATION_ALIASES: Record<string, number> = {
  // US
  'us': 2840,
  'u s': 2840,
  'u s a': 2840,
  'usa': 2840,
  'america': 2840,
  'united states of america': 2840,
  // UK
  'uk': 2826,
  'u k': 2826,
  'gb': 2826,
  'great britain': 2826,
  'britain': 2826,
  'united kingdom': 2826
}

// Build maps once
const byCode = new Map<number, DataForSeoLocation>()
const byName = new Map<string, DataForSeoLocation>()
const langByCode = new Map<string, DataForSeoLanguage>()
const langByName = new Map<string, DataForSeoLanguage>()
const langsByLocationCode = new Map<number, DataForSeoLanguage[]>()

// public dictionaries (simple consumption)
export const LOCATION_CODE_TO_NAME: Record<number, string> = {}
export const LOCATION_NAME_TO_CODE: Record<string, number> = {}
export const LANGUAGE_CODE_TO_NAME: Record<string, string> = {}
export const LANGUAGE_NAME_TO_CODE: Record<string, string> = {}

for (const loc of DATAFORSEO_LOCATIONS) {
  byCode.set(loc.code, loc as unknown as DataForSeoLocation)
  byName.set(norm(loc.name), loc as unknown as DataForSeoLocation)
  langsByLocationCode.set(loc.code, (loc.languages as unknown as DataForSeoLanguage[]))
  LOCATION_CODE_TO_NAME[loc.code] = loc.name
  LOCATION_NAME_TO_CODE[norm(loc.name)] = loc.code
  for (const lang of (loc.languages as unknown as DataForSeoLanguage[])) {
    const codeKey = lang.code.toLowerCase()
    langByCode.set(codeKey, lang)
    langByName.set(norm(lang.name), lang)
    LANGUAGE_CODE_TO_NAME[codeKey] = lang.name
    LANGUAGE_NAME_TO_CODE[norm(lang.name)] = lang.code
  }
}

export function locationNameFromCode(code: number | string): string | undefined {
  const n = Number(code)
  return byCode.get(n)?.name
}

export function locationCodeFromName(name?: string | null): number | undefined {
  if (!name) return undefined
  const key = norm(name)
  if (LOCATION_ALIASES[key]) return LOCATION_ALIASES[key]
  return byName.get(key)?.code
}

export function languageNameFromCode(code?: string | null): string | undefined {
  if (!code) return undefined
  return langByCode.get(code.toLowerCase())?.name
}

export function languageCodeFromName(name?: string | null): string | undefined {
  if (!name) return undefined
  return langByName.get(norm(name))?.code
}

export function languagesForLocation(location: number | string | undefined): DataForSeoLanguage[] {
  if (location == null) return []
  const code = typeof location === 'number' || /^(\d+)$/.test(String(location))
    ? Number(location)
    : locationCodeFromName(String(location))
  if (!code) return []
  return langsByLocationCode.get(code) ?? []
}

export function supportsLanguage(
  location: number | string | undefined,
  language: string | undefined
): boolean {
  if (!location || !language) return false
  const code = typeof location === 'number' || /^(\d+)$/.test(String(location))
    ? Number(location)
    : locationCodeFromName(String(location))
  if (!code) return false
  const langCode = langByCode.has(language.toLowerCase())
    ? language.toLowerCase()
    : languageCodeFromName(language)
  if (!langCode) return false
  const langs = langsByLocationCode.get(code) ?? []
  return langs.some((l) => l.code.toLowerCase() === langCode)
}

export function coerceToCodes(input: {
  location?: string | number | null
  language?: string | null
}): { locationCode: number; languageCode?: string } {
  const locationCode =
    (typeof input.location === 'number' && input.location) ||
    (typeof input.location === 'string' && /^(\d+)$/.test(input.location) && Number(input.location)) ||
    (typeof input.location === 'string' && locationCodeFromName(input.location)) ||
    DATAFORSEO_DEFAULT_LOCATION_CODE

  const languageCode =
    (input.language && langByCode.has(input.language.toLowerCase()) && input.language.toLowerCase()) ||
    (input.language && languageCodeFromName(input.language)) ||
    undefined

  return { locationCode, languageCode }
}

// Convenience getters for downstream code
export const dataforseoGeo = {
  locationNameFromCode,
  locationCodeFromName,
  languageNameFromCode,
  languageCodeFromName,
  languagesForLocation,
  supportsLanguage,
  coerceToCodes
}

// ----- UI helpers (dropdown-friendly) -----
export type SelectOption<T extends string | number = string | number> = {
  label: string
  value: T
}

export function getLocationOptions(): SelectOption<number>[] {
  return DATAFORSEO_LOCATIONS.map((l) => ({ label: l.name, value: l.code }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export function getLanguageOptions(location?: number | string): SelectOption<string>[] {
  const langs = location ? languagesForLocation(location) : Array.from(new Map([...langByCode]).values())
  const uniq = new Map<string, DataForSeoLanguage>()
  for (const l of langs) uniq.set(l.code.toLowerCase(), l)
  return Array.from(uniq.values())
    .map((l) => ({ label: l.name, value: l.code }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export const GEO_DICTIONARY = {
  LOCATION_CODE_TO_NAME,
  LOCATION_NAME_TO_CODE,
  LANGUAGE_CODE_TO_NAME,
  LANGUAGE_NAME_TO_CODE
} as const
