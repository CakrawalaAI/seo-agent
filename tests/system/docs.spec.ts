import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const erd = readFileSync(join(root, 'docs/erd.md'), 'utf-8')
const seq = readFileSync(join(root, 'docs/sequence-diagram.md'), 'utf-8')

const expectedTables = [
  'users',
  'user_auth_providers',
  'organizations',
  'organization_members',
  'subscriptions',
  'websites',
  'integrations',
  'keywords',
  'articles',
  'article_attachments',
  'keyword_serp',
  'crawl_jobs',
  'crawl_pages'
]

const forbiddenTerms = [
  'projects',           // Replaced by websites
  'project_integrations', // Replaced by integrations
  'website_integrations',
  'website_keywords',
  'logs/jobs.jsonl'     // DB-only architecture
]

describe('docs consistency', () => {
  it('ERD lists all current tables (websites-first architecture)', () => {
    for (const table of expectedTables) {
      if (!erd.includes(table)) {
        throw new Error(`docs/erd.md is missing table reference: ${table}`)
      }
    }
  })

  it('ERD forbids legacy terminology (projects, bundle, logs)', () => {
    const removedSectionIndex = erd.indexOf('## Removed')
    let beforeRemoved = removedSectionIndex >= 0 ? erd.slice(0, removedSectionIndex) : erd

    for (const term of forbiddenTerms) {
      if (beforeRemoved.includes(term)) {
        throw new Error(`docs/erd.md mentions forbidden term '${term}' (should be in Removed/Legacy section only)`)
      }
    }
  })

  it('Sequence diagram enforces DB-only (no bundle, no filesystem artifacts)', () => {
    expect(seq.toLowerCase()).toContain('db-only')
    expect(seq.toLowerCase()).toContain('stateless')
    expect(seq.toLowerCase()).toContain('no filesystem bundles')
    expect(seq.toLowerCase()).not.toContain('logs/jobs.jsonl')
    expect(seq.toLowerCase()).toContain('postgres')
  })

  it('Sequence diagram uses websites terminology (not projects)', () => {
    // Check for forbidden old terminology
    const projectMatches = seq.match(/\bprojects?\b/gi) || []
    // Filter out allowed contexts (like "Process Contracts" section title)
    const forbiddenMatches = projectMatches.filter(m =>
      !seq.includes('Process Contracts') ||
      seq.indexOf(m) < seq.indexOf('Process Contracts')
    )
    if (forbiddenMatches.length > 0) {
      throw new Error(`docs/sequence-diagram.md uses forbidden term "project(s)" instead of "website(s)"`)
    }

    // Verify websites terminology is present
    expect(seq).toContain('websites')
    expect(seq).toContain('website_')
  })

  it('Sequence diagram lists all DataForSEO endpoints we rely on', () => {
    const endpoints = [
      '/v3/dataforseo_labs/google/keyword_ideas/live',
      '/v3/serp/google/organic/live/regular'
    ]
    for (const endpoint of endpoints) {
      if (!seq.includes(endpoint)) {
        throw new Error(`docs/sequence-diagram.md missing DataForSEO endpoint ${endpoint}`)
      }
    }
  })

  it('Sequence diagram documents queue names correctly', () => {
    expect(seq).toContain('seo.jobs')
    expect(seq).toContain('seo_jobs.crawler')
    expect(seq).toContain('seo_jobs.general')
  })

  it('Sequence diagram cross-references erd.md for schemas', () => {
    expect(seq).toContain('docs/erd.md')
  })
})
