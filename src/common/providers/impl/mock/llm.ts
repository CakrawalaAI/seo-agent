import type { LlmProvider } from '../../interfaces/llm'
import type { ArticleOutlineSection } from '@entities/article/domain/article'

/**
 * Mock LLM provider for PrepInterview.ai
 * Returns realistic, topic-aware content without OpenAI API calls
 * Used when LLM mocking is enabled in dev
 */

const PREPINTERVIEW_BUSINESS_SUMMARY = `PrepInterview.ai is an AI-powered interview preparation platform that helps job seekers master behavioral, technical, and system design interviews. The platform offers personalized mock interviews, real-time feedback using the STAR method, and comprehensive resources for FAANG interview preparation. Target audience includes software engineers, product managers, and other tech professionals preparing for competitive job interviews.`

const PREPINTERVIEW_TOPIC_CLUSTERS = [
  'Interview Preparation',
  'Behavioral Interview Techniques',
  'Technical Interview Practice',
  'FAANG Interview Strategy',
  'Mock Interview Coaching'
]

const PREPINTERVIEW_KEYWORDS = [
  'interview prep platform',
  'behavioral interview practice',
  'ai interview coach',
  'mock interview questions',
  'faang interview prep',
  'star method examples',
  'technical interview guide',
  'system design interview',
  'coding interview practice',
  'interview feedback tool',
  'google interview prep',
  'amazon interview questions',
  'interview preparation tips',
  'common interview questions',
  'interview practice online',
  'ai mock interviewer',
  'interview coaching platform',
  'behavioral questions examples',
  'technical screening prep',
  'interview confidence building'
]

/**
 * Detect topic category from keyword
 */
function detectTopic(keyword: string): 'behavioral' | 'technical' | 'faang' | 'system-design' | 'general' {
  const lower = keyword.toLowerCase()

  if (lower.match(/behavioral|star|soft skill|leadership|conflict|team/i)) {
    return 'behavioral'
  }
  if (lower.match(/technical|coding|algorithm|data structure|leetcode|programming/i)) {
    return 'technical'
  }
  if (lower.match(/faang|google|amazon|meta|apple|netflix|microsoft/i)) {
    return 'faang'
  }
  if (lower.match(/system design|architecture|scalab|distributed/i)) {
    return 'system-design'
  }

  return 'general'
}

/**
 * Generate topic-aware article outline
 */
function generateOutline(keyword: string, topic: string): ArticleOutlineSection[] {
  const templates: Record<string, ArticleOutlineSection[]> = {
    behavioral: [
      { heading: 'What Are Behavioral Interviews?' },
      { heading: 'Why Companies Use Behavioral Questions' },
      { heading: 'The STAR Method Framework' },
      { heading: 'Common Behavioral Interview Questions' },
      { heading: 'Example Answers Using STAR' },
      { heading: 'How to Prepare Your Stories' },
      { heading: 'Practice Tips and Resources' }
    ],
    technical: [
      { heading: 'Technical Interview Overview' },
      { heading: 'Essential Data Structures to Master' },
      { heading: 'Common Algorithm Patterns' },
      { heading: 'Problem-Solving Framework' },
      { heading: 'Time and Space Complexity Analysis' },
      { heading: 'Practice Problems and Solutions' },
      { heading: 'Interview Day Tips' }
    ],
    faang: [
      { heading: 'What Makes FAANG Interviews Different' },
      { heading: 'Interview Process Breakdown' },
      { heading: 'Key Assessment Criteria' },
      { heading: 'Preparation Timeline and Strategy' },
      { heading: 'Company-Specific Tips and Insights' },
      { heading: 'Common Mistakes to Avoid' },
      { heading: 'Resources for Success' }
    ],
    'system-design': [
      { heading: 'System Design Interview Fundamentals' },
      { heading: 'Gathering Requirements' },
      { heading: 'High-Level Architecture' },
      { heading: 'Component Design and APIs' },
      { heading: 'Scaling and Performance' },
      { heading: 'Trade-offs and Design Decisions' },
      { heading: 'Practice Problems' }
    ],
    general: [
      { heading: 'Introduction' },
      { heading: 'Understanding the Interview Process' },
      { heading: 'Key Preparation Strategies' },
      { heading: 'Common Interview Formats' },
      { heading: 'Tips for Success' },
      { heading: 'Practice and Resources' }
    ]
  }

  return templates[topic] || templates.general
}

/**
 * Generate topic-aware article HTML
 */
