import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DndContext, PointerSensor, type DragEndEvent, useSensor, useSensors } from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useActiveWebsite } from '@common/state/active-website'
import { useMockData } from '@common/dev/mock-data-context'
import { getPlanItems } from '@entities/website/service'
import type { PlanItem } from '@entities/article/planner'
import { Button } from '@src/common/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@src/common/ui/empty'
import { log } from '@src/common/logger'
import { useArticleActions } from '@features/articles/shared/use-article-actions'
import { useArticleNavigation } from '@features/articles/shared/use-article-navigation'
import { Loader2 } from 'lucide-react'

type CalendarEvent = { id: string; date: string; title: string; status: NonNullable<PlanItem['status']> }

const MOCK_PLAN: PlanItem[] = [
  {
    id: 'plan-m-1',
    websiteId: 'proj_mock',
    keywordId: null,
    title: 'Launch Mock Interview Landing Page',
    scheduledDate: new Date().toISOString(),
    status: 'scheduled'
  },
  {
    id: 'plan-m-2',
    websiteId: 'proj_mock',
    keywordId: null,
    title: 'Publish STAR Method Cheat Sheet',
    scheduledDate: new Date(Date.now() + 86_400_000 * 2).toISOString(),
    status: 'queued'
  },
  {
    id: 'plan-m-3',
    websiteId: 'proj_mock',
    keywordId: null,
    title: 'Promote Interview Practice Templates',
    scheduledDate: new Date(Date.now() - 86_400_000 * 3).toISOString(),
    status: 'published'
  }
]

export function Page(): JSX.Element {
  const { id: projectId } = useActiveWebsite()
  const { enabled: mockEnabled } = useMockData()
  const [month, setMonth] = useState(() => new Date())
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const { viewArticle } = useArticleNavigation()
  const { reschedulePlanItem, reschedulingId } = useArticleActions()

  const planQuery = useQuery({
    queryKey: ['calendar.plan', projectId],
    queryFn: async () => (await getPlanItems(projectId!, 180)).items,
    enabled: Boolean(projectId && !mockEnabled),
    refetchInterval: 60_000
  })

  const planItems = mockEnabled ? MOCK_PLAN : planQuery.data ?? []

  const events = useMemo<CalendarEvent[]>(() => {
    return planItems
      .filter((item) => Boolean((item as any).scheduledDate))
      .map((item) => ({
        id: item.id,
        date: (item as any).scheduledDate,
        title: item.title,
        status: (item.status ?? 'queued') as NonNullable<PlanItem['status']>
      }))
  }, [planItems])
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of events) {
      const key = event.date.slice(0, 10)
      const list = map.get(key) ?? []
      list.push(event)
      map.set(key, list)
    }
    return map
  }, [events])
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const payload = event.active.data?.current?.event as CalendarEvent | undefined
      const overId = typeof event.over?.id === 'string' ? event.over.id : null
      if (!payload || !overId) return
      if (payload.date.slice(0, 10) === overId) return
      log.info('[calendar.page] drag_end', { articleId: payload.id, from: payload.date.slice(0, 10), to: overId })
      await reschedulePlanItem(payload.id, overId)
    },
    [reschedulePlanItem]
  )

  const handleEventClick = useCallback(
    (calendarEvent: CalendarEvent) => {
      log.info('[calendar.page] event_click', {
        articleId: calendarEvent.id,
        title: calendarEvent.title,
        scheduledDate: calendarEvent.date
      })
      viewArticle(calendarEvent.id)
    },
    [viewArticle]
  )

  if (!projectId) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Calendar</h1>
          <p className="text-sm text-muted-foreground">Schedule titles for the selected website.</p>
        </header>
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No website selected</EmptyTitle>
            <EmptyDescription>Choose a website to see its publishing schedule.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <p className="text-sm text-muted-foreground">A simple runway for scheduled and published items.</p>
      </header>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            >
              ◀
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setMonth(new Date())}>
              Today
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            >
              ▶
            </Button>
            <span className="ml-3 text-sm font-medium text-muted-foreground">{formatMonth(month)}</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (mockEnabled) return
              planQuery.refetch()
            }}
            disabled={mockEnabled || planQuery.isRefetching}
          >
            {planQuery.isRefetching ? 'Refreshing…' : mockEnabled ? 'Mock data' : 'Refresh data'}
          </Button>
        </div>

        {events.length === 0 ? (
          <Empty className="mt-6 border-none bg-transparent p-10">
            <EmptyHeader>
              <EmptyTitle>No scheduled items</EmptyTitle>
              <EmptyDescription>
                {mockEnabled
                  ? 'Toggle mock data off to view the live schedule.'
                  : planQuery.isFetching
                  ? 'Loading your plan…'
                  : 'Generate keywords and build a plan to populate the calendar.'}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <CalendarGrid month={month} events={events} onEventClick={handleEventClick} reschedulingId={reschedulingId} />
          </DndContext>
        )}
      </section>
    </div>
  )
}

