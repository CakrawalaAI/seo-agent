import { configRepo } from '@entities/config/repository'

export type KeywordRegenerateConfig = {
  lastRequestedAt?: string | null
  lastCompletedAt?: string | null
  lastFailedAt?: string | null
  lastJobId?: string | null
  lastRequestId?: string | null
  lastStatus?: 'queued' | 'completed' | 'failed'
}

const CONFIG_KEY = 'keywords.regenerate'

export async function getKeywordRegenerateConfig(websiteId: string) {
  const record = await configRepo.get<KeywordRegenerateConfig>('website', CONFIG_KEY, websiteId)
  return record?.valueJson ?? null
}

export async function setKeywordRegenerateConfig(websiteId: string, value: KeywordRegenerateConfig) {
  await configRepo.set('website', CONFIG_KEY, value, websiteId)
}
