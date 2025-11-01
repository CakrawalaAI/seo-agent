#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

type CliCommand =
  | 'help'
  | 'version'
  | 'ping'
  | 'login'
  | 'whoami'
  | 'billing-checkout'
  | 'billing-portal'
  | 'project-create'
  | 'project-ls'
  | 'crawl-run'
  | 'crawl-pages'
  | 'keyword-generate'
  | 'keyword-discover'
  | 'keyword-ls'
  | 'plan-ls'
  | 'plan-move'
  | 'schedule-run'
  | 'article-ls'
  | 'article-publish'
  | 'integration-add-webhook'
  | 'integration-test'
  | 'integration-add-webflow'
  | 'article-generate'
  | 'article-edit'
  | 'org-ls'
  | 'org-switch'
  | 'job-ls'
  | 'job-watch'
  | 'keyword-refresh'
  | 'serp-refresh'
  | 'schedule-metrics'
  | 'schedule-serp-anchors'
  | 'keyword-snapshots'
  | 'admin-backfill-canon'
  | 'article-enrich'
  | 'project-set'
  | 'bundle-ls'
  | 'serp-warm'
  | 'competitors-warm'
  | 'costs'
  | 'logs'
  | 'schedule-feedback'
  | 'schedule-crawl-weekly'
  | 'score-run'
  | 'keyword-prioritized'

