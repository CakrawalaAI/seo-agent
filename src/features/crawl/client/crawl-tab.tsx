import { formatDateTime } from '@features/projects/shared/helpers'
import type { CrawlPage } from '@entities'

type CrawlTabProps = {
  items: CrawlPage[]
  isLoading: boolean
  onRefresh: () => void
  onStartCrawl: () => void
  isStarting: boolean
}

export function CrawlTab({ items, isLoading, onRefresh, onStartCrawl, isStarting }: CrawlTabProps) {
  const lastExtractedAt = items[0]?.extractedAt ?? null

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onStartCrawl}
          disabled={isStarting}
        >
          {isStarting ? 'Starting…' : 'Start crawl'}
        </button>
        <button
          type="button"
          className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onRefresh}
          disabled={isLoading}
        >
          {isLoading ? 'Refreshing…' : 'Refresh list'}
        </button>
        {lastExtractedAt ? (
          <span className="text-xs text-muted-foreground">
            Last fetched {formatDateTime(lastExtractedAt)}
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading crawl pages…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No crawl pages yet. Start a crawl to populate the site snapshot.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">URL</th>
                <th className="px-4 py-2 text-left font-semibold">Status</th>
                <th className="px-4 py-2 text-left font-semibold">Title</th>
                <th className="px-4 py-2 text-left font-semibold">Extracted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((page) => (
                <tr key={page.id} className="odd:bg-muted/30">
                  <td className="break-all px-4 py-3 text-sm font-medium text-primary">
                    {page.url}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {page.httpStatus ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {page.metaJson?.title ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDateTime(page.extractedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
