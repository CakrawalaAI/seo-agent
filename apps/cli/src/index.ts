#!/usr/bin/env node
import { Command } from 'commander'
import ora from 'ora'
import { readFileSync } from 'node:fs'
import { SeoAgentClient } from '@seo-agent/sdk'
import { OrgMemberRoleSchema } from '@seo-agent/domain'
import type { CrawlPage, CreateIntegrationInput, Project } from '@seo-agent/domain'
import { describeJobStatus } from './jobs.js'
import {
  getSessionCookie,
  persistSessionFromHeaders,
  saveSessionCookie
} from './session.js'
import { appConfig } from '@seo-agent/platform'

const program = new Command()
program.name('seo').description('SEO Agent CLI')

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const createClient = () => {
  const baseUrl = appConfig.urls.apiBase

  const fetchWithSession: typeof fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => {
    const cookie = getSessionCookie()
    const headers = new Headers(init?.headers)
    if (cookie && !headers.has('cookie')) {
      headers.set('cookie', cookie)
    }
    const response = await fetch(input, { ...init, headers })
    persistSessionFromHeaders(response.headers)
    return response
  }

  return new SeoAgentClient({ baseUrl, fetch: fetchWithSession })
}

const parseLimitOption = (value: unknown, fallback: number) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return fallback
}

const parseOptionalInt = (value?: string) => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

const parseOptionalFloat = (value?: string) => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number.parseFloat(trimmed)
  return Number.isFinite(parsed) ? parsed : undefined
}

const readArticleUpdatePayload = () => {
  if (process.stdin.isTTY) {
    console.error('Provide article update JSON via stdin. Example: cat article.json | seo article edit --id <articleId>')
    process.exitCode = 1
    return null
  }

  let raw = ''
  try {
    raw = readFileSync(0, 'utf8')
  } catch (error) {
    console.error('Failed to read stdin', error)
    process.exitCode = 1
    return null
  }

  const trimmed = raw.trim()
  if (!trimmed) {
    console.error('No JSON payload provided on stdin')
    process.exitCode = 1
    return null
  }

  try {
    return JSON.parse(trimmed)
  } catch (error) {
    console.error('Invalid JSON on stdin')
    console.error(trimmed)
    process.exitCode = 1
    return null
  }
}

type ProjectCreateOptions = {
  org: string
  name: string
  url: string
  locale?: string
}

const executeProjectCreate = async (options: ProjectCreateOptions) => {
  const spinner = ora('Creating project').start()
  try {
    const client = createClient()
    const result = await client.createProject({
      orgId: options.org,
      name: options.name,
      siteUrl: options.url,
      defaultLocale: options.locale ?? 'en-US'
    })
    spinner.succeed(`Project created: ${result.project.id}`)
    if (result.crawlJobId) {
      console.log(`Crawl job enqueued: ${result.crawlJobId}`)
    }
  } catch (error) {
    spinner.fail('Failed to create project')
    handleError(error)
  }
}

const executeProjectUpdate = async (options: {
  id: string
  locale?: string
  policy?: string
  buffer?: string
}) => {
  const spinner = ora('Updating project').start()
  try {
    const client = createClient()
    const payload: Record<string, unknown> = {}
    if (options.locale) {
      payload.defaultLocale = options.locale
    }
    if (options.policy) {
      const policy = options.policy.toLowerCase()
      if (!['buffered', 'immediate', 'manual'].includes(policy)) {
        spinner.fail('Policy must be buffered, immediate, or manual')
        process.exitCode = 1
        return
      }
      payload.autoPublishPolicy = policy
    }
    if (options.buffer !== undefined) {
      const parsed = Number.parseInt(options.buffer ?? '', 10)
      if (Number.isFinite(parsed)) {
        payload.bufferDays = parsed
      }
    }
    if (Object.keys(payload).length === 0) {
      spinner.fail('Provide at least one field to update')
      process.exitCode = 1
      return
    }
    const project = await client.updateProject(options.id, payload as any)
    spinner.succeed('Project updated')
    console.log(JSON.stringify(project, null, 2))
  } catch (error) {
    spinner.fail('Failed to update project')
    handleError(error)
  }
}

type ProjectListOptions = {
  org?: string
  limit?: string
  cursor?: string
}

const executeProjectList = async (options: ProjectListOptions) => {
  try {
    const client = createClient()
    const limit = options.limit ? parseLimitOption(options.limit, 20) : undefined
    const response = await client.listProjects({
      orgId: options.org,
      cursor: options.cursor,
      limit
    })
    if (response.items.length === 0) {
      console.log('No projects found')
      return
    }
    console.table(
      response.items.map((project: Project) => ({
        id: project.id,
        name: project.name,
        siteUrl: project.siteUrl,
        locale: project.defaultLocale,
        createdAt: project.createdAt
      }))
    )
    if (response.nextCursor) {
      console.log(`Next cursor: ${response.nextCursor}`)
    }
  } catch (error) {
    handleError(error)
  }
}

