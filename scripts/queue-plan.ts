import { publishJob, queueEnabled } from '@common/infra/queue'
import { planRepo } from '@entities/article/planner'

const websiteId = process.argv[2]
const days = Number(process.argv[3] ?? '30')

if (!websiteId) {
  console.error('usage: node --loader tsx scripts/queue-plan.ts <websiteId> [days]')
  process.exit(1)
}

(async () => {
  if (Number.isNaN(days) || days <= 0) {
    throw new Error(`invalid days: ${days}`)
  }

  if (queueEnabled()) {
    const jobId = await publishJob({ type: 'plan', payload: { websiteId, days } })
    console.log(JSON.stringify({ mode: 'queue', jobId }))
  } else {
    const result = await planRepo.createPlan(websiteId, days, { draftDays: 3 })
    console.log(JSON.stringify({ mode: 'direct', result }))
  }
})()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
