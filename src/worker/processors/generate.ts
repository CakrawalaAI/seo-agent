import { planRepo } from '@entities/plan/repository'
import { articlesRepo } from '@entities/article/repository'
import { draftTitleOutline } from '@common/providers/llm'
import { getLlmProvider } from '@common/providers/registry'
import { evaluateArticle } from '@features/articles/server/evaluate'
import { ensureCanon } from '@features/keyword/server/ensureCanon'
import { ensureSerp } from '@features/serp/server/ensureSerp'
import { projectsRepo } from '@entities/project/repository'
import { integrationsRepo } from '@entities/integration/repository'
import * as bundle from '@common/bundle/store'
import { latestRunDir } from '@common/bundle/store'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export async function processGenerate(payload: { projectId: string; planItemId: string }) {
  const found = await planRepo.findById(payload.planItemId)
  if (!found) return
  const { item } = found
  const draft = await articlesRepo.createDraft({
    projectId: payload.projectId,
    planItemId: item.id,
    title: item.title,
    outline: Array.isArray(item.outlineJson) ? (item.outlineJson as any) : undefined
  })
  if (draft.status === 'published') {
    console.info('[generate] skip published article', { articleId: draft.id })
    return
  }
  if (draft.status === 'scheduled' && typeof draft.bodyHtml === 'string' && draft.bodyHtml.trim().length > 0) {
    console.info('[generate] skip already scheduled article', { articleId: draft.id })
    return
  }
  try {
    // Generate outline first if missing
    const needOutline = !draft.outlineJson || draft.outlineJson.length === 0
    let outline = draft.outlineJson ?? []
    if (needOutline) {
      try {
        const o = await draftTitleOutline(draft.title ?? item.title)
        outline = o.outline
        await articlesRepo.update(draft.id, { outlineJson: outline })
      } catch {}
    }
    // Enrich with SERP dump if available
    let serpDump: string | undefined
    let competitorDump: string | undefined
    try {
      const project = await projectsRepo.get(payload.projectId)
      const locale = project?.defaultLocale || 'en-US'
      const loc = Number(process.env.SEOA_DEFAULT_LOCATION_CODE || '2840')
      const device: 'desktop' | 'mobile' = 'desktop'
      const canon = await ensureCanon(draft.title ?? item.title, locale)
      const snap = await ensureSerp({ canon: { id: canon.id, phrase: draft.title ?? item.title, language: locale }, locationCode: loc, device, topK: 10 })
      serpDump = snap.textDump
      // read competitor dumps from bundle if present
      try {
        const base = latestRunDir(payload.projectId)
        const compFile = join(base, 'competitors', 'pages.jsonl')
        if (existsSync(compFile)) {
          const txt = readFileSync(compFile, 'utf-8')
          const lines = txt.split(/\r?\n/).filter(Boolean).slice(0, 5)
          const rows = lines.map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean) as any[]
          const dumps = rows.map((r) => `URL: ${r.url}\n${String(r.textDump || '').slice(0, 1200)}`)
          competitorDump = dumps.join('\n\n')
        }
      } catch {}
    } catch {}
    const llm = getLlmProvider()
    const { bodyHtml } = await llm.generateBody({ title: draft.title ?? item.title, outline, serpDump, competitorDump })
    try { if ((await import('@common/config')).config.debug?.writeBundle) { const { appendJsonl } = await import('@common/bundle/store'); appendJsonl('global', 'metrics/costs.jsonl', { node: 'llm', provider: process.env.OPENAI_API_KEY ? 'openai' : 'stub', at: new Date().toISOString(), stage: 'generateBody' }) } } catch {}
    try { if ((await import('@common/config')).config.debug?.writeBundle) { const { updateCostSummary } = await import('@common/metrics/costs'); updateCostSummary() } } catch {}
    await articlesRepo.update(draft.id, { bodyHtml, generationDate: new Date() as any, status: 'scheduled' })
    try { if ((await import('@common/config')).config.debug?.writeBundle) { const rel = `articles/drafts/${draft.id}.html`; bundle.writeText(payload.projectId, rel, bodyHtml); bundle.appendLineage(payload.projectId, { node: 'generate', outputs: { articleId: draft.id } }) } } catch {}
    // queue enrich step
    try {
      const { publishJob, queueEnabled } = await import('@common/infra/queue')
      if (queueEnabled()) {
        await publishJob({ type: 'enrich', payload: { projectId: payload.projectId, articleId: draft.id } })
      }
    } catch {}

    // Evaluate draft quality (gate autopublish)
    let passedGate = true
    try {
      const evalResult = await evaluateArticle(payload.projectId, draft.id, { title: draft.title ?? item.title, outline, bodyHtml })
      const threshold = Math.max(0, Math.min(100, Number(process.env.SEOA_ARTICLE_AUTOPUBLISH_THRESHOLD || '80')))
      passedGate = evalResult.score >= threshold
    } catch {}

    // optional immediate publish (policy-driven)
    try {
      const project = await projectsRepo.get(payload.projectId)
      const policy = String((project as any)?.autoPublishPolicy || '')
      if (policy === 'immediate' && passedGate) {
        const integrations = await integrationsRepo.list(String(payload.projectId))
        const { env } = await import('@common/infra/env')
        const target = integrations.find((i) => i.status === 'connected' && env.publicationAllowed.includes(String(i.type)))
        if (target) {
          const { publishJob, queueEnabled } = await import('@common/infra/queue')
          if (queueEnabled()) {
            await publishJob({ type: 'publish', payload: { articleId: draft.id, integrationId: target.id } })
          }
        }
      } else if (policy === 'immediate' && !passedGate) {
        try { const { appendJsonl } = await import('@common/bundle/store'); appendJsonl(payload.projectId, 'logs/jobs.jsonl', { id: `gate_${draft.id}`, type: 'evaluate', status: 'failed', at: new Date().toISOString(), reason: 'quality_gate' }) } catch {}
      }
    } catch {}
  } catch {
    // leave stub body
  }
}
