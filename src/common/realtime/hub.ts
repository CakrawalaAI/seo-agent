import { createServer, STATUS_CODES } from 'node:http'
import { createConnection } from 'node:net'
import type { IncomingMessage } from 'node:http'
import WebSocket, { WebSocketServer } from 'ws'

import { env } from '@common/infra/env'
import { incomingMessageToRequest } from '@common/http/node-request'
import { requireWebsiteAccess } from '@app/api-utils'
import { log } from '@src/common/logger'

export type DashboardProgressPayload = {
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

export type DashboardRealtimeMessage =
  | { type: 'ready'; websiteId: string }
  | { type: 'progress'; websiteId: string; payload: DashboardProgressPayload }

type RealtimeHub = {
  broadcast: (websiteId: string, message: DashboardRealtimeMessage) => void
  relayOnly?: boolean
  relayEndpoint?: string | null
  server?: ReturnType<typeof createServer>
}

const HUB_SYMBOL = Symbol.for('seoa.realtime.hub')
const HEARTBEAT_INTERVAL_MS = 30_000

type AliveSocket = WebSocket & { isAlive?: boolean; websiteId?: string }

export function ensureRealtimeHub(): RealtimeHub | null {
  if (typeof window !== 'undefined') return null
  if (env.realtimeDisableServer) return null
  const globalScope = globalThis as any
  const existing: RealtimeHub | undefined = globalScope[HUB_SYMBOL]
  if (existing) return existing
  const hub = createRealtimeHub()
  globalScope[HUB_SYMBOL] = hub
  return hub
}

type PublishOptions = { skipRelay?: boolean }

export async function publishDashboardProgress(
  websiteId: string,
  payload: DashboardProgressPayload,
  options: PublishOptions = {}
) {
  const hub = ensureRealtimeHub()
  const isLocalHub = !!hub && hub.relayOnly !== true && hub.server?.listening === true
  if (isLocalHub) hub!.broadcast(websiteId, { type: 'progress', websiteId, payload })
  if (options.skipRelay) return
  if (isLocalHub) return
  const endpoint = env.realtimeEndpoint || hub?.relayEndpoint
  if (!endpoint) return
  try {
    const base = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint
    const url = `${base}/api/websites/${encodeURIComponent(websiteId)}/progress`
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payload })
    })
  } catch (error) {
    log.warn('[realtime] relay failed', { websiteId, error: (error as Error)?.message || String(error) })
  }
}

