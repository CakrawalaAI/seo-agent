import { useMemo } from 'react'
import { Link, useLoaderData } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CheckCircle2, PlayCircle } from 'lucide-react'
import { OnboardingForm } from '@features/onboarding/client/onboarding-form'
import { GoogleMark } from '@src/common/ui/icons/google'
import { fetchSession } from '@entities/org/service'
import { listWebsites } from '@entities/website/service'
import type { MeSession } from '@entities'
import type { Website } from '@entities/website/domain/website'
import type { HomeLoaderData } from './loader'

export function Page() {
  const pricingConfig = useLoaderData({ from: '/' }) as HomeLoaderData
  const sessionQuery = useQuery<MeSession | null>({
    queryKey: ['home.me'],
    queryFn: async () => {
      try {
        return await fetchSession()
      } catch {
        return null
      }
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false
  })

  const session = sessionQuery.data
  const isAuthed = Boolean(session?.user)

  const primaryOrgId = useMemo(() => {
    if (!session) return null
    return session.activeOrg?.id ?? session.orgs?.[0]?.id ?? null
  }, [session])

  const websitesQuery = useQuery<{ items: Website[] }>({
    queryKey: ['home.websites', primaryOrgId],
    queryFn: async () => {
      if (!primaryOrgId) return { items: [] as Website[] }
      try {
        return await listWebsites(primaryOrgId)
      } catch {
        return { items: [] as Website[] }
      }
    },
    enabled: Boolean(isAuthed && primaryOrgId),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: false
  })

  const websites = websitesQuery.data?.items ?? []
  const sessionSignalsWebsite = Boolean(session?.activeProjectId)
  const hasWebsites = sessionSignalsWebsite || websites.length > 0

  return (
    <div className="bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 pb-24 pt-8 md:px-10">
        <header className="flex flex-col gap-12">
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <Link to="/" className="flex items-center gap-2 text-lg font-semibold">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-sm uppercase tracking-wide text-primary">
                SA
              </span>
              <span>SEO Agent</span>
            </Link>
            <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
              {NAV_ITEMS.map((item) => (
                <a key={item.label} href={item.href} className="transition hover:text-foreground">
                  {item.label}
                </a>
              ))}
            </nav>
            {isAuthed ? (
              <div className="flex items-center gap-3">
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
                >
                  Go to Dashboard
                </Link>
                <a
                  href="/api/auth/logout"
                  className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-semibold shadow-sm transition hover:bg-muted"
                >
                  Log out
                </a>
              </div>
            ) : (
              <a
                href="/api/auth/login?redirect=/dashboard"
                className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-semibold shadow-sm transition hover:bg-muted"
              >
                <GoogleMark />
                Continue with Google
              </a>
            )}
          </div>
          <section id="hero" className="grid gap-12 lg:grid-cols-[1fr,0.9fr]">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/5 px-4 py-1 text-xs font-medium text-primary">
                Google • ChatGPT • Perplexity
              </div>
              <div className="space-y-5">
                <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                  Google &amp; ChatGPT traffic on autopilot
                </h1>
                <p className="text-lg text-muted-foreground">
                  SEO Agent is an autonomous workflow that maps your niche, drafts human-quality content in your voice,
                  and publishes every day while you keep shipping product.
                </p>
              </div>
              <div className="space-y-4">
                <OnboardingForm isAuthed={isAuthed} hasWebsites={hasWebsites} redirectIfAuthenticated />
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-md border px-5 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
                  >
                    <PlayCircle className="h-4 w-4" />
                    Watch product tour
                  </button>
                  <span>Currently onboarding early-stage teams</span>
                </div>
              </div>
              <div className="grid gap-6 sm:grid-cols-3">
                {HERO_CARDS.map((card) => (
                  <div key={card.label} className="rounded-lg border bg-card p-4 shadow-sm">
                    <p className="text-lg font-semibold">{card.label}</p>
                    <p className="text-sm text-muted-foreground">{card.description}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background p-6 shadow-xl">
              <div className="flex h-full flex-col justify-between gap-6">
                <div className="space-y-4">
                  <p className="text-sm font-medium text-primary">Live production workflow</p>
                  <h2 className="text-2xl font-semibold">Get a personalized keyword playbook in minutes</h2>
                  <p className="text-sm text-muted-foreground">
                    Drop in your domain or sitemap. SEO Agent analyzes competitors, search volume, and intent to
                    surface the keywords you can realistically win right now.
                  </p>
                </div>
                <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-primary">Preview</p>
                  <div className="mt-4 space-y-3">
                    {KEYWORD_PREVIEW.map((item) => (
                      <div key={item.keyword} className="flex items-center justify-between gap-3 rounded-lg bg-background px-3 py-2">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold">{item.keyword}</span>
                          <span className="text-xs text-muted-foreground">{item.intent}</span>
                        </div>
                        <div className="flex items-center gap-4 text-right text-xs">
                          <span>
                            Vol<br />
                            <strong className="text-sm">{item.volume}</strong>
                          </span>
                          <span>
                            Diff<br />
                            <strong className="text-sm">{item.difficulty}</strong>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Auto-delivered 6AM UTC daily</span>
                  <span>Connect &gt; Approve &gt; Publish</span>
                </div>
              </div>
            </div>
          </section>
        </header>
        <main className="mt-20 flex flex-col gap-24">
          <section id="publish-daily" className="grid gap-12 lg:grid-cols-[1fr,0.9fr]">
            <div className="space-y-6">
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">Publish articles daily</span>
              <h2 className="text-3xl font-semibold">Ship 3,000+ word articles every morning</h2>
              <p className="text-muted-foreground">
                The agent reverse-engineers top results, drafts long-form content that sounds like your brand, and queues
                images, videos, and links so every post lands fully optimized.
              </p>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {PUBLISH_POINTS.map((point) => (
                  <li key={point} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <div className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium text-muted-foreground">
                Runs 24/7 · No extra SEO tools required
              </div>
            </div>
            <div className="relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm">
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_60%)]" />
              <div className="relative flex h-full flex-col justify-between gap-6">
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">Demo preview</p>
                  <h3 className="text-xl font-semibold">See the workflow in under 90 seconds</h3>
                  <p className="text-sm text-muted-foreground">
                    Watch how SEO Agent analyzes your niche, drafts a 3,000-word article, and schedules it for publishing without human edits.
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 self-start rounded-md border px-4 py-2 text-sm font-semibold transition hover:bg-muted"
                >
                  <PlayCircle className="h-4 w-4" />
                  Play demo
                </button>
              </div>
            </div>
          </section>

          <section id="inside" className="flex flex-col gap-10">
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">What's inside</span>
              <h2 className="text-3xl font-semibold">AI agent that brings traffic to you</h2>
              <p className="max-w-3xl text-muted-foreground">
                Replace the patchwork of keyword tools, writers, and schedulers. SEO Agent turns one setup into a
                self-driving content machine that keeps compounds every day.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {CORE_FEATURES.map((feature) => (
                <article key={feature.title} className="flex h-full flex-col gap-3 rounded-xl border bg-card p-6 shadow-sm">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-semibold">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                  <ul className="mt-auto space-y-2 text-sm text-muted-foreground">
                    {feature.details.map((detail) => (
                      <li key={detail} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <section id="how-it-works" className="grid gap-10 lg:grid-cols-[0.8fr,1fr]">
            <div className="space-y-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">How it works</span>
              <h2 className="text-3xl font-semibold">Three steps to always-on traffic</h2>
              <p className="text-muted-foreground">
                Launch once, then let the agent loop through research, writing, and publishing every day while you focus on
                product and customers.
              </p>
              <div className="grid gap-3 text-sm text-muted-foreground">
                {PROCESS_STEPS.map((step) => (
                  <div key={step.title} className="rounded-lg border bg-card/50 p-4">
                    <div className="text-sm font-semibold text-primary">Step {step.step}</div>
                    <div className="text-base font-semibold text-foreground">{step.title}</div>
                    <p>{step.description}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-6">
              <div className="rounded-2xl border bg-card p-6 shadow-sm">
                <h3 className="text-lg font-semibold">With SEO Agent</h3>
                <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                  {WITH_AGENT.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border bg-muted/40 p-6 shadow-inner">
                <h3 className="text-lg font-semibold">Old manual way</h3>
                <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                  {OLD_WAY.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section id="automations" className="flex flex-col gap-10">
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">Automation suite</span>
              <h2 className="text-3xl font-semibold">Everything you need to get traffic on autopilot</h2>
              <p className="max-w-3xl text-muted-foreground">
                SEO Agent brings the entire stack in-house—no extra subscriptions, no manual busywork, no guessing. Flip on
                the features you need and let the agent handle the rest.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {AUTOMATION_FEATURES.map((feature) => (
                <div key={feature.title} className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-sm">
                  <h3 className="text-lg font-semibold">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="ai-search" className="grid gap-10 lg:grid-cols-[0.9fr,1fr]">
            <div className="space-y-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">AI search edge</span>
              <h2 className="text-3xl font-semibold">Win both classic SERPs and AI answers</h2>
              <p className="text-muted-foreground">
                The agent optimizes every article for blended keyword reach—structured for Google crawlers, enriched for
                conversational engines like ChatGPT, Claude, and Gemini.
              </p>
              <div className="grid gap-3 text-sm text-muted-foreground">
                {AI_EDGE_POINTS.map((point) => (
                  <div key={point.title} className="rounded-lg border bg-card/50 p-4">
                    <div className="text-sm font-semibold text-primary">{point.title}</div>
                    <p className="mt-1">{point.description}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm">
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.2),_transparent_55%)]" />
              <div className="relative flex h-full flex-col justify-between gap-6">
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">Dual visibility</p>
                  <h3 className="text-xl font-semibold">See how one article surfaces everywhere</h3>
                  <p className="text-sm text-muted-foreground">
                    Compare a ranked Google snippet beside an AI assistant response to understand how structured outlining,
                    schema suggestions, and entity coverage keep you present in both experiences.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border bg-muted/40 p-4 shadow-inner">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Google Result</p>
                    <p className="mt-2 text-sm text-foreground">
                      Rich snippet with FAQ schema, internal links, and media packed from the same draft.
                    </p>
                  </div>
                  <div className="rounded-xl border bg-primary/10 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-primary/80">AI Answer</p>
                    <p className="mt-2 text-sm text-foreground">
                      Conversational summary citing your article because entities, citations, and takeaways are auto-tuned.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="examples" className="flex flex-col gap-10">
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">Real output</span>
              <h2 className="text-3xl font-semibold">Articles that rank, convert, and stay on brand</h2>
              <p className="max-w-3xl text-muted-foreground">
                Every piece is tailored to your positioning with deep research, original visuals, and conversion-friendly
                CTAs built in.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {ARTICLE_EXAMPLES.map((example) => (
                <article key={example.title} className="flex flex-col gap-3 rounded-xl border bg-card p-6 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-primary">{example.category}</p>
                  <h3 className="text-xl font-semibold">{example.title}</h3>
                  <p className="text-sm text-muted-foreground">{example.description}</p>
                  <span className="text-sm font-medium text-primary">Generated with SEO Agent</span>
                </article>
              ))}
            </div>
          </section>

          <section id="pricing" className="flex flex-col gap-10">
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">Pricing</span>
              <h2 className="text-3xl font-semibold">Pick the cadence that fits your runway</h2>
              <p className="max-w-2xl text-muted-foreground">
                One organization, one website. Let SEO Agent handle 30 long-form articles a month for you—
                pay monthly or lock in annual savings. Polar keeps subscriptions, billing, and entitlements in sync.
              </p>
            </div>
            <PricingPlans config={pricingConfig} />
          </section>

          <section className="flex flex-col gap-8 rounded-3xl border bg-card/60 p-8 shadow-sm">
            <div className="flex flex-col gap-3 text-center">
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">All-in-one traffic solution</span>
              <h2 className="text-3xl font-semibold">Everything required to rank without extra hires</h2>
              <p className="mx-auto max-w-3xl text-muted-foreground">
                Personalized keyword strategy, daily long-form content, hands-off publishing, and AI search optimization
                all live under one login. Switch it on once and let the agent run.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {SOLUTION_POINTS.map((item) => (
                <div key={item.title} className="flex h-full flex-col gap-2 rounded-2xl border bg-background p-5 text-left">
                  <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="faq" className="flex flex-col gap-10">
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">FAQ</span>
              <h2 className="text-3xl font-semibold">Everything you need to know before you launch</h2>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {FAQS.map((faq) => (
                <article key={faq.question} className="rounded-xl border bg-card p-6 shadow-sm">
                  <h3 className="text-lg font-semibold">{faq.question}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{faq.answer}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border bg-card p-6 shadow-sm">
              <h3 className="text-lg font-semibold">Integrations</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Connect your CMS or workflow tools in minutes - auto-publish or deliver drafts wherever you work.
              </p>
              <div className="mt-4 flex flex-wrap gap-3 text-sm font-medium">
                {INTEGRATIONS.map((integration) => (
                  <span key={integration} className="rounded-full border px-3 py-1 text-muted-foreground">
                    {integration}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border bg-card p-6 shadow-sm">
              <h3 className="text-lg font-semibold">50+ languages, native quality</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Choose any market and SEO Agent delivers natural, localized content with the correct tone, idioms, and
                on-page structure.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs font-medium text-muted-foreground sm:grid-cols-4">
                {LANGUAGES.map((language) => (
                  <span key={language} className="rounded-md border bg-background px-2 py-1 text-center">
                    {language}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-background p-10 text-center shadow-xl">
            <div className="mx-auto flex max-w-3xl flex-col gap-6">
              <h2 className="text-3xl font-semibold">Ready to earn traffic from Google &amp; ChatGPT?</h2>
              <p className="text-muted-foreground">
                Plug in your domain, approve the roadmap, and let the agent publish optimized articles and media every day while you focus on product.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <a
                  href="/api/auth/login?redirect=/dashboard"
                  className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
                >
                  Start your $1 trial
                </a>
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-2 rounded-md border px-6 py-3 text-base font-semibold transition hover:bg-muted"
                >
                  Go to dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <p className="text-xs text-muted-foreground">Cancel anytime | Keep every draft you generate</p>
            </div>
          </section>
        </main>
        <footer className="mt-24 flex flex-col gap-8 border-t pt-10 text-sm text-muted-foreground">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-xs uppercase tracking-wide text-primary">
                SA
              </span>
              SEO Agent
            </div>
            <div className="flex flex-wrap gap-4">
              <a href="#inside" className="transition hover:text-foreground">
                What's inside
              </a>
              <a href="#examples" className="transition hover:text-foreground">
                Examples
              </a>
              <a href="#pricing" className="transition hover:text-foreground">
                Pricing
              </a>
              <a href="/api/auth/login?redirect=/dashboard" className="transition hover:text-foreground">
                Sign in
              </a>
              <a href="mailto:hello@seoagent.ai" className="transition hover:text-foreground">
                Contact
              </a>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p>(c) {new Date().getFullYear()} SEO Agent. All rights reserved.</p>
            <div className="flex flex-wrap gap-4">
              <a href="/privacy" className="transition hover:text-foreground">
                Privacy policy
              </a>
              <a href="/terms" className="transition hover:text-foreground">
                Terms & conditions
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

type PricingPlansProps = { config: HomeLoaderData }

function PricingPlans({ config }: PricingPlansProps) {
  const { monthly, yearly } = config
  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat('en-US', { style: 'currency', currency: monthly.currency || 'USD' }),
    [monthly.currency]
  )

  const plans = useMemo(
    () => [
      {
        title: 'Monthly plan',
        interval: 'monthly' as const,
        plan: monthly,
        cta: 'Start 3-day trial'
      },
      {
        title: 'Yearly plan',
        interval: 'yearly' as const,
        plan: yearly,
        cta: 'Save with annual billing'
      }
    ],
    [monthly, yearly]
  )

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {plans.map(({ title, interval, plan, cta }) => {
        const billedLabel = interval === 'monthly' ? '/mo' : '/yr'
        const priceLabel = currencyFormatter.format(plan.priceCents / 100)
        const savings = interval === 'yearly' && monthly.priceCents > 0 ? 1 - plan.priceCents / (monthly.priceCents * 12) : null
        const annualizedMonthly = interval === 'yearly' ? currencyFormatter.format(plan.priceCents / 12 / 100) : null

        return (
          <div key={interval} className="flex h-full flex-col gap-5 rounded-3xl border bg-card p-8 shadow-lg">
            <div className="flex items-baseline justify-between">
              <div>
                <h3 className="text-2xl font-semibold text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground">{plan.description ?? 'All features, one property.'}</p>
              </div>
              {savings && savings > 0 ? (
                <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                  save {Math.round(savings * 100)}%
                </span>
              ) : null}
            </div>
            <div className="flex items-baseline gap-2">
              <div className="text-4xl font-semibold text-primary">{priceLabel}</div>
              <span className="text-sm text-muted-foreground">{billedLabel}</span>
            </div>
            {annualizedMonthly ? (
              <p className="text-xs text-muted-foreground">Equivalent to {annualizedMonthly}/mo when billed annually.</p>
            ) : null}
            {plan.trialDays ? (
              <p className="text-xs text-muted-foreground">
                {plan.trialDays}-day free trial. Cancel anytime before it ends to avoid charges.
              </p>
            ) : null}
            <a
              href="/api/auth/login?redirect=/dashboard"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              {cta}
            </a>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {PRICING_VALUE_PROPS.map((feature) => (
                <li key={`${interval}-${feature}`} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

const PRICING_VALUE_PROPS = [
  'One organization, one website fully managed',
  'Up to 30 long-form articles delivered every month',
  'Auto research, outlining, on-page optimization, and publishing',
  'Webhook + CMS integrations, internal linking, media automation',
  'Cancel anytime—keep every draft, outline, and keyword list'
] as const

const NAV_ITEMS = [
  { label: "What's Inside", href: '#inside' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Examples', href: '#examples' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' }
] as const

const HERO_CARDS = [
  {
    label: 'Agentic SEO autopilot',
    description: 'An autonomous workflow researches opportunities, writes long-form drafts, and schedules publishing for you.'
  },
  {
    label: 'Strategy without the grind',
    description: 'Daily SERP analysis keeps keyword priorities fresh so every article targets a winnable query.'
  },
  {
    label: 'Voice-locked execution',
    description: 'Share past posts and the agent mirrors tone, product positioning, and calls to action automatically.'
  }
] as const

const PUBLISH_POINTS = [
  '3,000+ word drafts stay aligned with your brand voice and positioning',
  'Rich media, internal/external links, and CTA blocks are embedded automatically',
  'Articles ship to your CMS queue daily at 6AM UTC ready for approval or auto-publish'
] as const

const KEYWORD_PREVIEW = [
  { keyword: 'ai seo workflows 2025', intent: 'Opportunity - Medium intent', volume: '1.6K', difficulty: '18' },
  { keyword: 'programmatic content strategy', intent: 'Transactional - High intent', volume: '980', difficulty: '21' },
  { keyword: 'best long tail keywords saas', intent: 'Commercial - Medium intent', volume: '720', difficulty: '16' }
] as const

const CORE_FEATURES = [
  {
    title: 'Personalized keyword intelligence',
    description:
      'Upload a domain, sitemap, or CSV. SEO Agent maps opportunity gaps across competitors and prioritizes the keywords you can win first.',
    details: ['Competitor SERP gap analysis', 'Difficulty & intent scoring', 'Auto-refreshing keyword lists']
  },
  {
    title: 'Auto research & outline',
    description:
      'Before writing, we deconstruct top results, questions, and content gaps - so every article ships with a winning outline.',
    details: ['SERP tear-downs & summaries', 'Entity extraction & schema hints', 'Outline editor with guardrails']
  },
  {
    title: 'Daily long-form generation',
    description:
      '3,000-word drafts optimized for both Google and AI search, delivered in your voice with internal links, CTAs, and media.',
    details: ['Brand voice tuning', 'On-page SEO checklist', 'Auto-inserted rich media']
  },
  {
    title: 'Hands-off publishing',
    description:
      'Flip a switch to auto-publish or approve in-app. Webflow, WordPress, Shopify, Framer, and webhook targets supported out of the box.',
    details: ['Scheduling & queue management', 'Internal/external link automation', 'Webhook + CMS connectors']
  }
] as const

const PROCESS_STEPS = [
  {
    step: 1,
    title: 'Add your website (5 minutes)',
    description: 'Drop in your domain and key competitors. The agent maps opportunity gaps and builds a ranked keyword backlog.'
  },
  {
    step: 2,
    title: 'Plan months of content in seconds',
    description: 'Approve the roadmap, let AutoPlan fill your calendar, and tweak priorities with a single click.'
  },
  {
    step: 3,
    title: 'Get traffic on autopilot',
    description: 'Daily research, writing, and publishing runs without handoffs—articles land in your CMS ready to go live.'
  }
] as const

const WITH_AGENT = [
  'Keyword backlog reprioritized daily by win probability',
  '3,000-word drafts delivered with outlines, media, and internal linking',
  'Auto-publish or approve from the queue you already use',
  'Optimization tuned for Google SERPs and AI assistants'
] as const

const OLD_WAY = [
  'Manual keyword spreadsheets that go stale every week',
  'Paying freelancers and agencies for each long-form draft',
  'Switching between half a dozen SEO tools to ship one article',
  'Publishing gaps that stall growth for weeks at a time'
] as const

const AI_EDGE_POINTS = [
  {
    title: 'Structured for crawlers',
    description: 'Entity coverage, schema suggestions, and internal links are embedded so Google understands context instantly.'
  },
  {
    title: 'Conversational ready',
    description: 'Answer-first summaries, citations, and fact checks make AI assistants reference your article as the source.'
  },
  {
    title: 'Live feedback loop',
    description: 'Daily performance signals refine outlines and keyword targets so visibility compounds across channels.'
  }
] as const

const AUTOMATION_FEATURES = [
  {
    title: 'Auto Keywords',
    description: 'Opportunity modeling with search volume, difficulty, intent, and competitive density ready out of the box.'
  },
  {
    title: 'Auto Research',
    description: 'Live SERP analysis with questions, schema, and content gaps summarized before a single word is written.'
  },
  {
    title: 'Auto Images',
    description: 'On-brand hero images, diagrams, and screenshots generated and embedded automatically.'
  },
  {
    title: 'Auto Promotion',
    description: 'Strategically places your offers, social proof, and CTAs across the article without sounding salesy.'
  },
  {
    title: 'Auto Linking',
    description: 'Smart internal and external linking with clustering logic to maximize topical authority.'
  },
  {
    title: 'Auto YouTube',
    description: 'Finds and embeds relevant videos to boost engagement and dwell time.'
  }
] as const

const ARTICLE_EXAMPLES = [
  {
    category: 'Versus',
    title: 'SEO vs SEM in 2025: Costs, strategy, and AI impact',
    description: 'A data-backed comparison updated for AI search. Helps prospects choose your offer with confidence.'
  },
  {
    category: 'Guide',
    title: 'How to launch a localized SEO playbook in 10 days',
    description: 'Step-by-step content that attracts global buyers and quietly sells your product along the way.'
  },
  {
    category: 'Listicle',
    title: '15 emerging long-tail keywords your competitors missed',
    description: 'Opportunity-driven roundups that capture high-intent traffic before the market saturates.'
  },
  {
    category: 'Playbook',
    title: 'Programmatic SEO for niche marketplaces: Complete workflow',
    description: 'Detailed walkthrough showing how to scale content without blowing up headcount or budgets.'
  }
] as const

const SOLUTION_POINTS = [
  {
    title: 'Personalized keyword plan',
    description: 'Upload your domain and competitors; the agent builds a prioritized roadmap you can approve in minutes.'
  },
  {
    title: 'Daily long-form drafts',
    description: '3,000+ word articles with structured outlines, brand voice alignment, and conversion-ready messaging.'
  },
  {
    title: 'Hands-off publishing',
    description: 'Connect WordPress, Webflow, Shopify, Framer, or webhooks once—autopublish takes it from there.'
  },
  {
    title: 'AI search optimization',
    description: 'Entity coverage, schema hints, and citations tuned for Google SERPs and AI assistants alike.'
  }
] as const

const FAQS = [
  {
    question: 'How fast will I see results?',
    answer:
      'SEO momentum depends on domain age, technical health, and competition. The agent ships optimized articles daily so search engines have constant fresh signals to index.'
  },
  {
    question: 'Is the content unique?',
    answer:
      'Yes. Every article is generated from proprietary research, passed through originality checks, and tuned to your brand voice.'
  },
  {
    question: 'Do I need SEO experience?',
    answer:
      'No. We handle keyword research, outlines, optimization, and publishing. You only approve drafts or let autopublish handle it.'
  },
  {
    question: 'Will this work for AI search?',
    answer:
      'SEO Agent optimizes for Google, ChatGPT, Claude, Gemini, Perplexity, and Bing so you capture both traditional and conversational queries.'
  },
  {
    question: 'How does autopublishing work?',
    answer:
      'Connect your CMS via integration or webhook. Approve once, and articles publish daily at 6AM UTC without manual work.'
  },
  {
    question: 'What if I want to pause?',
    answer:
      'Pause or cancel anytime. You keep every draft, outline, and keyword list generated during your subscription.'
  }
] as const

const INTEGRATIONS = ['Webflow', 'Framer', 'WordPress', 'Shopify', 'Wix', 'Ghost', 'Notion', 'Webhooks', 'Custom CMS'] as const

const LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Dutch',
  'Swedish',
  'Norwegian',
  'Danish',
  'Finnish',
  'Polish',
  'Romanian',
  'Turkish',
  'Arabic',
  'Hebrew',
  'Hindi',
  'Indonesian',
  'Vietnamese',
  'Thai',
  'Japanese',
  'Korean',
  'Chinese',
  'Malay',
  'Tagalog',
  'Ukrainian'
] as const
