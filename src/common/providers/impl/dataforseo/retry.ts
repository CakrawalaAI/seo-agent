export function isRetryableDataForSeo(error: unknown): boolean {
  const status = (error as any)?.status
  if (typeof status === 'number') {
    return status >= 500 || status === 429
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    return msg.includes('network') || msg.includes('fetch') || msg.includes('timeout') || msg.includes('abort')
  }
  return false
}
