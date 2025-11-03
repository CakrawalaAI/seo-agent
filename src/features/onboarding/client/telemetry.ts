type OnboardingEventName =
  | 'onboarding_form_submit'
  | 'onboarding_project_created'
  | 'onboarding_phase_change'
  | 'onboarding_abandon'

type Payload = Record<string, unknown> | undefined

export function trackOnboardingEvent(event: OnboardingEventName, payload?: Payload) {
  try {
    const body = JSON.stringify({ event, payload: payload ?? null, ts: new Date().toISOString() })
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' })
      const ok = navigator.sendBeacon('/api/onboarding/telemetry', blob)
      if (ok) return
    }
    void fetch('/api/onboarding/telemetry', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body
    })
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[onboarding] telemetry failed', error)
    }
  }
}
