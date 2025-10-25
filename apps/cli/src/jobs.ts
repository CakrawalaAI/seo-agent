export type JobResponse = {
  jobId: string
  status?: string
  skipped?: boolean
  reused?: boolean
}

export const describeJobStatus = (action: string, response: JobResponse) => {
  if (response.skipped) {
    return `${action} skipped${response.status ? ` (${response.status})` : ''} - job ${response.jobId}`
  }
  if (response.reused) {
    return `${action} already running: ${response.jobId}`
  }
  if (response.status && response.status !== 'queued') {
    return `${action} ${response.status}: ${response.jobId}`
  }
  return `${action} queued: ${response.jobId}`
}
