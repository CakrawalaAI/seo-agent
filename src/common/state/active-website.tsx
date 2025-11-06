import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { log } from '@src/common/logger'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

type Ctx = { id: string | null; setId: (id: string | null) => void }

const ActiveWebsiteContext = createContext<Ctx | null>(null)

export function ActiveWebsiteProvider({
  initialId,
  buildSearchValue,
  children
}: {
  initialId: string | null
  buildSearchValue?: (id: string | null) => string | null
  children: React.ReactNode
}) {
  const navigate = useNavigate()
  const [id, setLocal] = useState<string | null>(initialId ?? null)
  useEffect(() => {
    setLocal(initialId ?? null)
  }, [initialId])
  const qc = useQueryClient()
  const mutate = useMutation({
    mutationFn: async (next: string | null) => {
      await fetch('/api/active-website', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ websiteId: next })
      })
      return next
    },
    onSuccess: (next) => {
      setLocal(next)
      qc.setQueryData(['me'], (prev: any) => ({ ...(prev || {}), activeWebsiteId: next, activeProjectId: next }))
    }
  })
  const updateSearch = useCallback(
    (next: string | null) => {
      const value = buildSearchValue?.(next) ?? next
      navigate({
        search: ((prev: Record<string, unknown>) => {
          const nextSearch = { ...prev }
          if (value) {
            nextSearch.website = value
          } else {
            delete nextSearch.website
          }
          return nextSearch
        }) as never,
        replace: true
      })
    },
    [buildSearchValue, navigate]
  )
  const setId = useCallback(
    (next: string | null) => {
      if (next === id) {
        updateSearch(next)
        return
      }
      setLocal(next)
      updateSearch(next)
      mutate.mutate(next)
    },
    [id, mutate, updateSearch]
  )
  const value = useMemo<Ctx>(() => ({ id, setId }), [id, setId])
  return <ActiveWebsiteContext.Provider value={value}>{children}</ActiveWebsiteContext.Provider>
}

export function useActiveWebsite(): Ctx {
  const ctx = useContext(ActiveWebsiteContext)
  if (ctx) return ctx

  if (process.env.NODE_ENV !== 'production' && !warnedMissingProvider) {
    warnedMissingProvider = true
    const path = typeof window !== 'undefined' ? window.location?.pathname ?? 'unknown' : 'server'
    log.warn('useActiveWebsite fallback: ActiveWebsiteProvider missing; returning null context. Some behaviors may be disabled until provider mounts.', {
      path
    })
  }

  return fallbackCtx
}

const fallbackCtx: Ctx = Object.freeze({
  id: null,
  setId: () => {
    if (process.env.NODE_ENV !== 'production') {
      log.warn('ActiveWebsiteProvider missing: ignoring setId call')
    }
  }
}) as Ctx

let warnedMissingProvider = false
