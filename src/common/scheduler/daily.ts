import { projectsRepo } from '@entities/project/repository'
import { articlesRepo } from '@entities/article/repository'
import { integrationsRepo } from '@entities/integration/repository'
import { queueEnabled, publishJob } from '@common/infra/queue'
import { env } from '@common/infra/env'

function ymd(d: Date) { return d.toISOString().slice(0, 10) }
function addDays(base: Date, days: number) {
  const copy = new Date(base)
  copy.setUTCDate(copy.getUTCDate() + days)
  return copy
}

export async function runDailySchedules(opts: { projectId?: string } = {}) {
  const today = ymd(new Date())
  const threshold = ymd(addDays(new Date(), 3))
  const projects = opts.projectId
    ? (() => {
        if (!opts.projectId) return []
        return projectsRepo.get(opts.projectId).then((p) => (p ? [p] : []))
      })()
    : projectsRepo.list({ limit: 500 })
  const projectList = Array.isArray(projects) ? projects : await projects
  let queuedGenerations = 0
  let queuedPublishes = 0
  for (const project of projectList) {
    const projectId = project.id
    if (!project.planningApproved) continue
    const articles = await articlesRepo.list(projectId, 365)
    const integrations = await integrationsRepo.list(projectId)
    const publishTarget = integrations.find((i) => i.status === 'connected' && env.publicationAllowed.includes(String(i.type)))
    for (const article of articles) {
      const plannedDate = article.plannedDate
      if (!plannedDate) continue
      if (article.status === 'queued' && plannedDate <= threshold) {
        if (queueEnabled()) {
          await publishJob({ type: 'generate', payload: { projectId, planItemId: article.id } })
          queuedGenerations++
        }
      } else if (article.status === 'scheduled' && plannedDate <= today && publishTarget) {
        if (queueEnabled()) {
          await publishJob({ type: 'publish', payload: { articleId: article.id, integrationId: publishTarget.id } })
          queuedPublishes++
        }
      }
    }
  }
  console.info('[scheduler] daily run', { today, queuedGenerations, queuedPublishes })
  return { queuedGenerations, queuedPublishes }
}
