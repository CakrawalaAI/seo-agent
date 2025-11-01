import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getPlanItems, getProjectArticles } from '@entities/project/service'
import type { Article, PlanItem } from '@entities'

export type CalendarEntry = {
  id?: string
  planItemId?: string
  date: string
  title: string
  status: 'published' | 'scheduled' | 'queued'
  articleId?: string
}

function monthWindow(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return { start, end }
}

export function useCalendarEntries(projectId: string | null, monthCursor: Date) {
  const { start, end } = monthWindow(monthCursor)
  const plan = useQuery<{ items: PlanItem[] }>({
    queryKey: ['plan', projectId],
    queryFn: () => getPlanItems(projectId!),
    enabled: Boolean(projectId)
  })
  const arts = useQuery<{ items: Article[] }>({
    queryKey: ['articles', projectId],
    queryFn: () => getProjectArticles(projectId!),
    enabled: Boolean(projectId)
  })

  const entries = useMemo<CalendarEntry[]>(() => {
    if (!projectId) return []
    const items = plan.data?.items ?? []
    const articles = arts.data?.items ?? []
    const byPlan = new Map<string, Article>()
    for (const a of articles) {
      byPlan.set(a.id, a)
    }
    const within = items.filter((i) => {
      const d = new Date(i.plannedDate)
      return d >= start && d <= end
    })
    return within.map((i) => {
      const a = byPlan.get(i.id)
      const status: CalendarEntry['status'] = a?.status === 'published' ? 'published' : a ? 'scheduled' : 'queued'
      return { id: a?.id, articleId: a?.id, planItemId: i.id, date: i.plannedDate, title: i.title, status }
    })
  }, [projectId, plan.data?.items, arts.data?.items, start.getTime(), end.getTime()])

  return { entries, isLoading: plan.isLoading || arts.isLoading }
}
