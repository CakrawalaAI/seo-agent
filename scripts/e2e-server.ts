import http from 'node:http'
import { Readable } from 'node:stream'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const port = Number(process.env.PORT || process.env.PLAYWRIGHT_PORT || 4000)
const host = process.env.HOST || '0.0.0.0'

const { default: app } = await import('../dist/server/server.js')
const clientRoot = path.join(process.cwd(), 'dist', 'client')

const contentTypes: Record<string, string> = {
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
}

async function serveStatic(pathname: string, res: http.ServerResponse) {
  const filePath = path.join(clientRoot, pathname)
  try {
    const file = await readFile(filePath)
    const ext = path.extname(filePath)
    const type = contentTypes[ext] || 'application/octet-stream'
    res.statusCode = 200
    res.setHeader('Content-Type', type)
    res.end(file)
    return true
  } catch {
    return false
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const origin = `http://${req.headers.host || `${host}:${port}`}`
    const url = new URL(req.url || '/', origin)

    if (req.method === 'GET') {
      const pathname = url.pathname
      if (pathname.startsWith('/assets/') || pathname === '/favicon.ico' || pathname === '/manifest.webmanifest') {
        const served = await serveStatic(pathname.replace(/^\/+/, ''), res)
        if (served) {
          return
        }
      }
    }

    const init: RequestInit = {
      method: req.method,
      headers: req.headers as Record<string, string>
    }
    if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
      const body = Readable.toWeb(req)
      init.body = body as unknown as BodyInit
      ;(init as any).duplex = 'half'
    }
    const request = new Request(url, init)
    const response = await app.fetch(request)
    res.statusCode = response.status
    res.statusMessage = response.statusText
    const setCookie: string[] = []
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') {
        setCookie.push(value)
      } else {
        res.setHeader(key, value)
      }
    })
    if (setCookie.length) {
      res.setHeader('set-cookie', setCookie)
    }
    if (!response.body) {
      res.end()
      return
    }
    const readable = Readable.fromWeb(response.body)
    readable.pipe(res)
  } catch (error) {
    console.error('[e2e-server] request error', error)
    res.statusCode = 500
    res.end('Internal Server Error')
  }
})

const shutdown = () => {
  server.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

server.listen(port, host, () => {
  const displayHost = host === '0.0.0.0' ? 'localhost' : host
  console.log(`[e2e-server] listening on http://${displayHost}:${port}`)
})
