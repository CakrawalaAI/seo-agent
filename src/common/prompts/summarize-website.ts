export function buildPickTopFromSitemapPrompt(siteUrl: string, topN: number) {
  return `You are ranking sitemap URLs to capture a business website's identity.
From the list below, select up to ${topN} URLs that best represent the business:
- homepage
- product / solutions / features
- pricing / plans
- about / company / team
- customers / case studies
- how it works / overview
- key category hub pages

Subdomains policy: include curated subdomains (blog., docs., help., support., careers.) only if they contain core product/pricing/about/customer info not present on the main domain. Otherwise prefer main-domain pages.

Avoid: legal, auth, search, pagination, tag/category floods.
Return strict JSON only: {"urls":["..."]}. Use only URLs from input.
Site: ${siteUrl}`
}

export function buildWebsiteSummaryPrompt(siteUrl: string) {
  return `Read the multi-page dump for ${siteUrl}. Write a concise business context summary that covers:
- what the company does
- primary products / solutions
- target customer / ICP
- value propositions
- pricing signals (if any)
- differentiators
- credible proof points

Avoid fluff and speculation. If unknown, omit. 250–500 words. Output plain text only.`
}

export function buildWebsiteProfileReformatPrompt(siteUrl: string) {
  return `Reformat the concatenated page bullets for ${siteUrl} into a comprehensive website profile.
Rules:
- Do NOT add new facts. Do NOT omit information.
- Deduplicate near-duplicates; preserve names, numbers, plan tiers.
- Organize into sections exactly: Overview; Products/Services; Pricing; Customers/Proof; Content/Resources; Integrations; Compliance; Locations/Contact; Unknowns.
- Plain text only.`
}