type IntegrationAddOptions = {
  project: string
  url?: string
  secret?: string
  token?: string
  collection?: string
  publish?: string
  nameField?: string
  slugField?: string
  bodyField?: string
  summaryField?: string
  seoTitleField?: string
  seoDescriptionField?: string
  tagsField?: string
  imageField?: string
  locale?: string
  status?: string
}

const executeIntegrationAdd = async (type: string, options: IntegrationAddOptions) => {
  const spinner = ora('Creating integration').start()
  const normalizedType = type.toLowerCase()

  try {
    const client = createClient()
    let config: Record<string, unknown>

    switch (normalizedType) {
      case 'webhook': {
        if (!options.url) {
          spinner.fail('Webhook requires --url')
          process.exitCode = 1
          return
        }
        if (!options.secret) {
          spinner.fail('Webhook requires --secret')
          process.exitCode = 1
          return
        }
        config = {
          targetUrl: options.url,
          secret: options.secret
        }
        break
      }
      case 'webflow': {
        if (!options.token) {
          spinner.fail('Webflow requires --token')
          process.exitCode = 1
          return
        }
        if (!options.collection) {
          spinner.fail('Webflow requires --collection')
          process.exitCode = 1
          return
        }
        const bodyField = options.bodyField ?? ''
        if (!bodyField) {
          spinner.fail('Webflow requires --body-field')
          process.exitCode = 1
          return
        }
        const publishMode = options.publish?.toLowerCase() === 'live' ? 'live' : 'draft'
        config = {
          accessToken: options.token,
          collectionId: options.collection,
          publishMode,
          fieldMapping: {
            name: options.nameField ?? 'name',
            slug: options.slugField ?? 'slug',
            body: bodyField,
            excerpt: options.summaryField,
            seoTitle: options.seoTitleField,
            seoDescription: options.seoDescriptionField,
            tags: options.tagsField,
            mainImage: options.imageField
          },
          cmsLocaleId: options.locale
        }
        break
      }
      default: {
        spinner.fail(`Integration type ${normalizedType} not supported in MVP`)
        process.exitCode = 1
        return
      }
    }

    const payload: CreateIntegrationInput = {
      projectId: options.project,
      type: normalizedType as CreateIntegrationInput['type'],
      config,
      status: (options.status ?? 'connected') as CreateIntegrationInput['status']
    }

    const integration = await client.createIntegration(payload)

    spinner.succeed(`Integration created: ${integration.id}`)
    console.log(JSON.stringify(integration, null, 2))
  } catch (error) {
    spinner.fail('Failed to create integration')
    handleError(error)
  }
}

const executeIntegrationUpdate = async (options: { id: string; status?: string; url?: string; secret?: string }) => {
  const spinner = ora('Updating integration').start()
  try {
    const client = createClient()
    const payload: Record<string, unknown> = {}
    if (options.status) {
      const status = options.status.toLowerCase()
      if (!['connected', 'paused', 'error'].includes(status)) {
        spinner.fail('Status must be connected, paused, or error')
        process.exitCode = 1
        return
      }
      payload.status = status
    }
    if (options.url || options.secret) {
      const configUpdate: Record<string, unknown> = {}
      if (options.url) {
        configUpdate.targetUrl = options.url
      }
      if (options.secret) {
        configUpdate.secret = options.secret
      }
      if (Object.keys(configUpdate).length > 0) {
        payload.config = configUpdate
      }
    }

    if (!payload.status && !payload.config) {
      spinner.fail('Provide at least one field to update')
      process.exitCode = 1
      return
    }

    const integration = await client.updateIntegration(options.id, payload as any)
    spinner.succeed('Integration updated')
    console.log(JSON.stringify(integration, null, 2))
  } catch (error) {
    spinner.fail('Failed to update integration')
    handleError(error)
  }
}

const executeIntegrationDelete = async (options: { id: string }) => {
  const spinner = ora('Deleting integration').start()
  try {
    const client = createClient()
    await client.deleteIntegration(options.id)
    spinner.succeed('Integration deleted')
  } catch (error) {
    spinner.fail('Failed to delete integration')
    handleError(error)
  }
}

const executeIntegrationTest = async (options: { integration: string }) => {
  const spinner = ora('Triggering integration test').start()
  try {
    const client = createClient()
    const response = await client.testIntegration(options.integration)
    spinner.succeed('Integration test triggered')
    console.log(JSON.stringify(response, null, 2))
  } catch (error) {
    spinner.fail('Integration test failed')
    handleError(error)
  }
}

const executeKeywordsList = async (options: {
  project: string
  limit?: string
  cursor?: string
  status?: string
}) => {
  try {
    const client = createClient()
    const response = await client.listKeywords(options.project, {
      limit: parseLimitOption(options.limit, 20),
      cursor: options.cursor,
      status: options.status
    })
    console.log(JSON.stringify(response, null, 2))
  } catch (error) {
    handleError(error)
  }
}

