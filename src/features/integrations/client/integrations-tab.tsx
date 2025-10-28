import { useState } from 'react'
import { Button } from '@src/common/ui/button'
import { Input } from '@src/common/ui/input'
import { Label } from '@src/common/ui/label'

import { formatIntegrationLabel, maskSecret } from '@features/projects/shared/helpers'
import type { ProjectIntegration } from '@entities'

type IntegrationsTabProps = {
  integrations: ProjectIntegration[]
  onTest: (integrationId: string) => void
  testingIntegrationId: string | null
  onCreateWebhook: (input: { targetUrl: string; secret: string }) => Promise<unknown>
  creatingWebhook: boolean
}

export function IntegrationsTab({
  integrations,
  onTest,
  testingIntegrationId,
  onCreateWebhook,
  creatingWebhook
}: IntegrationsTabProps) {
  const [targetUrl, setTargetUrl] = useState('')
  const [secret, setSecret] = useState('')

  return (
    <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
      <div className="space-y-4">
        {integrations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No integrations yet. Add a webhook to start publishing drafts.
          </p>
        ) : (
          integrations.map((integration) => (
            <article key={integration.id} className="rounded-lg border bg-card p-4 shadow-sm">
              <header className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {formatIntegrationLabel(integration)}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {integration.type.toUpperCase()} · {String(integration.status ?? 'unknown').toUpperCase()}
                  </p>
                </div>
                <Button
                  type="button"
                  className="rounded-md border border-input px-3 py-1 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => onTest(integration.id)}
                  disabled={testingIntegrationId === integration.id}
                >
                  {testingIntegrationId === integration.id ? 'Testing…' : 'Send test'}
                </Button>
              </header>
              {integration.type === 'webhook' ? (
                <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <div>
                    <dt>Target URL</dt>
                    <dd className="break-all text-foreground">
                      {integration.configJson?.targetUrl ?? '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>Secret</dt>
                    <dd>{integration.configJson?.secret ? maskSecret(integration.configJson.secret) : '—'}</dd>
                  </div>
                </dl>
              ) : null}
            </article>
          ))
        )}
      </div>

      <aside className="rounded-lg border bg-card p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground">Add webhook</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Configure a webhook receiver to publish PortableArticle payloads with HMAC signatures.
        </p>
        <form
          className="mt-4 space-y-3 text-sm"
          onSubmit={async (event) => {
            event.preventDefault()
            if (!targetUrl || !secret) return
            try {
              await onCreateWebhook({ targetUrl, secret })
              setTargetUrl('')
              setSecret('')
            } catch {
              // handled upstream
            }
          }}
        >
          <Label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Target URL
            <Input
              type="url"
              required
              value={targetUrl}
              onChange={(event) => setTargetUrl(event.target.value)}
              placeholder="https://example.com/seo-agent"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              disabled={creatingWebhook}
            />
          </Label>
          <Label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Secret
            <Input
              type="text"
              required
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              placeholder="Shared secret"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              disabled={creatingWebhook}
            />
          </Label>
          <Button
            type="submit"
            className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!targetUrl || !secret || creatingWebhook}
          >
            {creatingWebhook ? 'Creating…' : 'Create webhook'}
          </Button>
        </form>
      </aside>
    </section>
  )
}
