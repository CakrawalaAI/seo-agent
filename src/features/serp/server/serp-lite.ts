import { getSerpProvider } from '@common/providers/registry'
import * as bundle from '@common/bundle/store'
import { latestRunDir } from '@common/bundle/store'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

export type SerpLite = {
  fetchedAt: string
  engine: 'google'
  device: 'desktop' | 'mobile'
  topK: number
  features: {
    paa: boolean
    video: boolean
    local: boolean
    topStories: boolean
  }
  domainMix: {
    authorityShare: number // 0..1 fraction of top results from authority list
  }
  contentTypes: Record<string, number> // counts by {howto|list|review|comparison|reference|other}
}

const AUTHORITY_HOSTS = [
  'wikipedia.org','youtube.com','linkedin.com','facebook.com','twitter.com','x.com','medium.com','reddit.com','quora.com','nytimes.com','cnn.com','bbc.co.uk','forbes.com','amazon.com','apple.com','microsoft.com','google.com','docs.google.com','support.google.com','cloudflare.com'
]

function host(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

function classifyTitle(title?: string): 'howto'|'list'|'review'|'comparison'|'reference'|'other' {
  const t = (title || '').toLowerCase()
  if (/how to|step[- ]by[- ]step|tutorial/.test(t)) return 'howto'
  if (/best|top \d+|\d+ (tips|ways|ideas)/.test(t)) return 'list'
  if (/review|ratings|pros and cons/.test(t)) return 'review'
  if (/vs\.?|compare|comparison/.test(t)) return 'comparison'
  if (/what is|definition|explained|guide/.test(t)) return 'reference'
  return 'other'
}

export async function ensureSerpLite(phrase: string, language: string, locationCode: number, opts?: { device?: 'desktop'|'mobile'; topK?: number; cacheProjectId?: string }) {
  const topK = opts?.topK ?? 10
  const device = opts?.device || 'desktop'
  const h = createHash('sha1').update(`${phrase}|${language}|${locationCode}|${device}|lite`).digest('hex').slice(0, 12)
  // try cache (bundle) first
  try {
    const target = opts?.cacheProjectId ? String(opts.cacheProjectId) : 'global'
    const base = latestRunDir(target)
    const file = join(base, 'serp', `${h}.lite.json`)
    if (existsSync(file)) {
      const json = JSON.parse(readFileSync(file, 'utf-8'))
      const age = Date.now() - new Date(json?.fetchedAt || 0).getTime()
      const ttlMs = 14 * 86400000
      if (age < ttlMs) {
        return json as SerpLite
      }
    }
  } catch {}
  const provider = getSerpProvider()
  const snap = await provider.ensure({ canon: { phrase, language }, locationCode, device, topK })
  const types = new Set<string>()
  for (const it of snap.items) {
    for (const t of it.types || []) types.add(String(t))
  }
  const features = {
    paa: Array.from(types).some((t) => /people_also_ask/i.test(t)),
    video: Array.from(types).some((t) => /video/i.test(t)),
    local: Array.from(types).some((t) => /local/i.test(t)),
    topStories: Array.from(types).some((t) => /top_stories|news/i.test(t))
  }
  const hosts = snap.items.map((i) => host(i.url)).filter(Boolean)
  const authority = hosts.filter((h) => AUTHORITY_HOSTS.some((a) => h.endsWith(a))).length
  const authorityShare = hosts.length ? authority / hosts.length : 0
  const counts: Record<string, number> = { howto: 0, list: 0, review: 0, comparison: 0, reference: 0, other: 0 }
  for (const it of snap.items) counts[classifyTitle(it.title)]++
  const lite: SerpLite = { fetchedAt: snap.fetchedAt, engine: 'google', device: snap.device, topK: snap.topK, features, domainMix: { authorityShare }, contentTypes: counts }
  try {
    const target = opts?.cacheProjectId ? String(opts.cacheProjectId) : 'global'
    bundle.writeJson(target, `serp/${h}.lite.json`, { phrase, language, locationCode, ...lite })
  } catch {}
  return lite
}

export function computeRankability(lite: SerpLite): number {
  const topDomainPower = lite.domainMix.authorityShare // 0..1
  const contentMatch = (() => {
    const { howto, list, review, comparison, reference } = lite.contentTypes
    const max = Math.max(howto, list, review, comparison, reference, 1)
    // assume we can produce howto/list/reference well
    const favored = howto + list + reference
    return Math.min(1, favored / max)
  })()
  const ctrPotential = (() => {
    const penalties = [lite.features.video, lite.features.local, lite.features.topStories, lite.features.paa].filter(Boolean).length
    return Math.max(0, 1 - 0.15 * penalties)
  })()
  const gapScore = 0.5 // placeholder without headings
  const freshnessTilt = 0.5 // unavailable here
  const score =
    0.30 * (1 - topDomainPower) +
    0.20 * contentMatch +
    0.15 * ctrPotential +
    0.20 * gapScore +
    0.15 * freshnessTilt
  return Math.round(Math.max(0, Math.min(1, score)) * 100)
}
