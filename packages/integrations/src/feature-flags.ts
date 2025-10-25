import { eq } from 'drizzle-orm'
import type { Database } from '@seo-agent/db'
import { schema } from '@seo-agent/db'
import { FeatureConfigSchema, type FeatureConfig } from '@seo-agent/domain'

export type FeatureFlagValue = unknown

export type FeatureFlag = {
  key: string
  enabled: boolean
  value: FeatureFlagValue | null
}

export const getFeatureFlag = async (
  db: Database,
  key: string,
  defaultValue: boolean,
): Promise<boolean> => {
  const row = await db.query.featureFlags.findFirst({
    where: (flags, { eq: equals }) => equals(flags.key, key)
  })
  if (!row) return defaultValue
  if (!row.enabled) return false
  if (typeof row.value === 'boolean') {
    return row.value
  }
  return row.enabled
}

export const resolveFeatureConfig = async (db: Database): Promise<FeatureConfig> => {
  const rows = await db.select().from(schema.featureFlags)
  const base: FeatureConfig = FeatureConfigSchema.parse({})
  const result: Partial<FeatureConfig> = {}

  for (const row of rows) {
    switch (row.key) {
      case 'seo-provider-metrics':
        if (row.enabled && typeof row.value === 'string') {
          result.metricsProvider = row.value as FeatureConfig['metricsProvider']
        }
        break
      case 'seo-autopublish-policy':
        if (row.enabled && typeof row.value === 'string') {
          result.autoPublishPolicy = row.value as FeatureConfig['autoPublishPolicy']
        }
        break
      case 'seo-buffer-days':
        if (row.enabled && typeof row.value === 'number') {
          result.bufferDays = row.value
        }
        break
      case 'seo-crawl-budget':
        if (row.enabled && typeof row.value === 'number') {
          result.crawlBudget = row.value
        }
        break
      case 'seo-playwright-headless':
        if (typeof row.value === 'boolean') {
          result.playwrightHeadless = row.enabled && row.value
        } else {
          result.playwrightHeadless = row.enabled
        }
        break
      case 'seo-publication-allowed':
        if (row.enabled && Array.isArray(row.value)) {
          result.publicationAllowed = row.value.filter((value): value is string => typeof value === 'string')
        }
        break
      default:
        break
    }
  }

  return FeatureConfigSchema.parse({ ...base, ...result })
}

export const upsertFeatureFlag = async (
  db: Database,
  key: string,
  value: FeatureFlagValue,
  enabled = true,
): Promise<void> => {
  const existing = await db.query.featureFlags.findFirst({
    where: (flags, { eq: equals }) => equals(flags.key, key)
  })
  if (existing) {
    await db
      .update(schema.featureFlags)
      .set({ value, enabled, updatedAt: new Date() })
      .where(eq(schema.featureFlags.key, key))
  } else {
    await db.insert(schema.featureFlags).values({ key, value, enabled })
  }
}