const executeKeywordAdd = async (options: {
  project: string
  phrase: string
  locale?: string
  topic?: string
  status?: string
  star?: boolean
  volume?: string
  cpc?: string
  competition?: string
  difficulty?: string
  intent?: string
  trend?: string
  opportunity?: string
}) => {
  const spinner = ora('Creating keyword').start()
  try {
    const client = createClient()

    const metrics: Record<string, unknown> = {}
    const volume = parseOptionalInt(options.volume)
    if (volume !== undefined) metrics.searchVolume = volume
    const cpc = parseOptionalFloat(options.cpc)
    if (cpc !== undefined) metrics.cpc = Number(Number(cpc).toFixed(2))
    const competition = parseOptionalFloat(options.competition)
    if (competition !== undefined) metrics.competition = competition
    const difficulty = parseOptionalFloat(options.difficulty)
    if (difficulty !== undefined) metrics.difficulty = difficulty
    if (options.intent) {
      metrics.intent = options.intent
    }
    if (options.trend) {
      const trendValues = options.trend
        .split(',')
        .map((value) => parseOptionalFloat(value))
        .filter((value) => value !== undefined)
      if (trendValues.length > 0) {
        metrics.trend12mo = trendValues
      }
    }

    const payload: Record<string, unknown> = {
      projectId: options.project,
      phrase: options.phrase,
      locale: options.locale ?? 'en-US'
    }

    if (options.topic) {
      payload.primaryTopic = options.topic
    }

    if (Object.keys(metrics).length > 0) {
      payload.metricsJson = metrics
    }

    const opportunity = parseOptionalFloat(options.opportunity)
    if (opportunity !== undefined) {
      payload.opportunityScore = Math.min(100, Math.max(0, opportunity))
    }

    if (options.status) {
      const normalized = options.status.toLowerCase()
      if (!['recommended', 'planned', 'generated'].includes(normalized)) {
        spinner.fail('Status must be recommended, planned, or generated')
        process.exitCode = 1
        return
      }
      payload.status = normalized
    }

    if (options.star) {
      payload.isStarred = true
    }

    const keyword = await client.createKeyword(payload as any)
    spinner.succeed(`Keyword created: ${keyword.id}`)
    console.log(JSON.stringify(keyword, null, 2))
  } catch (error) {
    spinner.fail('Failed to create keyword')
    handleError(error)
  }
}

const executeKeywordDelete = async (options: { id: string }) => {
  const spinner = ora('Deleting keyword').start()
  try {
    const client = createClient()
    await client.deleteKeyword(options.id)
    spinner.succeed('Keyword deleted')
  } catch (error) {
    spinner.fail('Failed to delete keyword')
    handleError(error)
  }
}

const executeKeywordSetStar = async (options: { id: string; star: boolean }) => {
  const spinner = ora(options.star ? 'Starring keyword' : 'Unstarring keyword').start()
  try {
    const client = createClient()
    const keyword = await client.updateKeyword(options.id, { isStarred: options.star })
    spinner.succeed(options.star ? 'Keyword starred' : 'Keyword unstarred')
    console.log(JSON.stringify(keyword, null, 2))
  } catch (error) {
    spinner.fail(options.star ? 'Failed to star keyword' : 'Failed to unstar keyword')
    handleError(error)
  }
}

const executePlanList = async (options: {
  project: string
  limit?: string
  cursor?: string
  status?: string
  month?: string
  from?: string
  to?: string
}) => {
  try {
    const client = createClient()
    let from = options.from ? options.from.trim() : undefined
    let to = options.to ? options.to.trim() : undefined

    if (options.month) {
      const normalized = options.month.trim()
      const match = normalized.match(/^(\d{4})-(\d{2})$/)
      if (!match) {
        throw new Error('Month must be in YYYY-MM format')
      }
      const year = Number.parseInt(match[1]!, 10)
      const monthIndex = Number.parseInt(match[2]!, 10)
      if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 1 || monthIndex > 12) {
        throw new Error('Month must be in YYYY-MM format')
      }
      const start = new Date(Date.UTC(year, monthIndex - 1, 1))
      const end = new Date(Date.UTC(year, monthIndex, 0))
      from = start.toISOString().slice(0, 10)
      to = end.toISOString().slice(0, 10)
    }

    const response = await client.listPlanItems(options.project, {
      limit: parseLimitOption(options.limit, 20),
      cursor: options.cursor,
      status: options.status,
      from,
      to
    })
    console.log(JSON.stringify(response, null, 2))
  } catch (error) {
    handleError(error)
  }
}

const executePlanMove = async (options: { id: string; date: string }) => {
  const spinner = ora('Updating plan item').start()
  try {
    const client = createClient()
    const result = await client.updatePlanItem(options.id, { plannedDate: options.date })
    spinner.succeed(`Plan item moved to ${result.plannedDate}`)
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    spinner.fail('Failed to update plan item')
    handleError(error)
  }
}

