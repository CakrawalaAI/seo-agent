export const SUMMARIZE_PAGE_SYSTEM_PROMPT = `You are an SEO analyst. Summarize web page content in 2-3 concise sentences highlighting user value and key offerings.`

export function buildSummarizePageUserPrompt(content: string) {
  return `Condense the following page content without markdown or bullet lists:\n\n${content}`
}
