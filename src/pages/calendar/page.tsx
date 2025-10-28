import { Link } from '@tanstack/react-router'
import { EmptyCalendar } from '@features/calendar/client/empty-calendar'

export function Page() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <p className="text-sm text-muted-foreground">Plan and schedule your articles.</p>
      </header>
      <EmptyCalendar />
      <p className="text-xs text-muted-foreground">
        No project selected. This is a preview calendar. Create a project to schedule real content.
        <span className="ml-2"> 
          <Link to="/projects" className="text-primary underline">Go to Projects</Link>
        </span>
      </p>
    </div>
  )
}
