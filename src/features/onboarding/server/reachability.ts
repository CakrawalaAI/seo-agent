type ReachabilityResult = {
  ok: boolean
  status?: number
  error?: string
}

const SKIP_REACHABILITY = false

export async function verifySiteReachable(siteUrl: string, timeoutMs = 5000): Promise<ReachabilityResult> {
  if (SKIP_REACHABILITY) return { ok: true }
  if (/localhost|127\.0\.0\.1|\.local$/i.test(siteUrl)) return { ok: true }
  const url = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl
  const head = await fetchWithTimeout(url, { method: 'HEAD', redirect: 'follow' }, timeoutMs)
  if (head.ok) return { ok: true, status: head.status }
  if (head.status === 405 || head.status === 501) {
    const getResp = await fetchWithTimeout(url, { method: 'GET', redirect: 'manual' }, timeoutMs)
    return { ok: getResp.ok, status: getResp.status }
  }
  return { ok: false, status: head.status }
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(input, { ...init, signal: controller.signal })
    return response
  } catch (error) {
    return new Response(null, { status: 599, statusText: (error as Error)?.message || 'timeout' })
  } finally {
    clearTimeout(timer)
  }
}
