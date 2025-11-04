import type { CrawlPage } from '@entities/crawl/domain/page'

/**
 * Mock crawler for PrepInterview.ai - returns hardcoded pages
 * Used when crawler mocking is enabled in dev
 */

const PREPINTERVIEW_PAGES: Array<Omit<CrawlPage, 'id' | 'websiteId' | 'createdAt' | 'updatedAt'>> = [
  {
    url: 'https://prepinterview.ai/',
    depth: 0,
    httpStatus: 200,
    status: 'completed',
    extractedAt: new Date().toISOString(),
    metaJson: {
      title: 'PrepInterview.ai - AI-Powered Interview Preparation Platform',
      description: 'Master your next interview with AI-powered mock interviews, personalized feedback, and comprehensive preparation resources.'
    },
    headingsJson: [
      { level: 1, text: 'AI-Powered Interview Preparation' },
      { level: 2, text: 'Practice with Realistic Mock Interviews' },
      { level: 2, text: 'Get Personalized Feedback' },
      { level: 2, text: 'Prepare for FAANG Companies' },
      { level: 3, text: 'Behavioral Interview Practice' },
      { level: 3, text: 'Technical Interview Prep' },
      { level: 3, text: 'System Design Questions' }
    ],
    linksJson: [
      { href: 'https://prepinterview.ai/features', text: 'Features' },
      { href: 'https://prepinterview.ai/pricing', text: 'Pricing' },
      { href: 'https://prepinterview.ai/blog', text: 'Interview Tips' },
      { href: 'https://prepinterview.ai/resources/behavioral', text: 'Behavioral Interview Guide' }
    ],
    contentText: `PrepInterview.ai - Your AI Interview Coach

Master your next interview with AI-powered preparation. Our platform provides realistic mock interviews, personalized feedback, and comprehensive resources to help you succeed.

Practice with Realistic Mock Interviews
Experience real interview scenarios with our AI interviewer. Get asked questions tailored to your target role and company. Practice as many times as you need.

Get Personalized Feedback
Receive detailed analysis of your answers using the STAR method. Identify areas for improvement and track your progress over time.

Prepare for FAANG Companies
Specialized preparation for Google, Amazon, Meta, Apple, and other top tech companies. Learn what interviewers are looking for.

Behavioral Interview Practice
Master the STAR method and practice common behavioral questions. Learn how to structure compelling stories from your experience.

Technical Interview Prep
Coding challenges, algorithm questions, and data structure problems. Practice with hints and detailed solutions.

System Design Questions
Learn to design scalable systems. Practice with real-world scenarios and get feedback on your architecture decisions.`,
    contentBlobUrl: null
  },
  {
    url: 'https://prepinterview.ai/features',
    depth: 1,
    httpStatus: 200,
    status: 'completed',
    extractedAt: new Date().toISOString(),
    metaJson: {
      title: 'Features - PrepInterview.ai',
      description: 'Explore our AI-powered mock interviews, personalized feedback, and comprehensive interview preparation tools.'
    },
    headingsJson: [
      { level: 1, text: 'Platform Features' },
      { level: 2, text: 'AI Mock Interviewer' },
      { level: 2, text: 'Personalized Feedback Engine' },
      { level: 2, text: 'Interview Question Database' },
      { level: 2, text: 'Progress Tracking' },
      { level: 3, text: 'Company-Specific Prep' },
      { level: 3, text: 'Role-Based Questions' }
    ],
    linksJson: [
      { href: 'https://prepinterview.ai/', text: 'Home' },
      { href: 'https://prepinterview.ai/pricing', text: 'Pricing' }
    ],
    contentText: `Platform Features

AI Mock Interviewer
Practice with our advanced AI that conducts realistic interviews. Get asked follow-up questions and experience the pressure of a real interview.

Personalized Feedback Engine
Our AI analyzes your responses and provides detailed feedback on structure, content, and delivery. Learn what works and what doesn't.

Interview Question Database
Access thousands of real interview questions from top companies. Filter by role, level, and company.

Progress Tracking
Monitor your improvement over time. See which question types you excel at and where you need more practice.

Company-Specific Prep
Prepare for specific companies with curated question sets and insider tips. Know what to expect at Google, Amazon, Meta, and more.

Role-Based Questions
Get questions tailored to your target role - software engineer, product manager, data scientist, or other positions.`,
    contentBlobUrl: null
  },
  {
    url: 'https://prepinterview.ai/resources/behavioral',
    depth: 1,
    httpStatus: 200,
    status: 'completed',
    extractedAt: new Date().toISOString(),
    metaJson: {
      title: 'Behavioral Interview Guide - PrepInterview.ai',
      description: 'Complete guide to acing behavioral interviews using the STAR method with examples and practice questions.'
    },
    headingsJson: [
      { level: 1, text: 'Behavioral Interview Guide' },
      { level: 2, text: 'What Are Behavioral Interviews?' },
      { level: 2, text: 'The STAR Method' },
      { level: 3, text: 'Situation' },
      { level: 3, text: 'Task' },
      { level: 3, text: 'Action' },
      { level: 3, text: 'Result' },
      { level: 2, text: 'Common Behavioral Questions' },
      { level: 2, text: 'How to Prepare' }
    ],
    linksJson: [
      { href: 'https://prepinterview.ai/', text: 'Home' },
      { href: 'https://prepinterview.ai/resources/technical', text: 'Technical Interview Guide' }
    ],
    contentText: `Behavioral Interview Guide

What Are Behavioral Interviews?
Behavioral interviews assess how you've handled situations in the past to predict future performance. Interviewers ask about specific experiences to evaluate your skills, judgment, and cultural fit.

The STAR Method
STAR is a framework for structuring your answers to behavioral questions. It ensures you provide complete, compelling responses.

Situation
Set the context. Describe the situation or challenge you faced. Be specific about when and where this occurred.

Task
Explain your responsibility or goal in that situation. What needed to be accomplished?

Action
Detail the specific actions you took. Focus on YOUR contributions, not the team's.

Result
Share the outcomes. Quantify results when possible. What did you learn?

Common Behavioral Questions
- Tell me about a time you faced a conflict with a team member
- Describe a situation where you failed
- Give an example of when you showed leadership
- Tell me about a difficult decision you made
- Describe a time you received critical feedback

How to Prepare
Prepare 5-7 stories covering different competencies: leadership, conflict resolution, problem-solving, teamwork, and failure. Practice telling these stories concisely.`,
    contentBlobUrl: null
  },
  {
    url: 'https://prepinterview.ai/resources/technical',
    depth: 1,
    httpStatus: 200,
    status: 'completed',
    extractedAt: new Date().toISOString(),
    metaJson: {
      title: 'Technical Interview Guide - PrepInterview.ai',
      description: 'Comprehensive guide to technical coding interviews with data structures, algorithms, and problem-solving strategies.'
    },
    headingsJson: [
      { level: 1, text: 'Technical Interview Guide' },
      { level: 2, text: 'What to Expect' },
      { level: 2, text: 'Essential Data Structures' },
      { level: 3, text: 'Arrays and Strings' },
      { level: 3, text: 'Linked Lists' },
      { level: 3, text: 'Trees and Graphs' },
      { level: 3, text: 'Hash Tables' },
      { level: 2, text: 'Common Algorithm Patterns' },
      { level: 2, text: 'Problem-Solving Framework' }
    ],
    linksJson: [
      { href: 'https://prepinterview.ai/', text: 'Home' },
      { href: 'https://prepinterview.ai/resources/behavioral', text: 'Behavioral Guide' },
      { href: 'https://prepinterview.ai/resources/system-design', text: 'System Design Guide' }
    ],
    contentText: `Technical Interview Guide

What to Expect
Technical interviews typically involve coding challenges where you solve problems on a whiteboard or in a shared editor. Interviewers assess problem-solving skills, coding ability, and communication.

Essential Data Structures
Master these core data structures that appear in most coding interviews.

Arrays and Strings
Foundation of many problems. Learn two-pointer techniques, sliding windows, and manipulation patterns.

Linked Lists
Understand traversal, reversal, and cycle detection. Practice fast/slow pointer techniques.

Trees and Graphs
Binary trees, BSTs, and graph traversal (BFS, DFS). Essential for many interview problems.

Hash Tables
Key for optimization. Learn when and how to use hash maps to improve time complexity.

Common Algorithm Patterns
- Two pointers for array problems
- Sliding window for substring problems
- Fast/slow pointers for linked lists
- BFS/DFS for trees and graphs
- Dynamic programming for optimization
- Binary search for sorted data

Problem-Solving Framework
1. Clarify the problem and constraints
2. Work through examples
3. Discuss approaches and trade-offs
4. Write clean, working code
5. Test with edge cases
6. Analyze time and space complexity`,
    contentBlobUrl: null
  },
  {
    url: 'https://prepinterview.ai/pricing',
    depth: 1,
    httpStatus: 200,
    status: 'completed',
    extractedAt: new Date().toISOString(),
    metaJson: {
      title: 'Pricing - PrepInterview.ai',
      description: 'Affordable interview preparation plans with unlimited practice and personalized feedback.'
    },
    headingsJson: [
      { level: 1, text: 'Simple, Transparent Pricing' },
      { level: 2, text: 'Free Plan' },
      { level: 2, text: 'Pro Plan' },
      { level: 2, text: 'Enterprise' }
    ],
    linksJson: [
      { href: 'https://prepinterview.ai/', text: 'Home' },
      { href: 'https://prepinterview.ai/features', text: 'Features' }
    ],
    contentText: `Simple, Transparent Pricing

Free Plan
Get started with basic interview practice. 5 mock interviews per month. Access to question database. Community support.

Pro Plan
Unlimited mock interviews. Personalized AI feedback. Company-specific prep. Priority support. $29/month or $290/year.

Enterprise
Custom solutions for teams. Admin dashboard. Usage analytics. SSO integration. Dedicated support. Contact sales for pricing.`,
    contentBlobUrl: null
  }
]

export interface MockCrawlResult {
  pages: CrawlPage[]
  urlsVisited: number
}

/**
 * Generate mock crawl pages for PrepInterview.ai
 * Returns realistic pages without making actual HTTP requests
 */
export function generateMockCrawl(websiteId: string, budget: number = 20): MockCrawlResult {
  const now = new Date().toISOString()

  // Take up to budget pages from our hardcoded set
  const selectedPages = PREPINTERVIEW_PAGES.slice(0, Math.min(budget, PREPINTERVIEW_PAGES.length))

  const pages: CrawlPage[] = selectedPages.map((template, index) => ({
    ...template,
    id: `mock_crawl_${websiteId}_${index}_${Date.now().toString(36)}`,
    websiteId,
    extractedAt: now,
    createdAt: now,
    updatedAt: now
  }))

  return {
    pages,
    urlsVisited: pages.length
  }
}

/**
 * Get mock representatives for crawl budget planning
 */
export function getMockRepresentatives(siteUrl: string, budget: number): string[] {
  return PREPINTERVIEW_PAGES
    .slice(0, Math.min(budget, PREPINTERVIEW_PAGES.length))
    .map(p => p.url)
}
