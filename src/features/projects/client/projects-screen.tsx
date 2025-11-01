import { useEffect, useMemo, useState } from 'react'
import { Button } from '@src/common/ui/button'
import { Input } from '@src/common/ui/input'
import { Label } from '@src/common/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@src/common/ui/select'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useActiveProject } from '@common/state/active-project'
import type { MeSession, Project } from '@entities'
import {
  createProject as createProjectApi,
  listProjects
} from '@entities/project/service'
import { fetchSession } from '@entities/org/service'

type CreateProjectResponse = {
  project: Project
  crawlJobId?: string | null
}

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}

export function ProjectsScreen(): JSX.Element {
  const [name, setName] = useState('')
  const [siteUrl, setSiteUrl] = useState('')
  const [locale, setLocale] = useState('en-US')
  const [creationResult, setCreationResult] = useState<CreateProjectResponse | null>(null)
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)
  const navigate = useNavigate()
  const { setId: setActiveProjectId } = useActiveProject()

  const meQuery = useQuery<MeSession>({
    queryKey: ['me'],
    queryFn: fetchSession,
    staleTime: 60_000
  })

  const orgs = meQuery.data?.orgs ?? []
  const activeOrgFromServer = meQuery.data?.activeOrg?.id ?? null

  useEffect(() => {
    if (!orgs.length) {
      setSelectedOrgId(null)
      return
    }
    if (!selectedOrgId) {
      setSelectedOrgId(activeOrgFromServer ?? orgs[0]!.id)
    }
  }, [orgs, activeOrgFromServer, selectedOrgId])

  const projectsQuery = useQuery<{ items: Project[] }>({
    queryKey: ['projects', selectedOrgId ?? 'none'],
    queryFn: () => listProjects(selectedOrgId ?? undefined),
    refetchInterval: 60_000,
    enabled: Boolean(selectedOrgId)
  })

  const projects = projectsQuery.data?.items ?? []

  const createMutation = useMutation<CreateProjectResponse>({
    mutationFn: async () => {
      if (!selectedOrgId) {
        throw new Error('No organization selected')
      }
      const payload = {
        orgId: selectedOrgId,
        name,
        siteUrl,
        defaultLocale: locale
      }
      return createProjectApi(payload)
    },
    onSuccess: (result) => {
      setCreationResult(result)
      setName('')
      setSiteUrl('')
      setLocale('en-US')
      projectsQuery.refetch()
      try {
        setActiveProjectId(result.project.id)
      } catch {}
      try {
        navigate({ to: '/projects/$projectId', params: { projectId: result.project.id } })
      } catch {}
    }
  })

  const creationMessage = useMemo(() => {
    if (!creationResult) return null
    return `Project ${creationResult.project.name} created. Crawl job ${creationResult.crawlJobId ?? 'queued'} started.`
  }, [creationResult])

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Projects</p>
        <h1 className="text-3xl font-semibold">Sites monitored by SEO Agent</h1>
        <p className="text-sm text-muted-foreground">
          Create a project per domain to crawl, discover keywords, plan content, and publish directly from the dashboard.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Label className="flex items-center gap-2 text-sm text-muted-foreground">
            Organization
            <Select
              value={selectedOrgId ?? undefined}
              onValueChange={(v) => setSelectedOrgId(v || null)}
              disabled={meQuery.isLoading || orgs.length === 0}
            >
              <SelectTrigger className="w-[260px]">
                <SelectValue placeholder="Select organization" />
              </SelectTrigger>
              <SelectContent>
                {orgs.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Label>
          {meQuery.isFetching ? (
            <span className="text-xs text-muted-foreground">Refreshing orgs…</span>
          ) : null}
        </div>
      </header>

      {!orgs.length ? (
        <section className="rounded-lg border bg-card p-6 text-sm text-muted-foreground shadow-sm">
          {meQuery.isLoading
            ? 'Loading account…'
            : 'Select or create an organization to begin adding projects.'}
        </section>
      ) : !selectedOrgId ? (
        <section className="rounded-lg border bg-card p-6 text-sm text-muted-foreground shadow-sm">
          Choose an organization to manage its projects.
        </section>
      ) : projectsQuery.isLoading ? (
        <section className="rounded-lg border bg-card p-6 text-sm text-muted-foreground shadow-sm">
          Loading projects…
        </section>
      ) : projectsQuery.isError ? (
        <section className="rounded-lg border bg-card p-6 text-sm text-destructive shadow-sm">
          Unable to load projects. Refresh the page or check the API logs.
        </section>
      ) : (
        <>
          <section className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">Create a project</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect a domain to trigger the initial crawl and discovery run.
            </p>
            <form
              className="mt-4 grid gap-3 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault()
                if (!name || !siteUrl) return
                createMutation.mutateAsync().catch(() => {})
              }}
            >
              <Label className="flex flex-col gap-1 text-sm font-medium text-muted-foreground">
                Project name
                <Input
                  type="text"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Acme Widgets"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={createMutation.isPending || !selectedOrgId}
                />
              </Label>
              <Label className="flex flex-col gap-1 text-sm font-medium text-muted-foreground">
                Site URL
                <Input
                  type="url"
                  required
                  value={siteUrl}
                  onChange={(event) => setSiteUrl(event.target.value)}
                  placeholder="https://www.example.com"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={createMutation.isPending || !selectedOrgId}
                />
              </Label>
              <Label className="flex flex-col gap-1 text-sm font-medium text-muted-foreground">
                Default locale
                <Input
                  type="text"
                  value={locale}
                  onChange={(event) => setLocale(event.target.value)}
                  placeholder="en-US"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={createMutation.isPending || !selectedOrgId}
                />
              </Label>
              <div className="flex items-end">
                <Button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={createMutation.isPending || !selectedOrgId}
                >
                  {createMutation.isPending ? 'Creating…' : 'Create project'}
                </Button>
              </div>
              {createMutation.isError ? (
                <p className="col-span-full text-sm text-destructive">
                  Failed to create project. Check the site URL and try again.
                </p>
              ) : null}
              {creationMessage ? (
                <p className="col-span-full text-sm text-emerald-600">{creationMessage}</p>
              ) : null}
            </form>
          </section>

          {projects.length === 0 ? (
            <section className="rounded-lg border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold">No projects yet</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Use the form above to add your first site. A crawl job starts automatically after creation.
              </p>
            </section>
          ) : (
            <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <article key={project.id} className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold text-primary">{project.name}</h2>
                    <p className="text-sm text-muted-foreground">{project.siteUrl}</p>
                  </div>
                  <dl className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between gap-4">
                      <dt>Locale</dt>
                      <dd className="font-medium text-foreground">{project.defaultLocale}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt>Created</dt>
                      <dd className="font-medium text-foreground">{formatDateTime(project.createdAt)}</dd>
                    </div>
                  </dl>
                  <div className="mt-auto pt-2">
                    <Link
                      to="/projects/$projectId"
                      params={{ projectId: project.id }}
                      className="inline-flex items-center justify-center rounded-md border border-input px-3 py-1.5 text-sm font-medium transition hover:bg-muted"
                    >
                      View project
                    </Link>
                  </div>
                </article>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  )
}
