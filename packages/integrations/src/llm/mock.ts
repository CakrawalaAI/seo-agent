import crypto from 'node:crypto'
import type {
  DraftTitleOutlineInput,
  DraftTitleOutlineResult,
  ExpandSeedsInput,
  GeneratedArticleResult,
  GenerateArticleInput,
  LLMProvider,
  OutlineSection,
  SeedKeyword,
  SummarizeSiteInput,
  DiscoverySummary
} from './types.js'

const deterministicShuffle = <T>(items: T[], seed: string): T[] => {
  const shuffled = [...items]
  let state = crypto.createHash('sha256').update(seed).digest()
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const byteIndex = i % state.length
    const randomByte = state[byteIndex]
    if (i % state.length === 0) {
      state = crypto.createHash('sha256').update(state).digest()
    }
    const j = randomByte % (i + 1)
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

const defaultAudience = [
  'Decision makers researching solutions',
  'Practitioners seeking implementation advice',
  'Existing customers looking for best practices'
]

const defaultProducts = [
  'Managed services',
  'Consulting retainers',
  'Platform subscriptions'
]

const buildOutline = (keyword: string): OutlineSection[] => [
  {
    heading: `Overview of ${keyword}`,
    subpoints: ['Why it matters', 'Key concepts']
  },
  {
    heading: `Implementing ${keyword}`,
    subpoints: ['Step-by-step guidance', 'Common pitfalls']
  },
  {
    heading: `Measuring success with ${keyword}`,
    subpoints: ['KPIs to watch', 'Tooling checklist']
  }
]

export class MockLLMProvider implements LLMProvider {
  async summarizeSite(input: SummarizeSiteInput): Promise<DiscoverySummary> {
    const firstPage = input.pages[0]
    let hostname = 'your business'
    if (firstPage?.url) {
      try {
        hostname = new URL(firstPage.url).hostname
      } catch (error) {
        hostname = firstPage.url
      }
    }
    const topicClusters = Array.from(
      new Set(
        input.pages
          .flatMap((page) => page.title?.split(/[-|]/g) ?? [])
          .map((segment) => segment.trim())
          .filter((segment) => segment.length > 4)
      )
    )

    const selectedClusters = topicClusters.length > 0
      ? deterministicShuffle(topicClusters, hostname).slice(0, 5)
      : ['Growth marketing fundamentals', 'Customer success stories', 'Product onboarding']

    return {
      businessSummary: `SEO Agent identified ${hostname} as a growth-focused business with emphasis on ${selectedClusters[0]}.`,
      audience: deterministicShuffle(defaultAudience, hostname).slice(0, 3),
      products: deterministicShuffle(defaultProducts, hostname).slice(0, 2),
      topicClusters: selectedClusters
    }
  }

  async expandSeedKeywords(input: ExpandSeedsInput): Promise<SeedKeyword[]> {
    const seeds: SeedKeyword[] = []
    const clusterPool = input.topicClusters.length > 0 ? input.topicClusters : ['Growth marketing']
    let counter = 1
    for (const cluster of clusterPool) {
      const perCluster = Math.ceil(input.maxKeywords / clusterPool.length)
      for (let i = 0; i < perCluster; i += 1) {
        if (seeds.length >= input.maxKeywords) break
        const keyword = `${cluster} idea ${counter}`.toLowerCase()
        seeds.push({ keyword, topic: cluster })
        counter += 1
      }
    }
    return seeds.slice(0, input.maxKeywords)
  }

  async draftTitleOutline(input: DraftTitleOutlineInput): Promise<DraftTitleOutlineResult> {
    const title = `${input.keyword.replace(/\b\w/g, (char) => char.toUpperCase())}: Complete Guide`
    return {
      title,
      outline: buildOutline(input.keyword)
    }
  }

  async generateArticle(input: GenerateArticleInput): Promise<GeneratedArticleResult> {
    const blocks: string[] = []
    blocks.push(`<h1>${input.title}</h1>`)
    blocks.push(`<p>This article explores ${input.keyword} for ${input.locale.toUpperCase()} audiences.</p>`)

    for (const section of input.outline) {
      blocks.push(`<h2>${section.heading}</h2>`)
      blocks.push(`<p>${section.heading} matters for ${input.keyword} initiatives.</p>`)
      if (section.subpoints?.length) {
        const items = section.subpoints.map((point) => `<li>${point}</li>`).join('')
        blocks.push(`<ul>${items}</ul>`)
      }
    }

    return {
      bodyHtml: blocks.join('')
    }
  }
}
