import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

type Ctx = { id: string | null; setId: (id: string | null) => void }

const ActiveProjectContext = createContext<Ctx | null>(null)

export function ActiveProjectProvider({
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
      await fetch('/api/active-project', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId: next })
      })
      return next
    },
    onSuccess: (next) => {
      setLocal(next)
      qc.setQueryData(['me'], (prev: any) => ({ ...(prev || {}), activeProjectId: next }))
    }
  })
  const updateSearch = useCallback(
    (next: string | null) => {
      const value = buildSearchValue?.(next) ?? next
      navigate({
        search: ((prev: Record<string, unknown>) => {
          const nextSearch = { ...prev }
          if (value) {
            nextSearch.project = value
          } else {
            delete nextSearch.project
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
  return <ActiveProjectContext.Provider value={value}>{children}</ActiveProjectContext.Provider>
}

export function useActiveProject(): Ctx {
  const ctx = useContext(ActiveProjectContext)
  if (!ctx) throw new Error('useActiveProject must be used within ActiveProjectProvider')
  return ctx
}
