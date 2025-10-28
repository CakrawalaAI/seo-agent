import { Link } from '@tanstack/react-router'
import { EmptyCalendar } from '@features/calendar/client/empty-calendar'
import { useActiveProject } from '@common/state/active-project'
import { useState } from 'react'
import { useCalendarEntries } from '@features/calendar/shared/useCalendarEntries'

export function Page() {
  const { id } = useActiveProject()
  const [cursor, setCursor] = useState(() => new Date())
  const { entries } = useCalendarEntries(id, cursor)
  const chips = entries.map((e) => ({ date: e.date, title: e.title, status: e.status, href: e.articleId ? `/projects/${id}/articles/${e.articleId}` : undefined }))
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <p className="text-sm text-muted-foreground">Plan and schedule your articles.</p>
      </header>
      <EmptyCalendar chips={chips} />
      <p className="text-xs text-muted-foreground">
        No project selected. This is a preview calendar. Create a project to schedule real content.
        <span className="ml-2"> 
          <Link to="/projects" className="text-primary underline">Go to Projects</Link>
        </span>
      </p>
    </div>
  )
}
