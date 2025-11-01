import 'dotenv/config'
import { getDb } from '@common/infra/db'
import { orgs, orgMembers, orgUsage } from '@entities/org/db/schema'
import { eq } from 'drizzle-orm'

function arg(name: string, def = '') {
  const i = process.argv.indexOf(name)
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : def
}

async function main() {
  const email = arg('--email') || 'dev@example.com'
  const credits = Number(arg('--credits') || '100')
  const db = getDb()
  const now = new Date()
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

  // Find an org for this email or create one
  const membs = await db.select().from(orgMembers).where(eq(orgMembers.userEmail as any, email)).limit(5)
  let orgId: string
  if (membs.length === 0) {
    orgId = `org_${Math.random().toString(36).slice(2, 8)}`
    await db.insert(orgs).values({ id: orgId, name: `${email.split('@')[0]}'s Org`, plan: 'starter', entitlementsJson: { monthlyPostCredits: credits, projectQuota: 100, status: 'active' } as any })
    await db.insert(orgMembers).values({ orgId, userEmail: email, role: 'owner' })
  } else {
    orgId = membs[0]!.orgId
    // Update entitlements
    await db.update(orgs).set({ entitlementsJson: { monthlyPostCredits: credits, projectQuota: 100, status: 'active' } as any, updatedAt: new Date() as any }).where(eq(orgs.id as any, orgId))
  }

  // Ensure usage reset for this cycle
  const usage = await db.select().from(orgUsage).where(eq(orgUsage.orgId as any, orgId)).limit(1)
  if (usage.length === 0) {
    await db.insert(orgUsage).values({ orgId, cycleStart: periodStart as any, postsUsed: 0, updatedAt: new Date() as any })
  } else {
    await db.update(orgUsage).set({ cycleStart: periodStart as any, postsUsed: 0, updatedAt: new Date() as any }).where(eq(orgUsage.orgId as any, orgId))
  }

  console.log(JSON.stringify({ ok: true, orgId, email, monthlyPostCredits: credits }, null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) })

