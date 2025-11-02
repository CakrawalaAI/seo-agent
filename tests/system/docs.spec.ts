import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const erd = readFileSync(join(root, 'docs/erd.md'), 'utf-8')
const seq = readFileSync(join(root, 'docs/sequence-diagram.md'), 'utf-8')
const spec = readFileSync(join(root, 'docs/spec.md'), 'utf-8')

const expectedTables = [
  'users',
  'user_auth_providers',
  'orgs',
  'org_members',
  'projects',
  'project_integrations',
  'keyword_canon',
  'keywords',
  'metric_cache',
  'articles',
  'article_attachments'
]

const removedTables = [
  'crawl_pages',
  'link_graph',
  'jobs',
  'serp_snapshot',
  'plan_items',
  'blobs',
  'sessions',
  'verifications',
  'org_usage'
]

describe('docs consistency', () => {
  it('ERD lists all current tables and omits legacy ones', () => {
    for (const table of expectedTables) {
      if (!erd.includes(table)) {
        throw new Error(`docs/erd.md is missing table reference: ${table}`)
      }
    }
    const removedSectionIndex = erd.indexOf('## Removed Tables')
    let beforeRemoved = removedSectionIndex >= 0 ? erd.slice(0, removedSectionIndex) : erd
    beforeRemoved = beforeRemoved.replace('logs/jobs.jsonl', '')
    for (const table of removedTables) {
      if (beforeRemoved.includes(table)) {
        throw new Error(`docs/erd.md mentions legacy table '${table}' outside the Removed Tables section`)
      }
    }
  })

  it('Sequence diagram references bundle-based workflow', () => {
    expect(seq).toContain('bundle')
    expect(seq).toContain('logs/jobs.jsonl')
    expect(seq).not.toContain('jobs table')
  })

  it('Spec lists all DataForSEO endpoints we rely on', () => {
    const endpoints = [
      '/v3/dataforseo_labs/google/keyword_overview/live',
      '/v3/dataforseo_labs/google/keywords_for_site/live',
      '/v3/dataforseo_labs/google/related_keywords/live',
      '/v3/dataforseo_labs/google/bulk_keyword_difficulty/live',
      '/v3/dataforseo_labs/google/keyword_suggestions/live',
      '/v3/keywords_data/google_ads/keywords_for_keywords/live',
      '/v3/keywords_data/google_ads/keyword_ideas/live',
      '/v3/serp/google/organic/live/regular'
    ]
    for (const endpoint of endpoints) {
      if (!spec.includes(endpoint)) {
        throw new Error(`docs/spec.md missing DataForSEO endpoint ${endpoint}`)
      }
    }
  })
})
