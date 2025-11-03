import Redis from 'ioredis'

type GlobalRedisCache = typeof globalThis & {
  __seoAgentRedis?: Redis
  __seoAgentRedisRegistered?: boolean
}

const globalRedis = globalThis as GlobalRedisCache

export function redisEnabled() {
  return Boolean(process.env.REDIS_URL)
}

export function getRedis(): Redis {
  if (!redisEnabled()) {
    throw new Error('REDIS_URL not set')
  }
  if (globalRedis.__seoAgentRedis) {
    return globalRedis.__seoAgentRedis
  }
  const url = process.env.REDIS_URL as string
  const client = new Redis(url, {
    lazyConnect: false,
    maxRetriesPerRequest: 1,
    enableAutoPipelining: true,
    enableOfflineQueue: false
  })
  if (!globalRedis.__seoAgentRedisRegistered) {
    globalRedis.__seoAgentRedisRegistered = true
    client.on('error', (err) => {
      console.error('[redis] error', { message: err?.message || String(err) })
    })
    client.on('connect', () => {
      const masked = maskRedisUrl(url)
      console.info('[redis] connected', { url: masked })
    })
    client.on('close', () => {
      console.warn('[redis] connection closed')
      globalRedis.__seoAgentRedis = undefined
    })
  }
  globalRedis.__seoAgentRedis = client
  return client
}

export async function closeRedis() {
  try {
    await globalRedis.__seoAgentRedis?.quit()
  } catch {}
  globalRedis.__seoAgentRedis = undefined
}

function maskRedisUrl(raw: string) {
  try {
    const u = new URL(raw)
    const user = u.username || 'default'
    const host = u.hostname || 'localhost'
    const port = u.port ? `:${u.port}` : ''
    return `${u.protocol}//${user}:****@${host}${port}${u.pathname}`
  } catch {
    return 'redis://<invalid>'
  }
}
