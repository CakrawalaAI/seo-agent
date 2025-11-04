import { publishJob, queueEnabled } from '@common/infra/queue'

type Payload = Record<string, unknown>

const [, , typeArg, websiteArg, jsonArg, extraArg] = process.argv

if (!typeArg) {
  console.error('usage: node --import tsx scripts/queue-job.ts <type> [websiteId|-] [payloadJson] [planDays]')
  process.exit(1)
}

(async () => {
  if (!queueEnabled()) {
    throw new Error('queue disabled; publishJob unavailable')
  }
  const type = typeArg as string
  const payload: Payload = {}
  if (websiteArg && websiteArg !== '-') payload.websiteId = websiteArg
  if (jsonArg) {
    try {
      const parsed = JSON.parse(jsonArg)
      Object.assign(payload, parsed)
    } catch (error) {
      throw new Error(`invalid payloadJson: ${(error as Error)?.message || String(error)}`)
    }
  }
  if (type === 'plan') {
    const daysValue = extraArg ? Number(extraArg) : Number(payload.days ?? 30)
    payload.days = Number.isFinite(daysValue) && daysValue > 0 ? daysValue : 30
  }
  const jobId = await publishJob({ type: type as any, payload })
  console.log(JSON.stringify({ type, jobId, payload }))
})()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
