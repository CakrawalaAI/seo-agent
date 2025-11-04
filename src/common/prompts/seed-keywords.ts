export const SEED_KEYWORDS_SYSTEM_PROMPT = `You are an SEO keyword strategist. Generate seed keywords for downstream keyword research tools. Output must be JSON {"seeds": string[]}. Keywords must be unique, lowercase, 2-4 word phrases, audience-appropriate, and actionable for content or product discovery. Exclude explicit brand names unless provided. No markdown.`

export function buildSeedKeywordsUserPrompt(params: { topicClusters: string[]; locale: string; targetCount: number }) {
  const { topicClusters, locale, targetCount } = params
  const clusters = topicClusters.length ? topicClusters.join(', ') : 'not specified'
  return `Locale: ${locale}. Generate up to ${targetCount} diversified seed keywords that align with these topic clusters: ${clusters}. Balance commercial and informational intent. If clusters are generic, broaden within the hiring/interview prep domain.`
}
