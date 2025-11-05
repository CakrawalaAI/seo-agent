export const GENERATE_BODY_SYSTEM_PROMPT = `You are an experienced content writer.
Output HTML fragment only. No markdown. No code fences. No <!DOCTYPE>, <html>, <head>, or <body>.
Wrap content in a single <article> root. Maintain professional tone and avoid fluff.`

export function buildGenerateBodyUserPrompt(options: { title: string; outlineHeadings: string[]; locale: string }) {
  const { title, outlineHeadings, locale } = options
  const bullets = outlineHeadings.map((heading) => `- ${heading}`).join('\n')
  return `Locale: ${locale}. Title: ${title}. Follow this outline:\n${bullets}\nReturn an HTML fragment only (no document wrappers). Wrap in <article>. No code fences. No JSON-LD.`
}
