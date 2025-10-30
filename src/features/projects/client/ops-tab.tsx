import { useMutation, useQuery } from '@tanstack/react-query'
import { Button } from '@src/common/ui/button'
import { competitorsWarm, getBundleList, getCosts, getLogs, scheduleMetrics, scheduleSerpAnchors, serpWarm, runScore, getPrioritizedKeywords } from '@entities/project/service'

export function OpsTab({ projectId }: { projectId: string }) {
  const costsQuery = useQuery({ queryKey: ['costs', projectId], queryFn: () => getCosts(projectId), staleTime: 60_000 })
  const logsQuery = useQuery({ queryKey: ['bundleLogs', projectId], queryFn: () => getLogs(projectId, 200), staleTime: 15_000 })
  const bundleQuery = useQuery({ queryKey: ['bundleList', projectId], queryFn: () => getBundleList(projectId), staleTime: 60_000 })

  const serpWarmMutation = useMutation({ mutationFn: () => serpWarm(projectId, 50) })
  const compWarmMutation = useMutation({ mutationFn: () => competitorsWarm(projectId, 10) })
  const metricsMonthlyMutation = useMutation({ mutationFn: () => scheduleMetrics() })
  const serpMonthlyMutation = useMutation({ mutationFn: () => scheduleSerpAnchors() })
  const scoreMutation = useMutation({ mutationFn: () => runScore(projectId) })
  const prioritizedQuery = useQuery({ queryKey: ['prioritized', projectId], queryFn: () => getPrioritizedKeywords(projectId, 50), staleTime: 30000 })

  return (
    <section className="grid gap-6 lg:grid-cols-[1.5fr,1fr]">
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Operations</h2>
        <p className="text-sm text-muted-foreground">Warm caches and trigger monthly refreshes.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Button disabled={serpWarmMutation.isPending} onClick={() => serpWarmMutation.mutate()} className="justify-start">{serpWarmMutation.isPending ? 'Warming SERP…' : 'Warm SERP cache (top 50)'}</Button>
          <Button disabled={compWarmMutation.isPending} onClick={() => compWarmMutation.mutate()} className="justify-start">{compWarmMutation.isPending ? 'Warming competitors…' : 'Warm competitors (top 10)'}</Button>
          <Button disabled={metricsMonthlyMutation.isPending} onClick={() => metricsMonthlyMutation.mutate()} className="justify-start">{metricsMonthlyMutation.isPending ? 'Queuing metrics…' : 'Queue monthly metrics (global)'}</Button>
          <Button disabled={serpMonthlyMutation.isPending} onClick={() => serpMonthlyMutation.mutate()} className="justify-start">{serpMonthlyMutation.isPending ? 'Queuing SERP…' : 'Queue monthly SERP anchors (global)'}</Button>
          <Button disabled={scoreMutation.isPending} onClick={() => scoreMutation.mutate()} className="justify-start">{scoreMutation.isPending ? 'Scoring…' : 'Recompute priorities (score)'}</Button>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-semibold text-foreground">Bundle files</h3>
          <p className="text-xs text-muted-foreground">Latest run directory listing.</p>
          {bundleQuery.isLoading ? (
            <p className="text-xs text-muted-foreground mt-2">Loading…</p>
          ) : (
            <div className="mt-2 max-h-56 overflow-auto rounded-md border px-3 py-2 text-[11px] font-mono text-muted-foreground">
              <div className="mb-2 text-foreground"># {bundleQuery.data?.base ?? ''}</div>
              <ul className="space-y-1">
                {(bundleQuery.data?.files ?? []).map((f) => (<li key={f}>{f}</li>))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <aside className="space-y-6">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground">Provider costs</h3>
          <p className="text-xs text-muted-foreground">From bundle/global/metrics/costs.json</p>
          {costsQuery.isLoading ? (
            <p className="text-xs text-muted-foreground mt-2">Loading…</p>
          ) : (
            <ul className="mt-2 divide-y divide-border rounded-md border">
              {Object.entries(costsQuery.data?.perDay ?? {}).slice(-5).map(([day, row]) => (
                <li key={day} className="flex items-center justify-between px-3 py-2 text-xs">
                  <span className="text-muted-foreground">{day}</span>
                  <span className="font-medium text-foreground">${(row as any).costUsd.toFixed(4)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground">Recent job events</h3>
          {logsQuery.isLoading ? (
            <p className="text-xs text-muted-foreground mt-2">Loading…</p>
          ) : (
            <ul className="mt-2 max-h-56 space-y-1 overflow-auto rounded-md border px-3 py-2 text-[11px] font-mono text-muted-foreground">
              {(logsQuery.data?.items ?? []).slice(-100).map((row, i) => (<li key={i}>{JSON.stringify(row)}</li>))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground">Prioritized keywords (top 50)</h3>
          {prioritizedQuery.isLoading ? (
            <p className="text-xs text-muted-foreground mt-2">Loading…</p>
          ) : (
            <ul className="mt-2 max-h-56 space-y-1 overflow-auto rounded-md border px-3 py-2 text-[11px] text-muted-foreground">
              {(prioritizedQuery.data?.items ?? []).map((row, i) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  <span className="truncate">{row.phrase}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-foreground">{row.role ?? 'n/a'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </section>
  )
}
