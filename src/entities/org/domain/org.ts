export type OrgPlan = 'starter' | 'growth' | 'enterprise' | string

export type Org = {
  id: string
  name: string
  plan?: OrgPlan | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type OrgEntitlements = {
  projectQuota?: number | null
  dailyArticles?: number | null
  monthlyPostCredits?: number | null
  [key: string]: unknown
}

export type MeSession = {
  user: { name?: string | null; email: string } | null
  activeOrg: { id: string; plan: OrgPlan } | null
  entitlements: OrgEntitlements | null
  usage?: { postsUsed?: number; monthlyPostCredits?: number; cycleStart?: string | null } | null
  orgs: Org[]
  activeProjectId?: string | null
}
