export const SUMMARIZE_PAGE_SYSTEM_PROMPT = `You are an SEO analyst. In 2–3 tight sentences, capture: what is offered, who it's for (ICP), pricing/tier hints (if any), and 1–2 concrete proof points (customers, metrics, certifications) when present. Avoid fluff.`

export function buildSummarizePageUserPrompt(content: string) {
  return `Condense the following page content. Plain text only. Be specific, prefer facts and names over generalities.\n\n${content}`
}
