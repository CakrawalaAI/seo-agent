import type { ArticleOutlineSection } from '@entities/article/domain/article'

type Citation = { title?: string; url: string; snippet?: string }
type MediaImage = { src: string; alt?: string; caption?: string }
type MediaYoutube = { title?: string; url: string }
type InternalLink = { anchor?: string; url: string }

export type ArticleContextPayload = {
  title: string
  locale: string
  outline: ArticleOutlineSection[]
  websiteSummary?: string
  serpDump?: string
  competitorDump?: string
  citations?: Citation[]
  youtube?: MediaYoutube[]
  images?: MediaImage[]
  internalLinks?: InternalLink[]
  features?: Record<string, boolean>
}

export function buildDraftOutlineMessages(args: { keyword: string; locale: string }) {
  const { keyword, locale } = args
  return {
    system: `You are a senior SEO editor. Create compelling titles and structured outlines that satisfy search intent, demonstrate expertise, and maximize organic performance.`,
    user: `Keyword: "${keyword}"
Locale: ${locale}

Return strict JSON:
{
  "title": "Exact article title in locale language",
  "outline": [
    { "heading": "H2 section heading" }
  ]
}

Guidelines:
- Title 60-65 characters, include keyword naturally.
- Outline 5-8 H2 entries, cover intent breadth (intro, key pillars, comparisons, CTA).
- Avoid fluff, marketing hype, clickbait.`
  }
}

export function buildGenerateBodyMessages(context: ArticleContextPayload) {
  const outlineRows = context.outline.map((section, index) => `${index + 1}. ${section.heading}`).join('\n')
  const citations = (context.citations || []).map((c, i) => `[${i + 1}] ${c.title || ''} — ${c.url}${c.snippet ? `\n  Snippet: ${c.snippet}` : ''}`).join('\n')
  const youtube = (context.youtube || []).map((item, i) => `${i + 1}. ${item.title || ''} — ${item.url}`).join('\n')
  const images = (context.images || []).map((image, i) => `${i + 1}. ${image.src}${image.alt ? ` (alt: ${image.alt})` : ''}${image.caption ? ` — ${image.caption}` : ''}`).join('\n')
  const links = (context.internalLinks || []).map((link, i) => `${i + 1}. ${link.anchor || 'Related'} — ${link.url}`).join('\n')
  const featuresList = Object.entries(context.features ?? {})
    .map(([key, value]) => `${key}: ${value ? 'enabled' : 'disabled'}`)
    .join(', ')

  const serpExcerpt = (context.serpDump || '').trim().slice(0, 9000)
  const competitorExcerpt = (context.competitorDump || '').trim().slice(0, 6000)
  const summary = (context.websiteSummary || '').trim()

  return {
    system: `You are an AI SEO content strategist.
Output HTML fragment only. No markdown. No code fences. No <!DOCTYPE>, <html>, <head>, or <body>.
Wrap content in a single <article> root. Semantic, accessible, production-ready.
Honor supplied outline and context; ensure factual accuracy with citations.`,
    user: `Title: ${context.title}
Locale: ${context.locale}
Outline (H2 order):
${outlineRows}

Website Summary:
${summary || '(none)'}

SERP Insights (top results excerpts):
${serpExcerpt || '(none)'}

Competitor Notes:
${competitorExcerpt || '(none)'}

Citations:
${citations || '(none)'}

YouTube Candidates:
${youtube || '(none)'}

Image Candidates:
${images || '(none)'}

Internal Links:
${links || '(none)'}

Feature Toggles: ${featuresList || '(default)'}

Instructions:
- Output valid semantic HTML5 fragment only. No full document wrappers.
- Include a single <h1> matching Title inside <article>.
- Use outline order for H2/H3 sections; write authoritative paragraphs; use lists when helpful.
- Images: when provided, place as <figure><img src="..." alt="..."/><figcaption>...</figcaption></figure>.
- YouTube: if enabled and a URL exists, include a simple paragraph link AND an optional <figure data-embed="youtube" data-url="..."></figure> marker (no iframe).
- References: inline hyperlinks plus a final <section><h2>References</h2><ol>…</ol></section> with plain links.
- Internal links: link relevant anchor text naturally.
- No <script> or <style>.
- No JSON-LD in body.
- Avoid repetition; ensure original wording.`
  }
}

export function buildFactCheckMessages(args: { title: string; preview?: string; citations?: Citation[] }) {
  const citations = (args.citations || []).map((c, i) => `${i + 1}. ${c.title || ''} — ${c.url}`).join('\n')
  return {
    system: `You are an accuracy auditor. Assess whether claims are supported by provided sources, returning JSON feedback.`,
    user: `Title: ${args.title}
Preview:
${(args.preview || '').slice(0, 2000)}

Citations:
${citations || '(none)'}

Return strict JSON:
{
  "score": number (0-100),
  "notes": "short justification highlighting gaps or risks"
}`
  }
}
