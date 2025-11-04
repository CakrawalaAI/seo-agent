import { useCallback, useMemo, useState, useEffect, type FormEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMockData } from '@common/dev/mock-data-context'
import { extractErrorMessage } from '@common/http/json'
import { fetchSession, fetchOrgMembers, inviteOrgMember } from '@entities/org/service'
import type { MeSession, OrgMember, OrgMemberRole } from '@entities'
import { useActiveWebsite } from '@common/state/active-website'
import { getWebsite } from '@entities/website/service'
import { Button } from '@src/common/ui/button'
import { Separator } from '@src/common/ui/separator'
import { Input } from '@src/common/ui/input'
import { Label } from '@src/common/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@src/common/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@src/common/ui/table'
import { Alert, AlertDescription, AlertTitle } from '@src/common/ui/alert'
import { CalendarDays, Sparkles, Users } from 'lucide-react'

type Feedback = { type: 'success' | 'error'; message: string }

const MOCK_SESSION: MeSession = {
  user: { name: 'Radja Polem', email: 'radja@example.com' },
  activeOrg: { id: 'org_mock', plan: 'growth' },
  entitlements: { projectQuota: 5, monthlyPostCredits: 30, dailyArticles: 2 },
  usage: { postsUsed: 8, monthlyPostCredits: 30, cycleStart: new Date().toISOString() },
  orgs: [{ id: 'org_mock', name: 'Prep Interview', plan: 'growth' }],
  activeProjectId: 'proj_mock'
}

const MOCK_MEMBERS: OrgMember[] = [
  { orgId: 'org_mock', email: 'radja@example.com', role: 'owner', joinedAt: new Date().toISOString() },
  { orgId: 'org_mock', email: 'content@example.com', role: 'member', joinedAt: new Date(Date.now() - 86_400_000).toISOString() }
]

