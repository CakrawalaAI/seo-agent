import { AsyncLocalStorage } from 'node:async_hooks'

export type PublishContext = {
  integrationId?: string | null
  websiteId?: string | null
  trigger?: 'auto' | 'manual' | 'test' | null
}

const storage = new AsyncLocalStorage<PublishContext>()

export function withPublishContext<T>(ctx: PublishContext, fn: () => Promise<T> | T): Promise<T> | T {
  return storage.run(ctx, fn) as any
}

export function getPublishContext(): PublishContext {
  return storage.getStore() ?? {}
}
