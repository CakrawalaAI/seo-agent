import { createJobQueue, type JobQueue } from '@seo-agent/queue'

let cachedQueue: JobQueue | null = null

export const getJobQueue = (): JobQueue => {
  if (!cachedQueue) {
    cachedQueue = createJobQueue()
    cachedQueue.ready.catch((error) => {
      console.warn('[platform] job queue not ready', error)
    })
  }
  return cachedQueue
}

export type { JobQueue }