const executeScheduleRun = async (options: { project?: string; policy?: string; buffer?: string }) => {
  const spinner = ora('Running schedule').start()
  try {
    const client = createClient()
    const policy = options.policy
      ? {
          policy: options.policy,
          bufferDays: options.buffer ? parseLimitOption(options.buffer, 3) : 3
        }
      : undefined
    const result = await client.runSchedule({ projectId: options.project, policy })
    spinner.succeed('Schedule run complete')
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    spinner.fail('Schedule run failed')
    handleError(error)
  }
}

const executeCrawlRun = async (options: { project: string; maxPages?: string }) => {
  const spinner = ora('Starting crawl').start()
  try {
    const client = createClient()
    const crawlBudget: Record<string, unknown> = {}
    if (options.maxPages) {
      const parsed = parseLimitOption(options.maxPages, 200)
      if (Number.isFinite(parsed)) {
        crawlBudget.maxPages = parsed
      }
    }
    const response = await client.startCrawl(options.project, {
      crawlBudget: Object.keys(crawlBudget).length > 0 ? (crawlBudget as any) : undefined
    })
    const message = describeJobStatus('Crawl', response)
    spinner.succeed(message)
    if (response.status && response.status !== 'queued') {
      console.log(`status: ${response.status}`)
    }
  } catch (error) {
    spinner.fail('Failed to start crawl')
    handleError(error)
  }
}

const executeCrawlStatus = async (options: { job: string }) => {
  try {
    const client = createClient()
    const status = await client.getCrawlStatus(options.job)
    console.log(JSON.stringify(status, null, 2))
  } catch (error) {
    handleError(error)
  }
}

const executeCrawlRuns = async (options: { project?: string; limit?: string; cursor?: string }) => {
  try {
    const client = createClient()
    const limit = options.limit ? parseLimitOption(options.limit, 20) : undefined
    const response = await client.listCrawlRuns({
      projectId: options.project,
      cursor: options.cursor,
      limit
    })
    console.log(JSON.stringify(response, null, 2))
  } catch (error) {
    handleError(error)
  }
}

const executeArticlesList = async (options: { project: string; status?: string; limit?: string; cursor?: string }) => {
  try {
    const client = createClient()
    const response = await client.listArticles(options.project, {
      status: options.status,
      limit: parseLimitOption(options.limit, 20),
      cursor: options.cursor
    })
    console.log(JSON.stringify(response, null, 2))
  } catch (error) {
    handleError(error)
  }
}

const executeArticlePublish = async (options: { id: string; integration: string }) => {
  const spinner = ora('Enqueuing publish job').start()
  try {
    const client = createClient()
    const response = await client.publishArticle(options.id, options.integration)
    spinner.succeed(describeJobStatus('Publish job', response))
  } catch (error) {
    spinner.fail('Failed to enqueue publish job')
    handleError(error)
  }
}

const executeArticleEdit = async (options: { id: string }) => {
  const payload = readArticleUpdatePayload()
  if (!payload) {
    return
  }

  const spinner = ora('Updating article').start()
  try {
    const client = createClient()
    const article = await client.updateArticle(options.id, payload as any)
    spinner.succeed('Article updated')
    console.log(JSON.stringify(article, null, 2))
  } catch (error) {
    spinner.fail('Failed to update article')
    handleError(error)
  }
}

const executeJobWatch = async (options: { id: string; interval?: string }) => {
  const jobId = options.id
  const interval = options.interval ? parseLimitOption(options.interval, 2000) : 2000
  const spinner = ora(`Watching job ${jobId}`).start()
  try {
    const client = createClient()
    let watching = true
    let printedLogs = 0

    while (watching) {
      const job = await client.getJob(jobId)
      const statusLine = job.status === 'running' ? `running (${job.progressPct ?? 0}%)` : job.status
      spinner.text = `Job ${job.id} ${statusLine}`

      const logs = job.logs ?? []
      if (logs.length > printedLogs) {
        spinner.stop()
        for (const log of logs.slice(printedLogs)) {
          const timestamp = log.timestamp ?? new Date().toISOString()
          console.log(`[${log.level}] ${timestamp} - ${log.message}`)
        }
        printedLogs = logs.length
        spinner.start()
        spinner.text = `Job ${job.id} ${statusLine}`
      }

      if (job.status === 'queued' || job.status === 'running') {
        await sleep(interval)
      } else {
        watching = false
        spinner.stop()
        console.log(`Job ${job.id} completed with status: ${job.status}`)
        if (job.progressPct !== undefined) {
          console.log(`Progress: ${job.progressPct}%`)
        }
        const pendingLogs = (job.logs ?? []).slice(printedLogs)
        for (const log of pendingLogs) {
          const timestamp = log.timestamp ?? new Date().toISOString()
          console.log(`[${log.level}] ${timestamp} - ${log.message}`)
        }
      }
    }
  } catch (error) {
    spinner.fail('Failed to watch job')
    handleError(error)
  }
}


