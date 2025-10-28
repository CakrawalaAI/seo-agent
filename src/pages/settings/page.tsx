export function Page() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Settings</p>
        <h1 className="text-3xl font-semibold">Account & App Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage preferences and defaults. Project-specific settings live within each project.
        </p>
      </header>
      <section className="rounded-lg border bg-card p-6 text-sm shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Preferences</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Theme: follows system (dark)</li>
          <li>Notifications: coming soon</li>
          <li>Default locale: en-US</li>
        </ul>
      </section>
    </main>
  )
}