export function Page(): JSX.Element {
  const { enabled: mockEnabled } = useMockData()
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<OrgMemberRole>('member')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [savingPolicy, setSavingPolicy] = useState(false)
  const [policyAllowYoutube, setPolicyAllowYoutube] = useState(true)
  const [policyMaxImages, setPolicyMaxImages] = useState(2)
  const { id: activeWebsiteId } = useActiveWebsite()

  const sessionQuery = useQuery<MeSession>({
    queryKey: ['settings.session'],
    queryFn: fetchSession,
    staleTime: 60_000,
    enabled: !mockEnabled
  })

  const membersQuery = useQuery<{ items: OrgMember[] }>({
    queryKey: ['settings.members'],
    queryFn: fetchOrgMembers,
    staleTime: 30_000,
    enabled: !mockEnabled
  })

  const session = mockEnabled ? MOCK_SESSION : sessionQuery.data
  const members = useMemo(() => (mockEnabled ? MOCK_MEMBERS : membersQuery.data?.items ?? []), [mockEnabled, membersQuery.data])

  // Content policy query (active website)
  const websiteQuery = useQuery({
    queryKey: ['settings.website', activeWebsiteId],
    queryFn: () => getWebsite(activeWebsiteId!),
    enabled: Boolean(activeWebsiteId && !mockEnabled),
    staleTime: 30_000
  })

  useEffect(() => {
    const w: any = websiteQuery.data
    if (!w) return
    const s = (w?.settings as any) || {}
    if (typeof s.allowYoutube === 'boolean') setPolicyAllowYoutube(Boolean(s.allowYoutube))
    if (typeof s.maxImages === 'number') setPolicyMaxImages(Math.max(0, Math.min(4, Number(s.maxImages))))
  }, [websiteQuery.data])

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      if (a.role === b.role) return a.email.localeCompare(b.email)
      if (a.role === 'owner') return -1
      if (b.role === 'owner') return 1
      return a.role.localeCompare(b.role)
    })
  }, [members])
  const memberCount = sortedMembers.length

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const payloadEmail = inviteEmail.trim()
      if (!payloadEmail) throw new Error('Email is required')
      const response = await inviteOrgMember(payloadEmail, inviteRole)
      return response
    },
    onSuccess: (result) => {
      setInviteEmail('')
      setFeedback({ type: 'success', message: `Invitation sent to ${result.email} as ${labelizeRole(result.role)}.` })
      if (!mockEnabled) {
        membersQuery.refetch().catch(() => {})
      }
    },
    onError: (error) => {
      setFeedback({ type: 'error', message: extractErrorMessage(error) })
    }
  })

  const activateMutation = useMutation({
    mutationFn: async () => {
      if (mockEnabled) return
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
        redirect: 'manual'
      })
      if (res.status === 302) {
        const location = res.headers.get('Location')
        if (location && typeof window !== 'undefined') window.location.href = location
        return
      }
      if (!res.ok) throw new Error(`Checkout failed (${res.status})`)
      const location = res.headers.get('Location') ?? null
      if (location && typeof window !== 'undefined') {
        window.location.href = location
        return
      }
      if (typeof window !== 'undefined') {
        window.location.href = '/api/billing/checkout'
      }
    },
    onError: (error) => {
      setFeedback({ type: 'error', message: extractErrorMessage(error) })
    }
  })

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (mockEnabled) return
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ returnUrl: typeof window !== 'undefined' ? window.location.href : undefined })
      })
      if (res.status === 302) {
        const location = res.headers.get('Location')
        if (location && typeof window !== 'undefined') window.location.href = location
        return
      }
      if (!res.ok) throw new Error(`Portal unavailable (${res.status})`)
      const payload = (await res.json().catch(() => ({}))) as { url?: string }
      const url = payload?.url ?? res.headers.get('Location') ?? null
      if (url && typeof window !== 'undefined') {
        window.location.href = url
        return
      }
      if (typeof window !== 'undefined') {
        window.location.href = '/api/billing/portal'
      }
    },
    onError: (error) => {
      setFeedback({ type: 'error', message: extractErrorMessage(error) })
    }
  })

  const cycleStart = session?.usage?.cycleStart ? new Date(session.usage.cycleStart) : null
  const renewalDate = cycleStart ? addDays(cycleStart, 30) : null
  const expiryDate = renewalDate
  const hasActiveSubscription = Boolean(session?.activeOrg?.plan && session.activeOrg.plan.toLowerCase() !== 'starter')
  const subscriptionActionLabel = hasActiveSubscription ? 'Cancel subscription' : 'Activate subscription'
  const subscriptionActionPending = hasActiveSubscription ? cancelMutation.isPending : activateMutation.isPending
  const subscriptionAction = hasActiveSubscription ? cancelMutation : activateMutation
  const planTitle = session?.activeOrg?.plan ? titleCase(session.activeOrg.plan) : 'Trial'
  const planMeta = hasActiveSubscription ? 'Billed monthly' : 'Pending activation'
  const statusLine = hasActiveSubscription
    ? renewalDate
      ? `Renews on ${formatFullDate(renewalDate)}`
      : 'Renews automatically'
    : expiryDate
    ? `Access ends on ${formatFullDate(expiryDate)}`
    : 'Activate to unlock publishing'
  const seatsLine = memberCount === 1 ? '1 member' : `${memberCount} members`

  const handleInviteSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (mockEnabled) return
      setFeedback(null)
      inviteMutation.mutate()
    },
    [inviteMutation, mockEnabled]
  )

  const handleInviteRoleChange = useCallback((value: string) => {
    setInviteRole((value as OrgMemberRole) || 'member')
  }, [])

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage organization access, invitations, and subscription lifecycle.
        </p>
      </header>

      {feedback ? (
        <Alert variant={feedback.type === 'error' ? 'destructive' : 'default'}>
          <AlertTitle>{feedback.type === 'error' ? 'Action required' : 'Success'}</AlertTitle>
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      ) : null}

      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Subscription</h2>
          <Separator />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-1 items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/40">
                <Sparkles className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{planTitle}</p>
                  <p className="text-xs text-muted-foreground">{planMeta}</p>
                </div>
                <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    <span>{statusLine}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>{seatsLine}</span>
                  </div>
                </div>
              </div>
            </div>
            <Button
              type="button"
              onClick={() => {
                setFeedback(null)
                subscriptionAction.mutate()
              }}
              disabled={mockEnabled || subscriptionActionPending}
            >
              {subscriptionActionPending ? 'Processing…' : subscriptionActionLabel}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Content policy (active website)</h2>
          <Separator />
          {activeWebsiteId ? (
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
              <Label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={policyAllowYoutube}
                  onChange={(e) => setPolicyAllowYoutube(e.currentTarget.checked)}
                  disabled={mockEnabled || websiteQuery.isFetching || savingPolicy}
                />
                Allow YouTube embeds
              </Label>
              <Label className="flex items-center gap-2 text-sm font-medium text-foreground">
                Max images
                <Input
                  type="number"
                  min={0}
                  max={4}
                  value={policyMaxImages}
                  onChange={(e) => setPolicyMaxImages(Math.max(0, Math.min(4, Number(e.currentTarget.value))))}
                  className="w-24"
                  disabled={mockEnabled || websiteQuery.isFetching || savingPolicy}
                />
              </Label>
              <div className="md:col-span-1 lg:col-span-2 flex items-center">
                <Button
                  type="button"
                  onClick={async () => {
                    if (!activeWebsiteId || mockEnabled) return
                    setSavingPolicy(true)
                    setFeedback(null)
                    try {
                      const res = await fetch(`/api/websites/${activeWebsiteId}`, {
                        method: 'PATCH',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ settings: { allowYoutube: policyAllowYoutube, maxImages: policyMaxImages } })
                      })
                      if (!res.ok) throw new Error(`Save failed (${res.status})`)
                      setFeedback({ type: 'success', message: 'Content policy saved.' })
                    } catch (err) {
                      setFeedback({ type: 'error', message: extractErrorMessage(err) })
                    } finally {
                      setSavingPolicy(false)
                    }
                  }}
                  disabled={mockEnabled || websiteQuery.isFetching || savingPolicy}
                >
                  {savingPolicy ? 'Saving…' : 'Save policy'}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Choose a website to configure content policy.</p>
          )}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Team access</h2>
            <p className="text-sm text-muted-foreground">
              Owners manage billing and invitations. Members can create, update, and delete articles, keywords, and website settings.
            </p>
          </div>
          <form className="grid gap-3 md:grid-cols-[2fr_1fr_160px] md:items-end" onSubmit={handleInviteSubmit}>
            <Label className="flex flex-col gap-1 text-sm font-medium text-muted-foreground">
              Invite email
              <Input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="teammate@example.com"
                required
                disabled={mockEnabled || inviteMutation.isPending}
              />
            </Label>
            <Label className="flex flex-col gap-1 text-sm font-medium text-muted-foreground">
              Role
              <Select value={inviteRole} onValueChange={handleInviteRoleChange} disabled={mockEnabled || inviteMutation.isPending}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                </SelectContent>
              </Select>
            </Label>
            <Button type="submit" disabled={mockEnabled || inviteMutation.isPending}>
              {inviteMutation.isPending ? 'Sending…' : mockEnabled ? 'Mocked' : 'Send invite'}
            </Button>
          </form>
          <Separator />
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {membersQuery.isLoading && !mockEnabled ? (
                  <TableRow>
                    <TableCell colSpan={3}>Loading members…</TableCell>
                  </TableRow>
                ) : membersQuery.isError && !mockEnabled ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-destructive">
                      Unable to load members.
                    </TableCell>
                  </TableRow>
                ) : sortedMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      No members yet. Invite a teammate to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedMembers.map((member) => (
                    <TableRow key={`${member.orgId}-${member.email}`}>
                      <TableCell className="font-medium">
                        {member.email}
                        {session?.user?.email && normalizeEmail(member.email) === normalizeEmail(session.user.email) ? (
                          <span className="ml-2 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            You
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize">
                          {member.role}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {member.joinedAt ? formatDate(new Date(member.joinedAt)) : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>
    </div>
  )
}

function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
}

function formatFullDate(date: Date) {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function titleCase(input: string) {
  return input
    .split(/[-_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function labelizeRole(role: OrgMemberRole) {
  return role === 'owner' ? 'Owner' : role === 'member' ? 'Member' : titleCase(role)
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}
