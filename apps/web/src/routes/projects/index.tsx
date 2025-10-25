// @ts-nocheck
import { useMemo, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import type { CreateProjectResponse, MeResponse, PaginatedResponse, Project } from '@seo-agent/domain'

const fetchProjects = async (orgId?: string): Promise<PaginatedResponse<Project>> => {
  const params = new URLSearchParams({ limit: '50' })
  if (orgId) {
    params.set('orgId', orgId)
  }
  const response = await fetch(`/api/projects?${params.toString()}`, { credentials: 'include' })
  if (!response.ok) {
    throw new Error('Failed to load projects')
  }
  return (await response.json()) as PaginatedResponse<Project>
}

const fetchMe = async (): Promise<MeResponse> => {
  const response = await fetch('/api/me', { credentials: 'include' })
  if (!response.ok) {
    throw new Error('Failed to load session')
  }
  return (await response.json()) as MeResponse
}

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}

export const Route = createFileRoute('/projects')({
  component: ProjectsPage
})

function ProjectsPage() {
  const [name, setName] = useState('')
  const [siteUrl, setSiteUrl] = useState('')
  const [locale, setLocale] = useState('en-US')
  const [creationResult, setCreationResult] = useState<CreateProjectResponse | null>(null)

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    staleTime: 60_000
  })

  const activeOrgId = meQuery.data?.activeOrg?.id

  const projectsQuery = useQuery({
    queryKey: ['projects', activeOrgId ?? 'none'],
    queryFn: () => fetchProjects(activeOrgId ?? undefined),
    refetchInterval: 60_000,
    enabled: Boolean(activeOrgId)
  })

  const projects = projectsQuery.data?.items ?? []

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!activeOrgId) {
        throw new Error('No organization selected')
      }
      const payload = {
        orgId: activeOrgId,
        name,
        siteUrl,
        defaultLocale: locale
      }
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      })
      if (!response.ok) {
        throw new Error('Failed to create project')
      }
      return (await response.json()) as CreateProjectResponse
    },
    onSuccess: (result) => {
      setCreationResult(result)
      setName('')
      setSiteUrl('')
      setLocale('en-US')
      projectsQuery.refetch()
    }
  })

  const creationMessage = useMemo(() => {
    if (!creationResult) return null
    return `Project ${creationResult.project.name} created. Crawl job ${creationResult.crawlJobId ?? 'queued'} started.`
  }, [creationResult])

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-12">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Projects</p>
        <h1 className="text-3xl font-semibold">Sites monitored by SEO Agent</h1>
        <p className="text-sm text-muted-foreground">
          Create a project per domain to crawl, discover keywords, plan content, and publish directly from the dashboard.
        </p>
      </header>

      {!activeOrgId ? (
        <section className="rounded-lg border bg-card p-6 text-sm text-muted-foreground shadow-sm">
          {meQuery.isLoading
            ? 'Loading account…'
            : 'Select or create an organization to begin adding projects.'}
        </section>
      ) : projectsQuery.isLoading ? (
        <section className="rounded-lg border bg-card p-6 text-sm text-muted-foreground shadow-sm">
          Loading projects…
        </section>
      ) : projectsQuery.isError ? (
        <section className="rounded-lg border bg-card p-6 text-sm text-destructive shadow-sm">
          Unable to load projects. Refresh the page or check the API logs.
        </section>
      ) : projects.length === 0 ? (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">No projects yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Run <code>seo project create</code> from the CLI to register your first site, or use the web dashboard once the creation flow is wired.
          </p>
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
              <label className="flex flex-col gap-1 text-sm font-medium text-muted-foreground">
                Project name
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Acme Widgets"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={createMutation.isPending || !activeOrgId}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-muted-foreground">
                Site URL
                <input
                  type="url"
                  required
                  value={siteUrl}
                  onChange={(event) => setSiteUrl(event.target.value)}
                  placeholder="https://www.example.com"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={createMutation.isPending || !activeOrgId}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-muted-foreground">
                Default locale
                <input
                  type="text"
                  value={locale}
                  onChange={(event) => setLocale(event.target.value)}
                  placeholder="en-US"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={createMutation.isPending || !activeOrgId}
                />
              </label>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={createMutation.isPending || !activeOrgId}
                >
                  {createMutation.isPending ? 'Creating…' : 'Create project'}
                </button>
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
        </>
      )}
    </main>
  )
}