function generateArticleHtml(title: string, outline: ArticleOutlineSection[], topic: string): string {
  const sections = outline.map(section => {
    const content = generateSectionContent(section.heading, topic)
    return `<section>
  <h2>${section.heading}</h2>
  ${content}
</section>`
  }).join('\n\n')

  return `<article>
<h1>${title}</h1>

<p><em>Master your interview preparation with PrepInterview.ai's AI-powered coaching platform. Get personalized feedback, practice with realistic scenarios, and build confidence for your next interview.</em></p>

${sections}

<section>
  <h2>Practice with PrepInterview.ai</h2>
  <p>Ready to take your interview preparation to the next level? PrepInterview.ai offers:</p>
  <ul>
    <li><strong>AI Mock Interviews</strong> - Practice with our intelligent interviewer that adapts to your responses</li>
    <li><strong>Personalized Feedback</strong> - Get detailed analysis of your answers and areas for improvement</li>
    <li><strong>Company-Specific Prep</strong> - Prepare with questions tailored to your target companies</li>
    <li><strong>Progress Tracking</strong> - Monitor your improvement and identify strengths and weaknesses</li>
  </ul>
  <p>Start practicing today and land your dream job with confidence.</p>
</section>
</article>`
}

/**
 * Generate content for a section based on heading and topic
 */
function generateSectionContent(heading: string, topic: string): string {
  const headingLower = heading.toLowerCase()

  // Generic intro-type sections
  if (headingLower.includes('introduction') || headingLower.includes('overview')) {
    return `<p>Interview preparation is crucial for landing competitive tech roles. Understanding the format, expectations, and strategies can make the difference between success and disappointment. This guide will help you prepare effectively and perform with confidence.</p>
<p>Whether you're interviewing at a startup or a major tech company, the fundamentals remain consistent: clear communication, structured thinking, and thorough preparation.</p>`
  }

  // STAR method sections
  if (headingLower.includes('star')) {
    return `<p>The STAR method is a proven framework for answering behavioral questions effectively:</p>
<ul>
  <li><strong>Situation</strong> - Set the context and provide relevant background</li>
  <li><strong>Task</strong> - Explain your responsibility or goal</li>
  <li><strong>Action</strong> - Detail the specific steps you took</li>
  <li><strong>Result</strong> - Share the outcomes and what you learned</li>
</ul>
<p>Using this structure ensures your answers are complete, compelling, and easy for interviewers to evaluate.</p>`
  }

  // Common questions sections
  if (headingLower.includes('common') && headingLower.includes('question')) {
    return `<p>Here are frequently asked interview questions you should prepare for:</p>
<ul>
  <li>Tell me about a time you faced a conflict with a team member</li>
  <li>Describe a situation where you failed and what you learned</li>
  <li>Give an example of when you showed leadership</li>
  <li>Tell me about a difficult decision you had to make</li>
  <li>Describe a time you received critical feedback</li>
</ul>
<p>For each question type, prepare 2-3 stories that demonstrate different competencies.</p>`
  }

  // Technical/data structures sections
  if (headingLower.includes('data structure') || headingLower.includes('algorithm')) {
    return `<p>Mastering fundamental data structures is essential for technical interviews. Focus on:</p>
<ul>
  <li><strong>Arrays and Strings</strong> - Two-pointer techniques, sliding windows, string manipulation</li>
  <li><strong>Linked Lists</strong> - Traversal, reversal, cycle detection with fast/slow pointers</li>
  <li><strong>Trees and Graphs</strong> - BFS, DFS, binary trees, and graph traversal algorithms</li>
  <li><strong>Hash Tables</strong> - Efficient lookups and optimizing time complexity</li>
  <li><strong>Stacks and Queues</strong> - LIFO/FIFO operations and practical applications</li>
</ul>
<p>Practice implementing these structures from scratch and solving problems that use them.</p>`
  }

  // FAANG-specific sections
  if (headingLower.includes('faang') || headingLower.includes('company')) {
    return `<p>FAANG companies (Facebook/Meta, Amazon, Apple, Netflix, Google) have rigorous interview processes with high standards:</p>
<ul>
  <li><strong>Multiple rounds</strong> - Expect 4-6 interview rounds including phone screens, technical interviews, and behavioral assessments</li>
  <li><strong>Bar raiser interviews</strong> - Some companies use experienced interviewers to maintain hiring quality</li>
  <li><strong>Leadership principles</strong> - Amazon emphasizes their 16 leadership principles throughout the process</li>
  <li><strong>System design focus</strong> - Senior positions will have dedicated system design rounds</li>
</ul>
<p>Research your target company's specific process and tailor your preparation accordingly.</p>`
  }

  // System design sections
  if (headingLower.includes('system design') || headingLower.includes('architecture')) {
    return `<p>System design interviews assess your ability to architect scalable solutions. Key steps include:</p>
<ol>
  <li><strong>Clarify requirements</strong> - Ask about functional and non-functional requirements, scale, and constraints</li>
  <li><strong>High-level design</strong> - Sketch the main components and how they interact</li>
  <li><strong>Deep dive</strong> - Discuss data models, APIs, and specific component implementations</li>
  <li><strong>Address bottlenecks</strong> - Identify potential issues and propose solutions for scalability</li>
</ol>
<p>Focus on trade-offs, justify your decisions, and demonstrate understanding of distributed systems concepts.</p>`
  }

  // Tips and preparation sections
  if (headingLower.includes('tip') || headingLower.includes('prepare') || headingLower.includes('practice')) {
    return `<p>Effective interview preparation requires consistent practice and strategic focus:</p>
<ul>
  <li><strong>Start early</strong> - Begin preparing 2-3 months before your target interview dates</li>
  <li><strong>Practice regularly</strong> - Set aside dedicated time each day for mock interviews and problem-solving</li>
  <li><strong>Get feedback</strong> - Practice with peers or use platforms like PrepInterview.ai for structured feedback</li>
  <li><strong>Review fundamentals</strong> - Don't skip basic concepts; interviewers often test foundational knowledge</li>
  <li><strong>Simulate real conditions</strong> - Practice with time constraints and without referring to solutions</li>
</ul>
<p>Consistency and deliberate practice are more valuable than cramming before your interview.</p>`
  }

  // Default content
  return `<p>This is an important aspect of interview preparation that candidates should understand thoroughly. Proper preparation in this area can significantly improve your performance and confidence during the actual interview.</p>
<p>Take time to study this topic, practice with real examples, and seek feedback on your approach. The investment in preparation will pay dividends when you're sitting across from your interviewer.</p>`
}

