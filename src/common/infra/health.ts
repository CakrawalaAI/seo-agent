import { config } from '@common/config'

export type ProviderStatus = {
  databaseUrl: boolean
  rabbitmqUrl: boolean
  openai: boolean
  dataforseo: boolean
  exa: boolean
  resend: boolean
}

export type HealthReport = {
  ok: boolean
  env: 'development' | 'production' | 'test'
  providers: ProviderStatus
  reasons?: string[]
}

export function computeHealth(): HealthReport {
  const envName = (process.env.NODE_ENV as any) || 'development'
  const providers: ProviderStatus = {
    databaseUrl: Boolean(process.env.DATABASE_URL),
    rabbitmqUrl: Boolean(process.env.RABBITMQ_URL),
    openai: Boolean(process.env.OPENAI_API_KEY),
    dataforseo: Boolean(process.env.DATAFORSEO_AUTH),
    exa: Boolean(process.env.EXA_API_KEY),
    resend: config.email.transport === 'resend' ? Boolean(config.email.resendApiKey || process.env.RESEND_API_KEY) : true
  }

  const reasons: string[] = []

  // Base infra
  if (envName === 'production') {
    if (!providers.databaseUrl) reasons.push('DATABASE_URL missing')
    if (!providers.rabbitmqUrl) reasons.push('RABBITMQ_URL missing')
  }

  if (!providers.openai) reasons.push('OPENAI_API_KEY missing')
  if (!providers.dataforseo) reasons.push('DATAFORSEO_AUTH missing')
  if (!providers.exa) reasons.push('EXA_API_KEY missing')

  // Email requirement when transport = resend
  if (config.email.transport === 'resend' && !providers.resend) {
    reasons.push('RESEND_API_KEY missing while email.transport=resend')
  }

  // Overall ok
  const ok = reasons.length === 0

  return { ok, env: envName as any, providers, reasons: reasons.length ? reasons : undefined }
}