program
  .command('ping')
  .description('Check API health')
  .action(async () => {
    const spinner = ora('Pinging SEO Agent API').start()
    try {
      const client = createClient()
      const health = await client.ping()
      spinner.succeed(`API ${health.service} v${health.version}`)
      console.log(`version ${health.version}`)
    } catch (error) {
      spinner.fail('API unreachable')
      handleError(error)
    }
  })

program
  .command('whoami')
  .description('Show current authenticated user')
  .action(async () => {
    const spinner = ora('Fetching profile').start()
    try {
      const client = createClient()
      const me = await client.getCurrentUser()
      if (!me.user) {
        spinner.stop()
        console.log('Not signed in')
        return
      }
      spinner.succeed(`Signed in as ${me.user.email}`)
      if (me.user.name) {
        console.log(`Name: ${me.user.name}`)
      }
      if (me.user.imageUrl) {
        console.log(`Avatar: ${me.user.imageUrl}`)
      }
    } catch (error) {
      spinner.fail('Failed to fetch profile')
      handleError(error)
    }
  })

program
  .command('login')
  .description('Store a session token for CLI usage')
  .requiredOption('--session <token>', 'Session token from browser cookie named "session"')
  .action((options) => {
    const token = String(options.session || '').trim()
    if (!token) {
      console.error('Session token cannot be empty')
      process.exitCode = 1
      return
    }
    saveSessionCookie(`session=${token}`)
    console.log('Session saved. Try `seo whoami` to verify.')
  })

program
  .command('job:watch')
  .description('Stream job status and logs until completion')
  .requiredOption('--id <jobId>', 'Job ID to watch')
  .option('--interval <ms>', 'Polling interval in milliseconds', '2000')
  .action(executeJobWatch)

program
  .command('crawl:pages')
  .description('List recently crawled pages for a project')
  .requiredOption('--project <projectId>', 'Project ID')
  .option('--limit <limit>', 'Number of pages to show (default 10)', '10')
  .option('--cursor <cursor>', 'Pagination cursor')
  .action(async (options) => {
    try {
      const client = createClient()
      const limit = Number.parseInt(options.limit ?? '10', 10) || 10
      const response = await client.listCrawlPages(options.project, {
        cursor: options.cursor,
        limit
      })
      const pages: CrawlPage[] = response.items
      if (pages.length === 0) {
        console.log('No crawl pages found for this project.')
        return
      }

      console.table(
        pages.map((page) => ({
          url: page.url,
          status: page.httpStatus,
          extractedAt: page.extractedAt,
          title: page.metaJson?.title ?? ''
        }))
      )

      if (response.nextCursor) {
        console.log(`Next cursor: ${response.nextCursor}`)
      }
    } catch (error) {
      handleError(error)
    }
  })

program
  .command('org:create')
  .description('Create an organization')
  .requiredOption('-n, --name <name>', 'Org name')
  .requiredOption('-p, --plan <plan>', 'Plan code')
  .action(async (options) => {
    const spinner = ora('Creating organization').start()
    try {
      const client = createClient()
      const org = await client.createOrg({
        name: options.name,
        plan: options.plan,
        entitlements: {
          projectQuota: 1,
          crawlPages: 200,
          dailyArticles: 1,
          autoPublishPolicy: 'buffered',
          bufferDays: 3
        }
      })
      spinner.succeed(`Org created: ${org.id}`)
    } catch (error) {
      spinner.fail('Failed to create org')
      handleError(error)
    }
  })

program
  .command('org:invite')
  .description('Create an invite link for an organization member')
  .requiredOption('--org <orgId>', 'Organization ID')
  .requiredOption('--email <email>', 'Email to invite')
  .option('--role <role>', 'Role to grant (owner|admin|member)', 'member')
  .option('--expires <hours>', 'Expiration in hours (default 72)', '72')
  .action(async (options) => {
    const spinner = ora('Creating invite').start()
    try {
      const client = createClient()
      const parsedRole = OrgMemberRoleSchema.parse(options.role ?? 'member')
      const expires = Number.parseInt(options.expires ?? '72', 10)
      const invite = await client.createOrgInvite({
        orgId: options.org,
        email: options.email,
        role: parsedRole,
        expiresInHours: Number.isFinite(expires) ? expires : 72
      })
      spinner.succeed('Invite created')
      console.log(`Invite URL: ${invite.inviteUrl}`)
    } catch (error) {
      spinner.fail('Failed to create invite')
      handleError(error)
    }
  })

program
  .command('billing:checkout')
  .description('Create a Polar checkout session')
  .requiredOption('--org <orgId>', 'Organization ID')
  .requiredOption('--plan <plan>', 'Plan code to purchase')
  .requiredOption('--success <url>', 'Success redirect URL')
  .requiredOption('--cancel <url>', 'Cancel redirect URL')
  .action(async (options) => {
    const spinner = ora('Creating checkout session').start()
    try {
      const client = createClient()
      const response = await client.createBillingCheckout({
        orgId: options.org,
        plan: options.plan,
        successUrl: options.success,
        cancelUrl: options.cancel
      })
      spinner.succeed('Checkout URL ready')
      console.log(`Checkout URL: ${response.url}`)
    } catch (error) {
      spinner.fail('Failed to create checkout session')
      handleError(error)
    }
  })