export async function runCli(args: string[] = process.argv.slice(2)) {
  const command = normalizeCommand(args[0])
  switch (command) {
    case 'ping': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const url = new URL('/api/health', baseUrl).toString()
      try {
        const res = await fetch(url, { method: 'GET' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as { ok?: boolean; version?: string; service?: string }
        const dv = typeof data?.version === 'string' ? data.version : 'unknown'
        console.log(`health ok: ${data?.ok ? 'true' : 'false'} service: ${data?.service ?? 'seo-agent'} v${dv}`)
      } catch (err) {
        console.error(`health check failed: ${(err as Error)?.message ?? String(err)}`)
        process.exitCode = 1
      }
      return
    }
    case 'login': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const url = new URL('/login', baseUrl).toString()
      console.log(`Open this URL in your browser to sign in:\n${url}`)
      return
    }
    case 'org-ls': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const url = new URL('/api/orgs', baseUrl).toString()
      const res = await fetch(url)
      if (!res.ok) {
        console.error(`org ls failed: HTTP ${res.status}`)
        process.exitCode = 1
        return
      }
      const data = (await res.json()) as { items?: Array<{ id: string; name?: string; plan?: string }> }
      for (const o of data.items ?? []) {
        console.log(`${o.id}\t${o.name ?? ''}\t${o.plan ?? ''}`)
      }
      return
    }
    case 'org-switch': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const orgId = getFlag(args, '--org') || ''
      if (!orgId) {
        console.error('usage: seo org-switch --org <id>')
        process.exitCode = 1
        return
      }
      const url = new URL('/api/orgs', baseUrl).toString()
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include' as any,
        body: JSON.stringify({ action: 'switch', orgId })
      })
      if (!res.ok && res.status !== 204) {
        console.error(`org switch failed: HTTP ${res.status}`)
        process.exitCode = 1
        return
      }
      console.log('ok')
      return
    }
    case 'job-ls': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const projectId = getFlag(args, '--project') || ''
      const limit = getFlag(args, '--limit') || '25'
      if (!projectId) {
        console.error('usage: seo job-ls --project <id> [--limit 25]')
        process.exitCode = 1
        return
      }
      const url = new URL(`/api/projects/${encodeURIComponent(projectId)}/jobs?limit=${encodeURIComponent(limit)}`, baseUrl).toString()
      const res = await fetch(url)
      if (!res.ok) {
        console.error(`job ls failed: HTTP ${res.status}`)
        process.exitCode = 1
        return
      }
      const data = (await res.json()) as { items?: Array<{ id: string; status: string; type: string; queuedAt?: string | null }> }
      for (const j of data.items ?? []) {
        console.log(`${j.status}\t${j.type}\t${j.id}\t${j.queuedAt ?? ''}`)
      }
      return
    }
    case 'job-watch': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const projectId = getFlag(args, '--project') || ''
      const id = getFlag(args, '--id') || ''
      if (!projectId || !id) {
        console.error('usage: seo job-watch --project <id> --id <jobId>')
        process.exitCode = 1
        return
      }
      const url = new URL(`/api/projects/${encodeURIComponent(projectId)}/jobs?limit=50`, baseUrl).toString()
      const started = Date.now()
      while (Date.now() - started < 120_000) {
        const res = await fetch(url)
        if (!res.ok) {
          await new Promise((r) => setTimeout(r, 1000))
          continue
        }
        const data = (await res.json()) as { items?: Array<{ id: string; status: string }> }
        const job = (data.items ?? []).find((j) => j.id === id)
        if (job && (job.status === 'completed' || job.status === 'failed')) {
          console.log(job.status)
          return
        }
        await new Promise((r) => setTimeout(r, 1000))
      }
      console.log('timeout')
      return
    }
    case 'whoami': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const url = new URL('/api/me', baseUrl).toString()
      try {
        const res = await fetch(url, { method: 'GET', credentials: 'include' as any })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as { user?: { email?: string; name?: string } | null }
        if (data?.user?.email) {
          console.log(`${data.user.name ?? 'User'} <${data.user.email}>`)
        } else {
          console.log('anonymous')
        }
      } catch (err) {
        console.error(`whoami failed: ${(err as Error)?.message ?? String(err)}`)
        process.exitCode = 1
      }
      return
    }
    case 'billing-checkout': {
      const server = (process.env.POLAR_SERVER || '').toLowerCase() === 'sandbox' ? 'https://sandbox-api.polar.sh/v1' : 'https://api.polar.sh/v1'
      const token = process.env.POLAR_ACCESS_TOKEN || 'test_token'
      const priceId = getFlag(args, '--price') || process.env.POLAR_PRICE_POSTS_30 || 'price_test'
      const orgId = getFlag(args, '--org') || 'org-dev'
      const res = await fetch(`${server}/checkouts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ product_price_id: priceId, metadata: { referenceId: orgId } })
      })
      if (!res.ok) {
        console.error(`checkout failed: HTTP ${res.status}`)
        process.exitCode = 1
        return
      }
      const data = (await res.json().catch(() => ({}))) as any
      const url = data?.url || data?.data?.url || ''
      console.log(url)
      return
    }
    case 'billing-portal': {
      const server = (process.env.POLAR_SERVER || '').toLowerCase() === 'sandbox' ? 'https://sandbox-api.polar.sh/v1' : 'https://api.polar.sh/v1'
      const token = process.env.POLAR_ACCESS_TOKEN || 'test_token'
      const orgSlug = process.env.POLAR_ORG_SLUG || ''
      const customerId = process.env.POLAR_CUSTOMER_ID || ''
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const returnUrl = getFlag(args, '--return') || `${baseUrl}/dashboard`
      if (customerId) {
        const res = await fetch(`${server}/billing_portal/sessions`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ customer_id: customerId, return_url: returnUrl })
        })
        if (!res.ok) {
          console.error(`portal failed: HTTP ${res.status}`)
          process.exitCode = 1
          return
        }
        const data = (await res.json().catch(() => ({}))) as any
        const url = data?.url || data?.data?.url || ''
        console.log(url)
        return
      }
      if (orgSlug) {
        // Fallback to generic portal URL
        console.log(`https://polar.sh/${orgSlug}/portal`)
        return
      }
      // In test/dev, allow calling the API even without IDs to receive a stubbed URL
      const res = await fetch(`${server}/billing_portal/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ return_url: returnUrl })
      })
      if (!res.ok) {
        console.error(`portal failed: HTTP ${res.status}`)
        process.exitCode = 1
        return
      }
      const data = (await res.json().catch(() => ({}))) as any
      console.log(data?.url || data?.data?.url || '')
      return
    }
    case 'project-create': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const url = new URL('/api/projects', baseUrl).toString()
      const orgId = getFlag(args, '--org') || 'org-dev'
      const name = getFlag(args, '--name') || 'My Project'
      const siteUrl = getFlag(args, '--site') || 'https://example.com'
      const defaultLocale = getFlag(args, '--locale') || 'en-US'
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orgId, name, siteUrl, defaultLocale })
      })
      if (!res.ok) {
        console.error(`project create failed: HTTP ${res.status}`)
        process.exitCode = 1
        return
      }
      const data = (await res.json()) as { project?: { id?: string; name?: string }; crawlJobId?: string | null }
      console.log(`project ${data?.project?.name ?? ''} created id=${data?.project?.id ?? ''}`)
      return
    }
    case 'keyword-refresh': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const canonId = getFlag(args, '--canon') || ''
      const phrase = getFlag(args, '--phrase') || ''
      const language = getFlag(args, '--language') || 'en-US'
      const locationCode = getFlag(args, '--location') || '2840'
      const what = getFlag(args, '--what') || 'metrics'
      const force = getFlag(args, '--force') || 'false'
      if (!canonId && !phrase) {
        console.error('usage: seo keyword-refresh --canon <id> | --phrase "best crm" [--language en-US] [--location 2840] [--what metrics|serp|both] [--force true]')
        process.exitCode = 1
        return
      }
      const url = new URL('/api/keyword/refresh', baseUrl).toString()
      const body: any = { language, locationCode: Number(locationCode), what, force: force === 'true' }
      if (canonId) body.canonId = canonId; else body.phrase = phrase
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { console.error(`keyword-refresh failed: HTTP ${res.status}`); process.exitCode = 1; return }
      console.log('queued')
      return
    }
    case 'serp-refresh': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const canonId = getFlag(args, '--canon') || ''
      const phrase = getFlag(args, '--phrase') || ''
      const language = getFlag(args, '--language') || 'en-US'
      const locationCode = getFlag(args, '--location') || '2840'
      const device = getFlag(args, '--device') || 'desktop'
      const topK = getFlag(args, '--topK') || '10'
      const force = getFlag(args, '--force') || 'false'
      if (!canonId && !phrase) { console.error('usage: seo serp-refresh --canon <id> | --phrase "best crm" [--language en-US] [--location 2840] [--device desktop|mobile] [--topK 10] [--force true]'); process.exitCode = 1; return }
      const url = new URL('/api/serp/refresh', baseUrl).toString()
      const body: any = { language, locationCode: Number(locationCode), device, topK: Number(topK), force: force === 'true' }
      if (canonId) body.canonId = canonId; else body.phrase = phrase
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { console.error(`serp-refresh failed: HTTP ${res.status}`); process.exitCode = 1; return }
      console.log('queued')
      return
    }
    case 'schedule-metrics': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const url = new URL('/api/schedules/metrics', baseUrl).toString()
      const res = await fetch(url, { method: 'POST' })
      if (!res.ok) { console.error(`schedule-metrics failed: HTTP ${res.status}`); process.exitCode = 1; return }
      const data = await res.json().catch(() => ({})) as any
      console.log(`queued ${data?.queued ?? 0}`)
      return
    }
    case 'schedule-serp-anchors': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const url = new URL('/api/schedules/serp-monthly', baseUrl).toString()
      const res = await fetch(url, { method: 'POST' })
      if (!res.ok) { console.error(`schedule-serp-anchors failed: HTTP ${res.status}`); process.exitCode = 1; return }
      const data = await res.json().catch(() => ({})) as any
      console.log(`queued ${data?.queued ?? 0}`)
      return
    }
    case 'keyword-snapshots': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const canonId = getFlag(args, '--canon') || ''
      const from = getFlag(args, '--from') || '0000-01'
      const to = getFlag(args, '--to') || '9999-12'
      if (!canonId) { console.error('usage: seo keyword-snapshots --canon <id> [--from YYYY-MM] [--to YYYY-MM]'); process.exitCode = 1; return }
      const url = new URL(`/api/keywords/${encodeURIComponent(canonId)}/snapshots?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, baseUrl).toString()
      const res = await fetch(url)
      if (!res.ok) { console.error(`keyword-snapshots failed: HTTP ${res.status}`); process.exitCode = 1; return }
      const data = await res.json().catch(() => ({})) as any
      for (const row of data?.items ?? []) {
        console.log(`${row.asOfMonth}\t${row.metricsJson?.searchVolume ?? ''}\t${row.metricsJson?.difficulty ?? ''}`)
      }
      return
    }
    case 'admin-backfill-canon': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const limit = getFlag(args, '--limit') || '500'
      const url = new URL(`/api/admin/backfill-canon?limit=${encodeURIComponent(limit)}`, baseUrl).toString()
      const res = await fetch(url, { method: 'POST' })
      if (!res.ok) { console.error(`admin-backfill-canon failed: HTTP ${res.status}`); process.exitCode = 1; return }
      const data = await res.json().catch(() => ({})) as any
      console.log(`updated ${data?.updated ?? 0}`)
      return
    }
    case 'project-ls': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const orgId = getFlag(args, '--org') || 'org-dev'
      const limit = getFlag(args, '--limit') || '50'
      const url = new URL(`/api/projects?orgId=${encodeURIComponent(orgId)}&limit=${encodeURIComponent(limit)}`, baseUrl).toString()
      const res = await fetch(url)
      if (!res.ok) {
        console.error(`project ls failed: HTTP ${res.status}`)
        process.exitCode = 1
        return
      }
      const data = (await res.json()) as { items?: Array<{ id: string; name: string; siteUrl?: string }> }
      for (const p of data?.items ?? []) {
        console.log(`${p.id}\t${p.name}\t${p.siteUrl ?? ''}`)
      }
      return
    }
    case 'crawl-run': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const projectId = getFlag(args, '--project') || ''
      if (!projectId) {
        console.error('usage: seo crawl-run --project <id>')
        process.exitCode = 1
        return
      }
      const url = new URL('/api/crawl/run', baseUrl).toString()
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId })
      })
      if (!res.ok) {
        console.error(`crawl run failed: HTTP ${res.status}`)
        process.exitCode = 1
        return
      }
      const data = (await res.json()) as { jobId?: string }
      console.log(`crawl job ${data?.jobId ?? 'queued'}`)
      return
    }
    case 'crawl-pages': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const projectId = getFlag(args, '--project') || ''
      const limit = getFlag(args, '--limit') || '100'
      if (!projectId) {
        console.error('usage: seo crawl-pages --project <id> [--limit N]')
        process.exitCode = 1
        return
      }
      const url = new URL(`/api/crawl/pages?projectId=${encodeURIComponent(projectId)}&limit=${encodeURIComponent(limit)}`, baseUrl).toString()
      const res = await fetch(url)
      if (!res.ok) {
        console.error(`crawl pages failed: HTTP ${res.status}`)
        process.exitCode = 1
        return
      }
      const data = (await res.json()) as { items?: Array<{ url: string; httpStatus?: number | string | null; metaJson?: any }> }
      for (const p of data?.items ?? []) {
        console.log(`${p.httpStatus ?? ''}\t${(p.metaJson?.title as string) ?? ''}\t${p.url}`)
      }
      return
    }
    case 'keyword-generate': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const projectId = getFlag(args, '--project') || ''
      const locale = getFlag(args, '--locale') || 'en-US'
      if (!projectId) {
        console.error('usage: seo keyword-generate --project <id> [--locale en-US]')
        process.exitCode = 1
        return
      }
      const url = new URL('/api/keywords/generate', baseUrl).toString()
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId, locale })
      })
      if (!res.ok) {
        console.error(`keyword generate failed: HTTP ${res.status}`)
        process.exitCode = 1
        return
      }
      const data = (await res.json()) as { jobId?: string }
      console.log(`keyword job ${data?.jobId ?? 'queued'}`)
      return
    }
    case 'keyword-discover': {
      // Live discovery from seed keywords (DataForSEO-backed via provider interfaces)
      const seedsCsv = getFlag(args, '--seeds') || ''
      const siteUrl = getFlag(args, '--site') || ''
      const language = getFlag(args, '--language') || 'en-US'
      const location = Number(getFlag(args, '--location') || '2840')
      const limit = Number(getFlag(args, '--limit') || '100')
      const withMetrics = (getFlag(args, '--metrics') || 'false') === 'true'
      if (!seedsCsv && !siteUrl) {
        console.error('usage: seo keyword-discover --seeds "kw1,kw2" [--site https://example.com] [--language en-US] [--location 2840] [--limit 100] [--metrics true]')
        process.exitCode = 1
        return
      }
      const seeds = seedsCsv.split(',').map((s) => s.trim()).filter(Boolean)
      const { getDiscoveryProvider, getMetricsProvider } = await import('@common/providers/registry')
      const prov = getDiscoveryProvider()
      const items: Array<{ phrase: string; source: 'site' | 'related' | 'ideas' }> = []
      const seen = new Set<string>()
      if (siteUrl) {
        try {
          const domain = new URL(siteUrl).hostname
          const base = await prov.keywordsForSite({ domain, language, locationCode: location, limit })
          for (const r of base) {
            const k = r.phrase.toLowerCase()
            if (!seen.has(k)) { seen.add(k); items.push({ phrase: r.phrase, source: 'site' }) }
            if (items.length >= limit) break
          }
        } catch {}
      }
      if (seeds.length) {
        try {
          const rel = await prov.relatedKeywords({ seeds, language, locationCode: location, limit })
          for (const r of rel) {
            const k = r.phrase.toLowerCase()
            if (!seen.has(k)) { seen.add(k); items.push({ phrase: r.phrase, source: 'related' }) }
            if (items.length >= limit) break
          }
        } catch {}
        if (items.length < limit) {
          try {
            const ideas = await prov.keywordIdeas({ seeds, language, locationCode: location, limit: Math.max(0, limit - items.length) })
            for (const r of ideas) {
              const k = r.phrase.toLowerCase()
              if (!seen.has(k)) { seen.add(k); items.push({ phrase: r.phrase, source: 'ideas' }) }
              if (items.length >= limit) break
            }
          } catch {}
        }
      }
      const top = items.slice(0, limit)
      if (!withMetrics) {
        for (const r of top) console.log(`${r.source}\t${r.phrase}`)
        return
      }
      const metricsProv = getMetricsProvider()
      const map = await metricsProv.overviewBatch(top.map((i) => i.phrase), language, location)
      for (const r of top) {
        const m = map.get(r.phrase.toLowerCase())
        const vol = m?.searchVolume ?? ''
        const diff = m?.difficulty ?? ''
        console.log(`${r.source}\t${vol}\t${diff}\t${r.phrase}`)
      }
      return
    }
    case 'keyword-ls': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const projectId = getFlag(args, '--project') || ''
      const status = getFlag(args, '--status') || 'all'
      const limit = getFlag(args, '--limit') || '100'
      if (!projectId) {
        console.error('usage: seo keyword-ls --project <id> [--status all] [--limit N]')
        process.exitCode = 1
        return
      }
      const url = new URL(`/api/projects/${encodeURIComponent(projectId)}/keywords?status=${encodeURIComponent(status)}&limit=${encodeURIComponent(limit)}`, baseUrl).toString()
      const res = await fetch(url)
      if (!res.ok) {
        console.error(`keyword ls failed: HTTP ${res.status}`)
        process.exitCode = 1
        return
      }
      const data = (await res.json()) as { items?: Array<{ phrase: string; metricsJson?: any; status?: string }> }
      for (const k of data?.items ?? []) {
        const vol = k?.metricsJson?.searchVolume ?? ''
        const diff = k?.metricsJson?.difficulty ?? ''
        console.log(`${k.status ?? ''}\t${String(vol)}\t${String(diff)}\t${k.phrase}`)
      }
      return
    }
    case 'plan-ls': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const projectId = getFlag(args, '--project') || ''
      const limit = getFlag(args, '--limit') || '90'
      if (!projectId) {
        console.error('usage: seo plan-ls --project <id> [--limit 90]')
        process.exitCode = 1
        return
      }
      const url = new URL(`/api/plan-items?projectId=${encodeURIComponent(projectId)}&limit=${encodeURIComponent(limit)}`, baseUrl).toString()
      const res = await fetch(url)
      if (!res.ok) {
        console.error(`plan ls failed: HTTP ${res.status}`)
        process.exitCode = 1
        return
      }
      const data = (await res.json()) as { items?: Array<{ id: string; plannedDate: string; title: string; status?: string }> }
      for (const p of data?.items ?? []) {
        console.log(`${p.plannedDate}\t${p.status ?? 'planned'}\t${p.id}\t${p.title}`)
      }
      return
    }
    case 'plan-move': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const id = getFlag(args, '--plan') || ''
      const date = getFlag(args, '--date') || ''
      if (!id || !date) {
        console.error('usage: seo plan-move --plan <id> --date YYYY-MM-DD')
        process.exitCode = 1
        return
      }
      const url = new URL(`/api/plan-items/${encodeURIComponent(id)}`, baseUrl).toString()
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plannedDate: date })
      })
      if (!res.ok) {
        console.error(`plan move failed: HTTP ${res.status}`)
        process.exitCode = 1
        return
      }
      console.log('ok')
      return
    }
    case 'schedule-run': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const projectId = getFlag(args, '--project') || ''
      if (!projectId) {
        console.error('usage: seo schedule-run --project <id>')
        process.exitCode = 1
        return
      }
      const url = new URL('/api/schedules/run', baseUrl).toString()
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId })
      })
      if (!res.ok) {
        console.error(`schedule run failed: HTTP ${res.status}`)
        process.exitCode = 1
        return
      }
      const data = (await res.json()) as { result?: { generatedDrafts?: number } }
      console.log(`generated ${data?.result?.generatedDrafts ?? 0}`)
      return
    }
    case 'article-ls': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const projectId = getFlag(args, '--project') || ''
      const limit = getFlag(args, '--limit') || '90'
      if (!projectId) {
        console.error('usage: seo article-ls --project <id> [--limit 90]')
        process.exitCode = 1
        return
      }
      const url = new URL(`/api/projects/${encodeURIComponent(projectId)}/articles?limit=${encodeURIComponent(limit)}`, baseUrl).toString()
      const res = await fetch(url)
      if (!res.ok) {
        console.error(`article ls failed: HTTP ${res.status}`)
        process.exitCode = 1
        return
      }
      const data = (await res.json()) as { items?: Array<{ id: string; status?: string; title?: string }> }
      for (const a of data?.items ?? []) {
        console.log(`${a.status ?? ''}\t${a.id}\t${a.title ?? ''}`)
      }
      return
    }
    case 'article-publish': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const articleId = getFlag(args, '--article') || ''
      const integrationId = getFlag(args, '--integration') || ''
      if (!articleId || !integrationId) {
        console.error('usage: seo article-publish --article <id> --integration <id>')
        process.exitCode = 1
        return
      }
      const url = new URL(`/api/articles/${encodeURIComponent(articleId)}/publish`, baseUrl).toString()
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ integrationId })
      })
      if (!res.ok) {
        console.error(`article publish failed: HTTP ${res.status}`)
        process.exitCode = 1
        return
      }
      const data = (await res.json()) as { jobId?: string }
      console.log(`publish job ${data?.jobId ?? ''}`)
      return
    }
    case 'article-generate': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const planItemId = getFlag(args, '--plan') || ''
      if (!planItemId) {
        console.error('usage: seo article-generate --plan <planItemId>')
        process.exitCode = 1
        return
      }
      const api = new URL('/api/articles/generate', baseUrl).toString()
      const res = await fetch(api, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ planItemId })
      })
      if (!res.ok) {
        console.error(`article generate failed: HTTP ${res.status}`)
        process.exitCode = 1
        return
      }
      const data = (await res.json()) as { articleId?: string }
      console.log(`generated ${data?.articleId ?? ''}`)
      return
    }
    case 'article-edit': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const articleId = getFlag(args, '--article') || ''
      const file = getFlag(args, '--file') || ''
      if (!articleId) {
        console.error('usage: seo article-edit --article <id> [--file path] (reads stdin if no file)')
        process.exitCode = 1
        return
      }
      let bodyHtml = ''
      if (file) {
        const fs = await import('node:fs/promises')
        bodyHtml = await fs.readFile(file, 'utf-8')
      } else {
        bodyHtml = await readStdin()
      }
      const api = new URL(`/api/articles/${encodeURIComponent(articleId)}`, baseUrl).toString()
      const res = await fetch(api, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bodyHtml })
      })
      if (!res.ok) {
        console.error(`article edit failed: HTTP ${res.status}`)
        process.exitCode = 1
        return
      }
      console.log('ok')
      return
    }
    case 'article-enrich': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const articleId = getFlag(args, '--article') || ''
      if (!articleId) { console.error('usage: seo article-enrich --article <id>'); process.exitCode = 1; return }
      const url = new URL(`/api/articles/${encodeURIComponent(articleId)}/enrich`, baseUrl).toString()
      const res = await fetch(url, { method: 'POST' })
      if (!res.ok) { console.error(`article-enrich failed: HTTP ${res.status}`); process.exitCode = 1; return }
      console.log('queued')
      return
    }
    case 'project-set': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const projectId = getFlag(args, '--project') || ''
      const serpDevice = getFlag(args, '--device') || ''
      const serpLocationCode = getFlag(args, '--serp-loc') || ''
      const metricsLocationCode = getFlag(args, '--metrics-loc') || ''
      if (!projectId) { console.error('usage: seo project-set --project <id> [--device desktop|mobile] [--serp-loc 2840] [--metrics-loc 2840]'); process.exitCode = 1; return }
      const body: any = {}
      if (serpDevice) body.serpDevice = serpDevice
      if (serpLocationCode) body.serpLocationCode = Number(serpLocationCode)
      if (metricsLocationCode) body.metricsLocationCode = Number(metricsLocationCode)
      const url = new URL(`/api/projects/${encodeURIComponent(projectId)}`, baseUrl).toString()
      const res = await fetch(url, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { console.error(`project-set failed: HTTP ${res.status}`); process.exitCode = 1; return }
      console.log('ok')
      return
    }
    case 'bundle-ls': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const projectId = getFlag(args, '--project') || ''
      if (!projectId) { console.error('usage: seo bundle-ls --project <id>'); process.exitCode = 1; return }
      const url = new URL(`/api/projects/${encodeURIComponent(projectId)}/bundle`, baseUrl).toString()
      const res = await fetch(url)
      if (!res.ok) { console.error(`bundle-ls failed: HTTP ${res.status}`); process.exitCode = 1; return }
      const data = await res.json().catch(() => ({})) as any
      console.log(`# ${data?.base ?? ''}`)
      for (const f of data?.files ?? []) console.log(f)
      return
    }
    case 'serp-warm': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const projectId = getFlag(args, '--project') || ''
      const topM = getFlag(args, '--topM') || '50'
      if (!projectId) { console.error('usage: seo serp-warm --project <id> [--topM 50]'); process.exitCode = 1; return }
      const url = new URL(`/api/projects/${encodeURIComponent(projectId)}/serp/warm?topM=${encodeURIComponent(topM)}`, baseUrl).toString()
      const res = await fetch(url, { method: 'POST' })
      if (!res.ok) { console.error(`serp-warm failed: HTTP ${res.status}`); process.exitCode = 1; return }
      const data = await res.json().catch(() => ({})) as any
      console.log(`queued ${data?.queued ?? 0}`)
      return
    }
    case 'competitors-warm': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const projectId = getFlag(args, '--project') || ''
      const topM = getFlag(args, '--topM') || '10'
      if (!projectId) { console.error('usage: seo competitors-warm --project <id> [--topM 10]'); process.exitCode = 1; return }
      const url = new URL(`/api/projects/${encodeURIComponent(projectId)}/competitors/warm?topM=${encodeURIComponent(topM)}`, baseUrl).toString()
      const res = await fetch(url, { method: 'POST' })
      if (!res.ok) { console.error(`competitors-warm failed: HTTP ${res.status}`); process.exitCode = 1; return }
      const data = await res.json().catch(() => ({})) as any
      console.log(`queued ${data?.queued ?? 0}`)
      return
    }
    case 'costs': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const url = new URL('/api/projects/_/costs', baseUrl).toString()
      const res = await fetch(url)
      if (!res.ok) { console.error(`costs failed: HTTP ${res.status}`); process.exitCode = 1; return }
      const data = await res.json().catch(() => ({})) as any
      console.log(JSON.stringify(data, null, 2))
      return
    }
    case 'logs': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const projectId = getFlag(args, '--project') || ''
      const tail = getFlag(args, '--tail') || '200'
      if (!projectId) { console.error('usage: seo logs --project <id> [--tail 200]'); process.exitCode = 1; return }
      const url = new URL(`/api/projects/${encodeURIComponent(projectId)}/logs?tail=${encodeURIComponent(tail)}`, baseUrl).toString()
      const res = await fetch(url)
      if (!res.ok) { console.error(`logs failed: HTTP ${res.status}`); process.exitCode = 1; return }
      const data = await res.json().catch(() => ({})) as any
      for (const row of data?.items ?? []) console.log(JSON.stringify(row))
      return
    }
    case 'schedule-feedback': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const projectId = getFlag(args, '--project') || ''
      if (!projectId) { console.error('usage: seo schedule-feedback --project <id>'); process.exitCode = 1; return }
      const url = new URL('/api/schedules/feedback', baseUrl).toString()
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId }) })
      if (!res.ok) { console.error(`schedule-feedback failed: HTTP ${res.status}`); process.exitCode = 1; return }
      console.log('queued')
      return
    }
    case 'schedule-crawl-weekly': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const url = new URL('/api/schedules/crawl-weekly', baseUrl).toString()
      const res = await fetch(url, { method: 'POST' })
      if (!res.ok) { console.error(`schedule-crawl-weekly failed: HTTP ${res.status}`); process.exitCode = 1; return }
      const data = await res.json().catch(() => ({})) as any
      console.log(`queued ${data?.queued ?? 0}`)
      return
    }
    case 'score-run': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const projectId = getFlag(args, '--project') || ''
      if (!projectId) { console.error('usage: seo score-run --project <id>'); process.exitCode = 1; return }
      const url = new URL(`/api/projects/${encodeURIComponent(projectId)}/score`, baseUrl).toString()
      const res = await fetch(url, { method: 'POST' })
      if (!res.ok) { console.error(`score-run failed: HTTP ${res.status}`); process.exitCode = 1; return }
      const data = await res.json().catch(() => ({})) as any
      console.log(data?.jobId ? data.jobId : 'queued')
      return
    }
    case 'keyword-prioritized': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const projectId = getFlag(args, '--project') || ''
      const limit = getFlag(args, '--limit') || '50'
      if (!projectId) { console.error('usage: seo keyword-prioritized --project <id> [--limit 50]'); process.exitCode = 1; return }
      const url = new URL(`/api/projects/${encodeURIComponent(projectId)}/keywords/prioritized?limit=${encodeURIComponent(limit)}`, baseUrl).toString()
      const res = await fetch(url)
      if (!res.ok) { console.error(`keyword-prioritized failed: HTTP ${res.status}`); process.exitCode = 1; return }
      const data = await res.json().catch(() => ({})) as any
      for (const row of data?.items ?? []) {
        console.log(`${row.role ?? ''}\t${String(row.opportunity ?? '')}\t${row.phrase}`)
      }
      return
    }
    case 'integration-add-webhook': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const projectId = getFlag(args, '--project') || ''
      const url = getFlag(args, '--url') || ''
      const secret = getFlag(args, '--secret') || ''
      if (!projectId || !url) {
        console.error('usage: seo integration-add-webhook --project <id> --url <target> [--secret s]')
        process.exitCode = 1
        return
      }
      const api = new URL('/api/integrations', baseUrl).toString()
      const res = await fetch(api, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId, type: 'webhook', status: 'connected', config: { targetUrl: url, secret } })
      })
      if (!res.ok) {
        console.error(`integration add failed: HTTP ${res.status}`)
        process.exitCode = 1
        return
      }
      const data = (await res.json()) as { id?: string }
      console.log(`integration ${data?.id ?? ''}`)
      return
    }
    case 'integration-add-webflow': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const projectId = getFlag(args, '--project') || ''
      const siteId = getFlag(args, '--site') || ''
      const collectionId = getFlag(args, '--collection') || ''
      const draft = getFlag(args, '--draft') || 'true'
      if (!projectId || !siteId || !collectionId) {
        console.error('usage: seo integration-add-webflow --project <id> --site <id> --collection <id> [--draft true|false]')
        process.exitCode = 1
        return
      }
      const api = new URL('/api/integrations', baseUrl).toString()
      const res = await fetch(api, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId, type: 'webflow', status: 'connected', config: { siteId, collectionId, draft: draft === 'true' } })
      })
      if (!res.ok) {
        console.error(`integration add failed: HTTP ${res.status}`)
        process.exitCode = 1
        return
      }
      const data = (await res.json()) as { id?: string }
      console.log(`integration ${data?.id ?? ''}`)
      return
    }
    case 'integration-test': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const id = getFlag(args, '--integration') || ''
      if (!id) {
        console.error('usage: seo integration-test --integration <id>')
        process.exitCode = 1
        return
      }
      const api = new URL(`/api/integrations/${encodeURIComponent(id)}/test`, baseUrl).toString()
      const res = await fetch(api, { method: 'POST' })
      if (!res.ok && res.status !== 204) {
        console.error(`integration test failed: HTTP ${res.status}`)
        process.exitCode = 1
        return
      }
      console.log('ok')
      return
    }
    case 'version': {
      const pkg = await readPackageJson()
      console.log(`${pkg.name ?? 'seo-agent'} v${pkg.version ?? '0.0.0'}`)
      return
    }
    case 'help':
    default: {
      printHelp()
    }
  }
}

