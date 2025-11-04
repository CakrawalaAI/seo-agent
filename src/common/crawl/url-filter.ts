export function normalizeUrl(u: string, base: URL): string | null {
  try {
    const url = new URL(u, base)
    if (url.host !== base.host) return null // no subdomains or external
    url.hash = ''
    url.search = ''
    let href = url.toString()
    if (href.endsWith('/') && href !== `${url.protocol}//${url.host}/`) href = href.slice(0, -1)
    return href
  } catch {
    return null
  }
}

export function isHtmlLike(u: string): boolean {
  const lowered = u.toLowerCase()
  // Exclude obvious non-HTML assets
  if (/\.(pdf|jpg|jpeg|png|gif|webp|svg|zip|csv|xls|xlsx|doc|docx|ppt|pptx|mp4|mp3)(?:$|\?)/.test(lowered)) return false
  // Exclude non-core app/product flows from crawling/seed extraction
  // Examples: auth, account, billing, org/team management, invites, dashboards, APIs, etc.
  if (/(?:\/wp-|\/feed|\/tag\/|\/category\/|\/page\/\d+|\/api|\/graphql|\/search|\/admin|\/dashboard|\/login|\/logout|\/sign[-_]?in|\/sign[-_]?up|\/register|\/(?:forgot|reset)-password|\/verify(?:[-_]?email)?|\/password|\/forgot|\/reset|\/verify|\/auth|\/oauth|\/sso|\/callback|\/account|\/settings|\/preferences|\/profile|\/me|\/billing|\/subscription(?:s)?|\/entitlement|\/checkout|\/(?:customer[-_]?portal|portal)|\/customer(?:s)?|\/invoice(?:s)?|\/payment(?:s)?|\/cart|\/order(?:s)?|\/org(?:s)?|\/organization(?:s)?|\/team(?:s)?|\/member(?:s)?|\/invite(?:s)?|\/accept|\/join)(?:$|\/|\?)/.test(lowered)) return false
  return true
}
