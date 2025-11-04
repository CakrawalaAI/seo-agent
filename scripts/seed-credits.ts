import 'dotenv/config'
import { getDb } from '@common/infra/db'
import { organizations, organizationMembers } from '@entities/org/db/schema'
import { eq } from 'drizzle-orm'

function arg(name: string, def = '') {
  const i = process.argv.indexOf(name)
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : def
}

async function main() {
  const email = arg('--email') || 'dev@example.com'
  const credits = Number(arg('--credits') || '100')
  const db = getDb()
  // Find an org for this email or create one
  const membs = await db.select().from(organizationMembers).where(eq(organizationMembers.userEmail as any, email)).limit(5)
  let orgId: string
  if (membs.length === 0) {
    orgId = `org_${Math.random().toString(36).slice(2, 8)}`
    await db.insert(organizations).values({ id: orgId, name: `${email.split('@')[0]}'s Org`, plan: 'starter', entitlementsJson: { monthlyPostCredits: credits, projectQuota: 100, status: 'active' } as any })
    await db.insert(organizationMembers).values({ orgId, userEmail: email, role: 'owner' })
  } else {
    orgId = membs[0]!.orgId
    // Update entitlements
    await db.update(organizations).set({ entitlementsJson: { monthlyPostCredits: credits, projectQuota: 100, status: 'active' } as any, updatedAt: new Date() as any }).where(eq(organizations.id as any, orgId))
  }

  // Ensure usage reset for this cycle
  console.log(JSON.stringify({ ok: true, orgId, email, monthlyPostCredits: credits }, null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) })