function normalizeCommand(input?: string): CliCommand {
  if (!input) return 'help'
  if (input === '--version' || input === '-v') return 'version'
  if (input === '--help' || input === '-h') return 'help'
  if (input.toLowerCase() === 'version') return 'version'
  if (input.toLowerCase() === 'ping') return 'ping'
  if (input.toLowerCase() === 'login') return 'login'
  if (input.toLowerCase() === 'whoami') return 'whoami'
  if (input.toLowerCase() === 'billing-checkout') return 'billing-checkout'
  if (input.toLowerCase() === 'billing-portal') return 'billing-portal'
  if (input.toLowerCase() === 'project-create') return 'project-create'
  if (input.toLowerCase() === 'project-ls') return 'project-ls'
  if (input.toLowerCase() === 'crawl-run') return 'crawl-run'
  if (input.toLowerCase() === 'crawl-pages') return 'crawl-pages'
  if (input.toLowerCase() === 'keyword-generate') return 'keyword-generate'
  if (input.toLowerCase() === 'keyword-ls') return 'keyword-ls'
  if (input.toLowerCase() === 'plan-ls') return 'plan-ls'
  if (input.toLowerCase() === 'plan-move') return 'plan-move'
  if (input.toLowerCase() === 'schedule-run') return 'schedule-run'
  if (input.toLowerCase() === 'article-ls') return 'article-ls'
  if (input.toLowerCase() === 'article-publish') return 'article-publish'
  if (input.toLowerCase() === 'integration-add-webhook') return 'integration-add-webhook'
  if (input.toLowerCase() === 'integration-add-webflow') return 'integration-add-webflow'
  if (input.toLowerCase() === 'integration-test') return 'integration-test'
  if (input.toLowerCase() === 'article-generate') return 'article-generate'
  if (input.toLowerCase() === 'article-edit') return 'article-edit'
  if (input.toLowerCase() === 'org-ls') return 'org-ls'
  if (input.toLowerCase() === 'org-switch') return 'org-switch'
  if (input.toLowerCase() === 'job-ls') return 'job-ls'
  if (input.toLowerCase() === 'job-watch') return 'job-watch'
  if (input.toLowerCase() === 'keyword-refresh') return 'keyword-refresh'
  if (input.toLowerCase() === 'serp-refresh') return 'serp-refresh'
  if (input.toLowerCase() === 'keyword-discover') return 'keyword-discover'
  if (input.toLowerCase() === 'schedule-metrics') return 'schedule-metrics'
  if (input.toLowerCase() === 'schedule-serp-anchors') return 'schedule-serp-anchors'
  if (input.toLowerCase() === 'keyword-snapshots') return 'keyword-snapshots'
  if (input.toLowerCase() === 'admin-backfill-canon') return 'admin-backfill-canon'
  if (input.toLowerCase() === 'article-enrich') return 'article-enrich'
  if (input.toLowerCase() === 'project-set') return 'project-set'
  if (input.toLowerCase() === 'bundle-ls') return 'bundle-ls'
  if (input.toLowerCase() === 'serp-warm') return 'serp-warm'
  if (input.toLowerCase() === 'competitors-warm') return 'competitors-warm'
  if (input.toLowerCase() === 'costs') return 'costs'
  if (input.toLowerCase() === 'logs') return 'logs'
  if (input.toLowerCase() === 'schedule-feedback') return 'schedule-feedback'
  if (input.toLowerCase() === 'schedule-crawl-weekly') return 'schedule-crawl-weekly'
  if (input.toLowerCase() === 'score-run') return 'score-run'
  if (input.toLowerCase() === 'keyword-prioritized') return 'keyword-prioritized'
  return 'help'
}

