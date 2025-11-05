type ComingSoonProps = {
  name: string
  docsUrl?: string
}

export function IntegrationComingSoon({ name, docsUrl }: ComingSoonProps) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  return (
    <div className="space-y-3 rounded-md border border-dashed border-muted-foreground/40 bg-muted/10 p-4 text-sm text-muted-foreground">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <p className="text-foreground">
          {name} connector is queued for development. Until we ship it, publishing will raise a
          <code className="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs text-foreground/80">NotImplementedError</code>
          inside the worker.
        </p>
        {docsUrl ? (
          <a
            className="inline-flex items-center rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition hover:border-primary hover:bg-primary/20"
            href={docsUrl}
            target="_blank"
            rel="noreferrer"
          >
            View research notes →
          </a>
        ) : null}
      </div>

      <p>
        You can still collect configuration details and map requirements with stakeholders. Once the adapter lands,
        saved config will hydrate the real implementation automatically.
      </p>

      <pre className="whitespace-pre-wrap rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
{`throw new NotImplementedError("[${slug}] publish not implemented — see integration research");`}
      </pre>
    </div>
  )
}
