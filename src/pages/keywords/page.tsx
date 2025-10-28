import { Link } from '@tanstack/react-router'

export function Page() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Keywords</h1>
        <p className="text-sm text-muted-foreground">Discover and prioritize opportunities.</p>
      </header>
      <section className="rounded-lg border bg-card p-6 text-sm shadow-sm">
        <p>No project selected. Create a project to view keywords.</p>
        <div className="mt-3">
          <Link to="/projects" className="text-primary underline">
            Go to Projects
          </Link>
        </div>
      </section>
    </div>
  )
}

