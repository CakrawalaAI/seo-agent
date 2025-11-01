import { useQuery } from '@tanstack/react-query'
import { getProjectArticles, getPlanItems } from '@entities/project/service'
import type { Article, PlanItem } from '@entities'
import { useActiveProject } from '@common/state/active-project'
import { Link } from '@tanstack/react-router'

export function Page() {
  const { id } = useActiveProject()
  const arts = useQuery<{ items: Article[] }>({ queryKey: ['articles', id], queryFn: () => getProjectArticles(id!), enabled: Boolean(id) })
  const plan = useQuery<{ items: PlanItem[] }>({ queryKey: ['plan', id], queryFn: () => getPlanItems(id!), enabled: Boolean(id) })
  const list = buildList(arts.data?.items ?? [], plan.data?.items ?? [])
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Articles</h1>
        <p className="text-sm text-muted-foreground">Chronological list of scheduled and published content.</p>
      </header>
      {!id ? (
        <section className="rounded-lg border bg-card p-6 text-sm shadow-sm">Select a project to view articles.</section>
      ) : (
        <section className="rounded-lg border bg-card p-2 shadow-sm">
          <ul className="divide-y">
            {list.map((it) => (
              <li key={it.key} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-muted/40">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{it.title}</div>
                  <div className="text-xs text-muted-foreground">{new Date(it.date).toDateString()}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${badge(it.status)}`}>{it.status}</span>
                  {it.articleId ? (
                    <Link to="/projects/$projectId/articles/$articleId" params={{ projectId: id!, articleId: it.articleId }} className="text-xs text-primary underline">
                      Open
                    </Link>
                  ) : (
                    <Link to="/projects/$projectId" params={{ projectId: id! }} search={{ tab: 'plan' }} className="text-xs text-primary underline">
                      Plan
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function buildList(articles: Article[], plan: PlanItem[]) {
  const byPlan = new Map<string, Article>()
  for (const a of articles) byPlan.set(a.id, a)
  const items = plan.map((p) => {
    const a = byPlan.get(p.id)
    const status = a?.status === 'published' ? 'published' : a ? 'scheduled' : 'queued'
    return { key: p.id, title: p.title, date: p.plannedDate, status, articleId: a?.id }
  })
  return items.sort((a, b) => a.date.localeCompare(b.date))
}

function badge(status: string) {
  if (status === 'published') return 'bg-emerald-600 text-white'
  if (status === 'scheduled') return 'bg-blue-600 text-white'
  return 'bg-amber-600 text-white'
}
