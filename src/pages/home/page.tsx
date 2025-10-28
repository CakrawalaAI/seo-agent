import { Link } from '@tanstack/react-router'

export function Page() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-16">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">SEO Agent</p>
        <h1 className="text-3xl font-semibold">Programmatic SEO autopilot</h1>
        <p className="text-muted-foreground">
          Connect a site, review the 30-day content plan, and let the worker generate and
          publish one article per day.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            Open dashboard
          </Link>
          <a href="/projects" className="text-sm font-medium text-primary hover:underline">
            View projects
          </a>
        </div>
      </header>
      <section className="grid gap-4 md:grid-cols-2">
        {FEATURES.map((feature) => (
          <article key={feature.title} className="rounded-lg border bg-card p-4 shadow-sm">
            <h2 className="text-lg font-semibold">{feature.title}</h2>
            <p className="text-sm text-muted-foreground">{feature.description}</p>
          </article>
        ))}
      </section>
    </main>
  )
}

const FEATURES = [
  {
    title: 'Crawl & discovery',
    description:
      'Playwright-powered crawler enriches each page with headings, metadata, and internal link graph.'
  },
  {
    title: 'Planning',
    description:
      'Generates a 30-day calendar of titles and outlines mapped to the highest value keywords.'
  },
  {
    title: 'Daily generation',
    description: 'Lazy drafts unlock each day, ready for inline edits in the web editor or CLI.'
  },
  {
    title: 'Autopublish',
    description: 'Webhook + Webflow connectors push approved drafts live once the buffer clears.'
  }
] as const
