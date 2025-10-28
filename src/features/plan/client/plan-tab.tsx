import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'

import type { PlanEditState } from '@features/plan/shared/state-machines'
import {
  badgeClassForTone,
  buildCalendarCells,
  computeNextGenerationCountdown,
  formatCalendarDay,
  formatMonthTitle,
  resolvePlanStatus
} from '@features/projects/shared/helpers'
import type { Article, PlanItem } from '@entities'

type PlanTabProps = {
  projectId: string
  planItems: PlanItem[]
  articlesByPlanId: Map<string, Article>
  planEditState: PlanEditState
  onReschedule: (planItem: PlanItem) => void
  onCreatePlan: () => void
  onRunSchedule: () => void
  isCreatingPlan: boolean
  isRunningSchedule: boolean
  queueDepth: number
}

export function PlanTab({
  projectId,
  planItems,
  articlesByPlanId,
  planEditState,
  onReschedule,
  onCreatePlan,
  onRunSchedule,
  isCreatingPlan,
  isRunningSchedule,
  queueDepth
}: PlanTabProps) {
  const calendarCells = useMemo(() => buildCalendarCells(planItems), [planItems])
  const monthHeading = planItems.length > 0 ? formatMonthTitle(planItems[0].plannedDate) : null
  const [generationCountdown, setGenerationCountdown] = useState(computeNextGenerationCountdown())

  useEffect(() => {
    if (typeof window === 'undefined') return
    const interval = window.setInterval(() => {
      setGenerationCountdown(computeNextGenerationCountdown())
    }, 60_000)
    return () => window.clearInterval(interval)
  }, [])

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onCreatePlan}
          disabled={isCreatingPlan}
        >
          {isCreatingPlan ? 'Rebuilding…' : 'Regenerate plan'}
        </button>
        <button
          type="button"
          className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onRunSchedule}
          disabled={isRunningSchedule}
        >
          {isRunningSchedule ? 'Running…' : 'Run schedule now'}
        </button>
        <span className="text-xs text-muted-foreground">Queue depth: {queueDepth}</span>
        <span className="text-xs text-muted-foreground">
          Next generation:{' '}
          <span className="font-semibold text-foreground">{generationCountdown}</span>
        </span>
      </div>

      {planItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No plan items yet. Generate keywords and run the plan builder to populate the calendar.
        </p>
      ) : (
        <div className="space-y-3">
          {monthHeading ? (
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {monthHeading}
            </h3>
          ) : null}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-7">
            {calendarCells.map((cell) => (
              <div
                key={cell.iso}
                className={`rounded-md border p-3 text-xs ${
                  cell.withinRange ? 'bg-card text-foreground' : 'bg-muted/30 text-muted-foreground'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wide">
                  <span>{formatCalendarDay(cell.date)}</span>
                  <span>{cell.iso}</span>
                </div>
                <div className="mt-3 space-y-2">
                  {cell.items.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">No assignments</p>
                  ) : (
                    cell.items.map((item) => {
                      const status = resolvePlanStatus(item, articlesByPlanId)
                      const relatedArticle = articlesByPlanId.get(item.id)
                      const isActive = planEditState.status !== 'idle' && planEditState.item?.id === item.id
                      const isSubmitting = planEditState.status === 'submitting' && planEditState.item?.id === item.id
                      const isErrored = planEditState.status === 'error' && planEditState.item?.id === item.id
                      const errorMessage = isErrored ? planEditState.message : null
                      return (
                        <div
                          key={item.id}
                          className={`space-y-2 rounded-md border border-dashed border-border/60 bg-background/80 p-2 shadow-sm ${
                            isActive ? 'ring-1 ring-primary/60' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[11px] font-semibold leading-snug text-foreground">
                              {item.title}
                            </p>
                            <span
                              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${badgeClassForTone(
                                status.tone
                              )}`}
                            >
                              {status.label}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2 text-[11px]">
                              <button
                                type="button"
                                className="font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={() => onReschedule(item)}
                                disabled={isSubmitting}
                              >
                                {isSubmitting ? 'Saving…' : 'Reschedule'}
                              </button>
                              {relatedArticle ? (
                                <Link
                                  to="/projects/$projectId/articles/$articleId"
                                  params={{ projectId, articleId: relatedArticle.id }}
                                  className="font-medium text-primary hover:underline"
                                >
                                  View draft
                                </Link>
                              ) : null}
                            </div>
                            {errorMessage ? (
                              <p className="text-[10px] font-medium text-destructive">{errorMessage}</p>
                            ) : null}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
