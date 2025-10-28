import { createContext, useContext, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

type Ctx = { id: string | null; setId: (id: string | null) => void }

const ActiveProjectContext = createContext<Ctx | null>(null)

export function ActiveProjectProvider({ initialId, children }: { initialId: string | null; children: React.ReactNode }) {
  const [id, setLocal] = useState<string | null>(initialId)
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
  const value = useMemo<Ctx>(() => ({ id, setId: (v) => mutate.mutate(v) }), [id, mutate])
  return <ActiveProjectContext.Provider value={value}>{children}</ActiveProjectContext.Provider>
}

export function useActiveProject(): Ctx {
  const ctx = useContext(ActiveProjectContext)
  if (!ctx) throw new Error('useActiveProject must be used within ActiveProjectProvider')
  return ctx
}

