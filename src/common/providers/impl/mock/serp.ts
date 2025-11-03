import type { SerpProvider, SerpSnapshot, SerpItem } from '../../interfaces/serp'
import { log } from '@src/common/logger'

/**
 * Mock SERP provider for testing
 * Returns fake search results related to interview preparation
 * Used when SERP mocking is enabled in dev
 */

/**
 * Generate mock SERP items based on keyword
 */
function generateMockSerpItems(keyword: string, topK: number): SerpItem[] {
  const lowerKeyword = keyword.toLowerCase()

  // Base competitor sites in the interview prep space
  const competitors = [
    {
      domain: 'interviewcake.com',
      title: 'Interview Cake - Master Coding Interviews',
      snippet: 'Get the skills you need to ace your technical interviews with our comprehensive coding interview prep course.'
    },
    {
      domain: 'leetcode.com',
      title: 'LeetCode - The World\'s Leading Online Programming Learning Platform',
      snippet: 'Level up your coding skills and quickly land a job. This is the best place to expand your knowledge and get prepared for your next interview.'
    },
    {
      domain: 'pramp.com',
      title: 'Pramp - Practice Mock Interviews & Coding Problems',
      snippet: 'Practice live interviews with peers for free. Get better at algorithmic and system design problems, and get hired.'
    },
    {
      domain: 'interviewbit.com',
      title: 'InterviewBit - Learn, Practice, and Master Coding Interviews',
      snippet: 'Prepare for tech interviews with coding problems, mock interviews, and algorithmic challenges.'
    },
    {
      domain: 'glassdoor.com',
      title: 'Interview Questions and Answers - Glassdoor',
      snippet: 'Prepare for your job interview with common questions, tips from employees, and insights into the interview process.'
    },
    {
      domain: 'indeed.com',
      title: 'Job Interview Tips: How to Make a Great Impression',
      snippet: 'Learn how to prepare for your interview, answer common questions, and make a lasting impression on hiring managers.'
    },
    {
      domain: 'themuse.com',
      title: 'The Ultimate Interview Guide - The Muse',
      snippet: 'Everything you need to know about preparing for interviews, from what to wear to how to answer tough questions.'
    },
    {
      domain: 'hackerrank.com',
      title: 'HackerRank - Practice Coding, Prepare for Interviews',
      snippet: 'Join over 21 million developers in solving code challenges on HackerRank, one of the best ways to prepare for programming interviews.'
    },
    {
      domain: 'geeksforgeeks.org',
      title: 'Interview Preparation - GeeksforGeeks',
      snippet: 'A comprehensive guide to preparing for technical interviews with tutorials, practice problems, and company-specific questions.'
    },
    {
      domain: 'medium.com',
      title: 'How to Prepare for Your Next Tech Interview',
      snippet: 'Practical tips and strategies for acing behavioral and technical interviews at top tech companies.'
    }
  ]

  const items: SerpItem[] = []

  // Adjust results based on keyword
  let relevantCompetitors = [...competitors]

  if (lowerKeyword.includes('behavioral')) {
    relevantCompetitors = relevantCompetitors.filter(c =>
      !['leetcode.com', 'hackerrank.com', 'geeksforgeeks.org'].includes(c.domain)
    )
  } else if (lowerKeyword.includes('technical') || lowerKeyword.includes('coding')) {
    relevantCompetitors = relevantCompetitors.filter(c =>
      ['leetcode.com', 'hackerrank.com', 'interviewcake.com', 'pramp.com', 'geeksforgeeks.org'].includes(c.domain)
    )
  }

  // Generate SERP items
  for (let i = 0; i < Math.min(topK, relevantCompetitors.length); i++) {
    const competitor = relevantCompetitors[i]
    if (!competitor) continue

    items.push({
      rank: i + 1,
      url: `https://${competitor.domain}/${lowerKeyword.replace(/\s+/g, '-')}`,
      title: competitor.title,
      snippet: competitor.snippet,
      types: i === 0 ? ['organic', 'featured'] : ['organic']
    })
  }

  // Fill remaining slots with generic results
  while (items.length < topK) {
    const rank = items.length + 1
    items.push({
      rank,
      url: `https://example-${rank}.com/${lowerKeyword.replace(/\s+/g, '-')}`,
      title: `${capitalize(keyword)} - Resource ${rank}`,
      snippet: `Comprehensive guide and resources for ${keyword}. Learn strategies, tips, and best practices.`,
      types: ['organic']
    })
  }

  return items
}

/**
 * Generate text dump from SERP items
 */
function generateTextDump(items: SerpItem[], keyword: string): string {
  const sections = items.map((item, index) => {
    return `=== Result ${index + 1}: ${item.title} ===
URL: ${item.url}
${item.snippet || 'No snippet available'}
`
  }).join('\n')

  return `Search results for "${keyword}"\nTotal results: ${items.length}\n\n${sections}`
}

/**
 * Mock SERP Provider Implementation
 */
export const mockSerpProvider: SerpProvider = {
  async ensure(args) {
    log.info('[MockSERP] Using mock SERP results for:', args.canon.phrase)

    const topK = args.topK || 10
    const items = generateMockSerpItems(args.canon.phrase, topK)
    const textDump = generateTextDump(items, args.canon.phrase)

    const snapshot: SerpSnapshot = {
      fetchedAt: new Date().toISOString(),
      engine: 'google',
      device: args.device || 'desktop',
      topK,
      items,
      textDump
    }

    return snapshot
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
