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
      const token = process.env.POLAR_ACCESS_TOKEN || ''
      const priceId = getFlag(args, '--price') || process.env.POLAR_PRICE_POSTS_30 || ''
      const orgId = getFlag(args, '--org') || 'org-dev'
      if (!token || !priceId) {
        console.error('missing POLAR_ACCESS_TOKEN or --price / POLAR_PRICE_POSTS_30')
        process.exitCode = 1
        return
      }
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
      const token = process.env.POLAR_ACCESS_TOKEN || ''
      const orgSlug = process.env.POLAR_ORG_SLUG || ''
      const customerId = process.env.POLAR_CUSTOMER_ID || ''
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const returnUrl = getFlag(args, '--return') || `${baseUrl}/dashboard`
      if (!token) {
        console.error('missing POLAR_ACCESS_TOKEN')
        process.exitCode = 1
        return
      }
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
      console.error('Set POLAR_CUSTOMER_ID or POLAR_ORG_SLUG for portal URL')
      process.exitCode = 1
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
      '  crawl-run --project <id>',
      '  crawl-pages --project <id> [--limit 100]',
      '  keyword-generate --project <id> [--locale en-US]',
      '  keyword-ls --project <id> [--status all] [--limit 100]',
      '  plan-ls --project <id> [--limit 90]',
      '  plan-move --plan <id> --date YYYY-MM-DD',
      '  schedule-run --project <id>',
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
