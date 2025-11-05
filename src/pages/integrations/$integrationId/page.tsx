import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { integrationManifests } from '@integrations/shared/catalog'
import type { IntegrationManifest } from '@integrations/shared/types'
import { IntegrationComingSoon } from '@features/integrations/shared/coming-soon'
import { integrationForms } from '@features/integrations/shared/forms'
import { Badge } from '@src/common/ui/badge'
import { Button } from '@src/common/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@src/common/ui/empty'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@src/common/ui/breadcrumb'

type PageProps = {
  integrationId: string
}

export function Page({ integrationId }: PageProps): JSX.Element {
  const manifest = useMemo<IntegrationManifest | undefined>(
    () => integrationManifests.find((entry) => entry.type === integrationId),
    [integrationId]
  )

  if (!manifest) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Integration not found</EmptyTitle>
            <EmptyDescription>The requested integration key is not part of the catalog.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  const availabilityLabel = availabilityBadge(manifest.availability)
  const docsUrl = manifest.docsUrl ?? `/docs/research/integrations/${integrationId}.md`

  const FormComponent = integrationForms[integrationId] ?? (() => <IntegrationComingSoon name={manifest.name} docsUrl={docsUrl} />)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/dashboard">Dashboard</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/integrations">Integrations</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{manifest.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-foreground">{manifest.name}</h1>
          <Badge variant={availabilityLabel.variant}>{availabilityLabel.text}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{manifest.description}</p>
      </header>

      <section className="space-y-4 rounded-lg border bg-card p-5 shadow-sm">
        <FormComponent />

        <dl className="grid grid-cols-1 gap-4 text-sm text-muted-foreground md:grid-cols-2">
          <div>
            <dt className="font-semibold text-foreground">Connection Mode</dt>
            <dd className="mt-1 capitalize">{manifest.connectMode.replace('-', ' ')}</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Supports Test?</dt>
            <dd className="mt-1">{manifest.supportsTest ? 'Yes' : 'No'}</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Auto Activate</dt>
            <dd className="mt-1">{manifest.supportsAutoActivate ? 'Yes' : 'No'}</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Status</dt>
            <dd className="mt-1 capitalize">{manifest.availability}</dd>
          </div>
        </dl>

        {manifest.configFields?.length ? (
          <div>
            <h2 className="text-sm font-semibold text-foreground">Expected Configuration</h2>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {manifest.configFields.map((field) => (
                <li key={field.key}>
                  <span className="font-medium text-foreground">{field.label}</span>
                  <span className="ml-2 text-xs uppercase tracking-wide text-muted-foreground/80">({field.type})</span>
                  {field.helpText ? <span className="ml-2 text-xs text-muted-foreground/70">{field.helpText}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild size="sm">
            <a href={docsUrl} target="_blank" rel="noreferrer">
              Open integration docs
            </a>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/integrations">Back to list</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}

function availabilityBadge(availability: IntegrationManifest['availability']): { text: string; variant: 'outline' | 'secondary' } {
  switch (availability) {
    case 'ga':
      return { text: 'General Availability', variant: 'secondary' }
    case 'beta':
      return { text: 'Beta', variant: 'secondary' }
    default:
      return { text: 'Planned', variant: 'outline' }
  }
}
