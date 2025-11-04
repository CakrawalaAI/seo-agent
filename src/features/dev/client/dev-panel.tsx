/// <reference types="vite/client" />

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@src/common/ui/button'
import { Switch } from '@src/common/ui/switch'
import type { KeywordIdeasOverride } from '@common/providers/overrides'

type DevKeywordOverride = Extract<KeywordIdeasOverride, 'mock' | null>

const STORAGE_KEY = 'seo.dev.keywordIdeasProvider'
const LEGACY_STORAGE_KEYS: string[] = []

export function DevPanelHost(): JSX.Element | null {
  if (import.meta.env.PROD) return null
  const isClient = typeof window !== 'undefined'
  if (!isClient) return null

  const [container, setContainer] = useState<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)
  const [keywordIdeas, setKeywordIdeas] = useState<DevKeywordOverride>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const keywordIdeasRef = useRef<DevKeywordOverride>(null)

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    let el = document.getElementById('seo-dev-panel-root') as HTMLElement | null
    let created = false
    if (!el) {
      el = document.createElement('div')
      el.id = 'seo-dev-panel-root'
      document.body.appendChild(el)
      created = true
    }
    setContainer(el)
    return () => {
      if (created && el && el.parentNode) {
        el.parentNode.removeChild(el)
      }
    }
  }, [])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
    }
  }, [])

  const syncServer = useCallback(
    async (next: DevKeywordOverride, options: { persistLocal: boolean }) => {
      if (!mountedRef.current) return
      setPending(true)
      setError(null)
      const previous = keywordIdeasRef.current
      if (options.persistLocal) {
        if (next) {
          window.localStorage.setItem(STORAGE_KEY, next)
        } else {
          window.localStorage.removeItem(STORAGE_KEY)
        }
        for (const legacyKey of LEGACY_STORAGE_KEYS) {
          if (legacyKey !== STORAGE_KEY) window.localStorage.removeItem(legacyKey)
        }
      }
      try {
        const res = await fetch('/api/dev/providers', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ keywordIdeas: next })
        })
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        const data = (await res.json().catch(() => ({}))) as { keywordIdeas?: unknown }
        const serverValue: DevKeywordOverride = data.keywordIdeas === 'mock' ? 'mock' : null
        keywordIdeasRef.current = serverValue
        setKeywordIdeas(serverValue)
      } catch (err) {
        if (options.persistLocal) {
          if (previous === 'mock') {
            window.localStorage.setItem(STORAGE_KEY, 'mock')
          } else {
            window.localStorage.removeItem(STORAGE_KEY)
          }
          for (const legacyKey of LEGACY_STORAGE_KEYS) {
            if (legacyKey !== STORAGE_KEY) window.localStorage.removeItem(legacyKey)
          }
        }
        keywordIdeasRef.current = previous
        setKeywordIdeas(previous)
        setError(err instanceof Error ? err.message : 'Failed to sync override')
      } finally {
        if (mountedRef.current) {
          setPending(false)
        }
      }
    },
    []
  )

  useEffect(() => {
    let stored: DevKeywordOverride = window.localStorage.getItem(STORAGE_KEY) === 'mock' ? 'mock' : null
    if (!stored) {
      for (const legacyKey of LEGACY_STORAGE_KEYS) {
        if (window.localStorage.getItem(legacyKey) === 'mock') {
          stored = 'mock'
          break
        }
      }
    }
    keywordIdeasRef.current = stored
    setKeywordIdeas(stored)
    const desired: DevKeywordOverride = stored
    syncServer(desired, { persistLocal: false }).catch(() => {})
  }, [syncServer])

  useEffect(() => {
    keywordIdeasRef.current = keywordIdeas
  }, [keywordIdeas])

  const statusLabel = useMemo(() => {
    if (keywordIdeas === 'mock') return 'Mock keyword generator enabled'
    return 'Using DataForSEO keyword generator'
  }, [keywordIdeas])

  if (!container) return null

  return createPortal(
    <div className="fixed bottom-4 right-4 z-[120] flex max-w-xs flex-col items-end gap-2 text-sm">
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen((prev) => !prev)}>
        Dev Panel
      </Button>
      {open ? (
        <div className="w-64 rounded-lg border border-border bg-background/95 p-4 shadow-lg backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-medium">Mock keywords</span>
            <Switch
              checked={keywordIdeas === 'mock'}
              disabled={pending}
              onCheckedChange={(checked) => {
                const next = checked ? 'mock' : null
                if (next === keywordIdeasRef.current) return
                syncServer(next, { persistLocal: true }).catch(() => {})
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">{statusLabel}</p>
          {pending ? <p className="mt-2 text-[11px] text-muted-foreground">Syncing…</p> : null}
          {error ? <p className="mt-2 text-[11px] text-destructive">{error}</p> : null}
          <div className="mt-3 flex justify-end">
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </div>,
    container
  )
}
