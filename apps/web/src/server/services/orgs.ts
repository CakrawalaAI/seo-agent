// @ts-nocheck
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { DEFAULT_BUFFER_DAYS } from '@seo-agent/domain'
import type {
  CreateIntegrationInput,
  CreateOrgInput,
  CreateProjectInput,
  CreateProjectResponse,
  Integration,
  Org,
  Project
} from '@seo-agent/domain'
import { getDb, schema } from '../db'
import { startCrawl } from './crawl'
import { buildTestPortableArticle, deliverWebhookPublish } from '@seo-agent/cms'
import { ensureProjectSlotAvailable } from './billing'

export const createOrg = async (input: CreateOrgInput): Promise<Org> => {
  const db = getDb()
  const id = randomUUID()
  const [record] = await db
    .insert(schema.orgs)
    .values({
      id,
      name: input.name,
      plan: input.plan,
      entitlements: input.entitlements,
      createdAt: new Date()
    })
    .returning()

  return {
    id: record.id,
    name: record.name,
    plan: record.plan,
    entitlementsJson: record.entitlements as Org['entitlementsJson'],
    createdAt: record.createdAt.toISOString()
  }
}

export const createProject = async (
  input: CreateProjectInput
): Promise<CreateProjectResponse> => {
  const { entitlements } = await ensureProjectSlotAvailable(input.orgId)
  const db = getDb()
  const id = randomUUID()
  const autoPublishPolicy =
    entitlements.autoPublishPolicy === 'manual' ||
    entitlements.autoPublishPolicy === 'immediate' ||
    entitlements.autoPublishPolicy === 'buffered'
      ? entitlements.autoPublishPolicy
      : 'buffered'
  const bufferDays = Number.isFinite(entitlements.bufferDays)
    ? Math.max(Number(entitlements.bufferDays), 0)
    : DEFAULT_BUFFER_DAYS
  const [record] = await db
    .insert(schema.projects)
    .values({
      id,
      orgId: input.orgId,
      name: input.name,
      siteUrl: input.siteUrl,
      defaultLocale: input.defaultLocale,
      branding: input.branding,
      autoPublishPolicy,
      bufferDays,
      createdAt: new Date()
    })
    .returning()

  const crawlJob = await startCrawl(record.id)

  return {
    project: {
      id: record.id,
      orgId: record.orgId,
      name: record.name,
      siteUrl: record.siteUrl,
      defaultLocale: record.defaultLocale,
      brandingJson: record.branding as Project['brandingJson'],
      autoPublishPolicy: record.autoPublishPolicy ?? undefined,
      bufferDays: record.bufferDays ?? undefined,
      createdAt: record.createdAt.toISOString()
    },
    crawlJobId: crawlJob.jobId
  }
}

export const createIntegration = async (
  input: CreateIntegrationInput
): Promise<Integration> => {
  const db = getDb()
  const id = randomUUID()
  const [record] = await db
    .insert(schema.integrations)
    .values({
      id,
      projectId: input.projectId,
      type: input.type,
      config: input.config,
      status: input.status ?? 'paused',
      createdAt: new Date()
    })
    .returning()

  return {
    id: record.id,
    projectId: record.projectId,
    type: record.type as Integration['type'],
    configJson: record.config as Integration['configJson'],
    status: record.status as Integration['status'],
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt ? record.updatedAt.toISOString() : undefined
  }
}

export const getOrg = async (id: string) => {
  const db = getDb()
  return db.query.orgs.findFirst({
    where: eq(schema.orgs.id, id)
  })
}

const resolveWebhookConfig = (record: typeof schema.integrations.$inferSelect) => {
  const config = (record?.config as Record<string, unknown>) ?? {}
  const targetUrl = typeof config.targetUrl === 'string' ? config.targetUrl : null
  const secret = typeof config.secret === 'string' ? config.secret : null
  if (!targetUrl || !secret) {
    const error = new Error('Webhook integration missing targetUrl or secret')
    ;(error as any).code = 'invalid_config'
    throw error
  }
  return { targetUrl, secret }
}

export const testIntegration = async (integrationId: string) => {
  const db = getDb()
  const integration = await db.query.integrations.findFirst({
    where: eq(schema.integrations.id, integrationId)
  })

  if (!integration) {
    const error = new Error('Integration not found')
    ;(error as any).code = 'not_found'
    throw error
  }

  switch (integration.type) {
    case 'webhook': {
      const { targetUrl, secret } = resolveWebhookConfig(integration)
      const project = await db.query.projects.findFirst({
        where: eq(schema.projects.id, integration.projectId)
      })

      const article = buildTestPortableArticle(project?.name)
      await deliverWebhookPublish({
        targetUrl,
        secret,
        article,
        articleId: `test-${integrationId}`,
        integrationId,
        projectId: integration.projectId,
        event: 'article.test',
        idempotencyKey: `integration-test:${integrationId}:${Date.now()}`
      })

      return { status: 'ok', message: 'Integration test event delivered' }
    }
    default: {
      const error = new Error(`Integration type ${integration.type} not supported`)
      ;(error as any).code = 'unsupported'
      throw error
    }
  }
}
