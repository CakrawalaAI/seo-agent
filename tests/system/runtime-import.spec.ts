import { describe, it, expect } from 'vitest'

const modules = [
  () => import('../../src/worker/processors/crawler'),
  () => import('../../src/worker/processors/discovery'),
  () => import('../../src/worker/processors/generate'),
  () => import('../../src/worker/processors/enrich'),
  () => import('../../src/common/infra/jobs'),
  () => import('../../src/entities/crawl/repository'),
  () => import('../../src/app/routes/api/projects/$projectId/snapshot'),
  () => import('../../src/app/routes/api/crawl/pages'),
  () => import('../../src/app/routes/api/projects/$projectId/link-graph')
]

describe('system: runtime imports', () => {
  it('imports critical modules without throwing', async () => {
    for (const loader of modules) {
      await expect(loader()).resolves.toBeTruthy()
    }
  })
})
