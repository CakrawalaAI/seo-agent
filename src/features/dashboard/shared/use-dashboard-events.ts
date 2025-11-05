import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'

type DashboardProgressPayload = {
  crawlProgress?: {
    crawledCount: number
    targetCount: number
    startedAt: string | null
    completedAt: string | null
  }
  crawlStatus?: 'idle' | 'running' | 'cooldown'
  crawlCooldownExpiresAt?: string | null
  lastCrawlAt?: string | null
  keywordProgress?: {
    total: number
  }
  articleProgress?: {
    generatedCount: number
    scheduledCount: number
    targetCount: number
  }
  queueDepth?: number
  playwrightWorkers?: {
    active: number
    max: number
  }
}

type DashboardRealtimeMessage =
  | { type: 'ready'; websiteId: string }
  | { type: 'progress'; websiteId: string; payload: DashboardProgressPayload }

const MAX_BACKOFF_MS = 30_000
const INITIAL_BACKOFF_MS = 2_000

export function useDashboardEvents(
  websiteId: string | null | undefined,
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options
  const queryClient = useQueryClient()
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<number | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!websiteId || !enabled) return

    let manualClose = false
    let backoff = INITIAL_BACKOFF_MS

    const buildUrl = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const port = import.meta.env.VITE_REALTIME_PORT || window.__SEOA_REALTIME_PORT__ || window.location.port
      const host = window.location.hostname
      const portSegment = port ? `:${port}` : ''
      return `${protocol}://${host}${portSegment}/api/websites/${encodeURIComponent(websiteId)}/events`
    }

    const handleMessage = (raw: string) => {
      if (!raw) return
      let parsed: DashboardRealtimeMessage | null = null
      try {
        parsed = JSON.parse(raw)
      } catch (error) {
        console.warn('[dashboard-events] Failed to parse payload', error)
        return
      }
      if (!parsed) return

      if (parsed.type === 'progress' && parsed.payload) {
        const payload = parsed.payload
        queryClient.setQueryData(['dashboard.snapshot', websiteId], (previous: any) => {
          if (!previous || typeof previous !== 'object') return previous
          let changed = false
          const next: Record<string, any> = { ...previous }

          if (payload.crawlProgress) {
            next.crawlProgress = { ...(previous.crawlProgress ?? {}), ...payload.crawlProgress }
            changed = true
          }
          if (payload.crawlStatus) {
            if (previous.crawlStatus !== payload.crawlStatus) changed = true
            next.crawlStatus = payload.crawlStatus
          }
          if ('crawlCooldownExpiresAt' in payload) {
            if (previous.crawlCooldownExpiresAt !== payload.crawlCooldownExpiresAt) changed = true
            next.crawlCooldownExpiresAt = payload.crawlCooldownExpiresAt ?? null
          }
          if ('lastCrawlAt' in payload) {
            if (previous.lastCrawlAt !== payload.lastCrawlAt) changed = true
            next.lastCrawlAt = payload.lastCrawlAt ?? null
          }
          if (payload.keywordProgress) {
            next.keywordProgress = { ...(previous.keywordProgress ?? {}), ...payload.keywordProgress }
            changed = true
          }
          if (payload.articleProgress) {
            next.articleProgress = { ...(previous.articleProgress ?? {}), ...payload.articleProgress }
            changed = true
          }
          if (typeof payload.queueDepth === 'number') {
            if (previous.queueDepth !== payload.queueDepth) changed = true
            next.queueDepth = payload.queueDepth
          }
          if (payload.playwrightWorkers) {
            const prev = previous.playwrightWorkers || null
            if (!prev || prev.active !== payload.playwrightWorkers.active || prev.max !== payload.playwrightWorkers.max) changed = true
            next.playwrightWorkers = payload.playwrightWorkers
          }

          return changed ? next : previous
        })
      }
    }

    const connect = () => {
      const url = buildUrl()
      const socket = new WebSocket(url)
      socketRef.current = socket

      socket.addEventListener('open', () => {
        backoff = INITIAL_BACKOFF_MS
      })

      socket.addEventListener('message', (event) => {
        if (typeof event.data === 'string') handleMessage(event.data)
      })

      socket.addEventListener('close', () => {
        socketRef.current = null
        if (manualClose) return
        if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current)
        reconnectTimer.current = window.setTimeout(connect, backoff)
        backoff = Math.min(backoff * 2, MAX_BACKOFF_MS)
      })

      socket.addEventListener('error', () => {
        socket.close()
      })
    }

    connect()

    return () => {
      manualClose = true
      if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current)
      reconnectTimer.current = null
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [websiteId, enabled, queryClient])
}

declare global {
  interface Window {
    __SEOA_REALTIME_PORT__?: string | number
  }
}
