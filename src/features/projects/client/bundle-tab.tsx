import { useEffect, useMemo, useState } from 'react'
import { Button } from '@src/common/ui/button'
import { getBundleList, getBundleFile } from '@entities/project/service'
import { useQuery } from '@tanstack/react-query'

export function BundleTab({ projectId }: { projectId: string }) {
  const listQuery = useQuery({ queryKey: ['bundleList', projectId], queryFn: () => getBundleList(projectId), staleTime: 30000 })
  const [selected, setSelected] = useState<string | null>(null)
  const [preview, setPreview] = useState<string>('')
  const [contentType, setContentType] = useState<string>('')

  useEffect(() => {
    if (!selected) return
    ;(async () => {
      try {
        const res = await getBundleFile(projectId, selected)
        setPreview(res.content)
        setContentType(res.contentType)
      } catch {
        setPreview('Failed to load file')
        setContentType('text/plain')
      }
    })()
  }, [projectId, selected])

  const files = listQuery.data?.files ?? []
  const grouped = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const f of files) {
      const dir = f.includes('/') ? f.split('/')[0]! : ''
      const arr = map.get(dir) ?? []
      arr.push(f)
      map.set(dir, arr)
    }
    return Array.from(map.entries())
  }, [files])

  return (
    <section className="grid gap-6 lg:grid-cols-[1fr,1.5fr]">
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Bundle files</h2>
        <p className="text-xs text-muted-foreground">{listQuery.data?.base ?? ''}</p>
        {listQuery.isLoading ? (
          <p className="mt-3 text-xs text-muted-foreground">Loading…</p>
        ) : (
          <div className="mt-3 max-h-[520px] overflow-auto">
            {grouped.map(([dir, arr]) => (
              <div key={dir} className="mb-3">
                <div className="text-xs font-semibold text-foreground">{dir || '.'}</div>
                <ul className="mt-1 space-y-1">
                  {arr.map((f) => (
                    <li key={f}>
                      <button
                        type="button"
                        onClick={() => setSelected(f)}
                        className={`w-full truncate rounded px-2 py-1 text-left text-[11px] ${selected === f ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'}`}
                        title={f}
                      >
                        {f}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground">Preview</h3>
        {!selected ? (
          <p className="mt-2 text-xs text-muted-foreground">Select a file from the list to preview.</p>
        ) : (
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{selected}</p>
            <a
              href={`/api/projects/${encodeURIComponent(projectId)}/bundle/file?path=${encodeURIComponent(selected)}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary hover:underline"
            >
              Open
            </a>
          </div>
        )}
        <div className="mt-2 max-h-[560px] overflow-auto rounded-md border bg-background p-2 text-[11px] font-mono text-foreground">
          <pre className="whitespace-pre-wrap break-words">{preview}</pre>
        </div>
      </div>
    </section>
  )
}

