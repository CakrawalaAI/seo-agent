import { useMemo, useState } from 'react'
import { Button } from '@src/common/ui/button'

type DayCell = { date: Date | null; key: string }

function getMonthMatrix(base: Date): DayCell[] {
  const year = base.getFullYear()
  const month = base.getMonth()
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const startOffset = (first.getDay() + 6) % 7 // Monday=0
  const totalDays = last.getDate()
  const cells: DayCell[] = []
  // leading blanks
  for (let i = 0; i < startOffset; i++) cells.push({ date: null, key: `b-${i}` })
  // month days
  for (let d = 1; d <= totalDays; d++) {
    const dt = new Date(year, month, d)
    cells.push({ date: dt, key: `d-${d}` })
  }
  // trailing blanks to complete weeks
  const trailing = (7 - (cells.length % 7)) % 7
  for (let i = 0; i < trailing; i++) cells.push({ date: null, key: `a-${i}` })
  return cells
}

export type CalendarChip = {
  date: string
  title: string
  status: 'published' | 'scheduled' | 'queued' | 'unpublished'
  href?: string
}

export function EmptyCalendar({ chips = [] }: { chips?: CalendarChip[] }): JSX.Element {
  const [cursor, setCursor] = useState(() => new Date())
  const matrix = useMemo(() => getMonthMatrix(cursor), [cursor])
  const monthLabel = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const today = new Date()
  const isToday = (d: Date) => d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()

  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            className="rounded-md border border-input px-2 py-1 text-sm hover:bg-muted"
            onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
          >
            ◀
          </Button>
          <Button
            type="button"
            className="rounded-md border border-input px-2 py-1 text-sm hover:bg-muted"
            onClick={() => setCursor(new Date())}
          >
            Today
          </Button>
          <Button
            type="button"
            className="rounded-md border border-input px-2 py-1 text-sm hover:bg-muted"
            onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
          >
            ▶
          </Button>
          <span className="ml-3 text-sm text-muted-foreground">{monthLabel}</span>
        </div>
        <div className="text-xs text-muted-foreground">Calendar Guide</div>
      </div>
      <div className="grid grid-cols-7 gap-2 text-xs">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="px-2 py-1 text-muted-foreground">{d}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-2">
        {matrix.map((cell) => {
          if (!cell.date) return <div key={cell.key} className="h-24 rounded-md border border-dashed border-muted/60 bg-muted/20" />
          const t = isToday(cell.date)
          const dayStr = cell.date.toISOString().slice(0, 10)
          const items = chips.filter((c) => c.date.slice(0, 10) === dayStr).slice(0, 2)
          return (
            <div
              key={cell.key}
              className={`h-24 rounded-md border bg-card ${t ? 'border-primary/60' : 'border-border'} sm:h-28`}
            >
              <div className="flex items-center justify-end px-2 py-1 text-xs text-muted-foreground">
                {cell.date.getDate()}
              </div>
              <div className="flex flex-col gap-1 px-2 pb-2">
                {items.length === 0 ? (
                  <div className="h-4 w-full rounded bg-muted/50" />
                ) : (
                  items.map((it, idx) => (
                    <Chip key={idx} {...it} />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Chip({ title, status, href }: CalendarChip) {
  const color =
    status === 'published'
      ? 'bg-emerald-600'
      : status === 'scheduled'
      ? 'bg-blue-600'
      : status === 'unpublished'
      ? 'bg-rose-600'
      : 'bg-amber-600'
  const content = (
    <span className="inline-flex w-full items-center gap-2 truncate rounded px-2 py-0.5 text-[11px] font-medium text-white">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span className="truncate">{title}</span>
    </span>
  )
  if (href) {
    return (
      <a href={href} className="block">
        {content}
      </a>
    )
  }
  return content
}