/**
 * Mock LLM Provider Implementation
 */
export const mockLlmProvider: LlmProvider = {
  async summarize(pages) {
    console.info('[MockLLM] Using mock site summary (dev mock enabled)')

    // Return PrepInterview business summary regardless of input
    return {
      businessSummary: PREPINTERVIEW_BUSINESS_SUMMARY,
      topicClusters: PREPINTERVIEW_TOPIC_CLUSTERS
    }
  },

  async pickTopFromSitemapString(siteUrl: string, listString: string, maxN: number): Promise<string[]> {
    console.info('[MockLLM] pickTopFromSitemapString (mock)')
    return listString
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, Math.max(1, Math.min(100, maxN || 100)))
  },

  async rankRepresentatives(siteUrl: string, candidates: string[], maxN: number): Promise<string[]> {
    console.info('[MockLLM] Using mock representative selection')

    // Return typical important pages for a SaaS product
    const preferred = [
      '/',
      '/features',
      '/pricing',
      '/blog',
      '/resources/behavioral',
      '/resources/technical',
      '/resources/system-design',
      '/about',
      '/contact'
    ]

    const result: string[] = []
    const n = Math.min(maxN, candidates.length)

    // Add preferred URLs if they exist in candidates
    for (const path of preferred) {
      if (result.length >= n) break
      const fullUrl = candidates.find(c => c.endsWith(path) || c.includes(path))
      if (fullUrl && !result.includes(fullUrl)) {
        result.push(fullUrl)
      }
    }

    // Fill remaining slots with first N candidates
    for (const url of candidates) {
      if (result.length >= n) break
      if (!result.includes(url)) {
        result.push(url)
      }
    }

    return result.slice(0, n)
  },

  async draftOutline(keyword: string, locale: string) {
    console.info('[MockLLM] Using mock outline generation for:', keyword)

    const topic = detectTopic(keyword)
    const outline = generateOutline(keyword, topic)

    // Generate a natural title based on the keyword
    const titleTemplates = {
      behavioral: `Mastering Behavioral Interviews: ${capitalize(keyword)}`,
      technical: `Complete Technical Interview Guide: ${capitalize(keyword)}`,
      faang: `How to Ace Your ${capitalize(keyword)}: Complete Strategy`,
      'system-design': `System Design Interview Guide: ${capitalize(keyword)}`,
      general: `Complete Guide to ${capitalize(keyword)}`
    }

    const title = titleTemplates[topic] || `${capitalize(keyword)}: Interview Preparation Guide`

    return { title, outline }
  },

  async generateBody(args) {
    console.info('[MockLLM] Using mock body generation for:', args.title)

    // Extract keyword from title or use title itself
    const keyword = args.title.toLowerCase()
    const topic = detectTopic(keyword)
    const bodyHtml = generateArticleHtml(args.title, args.outline, topic)

    return { bodyHtml }
  },

  async summarizeWebsiteDump(siteUrl: string, dumpString: string): Promise<string> {
    console.info('[MockLLM] summarizeWebsiteDump (mock)')
    return PREPINTERVIEW_BUSINESS_SUMMARY
  },

  async factCheck(args) {
    console.info('[MockLLM] Using mock fact-check')

    // Mock always returns a good score since we're using curated content
    return {
      score: 85,
      notes: 'Mock fact-check: Content appears well-structured with relevant interview preparation information.'
    }
  }
}

/**
 * Generate seed keywords for mock LLM
 */
export function mockExpandSeeds(clusters: string[], locale: string = 'en-US'): string[] {
  console.info('[MockLLM] Using mock seed expansion for clusters:', clusters.length)

  // Return PrepInterview keywords that are relevant to the clusters
  // In a real scenario, we'd filter based on cluster relevance
  return PREPINTERVIEW_KEYWORDS.slice(0, 20)
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
