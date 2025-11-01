import { projectsRepo } from '@entities/project/repository'
import { planRepo } from '@entities/plan/repository'
import { articlesRepo } from '@entities/article/repository'
import { integrationsRepo } from '@entities/integration/repository'
import { hasDatabase } from '@common/infra/db'
import { queueEnabled, publishJob } from '@common/infra/queue'
import { env } from '@common/infra/env'

function ymd(d: Date) { return d.toISOString().slice(0, 10) }
function daysBetween(a: Date, b: Date) { return Math.floor((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000)) }

export async function runDailySchedules() {
  const today = ymd(new Date())
  const projects = await projectsRepo.list({ limit: 500 })
  let totalDrafts = 0
  let totalPublishes = 0
  for (const project of projects) {
    const projectId = project.id
    // Credits gating removed (org_usage dropped)
    let remainingCredits = Infinity
    // Generate drafts for today
    const plan = await planRepo.list(projectId, 365)
    const existing = new Map((await articlesRepo.list(projectId, 999)).map((a) => [a.id, a]))
    for (const item of plan) {
      if (item.plannedDate === today && !existing.has(item.id)) {
        if (totalDrafts >= remainingCredits) break
        try {
          await articlesRepo.createDraft({ projectId, planItemId: item.id, title: item.title })
        } catch (e) {
          if ((e as Error)?.message === 'credit_exceeded') break
          throw e
        }
        if (queueEnabled()) {
          await publishJob({ type: 'generate', payload: { projectId, planItemId: item.id } })
        }
        totalDrafts++
      }
    }
    // Buffered autopublish
    try {
      const policy = String(project.autoPublishPolicy || env.autopublishPolicy)
      const bufferDays = Number(project.bufferDays ?? env.bufferDays)
      const target = (await integrationsRepo.list(projectId)).find((i) => i.status === 'connected' && env.publicationAllowed.includes(String(i.type)))
      if (target) {
        const drafts = (await articlesRepo.list(projectId, 200)).filter((a) => a.status === 'draft')
        for (const d of drafts) {
          const planItem = plan.find((p) => p.id === d.id)
          if (!planItem) continue
          const ageOk = policy === 'buffered' && planItem.plannedDate ? daysBetween(new Date(planItem.plannedDate), new Date()) >= Math.max(0, bufferDays) : false
          const hasBody = typeof d.bodyHtml === 'string' && d.bodyHtml.replace(/<[^>]+>/g, ' ').trim().length > 5
          if (ageOk && hasBody && queueEnabled()) {
            await publishJob({ type: 'publish', payload: { articleId: d.id, integrationId: target.id } })
            totalPublishes++
          }
        }
      }
    } catch {}
  }
  console.info('[scheduler] daily run', { today, generatedDrafts: totalDrafts, published: totalPublishes })
  return { generatedDrafts: totalDrafts, publishedArticles: totalPublishes }
}
