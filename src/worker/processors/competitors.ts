import { ensureCanon } from '@features/keyword/server/ensureCanon'
import { ensureSerp } from '@features/serp/server/ensureSerp'
import type { SerpItem } from '@common/providers/interfaces/serp'
import { saveText } from '@common/blob/store'
import { env } from '@common/infra/env'
import * as bundle from '@common/bundle/store'

function sameHost(a: string, b: string) {
  try { return new URL(a).host === new URL(b).host } catch { return false }
}

export async function processCompetitors(payload: { projectId: string; siteUrl: string; canonPhrase: string; language: string; locationCode: number; device?: 'desktop'|'mobile'; topK?: number }) {
  const canon = await ensureCanon(payload.canonPhrase, payload.language)
  const snap = await ensureSerp({ canon: { id: canon.id, phrase: payload.canonPhrase, language: payload.language }, locationCode: payload.locationCode, device: payload.device, topK: payload.topK })
  const baseHost = payload.siteUrl
  const urls = (snap.items || [])
    .filter((i: SerpItem) => i.url && !sameHost(i.url, baseHost))
    .slice(0, Math.max(1, Math.min(10, payload.topK || 10)))
    .map((i: SerpItem) => i.url)
  const rows: Array<{ url: string; title?: string; textDump?: string }> = []
  // Prefer Playwright if available
  let chromium: any = null
  let browser: any = null
  let page: any = null
  try { ({ chromium } = await import('playwright')) } catch {}
  if (chromium) {
    try { browser = await chromium.launch({ headless: true }); const ctx = await browser.newContext(); page = await ctx.newPage() } catch { browser = null; page = null }
  }
  for (const url of urls) {
    try {
      let textDump = ''
      if (page) {
        try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }) } catch {}
        try { textDump = await page.evaluate(() => document.body?.innerText || '') } catch {}
      }
      if (!textDump && env.competitorFetchFallback) {
        const res = await fetch(url, { method: 'GET' })
        const html = await res.text()
        textDump = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      }
      saveText(textDump, payload.projectId)
      rows.push({ url, title: '', textDump })
    } catch {}
  }
  if (browser) { try { await browser.close() } catch {} }
  try { bundle.writeJsonl(payload.projectId, 'competitors/pages.jsonl', rows); bundle.appendLineage(payload.projectId, { node: 'competitors', outputs: { count: rows.length } }) } catch {}
}
