import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { reactStartCookies } from 'better-auth/react-start'
import { organization } from 'better-auth/plugins'
import { getDb, hasDatabase } from '@common/infra/db'
import { polar, checkout, portal, usage, webhooks } from '@polar-sh/better-auth'
import { Polar } from '@polar-sh/sdk'
import { orgs, orgUsage } from '@entities/org/db/schema'

// Server-side Better Auth instance
// - Uses Drizzle adapter with Postgres when DATABASE_URL is set
// - Falls back to in-memory adapter for dev without DB
// - Exposes Google OAuth provider

// Lazy load memory adapter to avoid bundling when not needed
async function getAdapter() {
  if (hasDatabase()) {
    return drizzleAdapter(getDb() as unknown as Record<string, any>, {
      provider: 'pg',
      usePlural: true
      // schema: optional — defaults to BetterAuth CLI schema
    })
  }
  const { memoryAdapter } = await import('better-auth/adapters/memory')
  return memoryAdapter({})
}

const googleClientId = process.env.GOOGLE_CLIENT_ID || ''
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || ''

// Note: better-auth will infer baseURL from incoming requests.
const polarServer = process.env.POLAR_SERVER === 'sandbox' ? 'sandbox' : process.env.POLAR_SERVER === 'production' ? 'production' : undefined
const polarClient = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN || '',
  server: polarServer
})

export const auth = betterAuth({
  // Database adapter (async factory supported)
  database: async () => {
    return (await getAdapter()) as any
  },
  plugins: [
    organization({
      // Map Better Auth Organization model to our existing `orgs` table
      schema: {
        organization: {
          modelName: 'orgs',
          // keep defaults for standard fields; expose our extra fields
          additionalFields: {
            plan: { type: 'string', input: true, required: false },
            entitlementsJson: { type: 'json', input: true, required: false }
          }
        }
        // We keep member/invitation/teams on plugin defaults (new tables)
      }
    }),
    polar({
      client: polarClient,
      createCustomerOnSignUp: true,
      use: [
        // Keep Checkout enabled (for portal compat), but we won't use product slugs.
        checkout({
          successUrl: '/dashboard?billing=success&checkout_id={CHECKOUT_ID}',
          authenticatedUsersOnly: true
        }),
        portal(),
        usage(),
        webhooks({
          secret: process.env.POLAR_WEBHOOK_SECRET || '',
          onOrderPaid: async (payload) => { await handleSubscriptionUpsert(payload as any).catch(() => {}) },
          onSubscriptionActive: async (payload) => { await handleSubscriptionUpsert(payload as any).catch(() => {}) },
          onSubscriptionUpdated: async (payload) => { await handleSubscriptionUpsert(payload as any).catch(() => {}) }
        })
      ]
    }),
    // keep cookie plugin last
    reactStartCookies()
  ],
  socialProviders: {
    // Enable Google only when creds exist
    google: googleClientId && googleClientSecret ? { clientId: googleClientId, clientSecret: googleClientSecret } : { enabled: false } as any
  },
  session: {
    // keep defaults; tweak here if needed
  }
})

async function handleSubscriptionUpsert(raw: any) {
  const data = raw?.data ?? raw ?? {}
  const ref =
    data?.referenceId ||
    data?.checkout?.referenceId ||
    data?.order?.metadata?.referenceId ||
    data?.subscription?.metadata?.referenceId
  if (!ref) return
  const orgId = String(ref)
  const { plan, monthlyPostCredits, cycleStart } = await getCreditsAndCycleFromPayloadOrFetch(data)
  const entitlements: Record<string, unknown> = { monthlyPostCredits }
  const db = getDb()
  // Upsert entitlements
  await db
    .insert(orgs)
    .values({ id: orgId, name: orgId, plan, entitlementsJson: entitlements as any })
    .onConflictDoUpdate({ target: orgs.id, set: { plan, entitlementsJson: entitlements as any, updatedAt: new Date() as any } })
  // Ensure org_usage row exists
  try {
    await db
      .insert(orgUsage)
      .values({ orgId, cycleStart: cycleStart ?? (new Date() as any), postsUsed: 0 })
      .onConflictDoNothing?.()
  } catch {}
  // If cycle start changed (new billing cycle), reset postsUsed
  if (cycleStart) {
    try {
      // @ts-ignore
      const existing = await (db.select().from(orgUsage).where((orgUsage as any).orgId.eq(orgId)).limit(1) as any)
      const prev = existing?.[0]?.cycleStart ? new Date(existing[0].cycleStart) : null
      if (!prev || prev.getTime() !== new Date(cycleStart).getTime()) {
        await db
          .update(orgUsage)
          .set({ cycleStart: cycleStart as any, postsUsed: 0, updatedAt: new Date() as any })
          // @ts-ignore drizzle where helper
          .where((orgUsage as any).orgId.eq(orgId))
      }
    } catch {}
  }
  console.log('[billing] entitlements updated', { orgId, monthlyPostCredits, cycleStart: cycleStart?.toISOString?.?.() ?? cycleStart })
}

async function getCreditsAndCycleFromPayloadOrFetch(data: any): Promise<{ plan: string; monthlyPostCredits: number; cycleStart: Date | null }> {
  // Base unit posts from metadata
  const plan = String(
    data?.product?.name || data?.subscription?.product?.name || data?.order?.product?.name || 'business'
  )
  const unit = Number(
    data?.price?.metadata?.unit_posts ||
      data?.subscription?.price?.metadata?.unit_posts ||
      data?.product?.metadata?.unit_posts ||
      30
  )
  const mult = Number(
    data?.price?.metadata?.multiplier ||
      data?.subscription?.price?.metadata?.multiplier ||
      data?.product?.metadata?.multiplier ||
      data?.subscription?.quantity ||
      1
  )
  const cycleStartRaw = data?.subscription?.current_period_start || data?.order?.period_start || data?.current_period_start
  if (cycleStartRaw) {
    return { plan, monthlyPostCredits: Math.max(0, unit * Math.max(1, mult)), cycleStart: new Date(String(cycleStartRaw)) }
  }
  // Fallback: fetch subscription from Polar API using IDs found in payload
  try {
    const subId = data?.subscription?.id || data?.order?.subscription?.id || data?.subscription_id
    if (subId) {
      const sub = await polarClient.subscriptions.get({ id: String(subId) } as any)
      const s: any = (sub as any)?.data ?? sub
      const priceMeta = s?.price?.metadata || s?.product?.prices?.[0]?.metadata || {}
      const unitPosts = Number(priceMeta?.unit_posts || s?.product?.metadata?.unit_posts || 30)
      const multiplier = Number(priceMeta?.multiplier || s?.quantity || 1)
      const start = s?.current_period_start ? new Date(String(s.current_period_start)) : null
      return { plan, monthlyPostCredits: Math.max(0, unitPosts * Math.max(1, multiplier)), cycleStart: start }
    }
  } catch (err) {
    console.warn('[billing] subscription fetch failed', (err as Error)?.message ?? String(err))
  }
  return { plan, monthlyPostCredits: Math.max(0, unit * Math.max(1, mult)), cycleStart: null }
}