program
  .command('billing:portal')
  .description('Fetch the billing portal link for an organization')
  .requiredOption('--org <orgId>', 'Organization ID')
  .option('--return <url>', 'Return URL after portal')
  .action(async (options) => {
    const spinner = ora('Fetching billing portal link').start()
    try {
      const client = createClient()
      const response = await client.getBillingPortalLink({
        orgId: options.org,
        returnUrl: options.return
      })
      spinner.succeed('Portal URL ready')
      console.log(`Portal URL: ${response.url}`)
    } catch (error) {
      spinner.fail('Failed to fetch portal link')
      handleError(error)
    }
  })

program
  .command('project:create')
  .description('Create a project')
  .requiredOption('--org <orgId>', 'Org ID')
  .requiredOption('--name <name>', 'Project name')
  .requiredOption('--url <siteUrl>', 'Site URL')
  .option('--locale <locale>', 'Default locale', 'en-US')
  .action(executeProjectCreate)

const crawlCommand = program
  .command('crawl')
  .description('Crawl workflows')

crawlCommand
  .command('run')
  .description('Start a crawl job for a project')
  .requiredOption('--project <projectId>', 'Project ID')
  .option('--max-pages <count>', 'Override crawl budget')
  .action(executeCrawlRun)

crawlCommand
  .command('status')
  .description('Fetch crawl job status')
  .requiredOption('--job <jobId>', 'Job ID')
  .action(executeCrawlStatus)

crawlCommand
  .command('runs')
  .description('List crawl runs')
  .option('--project <projectId>', 'Filter by project')
  .option('--limit <limit>', 'Result limit', '20')
  .option('--cursor <cursor>', 'Pagination cursor')
  .action(executeCrawlRuns)

program
  .command('discovery:start')
  .description('Start topic discovery')
  .requiredOption('--project <projectId>', 'Project ID')
  .action(async (options) => {
    const spinner = ora('Starting discovery').start()
    try {
      const client = createClient()
      const response = await client.startDiscovery(options.project)
      spinner.succeed(describeJobStatus('Discovery', response))
    } catch (error) {
      spinner.fail('Failed to start discovery')
      handleError(error)
    }
  })

program
  .command('keywords:list')
  .description('List keywords for a project')
  .requiredOption('--project <projectId>', 'Project ID')
  .option('--limit <limit>', 'Result limit', '20')
  .option('--cursor <cursor>', 'Pagination cursor')
  .option('--status <status>', 'Filter by status')
  .action(executeKeywordsList)

const keywordCommand = program
  .command('keyword')
  .description('Keyword workflows')

keywordCommand
  .command('add')
  .description('Add a manual keyword to a project')
  .requiredOption('--project <projectId>', 'Project ID')
  .requiredOption('--phrase <phrase>', 'Keyword phrase')
  .option('--locale <locale>', 'Keyword locale', 'en-US')
  .option('--topic <topic>', 'Primary topic')
  .option('--status <status>', 'Initial status (recommended|planned|generated)')
  .option('--star', 'Mark keyword as starred')
  .option('--volume <number>', 'Search volume estimate')
  .option('--cpc <number>', 'CPC estimate')
  .option('--competition <number>', 'Competition score')
  .option('--difficulty <number>', 'Difficulty score')
  .option('--intent <intent>', 'Primary search intent label')
  .option('--trend <values>', 'Comma separated 12 month trend values')
  .option('--opportunity <score>', 'Opportunity score between 0-100')
  .action((options) => executeKeywordAdd(options))

keywordCommand
  .command('delete')
  .description('Delete a keyword')
  .requiredOption('--id <keywordId>', 'Keyword ID')
  .action((options) => executeKeywordDelete(options))

keywordCommand
  .command('star')
  .description('Star a keyword')
  .requiredOption('--id <keywordId>', 'Keyword ID')
  .action((options) => executeKeywordSetStar({ id: options.id, star: true }))

keywordCommand
  .command('unstar')
  .description('Remove star from a keyword')
  .requiredOption('--id <keywordId>', 'Keyword ID')
  .action((options) => executeKeywordSetStar({ id: options.id, star: false }))

