import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@src/common/ui/badge'
import { Button } from '@src/common/ui/button'
import { Separator } from '@src/common/ui/separator'
import type { Job } from '@entities'
import { listJobs } from '@entities/job/service'
import { getBundleList, getProject, generateKeywords } from '@entities/project/service'
import { useMutation } from '@tanstack/react-query'

type StepStatus = 'idle' | 'active' | 'done' | 'failed'

type PipelineStep = {
  id: 'crawl' | 'summarize' | 'seed' | 'metrics' | 'score'
  label: string
  hint?: string
  jobType: string
}

const STEPS: PipelineStep[] = [
  { id: 'crawl', label: 'Crawling', jobType: 'crawl' },
  { id: 'summarize', label: 'Summarize crawl', jobType: 'discovery' },
  { id: 'seed', label: 'Seed keywords', jobType: 'discovery' },
  { id: 'metrics', label: 'Fetch metrics', jobType: 'discovery' },
  { id: 'score', label: 'Prioritize', jobType: 'score' }
]

function pickLatestByType(jobs: Job[], type: string): Job | null {
  const subset = jobs.filter((j) => j.type === type)
  if (!subset.length) return null
  const sorted = [...subset].sort((a, b) => {
    const at = a.queuedAt ? Date.parse(a.queuedAt) : 0
    const bt = b.queuedAt ? Date.parse(b.queuedAt) : 0
    return bt - at
  })
  return sorted[0] || null
}

function statusFromJobs(jobs: Job[], type: string): StepStatus {
  const anyRunning = jobs.some((j) => j.type === type && (j.status === 'queued' || j.status === 'running'))
  if (anyRunning) return 'active'
  const anyFailed = jobs.some((j) => j.type === type && j.status === 'failed')
  const anyDone = jobs.some((j) => j.type === type && j.status === 'completed')
  if (anyFailed && !anyDone) return 'failed'
  if (anyDone) return 'done'
  return 'idle'
}

function statusFromBundleOrJobs(
  files: string[],
  jobs: Job[],
  step: PipelineStep
): StepStatus {
  // file-based completion hints
  if (step.id === 'summarize') {
    if (files.some((f) => f.includes('summary/site_summary.json'))) return 'done'
  }
  if (step.id === 'seed') {
    if (files.some((f) => f.includes('keywords/seeds.jsonl'))) return 'done'
  }
  if (step.id === 'metrics') {
    if (files.some((f) => f.includes('keywords/candidates.enriched.jsonl'))) return 'done'
  }
  if (step.id === 'score') {
    if (files.some((f) => f.includes('keywords/prioritized.jsonl'))) return 'done'
  }
  // fallback to job-based
  return statusFromJobs(jobs, step.jobType)
}

function dotClass(status: StepStatus) {
  switch (status) {
    case 'done':
      return 'bg-emerald-500'
    case 'active':
      return 'bg-amber-500 animate-pulse'
    case 'failed':
      return 'bg-rose-600'
    default:
      return 'bg-muted-foreground/40'
  }
}

function badge(status: StepStatus) {
  if (status === 'done') return <Badge className="bg-emerald-100 text-emerald-800">Done</Badge>
  if (status === 'active') return <Badge className="bg-amber-100 text-amber-800">In progress</Badge>
  if (status === 'failed') return <Badge className="bg-rose-100 text-rose-800">Failed</Badge>
  return <Badge variant="secondary">Not started</Badge>
}

export function PipelineTimelineCard({ projectId }: { projectId: string }) {
  const projectQ = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId)
  })

  const rerunMutation = useMutation({
    mutationFn: async () => {
      const locale = (projectQ.data as any)?.defaultLocale || 'en-US'
      await generateKeywords(projectId, locale)
    }
  })

  const jobsQ = useQuery({
    queryKey: ['jobs', projectId, 50],
    queryFn: async () => (await listJobs(projectId, 50)).items,
    // Poll while anything is running/queued
    refetchInterval: (q) => {
      const data = q.state.data as Job[] | undefined
      if (!data) return false
      const running = data.some((j) => j.status === 'queued' || j.status === 'running')
      return running ? 2000 : false
    }
  })

  const bundleQ = useQuery({
    queryKey: ['bundle.list', projectId],
    queryFn: async () => {
      try {
        const res = await getBundleList(projectId)
        return res?.files ?? []
      } catch {
        return [] as string[]
      }
    },
    refetchInterval: (q) => {
      const jobs = q.queryKey && jobsQ.data ? jobsQ.data : []
      const anyActive = Array.isArray(jobs) && jobs.some((j: Job) => j.status === 'queued' || j.status === 'running')
      return anyActive ? 3000 : 15000
    }
  })

  const jobs = jobsQ.data || []
  const files = bundleQ.data || []

  const steps = useMemo(
    () =>
      STEPS.map((s) => ({
        ...s,
        status: statusFromBundleOrJobs(files, jobs, s) as StepStatus,
        latest: pickLatestByType(jobs, s.jobType)
      })),
    [jobs, files]
  )

  return (
    <section className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Project Init Loop</h2>
          <p className="text-sm text-muted-foreground">
            {projectQ.data ? projectQ.data.name : 'Loading project…'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            className="rounded-md border border-input px-3 py-1.5 text-xs font-medium"
            onClick={() => jobsQ.refetch()}
            disabled={jobsQ.isFetching}
          >
            {jobsQ.isFetching ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Button
            type="button"
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => rerunMutation.mutate()}
            disabled={rerunMutation.isPending}
          >
            {rerunMutation.isPending ? 'Re‑running…' : 'Re‑run discovery'}
          </Button>
        </div>
      </div>

      <Separator className="my-4" />

      <ol className="relative ml-3 space-y-6">
        {steps.map((s, idx) => (
          <li key={s.id} className="group">
            {/* connector */}
            {idx < steps.length - 1 ? (
              <span className="absolute left-[-14px] top-5 h-[calc(100%-1rem)] w-[2px] bg-border" />
            ) : null}
            {/* dot */}
            <span className={`absolute left-[-18px] mt-1 h-3 w-3 rounded-full ring-2 ring-background ${dotClass(s.status)}`} />
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{s.label}</span>
                {badge(s.status)}
              </div>
              {s.hint ? (
                <p className="text-xs text-muted-foreground">{s.hint}</p>
              ) : null}
              {s.latest ? (
                <p className="text-[11px] text-muted-foreground">
                  {s.latest.status.toUpperCase()} · queued {s.latest.queuedAt ? new Date(s.latest.queuedAt).toLocaleString() : '—'}
                  {s.latest.finishedAt ? ` · finished ${new Date(s.latest.finishedAt).toLocaleString()}` : ''}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
