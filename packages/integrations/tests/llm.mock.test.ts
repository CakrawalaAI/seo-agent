import { describe, expect, it } from 'vitest'
import { MockLLMProvider } from '../src/llm/mock.js'

const provider = new MockLLMProvider()

describe('MockLLMProvider', () => {
  it('summarizes site content deterministically', async () => {
    const summary = await provider.summarizeSite({
      projectId: 'proj-1',
      locale: 'en',
      pages: [
        {
          url: 'https://example.com/about',
          title: 'About Example | Company',
          description: 'Learn about Example Co',
          content: 'Example Co helps customers grow with data-driven marketing solutions.'
        }
      ]
    })

    expect(summary.businessSummary).toContain('example.com')
    expect(summary.topicClusters.length).toBeGreaterThan(0)
  })

  it('produces seed keywords using topic clusters', async () => {
    const seeds = await provider.expandSeedKeywords({
      projectId: 'proj-1',
      locale: 'en',
      topicClusters: ['Demand generation'],
      maxKeywords: 5
    })

    expect(seeds).toHaveLength(5)
    expect(seeds[0]?.topic).toBe('Demand generation')
  })

  it('generates deterministic outlines and HTML', async () => {
    const outline = await provider.draftTitleOutline({ keyword: 'growth marketing', locale: 'en' })
    expect(outline.title).toContain('Growth Marketing')
    expect(outline.outline.length).toBeGreaterThan(0)

    const article = await provider.generateArticle({
      title: outline.title,
      outline: outline.outline,
      keyword: 'growth marketing',
      locale: 'en'
    })

    expect(article.bodyHtml).toContain('<h1>')
    expect(article.bodyHtml.toLowerCase()).toContain('growth marketing')
  })
})