keywordCommand
  .command('generate')
  .description('Trigger keyword discovery for a project')
  .requiredOption('--project <projectId>', 'Project ID')
  .option('--locale <locale>', 'Locale to target', 'en-US')
  .option('--location <location>', 'Geographic location label')
  .option('--max <count>', 'Maximum keyword candidates', '500')
  .option('--gads', 'Include Google Ads bulk volume task')
  .action(async (options) => {
    const spinner = ora('Queuing keyword discovery').start()
    try {
      const client = createClient()
      const response = await client.generateKeywords(options.project, {
        locale: options.locale,
        location: options.location,
        max: parseOptionalInt(options.max),
        includeGAds: Boolean(options.gads)
      })
      const suffix = response.costEstimate
        ? ` (est. $${response.costEstimate.total.toFixed(3)} ${response.costEstimate.currency})`
        : ''
      spinner.succeed(`${describeJobStatus('Keyword discovery', response)}${suffix}`)
    } catch (error) {
      spinner.fail('Failed to enqueue keyword discovery')
      handleError(error)
    }
  })

keywordCommand
  .command('ls')
  .description('List keywords for a project')
  .requiredOption('--project <projectId>', 'Project ID')
  .option('--limit <limit>', 'Result limit', '20')
  .option('--cursor <cursor>', 'Pagination cursor')
  .option('--status <status>', 'Filter by status')
  .action(executeKeywordsList)

const projectCommand = program
  .command('project')
  .description('Project workflows')

projectCommand
  .command('create')
  .description('Create a project')
  .requiredOption('--org <orgId>', 'Org ID')
  .requiredOption('--name <name>', 'Project name')
  .requiredOption('--url <siteUrl>', 'Site URL')
  .option('--locale <locale>', 'Default locale', 'en-US')
  .action(executeProjectCreate)

projectCommand
  .command('ls')
  .description('List projects')
  .option('--org <orgId>', 'Filter by organization')
  .option('--limit <limit>', 'Result limit', '20')
  .option('--cursor <cursor>', 'Pagination cursor')
  .action(executeProjectList)

projectCommand
  .command('update')
  .description('Update project settings')
  .requiredOption('--id <projectId>', 'Project ID')
  .option('--locale <locale>', 'New default locale')
  .option('--policy <policy>', 'Auto-publish policy (buffered|immediate|manual)')
  .option('--buffer <days>', 'Auto-publish buffer days')
  .action(executeProjectUpdate)

const integrationCommand = program
  .command('integration')
  .description('Integration workflows')

integrationCommand
  .command('add')
  .description('Create a new integration')
  .argument('<type>', 'Integration type (webhook|webflow)')
  .requiredOption('--project <projectId>', 'Project ID')
  .option('--url <targetUrl>', 'Target URL (webhook)')
  .option('--secret <secret>', 'Shared secret (webhook)')
  .option('--token <accessToken>', 'Webflow access token')
  .option('--collection <collectionId>', 'Webflow collection ID')
  .option('--publish <mode>', 'Webflow publish mode (draft|live)')
  .option('--body-field <fieldKey>', 'Webflow field key for rich text body')
  .option('--name-field <fieldKey>', 'Webflow field key for title (default name)')
  .option('--slug-field <fieldKey>', 'Webflow field key for slug (default slug)')
  .option('--summary-field <fieldKey>', 'Webflow field key for summary/excerpt')
  .option('--seo-title-field <fieldKey>', 'Webflow field key for SEO title')
  .option('--seo-description-field <fieldKey>', 'Webflow field key for meta description')
  .option('--tags-field <fieldKey>', 'Webflow field key for tags')
  .option('--image-field <fieldKey>', 'Webflow field key for main image URL')
  .option('--locale <cmsLocaleId>', 'Webflow CMS locale ID (optional)')
  .option('--status <status>', 'Initial status (connected|paused|error)', 'connected')
  .action((type, options) => executeIntegrationAdd(type, options))

integrationCommand
  .command('test')
  .description('Send a test payload to an integration')
  .requiredOption('--integration <integrationId>', 'Integration ID')
  .action((options) => executeIntegrationTest({ integration: options.integration }))

integrationCommand
  .command('update')
  .description('Update integration configuration')
  .requiredOption('--id <integrationId>', 'Integration ID')
  .option('--status <status>', 'Status (connected|paused|error)')
  .option('--url <targetUrl>', 'New webhook URL')
  .option('--secret <secret>', 'New webhook secret')
  .action((options) => executeIntegrationUpdate(options))

integrationCommand
  .command('delete')
  .description('Delete an integration')
  .requiredOption('--id <integrationId>', 'Integration ID to delete')
  .action((options) => executeIntegrationDelete(options))

const planCommand = program
  .command('plan')
  .description('Planning workflows')

planCommand
  .command('ls')
  .description('List plan items')
  .requiredOption('--project <projectId>', 'Project ID')
  .option('--limit <limit>', 'Result limit', '20')
  .option('--cursor <cursor>', 'Pagination cursor')
  .option('--status <status>', 'Filter by status (planned|skipped|consumed)')
  .option('--month <YYYY-MM>', 'Filter by month (YYYY-MM)')
  .option('--from <YYYY-MM-DD>', 'Filter start date (YYYY-MM-DD)')
  .option('--to <YYYY-MM-DD>', 'Filter end date (YYYY-MM-DD)')
  .action(executePlanList)

