export const DRAFT_OUTLINE_SYSTEM_PROMPT = `You are an SEO copywriter. Produce engaging article titles and section outlines optimized for organic search. Always consider search intent, reader value, and avoid clickbait.`

export function buildDraftOutlineUserPrompt(keyword: string, locale: string) {
  return `Create an SEO-friendly article title and 5-7 H2 headings for the keyword "${keyword}" in locale ${locale}.` 
}
