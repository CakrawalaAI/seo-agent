// Centralized app config — single place to see/override behavior.
// Prefer editing these defaults over environment flags.

export type AppConfig = {
  appUrl: string
  providers: {
    // When true, missing provider credentials fall back to stubbed behavior in dev.
    // For production, set to false to fail loudly.
    allowStubs: boolean
    metrics: 'dataforseo'
    serp: 'dataforseo'
    research: 'exa'
    llm: 'openai'
    expand: 'dataforseo'
    // Discovery provider (multi-source). Env: SEOA_PROVIDER_KEYWORD_DISCOVERY
    // default: 'dataforseo'
    discovery?: 'dataforseo'
  }
  serp: {
    // Cache TTL in days for SERP snapshots before refreshing
    ttlDays: number
    // Default top K results to fetch/save
    topKDefault: number
  }
  crawl: {
    // Max number of representative URLs to crawl per run
    maxRepresentatives: number
    // Whether to respect robots.txt (set false if owner consented)
    respectRobots: boolean
    // Depth beyond the selected URLs to expand same-host links (0 = only selected pages)
    expandDepth: number
  }
  email: {
    // 'stub' logs to console; 'resend' sends via Resend API
    transport: 'stub' | 'resend'
    // Set your Resend API key here when using transport 'resend'.
    // You may also source from env if you prefer: process.env.RESEND_API_KEY || ''
    resendApiKey: string
    fromAddress: string
  }
  debug?: {
    writeBundle?: boolean
  }
}

export const config: AppConfig = {
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  providers: {
    // Explicit: disable stubs by default; enable only when SEOA_ALLOW_PROVIDER_STUBS=1
    allowStubs: String(process.env.SEOA_ALLOW_PROVIDER_STUBS || '0') === '1',
    metrics: 'dataforseo',
    serp: 'dataforseo',
    research: 'exa',
    llm: 'openai',
    expand: 'dataforseo',
    // Allow override via env without changing file
    // @ts-ignore
    discovery: (process.env.SEOA_PROVIDER_KEYWORD_DISCOVERY as any) || 'dataforseo'
  },
  serp: {
    ttlDays: 14,
    topKDefault: 10
  },
  crawl: {
    maxRepresentatives: 100,
    respectRobots: false,
    // dev default: expand one hop beyond representatives
    expandDepth: 0
  },
  email: {
    transport: 'stub',
    resendApiKey: process.env.RESEND_API_KEY || '',
    fromAddress: 'no-reply@seo-agent.local'
  },
  debug: { writeBundle: false }
}
