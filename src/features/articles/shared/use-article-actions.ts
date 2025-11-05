import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useMockData } from '@common/dev/mock-data-context'
import { useActiveWebsite } from '@common/state/active-website'
import { deleteArticle as deleteArticleRequest, unpublishArticle as unpublishArticleRequest } from '@entities/article/service'
import { reschedulePlanItem as reschedulePlanItemRequest } from '@entities/website/service'
import type { Article } from '@entities'
import type { PlanItem } from '@entities/article/planner'

type Nullable<T> = T | null

const statusMessage = {
  selectWebsite: 'Select a website first',
  mockReadOnly: 'Mock data is read-only'
}

export function useArticleActions() {
  const queryClient = useQueryClient()
  const { id: projectId } = useActiveWebsite()
  const { enabled: mockEnabled } = useMockData()

  const [deletingId, setDeletingId] = useState<Nullable<string>>(null)
  const [statusMutatingId, setStatusMutatingId] = useState<Nullable<string>>(null)
  const [reschedulingId, setReschedulingId] = useState<Nullable<string>>(null)

  const listKey = projectId ? (['articles.list', projectId] as const) : null
  const planKey = projectId ? (['articles.plan', projectId] as const) : null
  const calendarKey = projectId ? (['calendar.plan', projectId] as const) : null

  const guardMutations = useCallback(() => {
    if (!projectId) {
      toast.error(statusMessage.selectWebsite)
      return false
    }
    if (mockEnabled) {
      toast.error(statusMessage.mockReadOnly)
      return false
    }
    return true
  }, [mockEnabled, projectId])

  const restoreCache = useCallback(
    (key: readonly unknown[] | null, snapshot: unknown) => {
      if (!key) return
      queryClient.setQueryData(key, snapshot)
    },
    [queryClient]
  )

  const removeFromCache = useCallback(
    (key: readonly unknown[] | null, id: string) => {
      if (!key) return
      queryClient.setQueryData(key, (cached: unknown) => {
        if (!Array.isArray(cached)) return cached
        return (cached as Array<{ id: string }>).filter((item) => item.id !== id)
      })
    },
    [queryClient]
  )

  const mergeIntoCache = useCallback(
    (key: readonly unknown[] | null, id: string, patch: Partial<Article | PlanItem>) => {
      if (!key) return
      queryClient.setQueryData(key, (cached: unknown) => {
        if (!Array.isArray(cached)) return cached
        let changed = false
        const next = (cached as Array<Record<string, unknown>>).map((item) => {
          if (item?.id !== id) return item
          changed = true
          return { ...item, ...patch }
        })
        return changed ? next : cached
      })
    },
    [queryClient]
  )

  const deleteArticle = useCallback(
    async (articleId: string) => {
      if (!guardMutations()) return
      setDeletingId(articleId)
      const snapshots = {
        list: listKey ? queryClient.getQueryData(listKey) : null,
        plan: planKey ? queryClient.getQueryData(planKey) : null,
        calendar: calendarKey ? queryClient.getQueryData(calendarKey) : null
      }

      removeFromCache(listKey, articleId)
      removeFromCache(planKey, articleId)
      removeFromCache(calendarKey, articleId)

      try {
        await deleteArticleRequest(articleId)
        toast.success('Article deleted')
      } catch (error) {
        restoreCache(listKey, snapshots.list)
        restoreCache(planKey, snapshots.plan)
        restoreCache(calendarKey, snapshots.calendar)
        toast.error(error instanceof Error ? error.message : 'Failed to delete article')
        throw error
      } finally {
        setDeletingId(null)
        if (listKey) queryClient.invalidateQueries({ queryKey: listKey })
        if (planKey) queryClient.invalidateQueries({ queryKey: planKey })
        if (calendarKey) queryClient.invalidateQueries({ queryKey: calendarKey })
      }
    },
    [calendarKey, guardMutations, listKey, planKey, queryClient, removeFromCache, restoreCache]
  )

  const unpublishArticle = useCallback(
    async (articleId: string) => {
      if (!guardMutations()) return
      setStatusMutatingId(articleId)
      const snapshots = {
        list: listKey ? queryClient.getQueryData(listKey) : null,
        plan: planKey ? queryClient.getQueryData(planKey) : null,
        calendar: calendarKey ? queryClient.getQueryData(calendarKey) : null
      }

      const optimisticPatch = { status: 'unpublished', publishDate: null, url: null }
      mergeIntoCache(listKey, articleId, optimisticPatch)
      mergeIntoCache(planKey, articleId, optimisticPatch)
      mergeIntoCache(calendarKey, articleId, optimisticPatch)

      try {
        const updated = await unpublishArticleRequest(articleId)
        const payload = updated?.article ?? updated
        mergeIntoCache(listKey, articleId, payload ?? {})
        mergeIntoCache(planKey, articleId, payload ?? {})
        mergeIntoCache(calendarKey, articleId, payload ?? {})
        toast.success('Article marked as unpublished')
      } catch (error) {
        restoreCache(listKey, snapshots.list)
        restoreCache(planKey, snapshots.plan)
        restoreCache(calendarKey, snapshots.calendar)
        toast.error(error instanceof Error ? error.message : 'Failed to update status')
        throw error
      } finally {
        setStatusMutatingId(null)
        if (listKey) queryClient.invalidateQueries({ queryKey: listKey })
        if (planKey) queryClient.invalidateQueries({ queryKey: planKey })
        if (calendarKey) queryClient.invalidateQueries({ queryKey: calendarKey })
      }
    },
    [calendarKey, guardMutations, listKey, mergeIntoCache, planKey, queryClient, restoreCache]
  )

  const reschedulePlanItem = useCallback(
    async (planItemId: string, isoDate: string) => {
      if (!guardMutations()) return
      if (isoDate.length !== 10) {
        toast.error('Scheduled date must be YYYY-MM-DD')
        return
      }
      setReschedulingId(planItemId)
      const snapshots = {
        list: listKey ? queryClient.getQueryData(listKey) : null,
        plan: planKey ? queryClient.getQueryData(planKey) : null,
        calendar: calendarKey ? queryClient.getQueryData(calendarKey) : null
      }

      const optimisticPatch = { scheduledDate: isoDate }
      mergeIntoCache(listKey, planItemId, optimisticPatch)
      mergeIntoCache(planKey, planItemId, optimisticPatch)
      mergeIntoCache(calendarKey, planItemId, optimisticPatch)

      try {
        await reschedulePlanItemRequest(planItemId, isoDate)
        toast.success('Schedule updated')
      } catch (error) {
        restoreCache(listKey, snapshots.list)
        restoreCache(planKey, snapshots.plan)
        restoreCache(calendarKey, snapshots.calendar)
        toast.error(error instanceof Error ? error.message : 'Failed to reschedule')
        throw error
      } finally {
        setReschedulingId(null)
        if (planKey) queryClient.invalidateQueries({ queryKey: planKey })
        if (calendarKey) queryClient.invalidateQueries({ queryKey: calendarKey })
        if (listKey) queryClient.invalidateQueries({ queryKey: listKey })
      }
    },
    [calendarKey, guardMutations, listKey, mergeIntoCache, planKey, queryClient, restoreCache]
  )

  return {
    mockEnabled,
    deletingId,
    statusMutatingId,
    reschedulingId,
    deleteArticle,
    unpublishArticle,
    reschedulePlanItem
  }
}
