import { OnboardingScreen } from '@features/onboarding/client/onboarding-screen'
import type { MeSession } from '@entities'

export function Page({
  projectId,
  projectSlug,
  siteUrl,
  session
}: {
  projectId: string | null
  projectSlug?: string | null
  siteUrl?: string | null
  session: MeSession | null
}) {
  return <OnboardingScreen projectId={projectId} projectSlug={projectSlug} siteUrl={siteUrl} session={session} />
}