async function readPackageJson(): Promise<Record<string, unknown>> {
  try {
    const pkgUrl = await resolvePackageJsonUrl()
    const contents = await readFile(pkgUrl, 'utf-8')
    return JSON.parse(contents)
  } catch {
    return {}
  }
}

async function resolvePackageJsonUrl() {
  const currentFile = fileURLToPath(import.meta.url)
  const root = dirname(dirname(currentFile))
  return pathToFileURL(join(root, 'package.json'))
}

function printHelp() {
  console.log(
    [
      'SEO Agent CLI',
      '',
      'Usage:',
      '  seo [command]',
      '',
      'Commands:',
      '  help        Show this help output',
      '  version     Print the current package version',
      '  ping        Call /api/health on SEO_AGENT_BASE_URL (default http://localhost:5173)',
      '  login       Print sign-in URL (browser flow)',
      '  whoami      Show session user from /api/me',
      '  billing-checkout --org <id> [--price <priceId>]  # uses POLAR_PRICE_POSTS_30 if omitted',
      '  billing-portal [--return url]                       # uses POLAR_CUSTOMER_ID or POLAR_ORG_SLUG',
      '  project-create --org <id> --name "Acme" --site https://acme.com [--locale en-US]',
      '  project-ls --org <id> [--limit 50]',
      '  project-set --project <id> [--device desktop|mobile] [--serp-loc 2840] [--metrics-loc 2840]',
      '  bundle-ls --project <id>',
      '  serp-warm --project <id> [--topM 50]',
      '  competitors-warm --project <id> [--topM 10]',
      '  costs',
      '  logs --project <id> [--tail 200]',
      '  schedule-feedback --project <id>',
      '  schedule-crawl-weekly',
      '  score-run --project <id>',
      '  keyword-prioritized --project <id> [--limit 50]',
      '  crawl-run --project <id>',
      '  crawl-pages --project <id> [--limit 100]',
      '  keyword-generate --project <id> [--locale en-US]',
      '  keyword-discover --seeds "kw1,kw2" [--site https://example.com] [--language en-US] [--location 2840] [--limit 100] [--metrics true]',
      '  keyword-ls --project <id> [--status all] [--limit 100]',
      '  keyword-refresh --phrase "best crm" [--language en-US] [--location 2840] [--what metrics|serp|both] [--force true]',
      '  keyword-snapshots --canon <id> [--from YYYY-MM] [--to YYYY-MM]',
      '  plan-ls --project <id> [--limit 90]',
      '  plan-move --plan <id> --date YYYY-MM-DD',
      '  schedule-run --project <id>',
      '  schedule-metrics',
      '  schedule-serp-anchors',
      '  article-ls --project <id> [--limit 90]',
      '  article-publish --article <id> --integration <id>',
      '  article-generate --plan <planItemId>',
      '  article-edit --article <id> [--file path] (reads stdin if no file)',
      '  integration-add-webhook --project <id> --url <target> [--secret s]',
      '  integration-add-webflow --project <id> --site <id> --collection <id> [--draft true|false]',
      '  integration-test --integration <id>',
      '  org-ls',
      '  org-switch --org <id>',
      '  job-ls --project <id> [--limit 25]',
      '  job-watch --project <id> --id <jobId>',
      '  article-enrich --article <id>',
      '  admin-backfill-canon [--limit 500]',
      '',
      'Examples:',
      '  seo version',
      '  seo ping',
      '  seo help'
    ].join('\n')
  )
}

function getFlag(argv: string[], name: string) {
  const idx = argv.indexOf(name)
  if (idx >= 0 && idx + 1 < argv.length) return argv[idx + 1]
  return ''
}

async function readStdin() {
  const { stdin } = process as any
  if (stdin.isTTY) return ''
  const chunks: Array<Buffer> = []
  for await (const chunk of stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
  }
  return Buffer.concat(chunks).toString('utf-8')
}

const cliImportMeta = import.meta as ImportMeta & { main?: boolean }

if (cliImportMeta.main) {
  runCli().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
