// @ts-nocheck
import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { Integration } from '@seo-agent/domain'
import { useProjectLayout } from './__layout'

type TestResponse = {
  status: string
  message?: string
}

const testIntegration = async (integrationId: string): Promise<TestResponse> => {
  const response = await fetch(`/api/integrations/${integrationId}/test`, {
    method: 'POST',
    credentials: 'include'
  })
  if (!response.ok) {
    throw new Error('Integration test failed')
  }
  return (await response.json()) as TestResponse
}

export const Route = createFileRoute('/projects/$projectId/integrations')({
  component: IntegrationsPage
})

function IntegrationsPage() {
  const { snapshot, projectId, refetch } = useProjectLayout()
  const integrations = snapshot?.integrations ?? []

  const [testResults, setTestResults] = useState<Record<string, { status: 'success' | 'error'; message: string }>>({})
  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [webflowToken, setWebflowToken] = useState('')
  const [webflowCollection, setWebflowCollection] = useState('')
  const [webflowPublishMode, setWebflowPublishMode] = useState<'draft' | 'live'>('draft')
  const [webflowNameField, setWebflowNameField] = useState('name')
  const [webflowSlugField, setWebflowSlugField] = useState('slug')
  const [webflowBodyField, setWebflowBodyField] = useState('')
  const [webflowSummaryField, setWebflowSummaryField] = useState('')
  const [webflowSeoTitleField, setWebflowSeoTitleField] = useState('')
  const [webflowSeoDescriptionField, setWebflowSeoDescriptionField] = useState('')
  const [webflowTagsField, setWebflowTagsField] = useState('')
  const [webflowImageField, setWebflowImageField] = useState('')
  const [webflowLocale, setWebflowLocale] = useState('')

  const testMutation = useMutation({
    mutationFn: (integrationId: string) => testIntegration(integrationId)
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        projectId,
        type: 'webhook',
        config: {
          targetUrl: webhookUrl,
          secret: webhookSecret
        },
        status: 'connected'
      }
      const response = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      })
      if (!response.ok) {
        throw new Error('Failed to create integration')
      }
      return (await response.json()) as Integration
    },
    onSuccess: async (integration) => {
      setWebhookUrl('')
      setWebhookSecret('')
      await refetch()
      if (integration?.id) {
        await handleTest(integration.id)
      }
    }
  })

  const createWebflowMutation = useMutation({
    mutationFn: async () => {
      const trim = (value: string) => value.trim()
      const field = (value: string) => {
        const next = value.trim()
        return next.length > 0 ? next : undefined
      }

      const payload = {
        projectId,
        type: 'webflow',
        config: {
          accessToken: trim(webflowToken),
          collectionId: trim(webflowCollection),
          publishMode: webflowPublishMode,
          cmsLocaleId: field(webflowLocale),
          fieldMapping: {
            name: field(webflowNameField) ?? 'name',
            slug: field(webflowSlugField) ?? 'slug',
            body: trim(webflowBodyField),
            excerpt: field(webflowSummaryField),
            seoTitle: field(webflowSeoTitleField),
            seoDescription: field(webflowSeoDescriptionField),
            tags: field(webflowTagsField),
            mainImage: field(webflowImageField)
          }
        },
        status: 'connected'
      }

      if (!payload.config.accessToken) {
        throw new Error('Access token is required')
      }
      if (!payload.config.collectionId) {
        throw new Error('Collection ID is required')
      }
      if (!payload.config.fieldMapping.body) {
        throw new Error('Body field is required')
      }

      const response = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error('Failed to create Webflow integration')
      }

      return (await response.json()) as Integration
    },
    onSuccess: async (integration) => {
      setWebflowToken('')
      setWebflowCollection('')
      setWebflowBodyField('')
      setWebflowSummaryField('')
      setWebflowSeoTitleField('')
      setWebflowSeoDescriptionField('')
      setWebflowTagsField('')
      setWebflowImageField('')
      setWebflowLocale('')
      await refetch()
      if (integration?.id) {
        await handleTest(integration.id)
      }
    }
  })

  const integrationSummary = useMemo(
    () =>
      integrations.reduce(
        (acc, integration) => {
          acc[integration.type] = (acc[integration.type] ?? 0) + 1
          return acc
        },
        {} as Record<string, number>
      ),
    [integrations]
  )

  const handleTest = async (integrationId: string) => {
    try {
      const result = await testMutation.mutateAsync(integrationId)
      setTestResults((prev) => ({
        ...prev,
        [integrationId]: { status: 'success', message: result.message ?? 'Test event delivered' }
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Integration test failed'
      setTestResults((prev) => ({
        ...prev,
        [integrationId]: { status: 'error', message }
      }))
    }
  }

  const maskConfig = (integration: Integration) => {
    const raw = (integration?.configJson ?? {}) as Record<string, any>
    if (integration.type === 'webhook') {
      return {
        ...raw,
        secret: raw?.secret ? '********' : undefined
      }
    }
    if (integration.type === 'webflow') {
      const fieldMapping = raw?.fieldMapping ?? {}
      return {
        ...raw,
        accessToken: raw?.accessToken ? '********' : undefined,
        fieldMapping
      }
    }
    return raw
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Integrations</p>
        <h2 className="text-2xl font-semibold">Connect your CMS or custom webhook</h2>
        <p className="text-sm text-muted-foreground">
          Connect a Webhook endpoint or a Webflow CMS collection. Webhook receives HMAC-signed PortableArticle payloads; Webflow creates CMS items and can publish them live or keep drafts for review.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[2fr,3fr]">
        <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">CLI quickstart</p>
          <ul className="mt-2 space-y-1">
            <li>
              <code className="rounded bg-background px-2 py-1">seo integration add webhook --project {projectId} --url https://your-site/api/receive --secret sk_test</code>
            </li>
            <li>
              <code className="rounded bg-background px-2 py-1">seo integration add webflow --project {projectId} --token wfpat_xxx --collection 000000000000000000000000 --body-field rich-text</code>
            </li>
            <li>
              <code className="rounded bg-background px-2 py-1">seo integration test --integration &lt;integrationId&gt;</code>
            </li>
          </ul>
        </div>
        <div className="flex flex-col gap-4">
          <form
            className="flex flex-col gap-3 rounded-lg border bg-card p-4 text-sm"
            onSubmit={(event) => {
              event.preventDefault()
              if (!webhookUrl || !webhookSecret) return
              createMutation.mutateAsync().catch(() => {})
            }}
          >
          <div>
            <h3 className="text-sm font-semibold text-foreground">Connect webhook</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Provide a URL that accepts signed `PortableArticle` payloads. We will send a test event immediately.
            </p>
          </div>
          <label className="text-xs font-medium text-muted-foreground" htmlFor="webhook-url">
            Target URL
          </label>
          <input
            id="webhook-url"
            type="url"
            required
            value={webhookUrl}
            onChange={(event) => setWebhookUrl(event.target.value)}
            placeholder="https://app.example.com/api/receive"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={createMutation.isPending}
          />
          <label className="text-xs font-medium text-muted-foreground" htmlFor="webhook-secret">
            Shared secret
          </label>
          <input
            id="webhook-secret"
            type="text"
            required
            value={webhookSecret}
            onChange={(event) => setWebhookSecret(event.target.value)}
            placeholder="sk_test_123"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={createMutation.isPending}
          />
          <button
            type="submit"
            className="mt-2 inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Connecting…' : 'Save & send test'}
          </button>
          {createMutation.isError ? (
            <p className="text-xs text-destructive">Unable to create integration. Check the URL and secret.</p>
          ) : null}
          </form>
          <form
            className="flex flex-col gap-3 rounded-lg border bg-card p-4 text-sm"
            onSubmit={(event) => {
              event.preventDefault()
              createWebflowMutation.mutateAsync().catch(() => {})
            }}
          >
            <div>
              <h3 className="text-sm font-semibold text-foreground">Connect Webflow CMS</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Use a Webflow API token with CMS access and map collection fields. Run the test action afterwards to validate the mapping.
              </p>
            </div>
            <label className="text-xs font-medium text-muted-foreground" htmlFor="webflow-token">
              Access token
            </label>
            <input
              id="webflow-token"
              type="password"
              required
              value={webflowToken}
              onChange={(event) => setWebflowToken(event.target.value)}
              placeholder="wfpat_..."
              className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={createWebflowMutation.isPending}
            />
            <label className="text-xs font-medium text-muted-foreground" htmlFor="webflow-collection">
              Collection ID
            </label>
            <input
              id="webflow-collection"
              type="text"
              required
              value={webflowCollection}
              onChange={(event) => setWebflowCollection(event.target.value)}
              placeholder="e.g. 639656400769508adc12fe42"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={createWebflowMutation.isPending}
            />
            <label className="text-xs font-medium text-muted-foreground" htmlFor="webflow-mode">
              Publish mode
            </label>
            <select
              id="webflow-mode"
              value={webflowPublishMode}
              onChange={(event) => setWebflowPublishMode(event.target.value === 'live' ? 'live' : 'draft')}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={createWebflowMutation.isPending}
            >
              <option value="draft">Keep as draft</option>
              <option value="live">Publish immediately</option>
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-muted-foreground">
                Title field
                <input
                  type="text"
                  value={webflowNameField}
                  onChange={(event) => setWebflowNameField(event.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={createWebflowMutation.isPending}
                />
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                Slug field
                <input
                  type="text"
                  value={webflowSlugField}
                  onChange={(event) => setWebflowSlugField(event.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={createWebflowMutation.isPending}
                />
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                Body field (rich text)
                <input
                  type="text"
                  required
                  value={webflowBodyField}
                  onChange={(event) => setWebflowBodyField(event.target.value)}
                  placeholder="e.g. post-body"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={createWebflowMutation.isPending}
                />
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                Summary field (optional)
                <input
                  type="text"
                  value={webflowSummaryField}
                  onChange={(event) => setWebflowSummaryField(event.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={createWebflowMutation.isPending}
                />
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                SEO title field (optional)
                <input
                  type="text"
                  value={webflowSeoTitleField}
                  onChange={(event) => setWebflowSeoTitleField(event.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={createWebflowMutation.isPending}
                />
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                Meta description field (optional)
                <input
                  type="text"
                  value={webflowSeoDescriptionField}
                  onChange={(event) => setWebflowSeoDescriptionField(event.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={createWebflowMutation.isPending}
                />
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                Tags field (optional)
                <input
                  type="text"
                  value={webflowTagsField}
                  onChange={(event) => setWebflowTagsField(event.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={createWebflowMutation.isPending}
                />
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                Main image field (optional)
                <input
                  type="text"
                  value={webflowImageField}
                  onChange={(event) => setWebflowImageField(event.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={createWebflowMutation.isPending}
                />
              </label>
            </div>
            <label className="text-xs font-medium text-muted-foreground" htmlFor="webflow-locale">
              Locale ID (optional)
            </label>
            <input
              id="webflow-locale"
              type="text"
              value={webflowLocale}
              onChange={(event) => setWebflowLocale(event.target.value)}
              placeholder="Primary locale will be used if empty"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={createWebflowMutation.isPending}
            />
            <button
              type="submit"
              className="mt-2 inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={createWebflowMutation.isPending}
            >
              {createWebflowMutation.isPending ? 'Connecting…' : 'Save Webflow config'}
            </button>
            {createWebflowMutation.isError ? (
              <p className="text-xs text-destructive">Unable to connect to Webflow. Verify token, collection, and the field mapping.</p>
            ) : null}
          </form>
        </div>
      </div>

      {integrations.length === 0 ? (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          No integrations configured. Add a webhook or Webflow connector to start auto-publishing.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(integrationSummary).map(([type, count]) => (
              <div key={type} className="rounded-md border bg-card p-3">
                <p className="text-xs uppercase text-muted-foreground">{type}</p>
                <p className="text-lg font-semibold text-foreground">{count}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {integrations.map((integration) => (
              <article key={integration.id} className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm">
                <header className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{integration.type}</h3>
                    <p className="text-xs text-muted-foreground">Integration ID: {integration.id}</p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {integration.status}
                  </span>
                </header>
                <pre className="overflow-x-auto rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
{JSON.stringify(maskConfig(integration), null, 2)}
                </pre>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center rounded-md border border-input px-3 py-2 text-xs font-medium transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                    disabled={testMutation.isPending}
                    onClick={() => handleTest(integration.id)}
                  >
                    {testMutation.isPending ? 'Sending…' : 'Send test event'}
                  </button>
                </div>
                {testResults[integration.id] ? (
                  <div
                    className={`rounded-md px-3 py-2 text-xs ${
                      testResults[integration.id].status === 'success'
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-destructive/10 text-destructive'
                    }`}
                  >
                    {testResults[integration.id].message}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
