import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { log } from '@src/common/logger'
import { Switch } from '@src/common/ui/switch'
import { Badge } from '@src/common/ui/badge'

type MockDataContextValue = {
  enabled: boolean
  setEnabled: (next: boolean) => void
}

const MockDataContext = createContext<MockDataContextValue | null>(null)

export function MockDataProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('seo-agent:mock-data') === 'on'
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const next = enabled ? 'on' : 'off'
    window.localStorage.setItem('seo-agent:mock-data', next)
  }, [enabled])

  const value = useMemo<MockDataContextValue>(() => ({ enabled, setEnabled }), [enabled])

  return (
    <MockDataContext.Provider value={value}>
      {children}
      <DevFloatingPanel />
    </MockDataContext.Provider>
  )
}

export function useMockData() {
  const ctx = useContext(MockDataContext)
  if (ctx) return ctx

  if (process.env.NODE_ENV !== 'production' && !warnedMissingMockProvider) {
    warnedMissingMockProvider = true
    const path = typeof window !== 'undefined' ? window.location?.pathname ?? 'unknown' : 'server'
    log.warn('useMockData fallback: MockDataProvider missing; returning disabled mock context.', { path })
  }

  return fallbackMockContext
}

const fallbackMockContext: MockDataContextValue = Object.freeze({
  enabled: false,
  setEnabled: () => {
    if (process.env.NODE_ENV !== 'production') {
      log.warn('MockDataProvider missing: ignoring setEnabled call')
    }
  }
})

let warnedMissingMockProvider = false

function DevFloatingPanel() {
  const { enabled, setEnabled } = useMockData()
  return (
    <div className="pointer-events-auto fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg border bg-background/95 px-4 py-3 text-sm shadow-lg backdrop-blur">
      <Badge variant={enabled ? 'default' : 'secondary'} className="uppercase tracking-wide">
        Dev
      </Badge>
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Mock data</span>
      <Switch checked={enabled} onCheckedChange={(state) => setEnabled(Boolean(state))} />
    </div>
  )
}
