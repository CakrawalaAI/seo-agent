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
  return `You are writing an executive-style business summary for ${siteUrl} based strictly on the provided content. Use an investment memo tone: clear, factual, useful for SEO planning. Do not invent facts.

Output requirements (plain text only):
- Length: roughly 1–2 pages (≈400–900 words). Be tight and scannable.
- Structure:
  1) Executive Summary — 2–4 short paragraphs covering what the company does, who it serves, core value, and positioning.
  2) Key Facts — concise mini‑sections with short lines (not bullet soup). Include only if evidence exists:
     • Audience/ICP
     • Offering (products/services) and core capabilities
     • Pricing signals (tiers, trials, subscription) — include only when explicitly shown
     • Proof/traction (logos, metrics, certifications) — include only when explicitly shown
     • Go‑to‑market (channels, regions, languages) — include only when present
     • Integrations/stack (only notable ones, e.g., CRM, analytics, infrastructure)
     • Contact/Presence (socials or contact point)
- Style: professional, neutral, concise. Prefer short sentences. No section called "Unknowns". Never write "unknown", "not listed", "not provided", or "N/A" — simply omit missing items.
- Formatting: plain text paragraphs and short lines. No markdown, no numbered lists, no code fences.

Example format (illustrative — do not reuse facts):
Acme builds an AI platform that automates support across chat and email. Teams deploy quickly, reduce response times, and maintain quality. The product targets SMB and mid‑market teams that use popular help desks and CRMs. Differentiation centers on fast setup, coverage across channels, and measurable gains in CSAT and handle time.

Key Facts
Audience/ICP: support teams at SaaS SMBs and mid‑market firms
Offering: AI agent for chat/email; low‑code flows; analytics for quality
Pricing: free trial visible; monthly subscription mentioned; no public tiers
Proof/Traction: case studies cite 40–60% faster replies; SOC 2 on site
Go‑to‑market: English content; focus on North America & EU
Integrations: Zendesk, Salesforce, HubSpot
Contact/Presence: contact form; active on X and LinkedIn`
}

export function buildWebsiteProfileReformatPrompt(siteUrl: string) {
  return `Reformat the concatenated page bullets for ${siteUrl} into an executive-style business summary suitable for SEO planning.
Rules:
- Do NOT add new facts. Preserve names, numbers, plan tiers, and concrete evidence.
- Deduplicate near‑duplicates; compress repetitive points.
- Length: ~1–2 pages (≈400–900 words). Tight, scannable.
- Structure:
  1) Executive Summary — 2–4 short paragraphs covering what the company does, audience, value, differentiation.
  2) Key Facts — concise mini‑sections as short lines (not long bullet lists). Include only if evidence exists:
     • Audience/ICP
     • Offering (products/services) & core capabilities
     • Pricing signals (tiers, trials, subscription) — only when explicitly shown
     • Proof/traction (logos, metrics, certifications)
     • Go‑to‑market (channels, regions, languages)
     • Integrations/stack (only notable items)
     • Contact/Presence (socials/contact point)
- Style: professional, neutral, concise. Prefer short sentences.
- Omit missing items entirely. Never write "Unknowns", "not listed", "not provided", or "N/A".
- Plain text only. No markdown, no numbered lists, no code fences.`
}
