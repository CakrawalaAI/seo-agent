import { useEffect, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ArrowRight, Loader2 } from 'lucide-react'
import { useForm } from '@tanstack/react-form'
import { Button } from '@src/common/ui/button'
import { Input } from '@src/common/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@src/common/ui/form'
import { toast } from 'sonner'
import { log } from '@src/common/logger'
import { trackOnboardingEvent } from './telemetry'

type OnboardingResponse =
  | { status: 'auth'; url: string; redirect: string }
  | {
      status: 'created' | 'existing'
      websiteId: string
      websiteSlug: string
      crawlJobId: string | null
      redirect: string
    }

function prepareSiteUrl(raw: string): string {
  const value = (raw || '').trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  return `https://${value}`
}

const LOCAL_STORAGE_KEY = 'seo-agent.onboarding.siteUrl'

export function OnboardingForm() {
  const [flowId] = useState(() => {
    try { return crypto.randomUUID() } catch { return Math.random().toString(36).slice(2) }
  })
  const initialSiteUrl = useMemo(() => {
    if (typeof window === 'undefined') return ''
    try {
      return window.localStorage.getItem(LOCAL_STORAGE_KEY) ?? ''
    } catch {
      return ''
    }
  }, [])
  const [externalError, setExternalError] = useState<string | null>(null)

  const submitMutation = useMutation<OnboardingResponse, Error, string>({
    mutationFn: async (prepared) => {
      trackOnboardingEvent('onboarding_form_submit', { siteUrl: prepared })
      log.debug('[onboarding.form] submit_click', { flowId, raw: form.store.state.values.siteUrl, prepared })
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-seoa-flow': flowId },
        body: JSON.stringify({ siteUrl: prepared, flowId })
      })
      if (!response.ok) {
        let message = 'Unable to submit website. Check your domain and try again.'
        try {
          const payload = await response.json()
          if (payload?.message) message = String(payload.message)
        } catch {}
        throw new Error(message)
      }
      return (await response.json()) as OnboardingResponse
    },
    onSuccess: (result) => {
      log.debug('[onboarding.form] submit_success', { flowId, status: result.status, redirect: (result as any)?.redirect })
      if (result.status === 'created' || result.status === 'existing') {
        trackOnboardingEvent('onboarding_website_created', {
          websiteId: (result as any).websiteId,
          status: result.status,
          crawlJobId: result.crawlJobId
        })
      }
      if (result.status === 'auth') {
        toast.message('Redirecting to Google sign-in…')
        window.location.href = result.url
        return
      }
      toast.success('Website created')
      window.location.href = result.redirect || '/dashboard'
    },
    onError: (err) => {
      log.warn('[onboarding.form] submit_error', { flowId, message: err.message })
      const msg = err.message || 'Unable to submit. Please try again.'
      setExternalError(msg)
      toast.error(msg)
    }
  })

  const form = useForm({
    defaultValues: { siteUrl: initialSiteUrl },
    validators: {
      onSubmit: ({ value }) => (!prepareSiteUrl(value.siteUrl) ? 'Enter your website URL to continue' : undefined)
    },
    onSubmitInvalid: () => {
      setExternalError(null)
    },
    onSubmit: async ({ value, formApi }) => {
      if (submitMutation.isPending) return
      const prepared = prepareSiteUrl(value.siteUrl)
      if (!prepared) {
        setExternalError('Enter your website URL to continue')
        return
      }
      if (import.meta.env.DEV) {
        console.info('[onboarding.form] normalized site', { prepared })
      }
      setExternalError(null)
      formApi.setFieldValue('siteUrl', prepared, { touch: true })
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(LOCAL_STORAGE_KEY, prepared)
        } catch {}
      }
      await submitMutation.mutateAsync(prepared)
    }
  })

  const siteUrlValue = form.useStore((state) => state.values.siteUrl)
  const isFormSubmitting = form.useStore((state) => state.isSubmitting)
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, siteUrlValue ?? '')
    } catch {}
  }, [siteUrlValue])

  const isSubmitting = submitMutation.isPending || isFormSubmitting

  return (
    <Form form={form}>
      <form
        noValidate
        className="flex w-full flex-col gap-3 rounded-xl border border-primary/30 bg-background/80 p-4 shadow-lg sm:flex-row sm:items-center sm:gap-2 sm:p-3"
        onSubmit={(event) => {
          event.preventDefault()
          // Ensure client-side submit even if hydration glitches
          form.handleSubmit()
        }}
      >
        <FormField name="siteUrl">
          {(field) => (
            <FormItem className="flex-1">
              <FormLabel className="sr-only">Website URL</FormLabel>
              <FormControl>
                <Input
                  id="onboarding-site-url"
                  type="text"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="https://www.example.com"
                  value={field.state.value}
                  onChange={(event) => {
                    field.handleChange(event.target.value)
                    if (externalError) setExternalError(null)
                  }}
                  onBlur={() => field.handleBlur()}
                  disabled={isSubmitting}
                  className="h-12 w-full rounded-lg border border-primary/40 bg-background px-4 text-base shadow-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              </FormControl>
              <FormMessage message={externalError} />
            </FormItem>
          )}
        </FormField>
        <Button
          type="submit"
          disabled={isSubmitting}
          onClick={() => form.handleSubmit()}
          className="inline-flex h-12 min-w-[220px] items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing…
            </>
          ) : (
            <>
              Continue with Google
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>
    </Form>
  )
}
