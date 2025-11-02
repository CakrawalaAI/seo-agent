import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useActiveProject } from '@common/state/active-project'
import { useMockData } from '@common/dev/mock-data-context'
import { createWebhook, getProjectSnapshot } from '@entities/project/service'
import type { ProjectIntegration } from '@entities'
import { Button } from '@src/common/ui/button'
import { Input } from '@src/common/ui/input'
import { Label } from '@src/common/ui/label'
import { Badge } from '@src/common/ui/badge'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@src/common/ui/empty'

const MOCK_WEBHOOKS: ProjectIntegration[] = [
  {
    id: 'integration-m-1',
    projectId: 'proj_mock',
    type: 'webhook',
    status: 'connected',
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
    updatedAt: new Date().toISOString(),
    configJson: {
      targetUrl: 'https://example.com/hooks/seo-agent',
      secret: '••••••mock'
    }
  }
]

export function Page(): JSX.Element {
  const { id: projectId } = useActiveProject()
  const { enabled: mockEnabled } = useMockData()
  const [targetUrl, setTargetUrl] = useState('')
  const [secret, setSecret] = useState('')

  const snapshotQuery = useQuery({
    queryKey: ['integrations.snapshot', projectId],
    queryFn: () => getProjectSnapshot(projectId!),
    enabled: Boolean(projectId && !mockEnabled),
    refetchInterval: 45_000
  })

  const integrations = mockEnabled
    ? MOCK_WEBHOOKS
    : (snapshotQuery.data?.integrations ?? []).filter((integration) => integration.type === 'webhook')

  const createWebhookMutation = useMutation({
    mutationFn: () => createWebhook(projectId!, targetUrl, secret),
    onSuccess: () => {
      setTargetUrl('')
      setSecret('')
      snapshotQuery.refetch()
    }
  })

  if (!projectId) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Integrations</h1>
          <p className="text-sm text-muted-foreground">Select a project to configure webhook delivery.</p>
        </header>
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No project selected</EmptyTitle>
            <EmptyDescription>Pick a project from the sidebar to connect a webhook target.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-sm text-muted-foreground">Just the essentials—connect a webhook endpoint for publishing.</p>
      </header>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Active webhooks</h2>
        {integrations.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {mockEnabled
              ? 'Toggle mock data off to see live integrations.'
              : 'No webhooks yet. Add one below to start receiving published articles.'}
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {integrations.map((integration) => (
              <li key={integration.id} className="rounded-md border border-border/70 bg-background/70 p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{integration.configJson?.targetUrl ?? '—'}</span>
                  <Badge variant={integration.status === 'connected' ? 'default' : 'secondary'} className="uppercase">
                    {integration.status ?? 'unknown'}
                  </Badge>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Secret: {integration.configJson?.secret ? maskSecret(String(integration.configJson.secret)) : '—'}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Add webhook</h2>
        <p className="mt-1 text-sm text-muted-foreground">We will POST PortableArticle payloads with an HMAC signature.</p>
        <form
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (!targetUrl || !secret || mockEnabled) return
            createWebhookMutation.mutate()
          }}
        >
          <Label className="flex flex-col gap-2 text-xs font-medium text-muted-foreground">
            Target URL
            <Input
              type="url"
              required
              value={targetUrl}
              onChange={(event) => setTargetUrl(event.target.value)}
              placeholder="https://example.com/hooks/seo-agent"
              disabled={createWebhookMutation.isPending || mockEnabled}
            />
          </Label>
          <Label className="flex flex-col gap-2 text-xs font-medium text-muted-foreground">
            Shared secret
            <Input
              type="text"
              required
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              placeholder="Enter a secret used to sign payloads"
              disabled={createWebhookMutation.isPending || mockEnabled}
            />
          </Label>
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={createWebhookMutation.isPending || mockEnabled || !targetUrl || !secret}
            >
              {createWebhookMutation.isPending ? 'Creating…' : mockEnabled ? 'Mock data' : 'Create webhook'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}

function maskSecret(secret: string) {
  if (!secret) return '—'
  if (secret.length <= 6) return '••••'
  return `${secret.slice(0, 3)}••••${secret.slice(-2)}`
}
