import { getAuthHeader } from './auth'
import { log } from '@src/common/logger'
import { HTTP_TIMEOUT_MS } from '@src/common/http/timeout'
import { withRetry } from '@common/async/retry'
import { isRetryableDataForSeo } from './retry'

const BASE_URL = 'https://api.dataforseo.com'
const ENDPOINT = '/v3/dataforseo_labs/google/keyword_overview/live'

export type KeywordOverviewItem = {
  keyword: string
  keyword_info: Record<string, unknown> | null
  keyword_properties: Record<string, unknown> | null
  impressions_info: Record<string, unknown> | null
}

export async function keywordOverview(params: { keyword: string; languageCode: string; locationCode: number }): Promise<KeywordOverviewItem | null> {
  const keyword = String(params.keyword || '').trim()
  if (!keyword) throw new Error('keywordOverview: keyword required')
  const auth = getAuthHeader()
  if (!auth) throw new Error('DataForSEO credentials missing')
  log.debug('[dfs.keywordOverview] request', { keyword, languageCode: params.languageCode, locationCode: params.locationCode })

  const task = {
    language_code: params.languageCode,
    location_code: params.locationCode,
    keywords: [keyword]
  }

  const json = await withRetry(async () => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS)
    try {
      const res = await fetch(`${BASE_URL}${ENDPOINT}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: auth
        },
        body: JSON.stringify([task]),
        signal: controller.signal
      })

      const text = await res.text()
      if (!res.ok) {
        log.error('[dfs.keywordOverview] http_error', { status: res.status, summary: summarizeBody(text) })
        const error = new Error(`DataForSEO HTTP ${res.status}`)
        ;(error as any).status = res.status
        throw error
      }

      const parsed = safeParseJson(text)
      if (!parsed) {
        log.warn('[dfs.keywordOverview] invalid_json')
        return null
      }
      log.debug('[dfs.keywordOverview] raw_response', {
        keyword,
        languageCode: params.languageCode,
        locationCode: params.locationCode,
        statusCode: parsed?.status_code ?? null,
        statusMessage: parsed?.status_message ?? null,
        cost: parsed?.cost ?? null,
        tasksCount: Array.isArray(parsed?.tasks) ? parsed.tasks.length : null,
        tasksError: parsed?.tasks_error ?? null,
        taskIds: Array.isArray(parsed?.tasks) ? parsed.tasks.map((task: any) => task?.id).filter(Boolean) : null,
        summary: summarizeBody(text)
      })
      return parsed
    } finally {
      clearTimeout(timeout)
    }
  }, {
    label: 'dfs.keywordOverview',
    retryOn: (error) => isRetryableDataForSeo(error),
    onRetry: ({ attempt, delayMs, error }) => {
      log.warn('[dfs.keywordOverview] retry', { attempt, delayMs, message: (error as Error)?.message })
    }
  })

  if (!json) {
    return null
  }

  const tasks = Array.isArray(json?.tasks) ? json.tasks : []
  if (!tasks.length) {
    log.debug('[dfs.keywordOverview] empty_payload', {
      keyword,
      languageCode: params.languageCode,
      locationCode: params.locationCode,
      reason: 'no_tasks'
    })
  }
  for (const taskResult of tasks) {
    const results = Array.isArray(taskResult?.result) ? taskResult.result : []
    if (!results.length) {
      log.debug('[dfs.keywordOverview] empty_payload', {
        keyword,
        languageCode: params.languageCode,
        locationCode: params.locationCode,
        reason: 'no_results',
        taskId: taskResult?.id ?? null,
        taskStatusCode: taskResult?.status_code ?? null,
        taskStatusMessage: taskResult?.status_message ?? null,
        taskResultCount: taskResult?.result_count ?? null
      })
    }
    for (const result of results) {
      const items = Array.isArray((result as any)?.items) ? (result as any).items : [result]
      for (const item of items) {
        const overview = item?.keyword_data || item
        const formatted: KeywordOverviewItem = {
          keyword: String(
            overview?.keyword ||
              overview?.keyword_info?.keyword ||
              result?.keyword_data?.keyword ||
              keyword ||
              ''
          ).trim(),
          keyword_info: normalizeObject(overview?.keyword_info || item?.keyword_info || result?.keyword_info),
          keyword_properties: normalizeObject(overview?.keyword_properties || item?.keyword_properties || result?.keyword_properties),
          impressions_info: normalizeObject(overview?.impressions_info || item?.impressions_info || result?.impressions_info)
        }
        if (formatted.keyword) return formatted
      }
    }
  }

  log.info('[dfs.keywordOverview] no results', {
    keyword,
    languageCode: params.languageCode,
    locationCode: params.locationCode,
    tasksCount: tasks.length,
    tasksError: json?.tasks_error ?? null
  })
  return null
}

function normalizeObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

function safeParseJson(text: string): any {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function summarizeBody(text: string): Record<string, unknown> {
  if (!text) return {}
  const parsed = safeParseJson(text)
  if (parsed && typeof parsed === 'object') {
    const out: Record<string, unknown> = {}
    if (parsed.status_code !== undefined) out.statusCode = parsed.status_code
    if (parsed.status_message) out.statusMessage = parsed.status_message
    if (parsed.error) out.error = parsed.error
    if (parsed.error_message) out.errorMessage = parsed.error_message
    if (parsed.tasks_error !== undefined) out.tasksError = parsed.tasks_error
    if (Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
      const firstTask = parsed.tasks[0]
      if (firstTask?.status_code !== undefined) out.taskStatusCode = firstTask.status_code
      if (firstTask?.status_message) out.taskStatusMessage = firstTask.status_message
      if (firstTask?.result_count !== undefined) out.taskResultCount = firstTask.result_count
    }
    return Object.keys(out).length ? out : { raw: truncate(text) }
  }
  return { raw: truncate(text) }
}

function truncate(value: string, max = 240) {
  return value.length <= max ? value : `${value.slice(0, max)}…`
}
