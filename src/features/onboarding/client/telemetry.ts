type OnboardingEventName =
  | 'onboarding_form_submit'
  | 'onboarding_website_created'
  | 'onboarding_phase_change'
  | 'onboarding_abandon'

type Payload = Record<string, unknown> | undefined

export function trackOnboardingEvent(_event: OnboardingEventName, _payload?: Payload) {
  // Telemetry disabled; no-op after merge into Dashboard
  return
}
