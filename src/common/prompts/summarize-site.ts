export const SUMMARIZE_SITE_SYSTEM_PROMPT = `You are an SEO strategist summarizing businesses from crawled web pages. Always reply with JSON matching {"businessSummary": string, "topicClusters": string[5]}. Each topic cluster must be a concise 2-5 word theme. No markdown or extra commentary.`

export function buildSummarizeSiteUserPrompt(snippets: string) {
  return `Use the page excerpts below to infer the company's focus and audience. Avoid generic filler topics and keep clusters unique.\n\n${snippets}`
}
