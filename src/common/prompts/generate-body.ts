export const GENERATE_BODY_SYSTEM_PROMPT = `You are an experienced content writer. Produce well-structured HTML articles that align with provided outlines, maintain professional tone, and avoid fluff.`

export function buildGenerateBodyUserPrompt(options: { title: string; outlineHeadings: string[]; locale: string }) {
  const { title, outlineHeadings, locale } = options
  const bullets = outlineHeadings.map((heading) => `- ${heading}`).join('\n')
  return `Locale: ${locale}. Title: ${title}. Follow this outline:\n${bullets}\nReturn only HTML markup (no markdown).`
}
