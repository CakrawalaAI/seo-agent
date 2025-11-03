const DEFAULT_PROTOCOL = 'https:'

export type NormalizedSite = {
  input: string
  siteUrl: string
  host: string
  slug: string
  projectName: string
}

export function normalizeSiteInput(raw: string): NormalizedSite {
  const input = (raw || '').trim()
  if (!input) throw new Error('empty_site_url')
  const prefixed = /^(https?:)?\/\//i.test(input) ? input : `https://${input}`
  let parsed: URL
  try {
    parsed = new URL(prefixed)
  } catch {
    throw new Error('invalid_site_url')
  }
  if (!parsed.hostname) throw new Error('invalid_site_url')
  parsed.hash = ''
  parsed.search = ''
  const protocol = parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.protocol : DEFAULT_PROTOCOL
  const host = parsed.hostname.toLowerCase()
  const siteUrl = `${protocol}//${host}${parsed.port ? `:${parsed.port}` : ''}`
  const slug = slugify(host)
  const projectName = deriveProjectName(host)
  return { input, siteUrl, host, slug, projectName }
}

export function slugify(host: string): string {
  return host
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function deriveProjectName(host: string): string {
  const base = host
    .split('.')
    .filter(Boolean)
    .slice(-2)
    .join(' ')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
  if (!base) return 'New Project'
  const words = base.split(/\s+/g)
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

export function canonicalizeSiteUrl(siteUrl: string): string {
  return normalizeSiteInput(siteUrl).siteUrl
}