function createRealtimeHub(): RealtimeHub {
  const server = createServer()
  const wss = new WebSocketServer({ noServer: true })
  const connections = new Map<string, Set<AliveSocket>>()
  let heartbeat: NodeJS.Timeout | null = null

  const hub: RealtimeHub = {
    broadcast: (websiteId: string, message: DashboardRealtimeMessage) => {
      const peers = connections.get(websiteId)
      if (!peers || peers.size === 0) return
      const serialized = JSON.stringify(message)
      for (const socket of peers) {
        if (socket.readyState !== WebSocket.OPEN) continue
        try {
          socket.send(serialized)
        } catch (error) {
          log.warn('[realtime] failed to send message', { websiteId, error: (error as Error)?.message })
        }
      }
    },
    relayOnly: false,
    relayEndpoint: env.realtimeEndpoint || null,
    server
  }

  const cleanup = (socket: AliveSocket) => {
    const websiteId = socket.websiteId
    if (!websiteId) return
    const group = connections.get(websiteId)
    if (!group) return
    group.delete(socket)
    if (group.size === 0) connections.delete(websiteId)
  }

  wss.on('connection', (socket: AliveSocket, request: IncomingMessage) => {
    const websiteId = socket.websiteId
    if (!websiteId) {
      socket.close(1008, 'missing website context')
      return
    }
    socket.isAlive = true
    socket.send(JSON.stringify({ type: 'ready', websiteId }))
    socket.on('pong', () => {
      socket.isAlive = true
    })
    socket.on('close', () => cleanup(socket))
    socket.on('error', () => cleanup(socket))
    log.debug('[realtime] connection established', { websiteId })
  })

  server.on('upgrade', async (req, socket, head) => {
    if (!req.url) {
      rejectUpgrade(socket, 400, 'Bad Request')
      return
    }

    const host = req.headers.host ?? `localhost:${env.realtimePort}`
    let pathname = ''
    try {
      const parsed = new URL(req.url, `http://${host}`)
      pathname = parsed.pathname
    } catch {
      rejectUpgrade(socket, 400, 'Bad Request')
      return
    }

    const match = pathname.match(/^\/api\/websites\/([^/]+)\/events$/)
    if (!match) {
      rejectUpgrade(socket, 404, 'Not Found')
      return
    }

    const websiteId = decodeURIComponent(match[1] ?? '')
    if (!websiteId) {
      rejectUpgrade(socket, 400, 'Bad Request')
      return
    }

    const fetchRequest = incomingMessageToRequest(req)

    try {
      await requireWebsiteAccess(fetchRequest, websiteId)
    } catch (error) {
      const response = error instanceof Response ? error : undefined
      const status = response?.status ?? 401
      const statusText = response?.statusText || STATUS_CODES[status] || 'Unauthorized'
      let body = ''
      if (response) {
        try {
          body = await response.text()
        } catch {}
      }
      rejectUpgrade(socket, status, statusText, body)
      return
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      if (hub.relayOnly) {
        try {
          ws.close(1013, 'hub not listening')
        } catch {}
        return
      }
      const aliveSocket = ws as AliveSocket
      aliveSocket.websiteId = websiteId
      const peers = connections.get(websiteId) ?? new Set<AliveSocket>()
      peers.add(aliveSocket)
      connections.set(websiteId, peers)
      wss.emit('connection', aliveSocket, req)
    })
  })

  const startHeartbeat = () => {
    heartbeat = setInterval(() => {
      for (const [websiteId, peers] of connections) {
        for (const socket of peers) {
          if (socket.readyState !== WebSocket.OPEN) {
            cleanup(socket)
            continue
          }
          if (socket.isAlive === false) {
            log.warn('[realtime] terminating stalled connection', { websiteId })
            cleanup(socket)
            try { socket.terminate() } catch {}
            continue
          }
          socket.isAlive = false
          try {
            socket.ping()
          } catch {
            cleanup(socket)
            try { socket.terminate() } catch {}
          }
        }
      }
    }, HEARTBEAT_INTERVAL_MS)
    heartbeat.unref?.()
  }

  const adoptExternalHub = (endpoint: string) => {
    hub.relayOnly = true
    hub.relayEndpoint = endpoint
    hub.server = undefined
    if (heartbeat) {
      clearInterval(heartbeat)
      heartbeat = null
    }
    log.info('[realtime] adopting external hub', { port: env.realtimePort, endpoint })
    try { server.close() } catch {}
    try { wss.close() } catch {}
  }

  const startLocalHub = () => {
    if (hub.relayOnly) return
    if (hub.server?.listening === true) return
    try {
      server.listen(env.realtimePort, () => {
        hub.server = server
        hub.relayOnly = false
        hub.relayEndpoint = env.realtimeEndpoint || null
        log.info('[realtime] hub listening', { port: env.realtimePort })
        startHeartbeat()
      })
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code
      if (code === 'EADDRINUSE') {
        const fallbackEndpoint = env.realtimeEndpoint || `http://127.0.0.1:${env.realtimePort}`
        adoptExternalHub(fallbackEndpoint)
        return
      }
      const message = (error as Error)?.message || String(error)
      log.error('[realtime] hub server error', { message })
    }
  }

  server.on('error', (error: any) => {
    const code = (error as NodeJS.ErrnoException)?.code
    if (code === 'EADDRINUSE') {
      const fallbackEndpoint = env.realtimeEndpoint || `http://127.0.0.1:${env.realtimePort}`
      adoptExternalHub(fallbackEndpoint)
      return
    }
    const message = (error as Error)?.message || String(error)
    log.error('[realtime] hub server error', { message })
  })

  server.on('close', () => {
    if (heartbeat) {
      clearInterval(heartbeat)
      heartbeat = null
    }
    hub.server = undefined
  })

  const probeForExistingHub = () => {
    try {
      const probe = createConnection({ port: env.realtimePort, host: '127.0.0.1' })
      let settled = false
      const settle = (next: () => void) => {
        if (settled) return
        settled = true
        try { probe.destroy() } catch {}
        next()
      }
      probe.once('connect', () => {
        settle(() => {
          const endpoint = env.realtimeEndpoint || `http://127.0.0.1:${env.realtimePort}`
          adoptExternalHub(endpoint)
        })
      })
      probe.once('error', () => {
        settle(() => {
          startLocalHub()
        })
      })
      probe.setTimeout(200, () => settle(startLocalHub))
    } catch {
      startLocalHub()
    }
  }

  probeForExistingHub()

  return hub
}

function rejectUpgrade(socket: any, status: number, statusText: string, body?: string) {
  try {
    const payload = body ?? ''
    const headers = [`HTTP/1.1 ${status} ${statusText}`, 'Connection: close']
    if (payload) {
      headers.push('Content-Type: application/json; charset=utf-8')
      headers.push(`Content-Length: ${Buffer.byteLength(payload)}`)
    }
    socket.write(headers.join('\r\n') + '\r\n\r\n' + payload)
  } catch {}
  try {
    socket.destroy()
  } catch {}
}