function CalendarGrid({
  month,
  events,
  onEventClick,
  reschedulingId
}: {
  month: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
  reschedulingId: string | null
}) {
  const cells = useMemo(() => buildCalendar(month), [month])
  const today = useMemo(() => new Date(), [])
  const eventByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of events) {
      const day = event.date.slice(0, 10)
      const bucket = map.get(day) ?? []
      bucket.push(event)
      map.set(day, bucket)
    }
    return map
  }, [events])

  return (
    <div className="mt-6 grid grid-cols-7 gap-2 text-xs">
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
        <div key={label} className="px-2 py-1 text-muted-foreground">
          {label}
        </div>
      ))}
      {cells.map((cell) => {
        if (!cell.date) {
          return <div key={cell.key} className="h-24 rounded-md border border-dashed border-muted/40" />
        }
        const dayKey = cell.date.toISOString().slice(0, 10)
        const dateEvents = eventByDay.get(dayKey) ?? []
        const isToday =
          cell.date.getFullYear() === today.getFullYear() &&
          cell.date.getMonth() === today.getMonth() &&
          cell.date.getDate() === today.getDate()
        return (
          <CalendarDayCell
            key={cell.key}
            dayKey={dayKey}
            date={cell.date}
            events={dateEvents}
            isToday={isToday}
            onEventClick={onEventClick}
            reschedulingId={reschedulingId}
          />
        )
      })}
    </div>
  )
}

type CalendarDayCellProps = {
  dayKey: string
  date: Date
  events: CalendarEvent[]
  isToday: boolean
  onEventClick: (event: CalendarEvent) => void
  reschedulingId: string | null
}

function CalendarDayCell({
  dayKey,
  date,
  events,
  isToday,
  onEventClick,
  reschedulingId
}: CalendarDayCellProps) {
  const { isOver, setNodeRef } = useDroppable({ id: dayKey })
  return (
    <div
      ref={setNodeRef}
      className={`flex h-24 flex-col rounded-md border bg-background/80 p-2 transition ${
        isToday ? 'border-primary/60 shadow-sm' : 'border-border'
      } ${isOver ? 'ring-2 ring-primary/50' : ''}`}
    >
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{date.getDate()}</span>
        <span className="font-medium text-foreground/70">{events.length > 0 ? `${events.length}` : ''}</span>
      </div>
      <div className="mt-2 space-y-1">
        {events.length === 0
          ? null
          : events.map((event) => (
              <CalendarEventChip
                key={event.id}
                event={event}
                onEventClick={onEventClick}
                reschedulingId={reschedulingId}
              />
            ))}
      </div>
    </div>
  )
}

type CalendarEventChipProps = {
  event: CalendarEvent
  onEventClick: (event: CalendarEvent) => void
  reschedulingId: string | null
}

function CalendarEventChip({ event, onEventClick, reschedulingId }: CalendarEventChipProps) {
  const isPending = reschedulingId === event.id
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: event.id,
    data: { event },
    disabled: isPending
  })
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined
  return (
    <button
      type="button"
      ref={setNodeRef}
      style={style}
      className={`flex w-full items-center justify-between gap-2 truncate rounded-md px-2 py-1 text-[11px] font-medium text-background transition ${
        badgeColor(event.status)
      } ${isDragging ? 'shadow-lg ring-1 ring-primary/60' : ''} ${isPending ? 'opacity-60' : ''}`}
      onClick={(ev) => {
        ev.stopPropagation()
        onEventClick(event)
      }}
      {...listeners}
      {...attributes}
    >
      <span className="truncate">{event.title}</span>
      {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
    </button>
  )
}

type CalendarCell = { key: string; date: Date | null }

function buildCalendar(base: Date): CalendarCell[] {
  const year = base.getFullYear()
  const month = base.getMonth()
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const startOffset = (first.getDay() + 6) % 7
  const totalDays = last.getDate()
  const cells: CalendarCell[] = []
  for (let i = 0; i < startOffset; i++) cells.push({ key: `b-${i}`, date: null })
  for (let day = 1; day <= totalDays; day++) cells.push({ key: `d-${day}`, date: new Date(year, month, day) })
  const trailing = (7 - (cells.length % 7)) % 7
  for (let i = 0; i < trailing; i++) cells.push({ key: `a-${i}`, date: null })
  return cells
}

function formatMonth(date: Date) {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function badgeColor(status: NonNullable<PlanItem['status']>) {
  if (status === 'published') return 'bg-emerald-600'
  if (status === 'scheduled') return 'bg-blue-600'
  if (status === 'unpublished') return 'bg-rose-600'
  return 'bg-amber-600'
}