planCommand
  .command('move')
  .description('Reschedule a plan item')
  .requiredOption('--id <planItemId>', 'Plan item ID')
  .requiredOption('--date <YYYY-MM-DD>', 'New planned date (YYYY-MM-DD)')
  .action(executePlanMove)

const scheduleCommand = program
  .command('schedule')
  .description('Scheduler workflows')

scheduleCommand
  .command('run')
  .description('Trigger daily schedule run')
  .option('--project <projectId>', 'Project ID')
  .option('--policy <policy>', 'Policy (buffered|immediate|manual)')
  .option('--buffer <days>', 'Buffer days')
  .action(executeScheduleRun)

const jobCommand = program
  .command('job')
  .description('Job workflows')

jobCommand
  .command('watch')
  .description('Stream job status and logs until completion')
  .requiredOption('--id <jobId>', 'Job ID to watch')
  .option('--interval <ms>', 'Polling interval in milliseconds', '2000')
  .action(executeJobWatch)

const articleCommand = program
  .command('article')
  .description('Article workflows')

articleCommand
  .command('ls')
  .description('List articles for a project')
  .requiredOption('--project <projectId>', 'Project ID')
  .option('--status <status>', 'Filter by status (draft|published|failed)')
  .option('--limit <limit>', 'Result limit', '20')
  .option('--cursor <cursor>', 'Pagination cursor')
  .action(executeArticlesList)

articleCommand
  .command('publish')
  .description('Publish an article through an integration')
  .requiredOption('--id <articleId>', 'Article ID')
  .requiredOption('--integration <integrationId>', 'Integration ID to use')
  .action(executeArticlePublish)

articleCommand
  .command('edit')
  .description('Update an article by piping JSON payload via stdin')
  .requiredOption('--id <articleId>', 'Article ID')
  .action(executeArticleEdit)

program
  .command('plan:list')
  .description('List plan items')
  .requiredOption('--project <projectId>', 'Project ID')
  .option('--limit <limit>', 'Result limit', '20')
  .option('--cursor <cursor>', 'Pagination cursor')
  .option('--status <status>', 'Filter by status (planned|skipped|consumed)')
  .action(executePlanList)

program
  .command('plan:create')
  .description('Create a plan from discovered keywords')
  .requiredOption('--project <projectId>', 'Project ID')
  .option('--keywords <ids>', 'Comma-separated keyword IDs to include')
  .option('--days <days>', 'Number of days to plan (default 30)')
  .option('--start <date>', 'Start date YYYY-MM-DD (default today)')
  .action(async (options) => {
    const spinner = ora('Enqueuing plan job').start()
    try {
      const client = createClient()
      const keywordIds = options.keywords
        ? String(options.keywords)
            .split(',')
            .map((id: string) => id.trim())
            .filter(Boolean)
        : undefined
      const days = options.days ? Number.parseInt(options.days, 10) : undefined
      const payload = {
        projectId: options.project,
        keywordIds,
        days,
        startDate: options.start
      }
      const response = await client.createPlan(payload)
      spinner.succeed(describeJobStatus('Plan job', response))
    } catch (error) {
      spinner.fail('Failed to enqueue plan job')
      handleError(error)
    }
  })

program
  .command('plan:move')
  .description('Reschedule a plan item to a new date')
  .requiredOption('--id <planItemId>', 'Plan item ID')
  .requiredOption('--date <YYYY-MM-DD>', 'New planned date (YYYY-MM-DD)')
  .action(executePlanMove)

program
  .command('schedule:run')
  .description('Trigger daily schedule')
  .option('--project <projectId>', 'Project ID')
  .option('--policy <policy>', 'Policy (buffered|immediate|manual)')
  .option('--buffer <days>', 'Buffer days')
  .action(executeScheduleRun)

program
  .command('articles:list')
  .description('List articles for a project')
  .requiredOption('--project <projectId>', 'Project ID')
  .option('--status <status>', 'Filter by status (draft|published|failed)')
  .option('--limit <limit>', 'Result limit', '20')
  .option('--cursor <cursor>', 'Pagination cursor')
  .action(executeArticlesList)

program
  .command('articles:publish')
  .description('Publish an article via integration')
  .requiredOption('--id <articleId>', 'Article ID')
  .requiredOption('--integration <integrationId>', 'Integration ID to use')
  .action(executeArticlePublish)

program
  .command('articles:edit')
  .description('Update an article by piping JSON payload via stdin')
  .requiredOption('--id <articleId>', 'Article ID')
  .action(executeArticleEdit)

program
  .command('integration:test')
  .description('Send a test payload to an integration')
  .requiredOption('--id <integrationId>', 'Integration ID')
  .action((options) => executeIntegrationTest({ integration: options.id }))

program.parseAsync()

function handleError(error: unknown) {
  if (error instanceof Error) {
    console.error(error.message)
    if ((error as any).details) {
      console.error(JSON.stringify((error as any).details, null, 2))
    }
  } else {
    console.error(error)
  }
  process.exitCode = 1
}
