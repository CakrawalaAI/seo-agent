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
      const url = new URL('/api/auth/sign-in/social', baseUrl).toString()
      console.log(`Open this URL in your browser to sign in:\n${url}`)
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
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const url = new URL('/api/billing/checkout', baseUrl).toString()
      const orgId = getFlag(args, '--org') || 'org-dev'
      const plan = getFlag(args, '--plan') || 'growth'
      const successUrl = getFlag(args, '--success') || `${baseUrl}/dashboard`
      const cancelUrl = getFlag(args, '--cancel') || `${baseUrl}/dashboard?billing=cancel`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orgId, plan, successUrl, cancelUrl })
      })
      if (!res.ok) {
        console.error(`checkout failed: HTTP ${res.status}`)
        process.exitCode = 1
        return
      }
      const data = (await res.json()) as { url?: string }
      console.log(data?.url ?? '')
      return
    }
    case 'billing-portal': {
      const baseUrl = process.env.SEO_AGENT_BASE_URL || 'http://localhost:5173'
      const orgId = getFlag(args, '--org') || 'org-dev'
      const returnUrl = getFlag(args, '--return') || `${baseUrl}/dashboard`
      const url = new URL(`/api/billing/portal?orgId=${encodeURIComponent(orgId)}&returnUrl=${encodeURIComponent(returnUrl)}`, baseUrl).toString()
      const res = await fetch(url)
      if (!res.ok) {
        console.error(`portal failed: HTTP ${res.status}`)
        process.exitCode = 1
        return
      }
      const data = (await res.json()) as { url?: string }
      console.log(data?.url ?? '')
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
  if (input.toLowerCase() === 'integration-test') return 'integration-test'
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
      '  billing-checkout [--org id] [--plan growth] [--success url] [--cancel url]',
      '  billing-portal [--org id] [--return url] ',
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
      '  integration-add-webhook --project <id> --url <target> [--secret s]',
      '  integration-test --integration <id>',
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

const cliImportMeta = import.meta as ImportMeta & { main?: boolean }

if (cliImportMeta.main) {
  runCli().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
