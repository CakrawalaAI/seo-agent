import { formatDateTime } from '@src/common/ui/format'
import { Button } from '@src/common/ui/button'
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@src/common/ui/table'
import type { CrawlPage } from '@entities'

type CrawlTabProps = {
  items: CrawlPage[]
  isLoading: boolean
  onRefresh: () => void
  onStartCrawl: () => void
  isStarting: boolean
}

export function CrawlTab({ items, isLoading, onRefresh, onStartCrawl, isStarting }: CrawlTabProps) {
  const lastExtractedAt = (items[0] as any)?.createdAt ?? null

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onStartCrawl}
          disabled={isStarting}
        >
          {isStarting ? 'Starting…' : 'Start crawl'}
        </Button>
        <Button
          type="button"
          className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onRefresh}
          disabled={isLoading}
        >
          {isLoading ? 'Refreshing…' : 'Refresh list'}
        </Button>
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
          <Table className="min-w-full divide-y divide-border text-sm">
            <TableHeader className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <TableRow>
                <TableHead className="px-4 py-2 text-left font-semibold">URL</TableHead>
                <TableHead className="px-4 py-2 text-left font-semibold">Status</TableHead>
                <TableHead className="px-4 py-2 text-left font-semibold">Title</TableHead>
                <TableHead className="px-4 py-2 text-left font-semibold">Extracted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border">
              {items.map((page) => (
                <TableRow key={page.id} className="odd:bg-muted/30">
                  <TableCell className="break-all px-4 py-3 text-sm font-medium text-primary">
                    {page.url}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                    {page.httpStatus ?? '—'}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-foreground">
                    {(page as any).title ?? '—'}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDateTime((page as any).createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}
