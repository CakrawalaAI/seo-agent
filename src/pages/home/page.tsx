import { Link } from '@tanstack/react-router'
import { ArrowRight, CheckCircle2, PlayCircle } from 'lucide-react'

export function Page() {
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
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="hidden rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted md:inline-flex"
              >
                Sign in
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
              >
                Start for Free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <section id="hero" className="grid gap-12 lg:grid-cols-[1fr,0.9fr]">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/5 px-4 py-1 text-xs font-medium text-primary">
                Google / ChatGPT / Claude / Gemini
              </div>
              <div className="space-y-5">
                <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                  Traffic on autopilot for modern search
                </h1>
                <p className="text-lg text-muted-foreground">
                  SEO Agent researches, writes, optimizes, and publishes long-form articles for you 24/7.
                  Connect your site once and wake up to fresh, search-ready content every morning.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
                >
                  Start for Free
                </Link>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-md border px-6 py-3 text-base font-semibold transition hover:bg-muted"
                >
                  <PlayCircle className="h-5 w-5" />
                  Watch demo
                </button>
                <span className="text-sm text-muted-foreground">Rated 4.8/5 by operators worldwide</span>
              </div>
              <div className="grid gap-6 sm:grid-cols-3">
                {STATS.map((stat) => (
                  <div key={stat.label} className="rounded-lg border bg-card p-4 shadow-sm">
                    <p className="text-lg font-semibold">{stat.label}</p>
                    <p className="text-sm text-muted-foreground">{stat.description}</p>
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
          <section id="inside" className="flex flex-col gap-10">
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">What's inside</span>
              <h2 className="text-3xl font-semibold">Everything you need to run programmatic SEO on autopilot</h2>
              <p className="max-w-3xl text-muted-foreground">
                From opportunity discovery to daily publishing, SEO Agent keeps the entire workflow moving while you
                focus on the rest of the business.
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

          <section className="grid gap-10 lg:grid-cols-[0.8fr,1fr]">
            <div className="space-y-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">Content engine</span>
              <h2 className="text-3xl font-semibold">Plan months of content in seconds</h2>
              <p className="text-muted-foreground">
                Choose approved keywords, let AutoPlan fill your calendar, and watch SEO Agent deliver ready-to-publish
                articles while you sleep.
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
              <h2 className="text-3xl font-semibold">Every lever you need already wired in</h2>
              <p className="max-w-3xl text-muted-foreground">
                SEO Agent brings the entire tool stack in-house - no extra subscriptions, no manual busywork, no guessing.
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

          <section className="flex flex-col gap-10">
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">Trusted results</span>
              <h2 className="text-3xl font-semibold">Hear it from teams already scaling traffic</h2>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {TESTIMONIALS.map((testimonial) => (
                <blockquote key={testimonial.name} className="flex h-full flex-col gap-3 rounded-xl border bg-card p-6 shadow-sm">
                  <p className="text-sm text-muted-foreground">"{testimonial.quote}"</p>
                  <div>
                    <p className="text-sm font-semibold">{testimonial.name}</p>
                    <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                  </div>
                </blockquote>
              ))}
            </div>
          </section>

          <section id="pricing" className="flex flex-col gap-10">
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">Pricing</span>
              <h2 className="text-3xl font-semibold">One plan, everything included</h2>
              <p className="max-w-2xl text-muted-foreground">
                Start for $1, validate the results, then keep the engine running for less than the cost of a single
                freelance article.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {PRICING_PLANS.map((plan) => (
                <div key={plan.name} className={`flex flex-col gap-4 rounded-2xl border p-6 shadow-sm ${plan.highlight ? 'border-primary bg-primary/5' : 'bg-card'}`}>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <h3 className="text-xl font-semibold">{plan.name}</h3>
                      <p className="text-sm text-muted-foreground">{plan.description}</p>
                    </div>
                    {plan.highlight ? (
                      <span className="text-xs font-semibold uppercase tracking-wide text-primary">Popular</span>
                    ) : null}
                  </div>
                  <div className="text-3xl font-semibold">{plan.price}</div>
                  <p className="text-sm text-muted-foreground">{plan.note}</p>
                  <Link
                    to="/login"
                    className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition ${plan.highlight ? 'bg-primary text-primary-foreground hover:opacity-90' : 'border hover:bg-muted'}`}
                  >
                    {plan.cta}
                  </Link>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
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
              <h2 className="text-3xl font-semibold">Unlock traffic on autopilot</h2>
              <p className="text-muted-foreground">
                Launch in under 10 minutes. Approve your keyword strategy, schedule your calendar, and let SEO Agent
                deliver 3,000-word articles every day.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
                >
                  Start your $1 trial
                </Link>
                <Link
                  to="/projects"
                  className="inline-flex items-center gap-2 rounded-md border px-6 py-3 text-base font-semibold transition hover:bg-muted"
                >
                  Explore projects
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
              <Link to="/login" className="transition hover:text-foreground">
                Sign in
              </Link>
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

const NAV_ITEMS = [
  { label: "What's Inside", href: "#inside" },
  { label: 'Examples', href: '#examples' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' }
] as const

const STATS = [
  { label: '10,000+ articles', description: 'Published for customers in 120 industries' },
  { label: '4.8/5 rating', description: 'Based on thousands of operator reviews' },
  { label: '24/7 automation', description: 'Research, writing, optimization, and publishing on autopilot' }
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
  { step: 1, title: 'Add your website', description: 'Connect a site or paste competitors. We crawl, audit, and build your opportunity model in minutes.' },
  { step: 2, title: 'Approve your roadmap', description: 'Review keyword batches and content calendar suggestions. Lock in priorities with a single click.' },
  { step: 3, title: 'Let it run', description: 'SEO Agent researches, drafts, optimizes, and publishes daily while you focus on product and sales.' }
] as const

const WITH_AGENT = [
  'Auto-refreshing keyword backlog prioritized by win probability',
  'Content calendar that fills itself with 3,000-word long-form drafts',
  'Internal/external linking, media, and conversion CTAs handled for you',
  'Native support for Google, ChatGPT, Claude, Gemini, Perplexity, Bing'
] as const

const OLD_WAY = [
  'Late nights in spreadsheets chasing keyword ideas',
  'Paying hundreds per article with uncertain ROI',
  'Juggling five different SEO tools for basic insights',
  'Publishing gaps that stall growth for weeks'
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

const TESTIMONIALS = [
  {
    quote:
      "Thirty days in we jumped from a few hundred impressions to thousands. The automation genuinely owns the SEO pipeline now.",
    name: 'Mark Eckert',
    role: 'Owner, That Pitch'
  },
  {
    quote:
      'Ranking on ChatGPT was a surprise win. We now see qualified leads from AI assistants daily.',
    name: 'Nik Zechner',
    role: 'Managing Director, Grauberg'
  },
  {
    quote:
      'Replaced our agency retainer and several tools. Content quality is on par with our best writers at a fraction of the cost.',
    name: 'Elena Kowalski',
    role: 'Marketing Director'
  },
  {
    quote:
      'Organic traffic up 340% in three months. The cadence, quality, and conversion copy are unreal for the price.',
    name: 'Bridget O\'Connor',
    role: 'Founder'
  }
] as const

const PRICING_PLANS = [
  {
    name: 'Starter',
    description: 'Validate the workflow with a single property.',
    price: '$49/mo',
    note: '$1 for the first 3 days - Cancel anytime',
    cta: 'Start pilot',
    features: ['1 website included', 'Personalized keyword strategy', '15 SEO-optimized articles monthly', 'Auto images & media embeds', 'Unlimited keyword refreshes'],
    highlight: false
  },
  {
    name: 'Business',
    description: 'Most popular for growing SaaS and agencies.',
    price: '$99/mo',
    note: '30 long-form articles monthly - Auto-publish included',
    cta: 'Start for free',
    features: ['1 website included', '30 AI-driven articles (1 daily)', 'Auto internal & external linking', 'Auto promotion blocks & CTAs', 'Unlimited team seats'],
    highlight: true
  },
  {
    name: 'Scale',
    description: 'For multi-property portfolios and publishers.',
    price: 'Talk to us',
    note: 'Custom volumes, workflows, and integrations',
    cta: 'Book a consult',
    features: ['Up to 5 websites', 'Custom content cadence', 'Dedicated strategist & QA lane', 'Private Slack + priority support', 'Bespoke integrations & reporting'],
    highlight: false
  }
] as const

const FAQS = [
  {
    question: 'How fast will I see results?',
    answer:
      'Most teams see impression lifts in 30 days and meaningful traffic in 60-90 days depending on domain age and competitiveness.'
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
