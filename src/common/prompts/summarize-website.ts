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

