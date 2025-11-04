import 'dotenv/config'

async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

async function main() {
  const base = process.env.APP_URL || 'http://localhost:3000'
  const siteUrl = process.env.SMOKE_SITE_URL || 'https://example.com'
  const orgId = process.env.SMOKE_ORG_ID || 'org-dev'
  const name = process.env.SMOKE_PROJECT_NAME || 'Smoke Website'

  // Create website (E2E_NO_AUTH=1 recommended for local)
  const createRes = await fetch(new URL('/api/websites', base).toString(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: siteUrl, defaultLocale: 'en-US' })
  })
  const createBody: any = await createRes.json().catch(() => ({}))
  if (!createRes.ok) {
    console.error('create project failed', createBody)
    process.exit(1)
  }
  const projectId: string | undefined = createBody?.website?.id
  if (!projectId) {
    console.error('missing project id in create response', createBody)
    process.exit(1)
  }

  // Poll snapshot for discovery/plan progress
  const deadline = Date.now() + Math.max(60_000, Number(process.env.SMOKE_TIMEOUT_MS || '180000'))
  let last: any = null
  while (Date.now() < deadline) {
    const snapRes = await fetch(new URL(`/api/websites/${projectId}/snapshot`, base).toString())
    last = await snapRes.json().catch(() => ({}))
    const hasSummary = Boolean(last?.latestDiscovery?.summaryJson)
    const planCount = Array.isArray(last?.planItems) ? last.planItems.length : 0
    if (hasSummary || planCount > 0) {
      console.log(JSON.stringify({ ok: true, projectId, hasSummary, planCount }, null, 2))
      process.exit(0)
    }
    await sleep(3000)
  }
  console.error(JSON.stringify({ ok: false, projectId, last }, null, 2))
  process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(1) })
