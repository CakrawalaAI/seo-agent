import { useState } from 'react'
import { Button } from '@src/common/ui/button'
import { Input } from '@src/common/ui/input'
import { Label } from '@src/common/ui/label'
import { formatIntegrationLabel, maskSecret } from '@features/projects/shared/helpers'
import type { ProjectIntegration } from '@entities'

type Props = {
  integrations: ProjectIntegration[]
  onTest: (integrationId: string) => void
  testingIntegrationId: string | null
  onCreateWebhook: (input: { targetUrl: string; secret: string }) => Promise<unknown>
  creatingWebhook: boolean
}

export function IntegrationsSidebar({ integrations, onTest, testingIntegrationId, onCreateWebhook, creatingWebhook }: Props) {
  const [targetUrl, setTargetUrl] = useState('')
  const [secret, setSecret] = useState('')

  return (
    <aside className="rounded-lg border bg-card p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground">Integrations</h3>
      <div className="mt-2 space-y-2">
        {integrations.length === 0 ? (
          <p className="text-xs text-muted-foreground">No integrations yet.</p>
        ) : (
          integrations.map((integration) => (
            <div key={integration.id} className="rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-foreground">{formatIntegrationLabel(integration)}</div>
                  <div className="text-[11px] text-muted-foreground">{integration.type.toUpperCase()} · {String(integration.status ?? 'unknown').toUpperCase()}</div>
                </div>
                <Button
                  type="button"
                  className="rounded-md border border-input px-2 py-1 text-[11px] font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => onTest(integration.id)}
                  disabled={testingIntegrationId === integration.id}
                >
                  {testingIntegrationId === integration.id ? 'Testing…' : 'Send test'}
                </Button>
              </div>
              {integration.type === 'webhook' ? (
                <dl className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                  <div>
                    <dt>Target</dt>
                    <dd className="break-all text-foreground">{integration.configJson?.targetUrl ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Secret</dt>
                    <dd>{integration.configJson?.secret ? maskSecret(integration.configJson.secret) : '—'}</dd>
                  </div>
                </dl>
              ) : null}
            </div>
          ))
        )}
      </div>

      <div className="mt-4 h-px w-full bg-border" />
      <h4 className="mt-3 text-xs font-semibold text-foreground">Add webhook</h4>
      <p className="mt-1 text-[11px] text-muted-foreground">Receive PortableArticle payloads with HMAC signatures.</p>
      <form
        className="mt-3 space-y-3 text-sm"
        onSubmit={async (event) => {
          event.preventDefault()
          if (!targetUrl || !secret) return
          try {
            await onCreateWebhook({ targetUrl, secret })
            setTargetUrl('')
            setSecret('')
          } catch {}
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
  )
}

