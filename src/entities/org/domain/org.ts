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
  [key: string]: unknown
}

export type MeSession = {
  user: { name?: string | null; email: string } | null
  activeOrg: { id: string; plan: OrgPlan } | null
  entitlements: OrgEntitlements | null
  orgs: Org[]
}
