import * as bundle from '@common/bundle/store'

export async function processFeedback(payload: { websiteId: string }) {
  // Placeholder: write a stub GSC metrics file to bundle; real integration deferred
  const day = new Date().toISOString().slice(0, 10)
  try {
    bundle.writeJson(payload.websiteId, `metrics/gsc/${day}.json`, { ok: false, note: 'GSC integration not configured', at: new Date().toISOString() })
    bundle.appendLineage(payload.websiteId, { node: 'feedback', outputs: { day } })
  } catch {}
}
