import type { OpenAI } from 'openai'
import type {
  DraftTitleOutlineInput,
  DraftTitleOutlineResult,
  ExpandSeedsInput,
  GenerateArticleInput,
  GeneratedArticleResult,
  LLMProvider,
  SeedKeyword,
  SummarizeSiteInput,
  DiscoverySummary
} from './types.js'

const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'

const buildJsonPrompt = (instruction: string, payload: Record<string, unknown>) => {
  return `${instruction}\nInput:${JSON.stringify(payload)}`
}

const parseJson = <T>(value: string, fallback: T): T => {
  try {
    return JSON.parse(value) as T
  } catch (error) {
    return fallback
  }
}

export class OpenAILLMProvider implements LLMProvider {
  constructor(private readonly client: OpenAI, private readonly model: string = DEFAULT_MODEL) {}

  private async complete<T>(messages: Array<{ role: 'system' | 'user'; content: string }>, fallback: T): Promise<T> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      response_format: { type: 'json_object' }
    })
    const content = response.choices[0]?.message?.content
    if (!content) return fallback
    return parseJson<T>(content, fallback)
  }

  async summarizeSite(input: SummarizeSiteInput): Promise<DiscoverySummary> {
    const pages = input.pages.map((page) => ({
      url: page.url,
      title: page.title,
      description: page.description,
      excerpt: page.content.slice(0, 1000)
    }))

    const instruction = 'Summarize the business, audience, products, and up to five topic clusters in JSON format.'
    const fallback: DiscoverySummary = {
      businessSummary: 'Summary unavailable',
      audience: [],
      products: [],
      topicClusters: []
    }

    return this.complete<DiscoverySummary>(
      [
        { role: 'system', content: 'You are an SEO assistant returning strict JSON.' },
        { role: 'user', content: buildJsonPrompt(instruction, { locale: input.locale, pages }) }
      ],
      fallback
    )
  }

  async expandSeedKeywords(input: ExpandSeedsInput): Promise<SeedKeyword[]> {
    const instruction = 'Generate SEO keyword ideas with their parent topic as an array of {"keyword": string, "topic": string}'
    return this.complete<SeedKeyword[]>(
      [
        { role: 'system', content: 'You are an SEO assistant returning a JSON array of keyword objects.' },
        { role: 'user', content: buildJsonPrompt(instruction, input) }
      ],
      []
    )
  }

  async draftTitleOutline(input: DraftTitleOutlineInput): Promise<DraftTitleOutlineResult> {
    const instruction = 'Return a JSON object {"title": string, "outline": OutlineSection[]} with headings and subpoints.'
    return this.complete<DraftTitleOutlineResult>(
      [
        { role: 'system', content: 'You are an SEO assistant producing outlines in JSON.' },
        { role: 'user', content: buildJsonPrompt(instruction, input) }
      ],
      { title: input.keyword, outline: [] }
    )
  }

  async generateArticle(input: GenerateArticleInput): Promise<GeneratedArticleResult> {
    const instruction = 'Return JSON {"bodyHtml": string, "media": Array<{"src": string, "alt"?: string, "caption"?: string}>}'
    return this.complete<GeneratedArticleResult>(
      [
        { role: 'system', content: 'You craft full HTML articles and optional media suggestions in JSON.' },
        { role: 'user', content: buildJsonPrompt(instruction, input) }
      ],
      { bodyHtml: '' }
    )
  }
}
