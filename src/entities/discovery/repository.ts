type DiscoveryRun = {
  providersUsed: string[]
  startedAt: string
  finishedAt: string
  status: string
  costMeterJson?: Record<string, unknown>
  summaryJson?: Record<string, unknown>
}

const byProject = new Map<string, DiscoveryRun>()

export const discoveryRepo = {
  record(projectId: string, run: DiscoveryRun) {
    byProject.set(projectId, run)
  },
  latest(projectId: string): DiscoveryRun | null {
    return byProject.get(projectId) ?? null
  }
}

