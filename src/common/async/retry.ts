import { env } from '@common/infra/env'

type RetryHookArgs = {
  attempt: number
  maxAttempts: number
  delayMs: number
  error: unknown
  label?: string
}

export type RetryOptions = {
  attempts?: number
  baseDelayMs?: number
  maxDelayMs?: number
  backoffFactor?: number
  jitterRatio?: number
  retryOn?: (error: unknown) => boolean
  onRetry?: (args: RetryHookArgs) => void
  label?: string
}

const DEFAULT_BASE_DELAY = 300
const DEFAULT_MAX_DELAY = 5000
const DEFAULT_BACKOFF = 2
const DEFAULT_JITTER = 0.2

export async function withRetry<T>(operation: (attempt: number) => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const maxAttempts = Math.max(1, options.attempts ?? env.externalRetryAttempts ?? 3)
  const baseDelay = options.baseDelayMs ?? DEFAULT_BASE_DELAY
  const maxDelay = options.maxDelayMs ?? DEFAULT_MAX_DELAY
  const factor = options.backoffFactor ?? DEFAULT_BACKOFF
  const jitterRatio = options.jitterRatio ?? DEFAULT_JITTER

  let attempt = 0
  let lastError: unknown = null

  while (attempt < maxAttempts) {
    try {
      return await operation(attempt + 1)
    } catch (error) {
      lastError = error
      attempt++
      if (attempt >= maxAttempts) {
        break
      }
      if (options.retryOn && !options.retryOn(error)) {
        throw error
      }
      const delayNoJitter = Math.min(maxDelay, Math.round(baseDelay * Math.pow(factor, attempt - 1)))
      const jitter = Math.random() * delayNoJitter * jitterRatio
      const delayMs = Math.round(delayNoJitter + jitter)
      if (options.onRetry) {
        options.onRetry({ attempt: attempt + 1, maxAttempts, delayMs, error, label: options.label })
      }
      await sleep(delayMs)
    }
  }

  throw lastError ?? new Error('retry_failed')
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)))
}
