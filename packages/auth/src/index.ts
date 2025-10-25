import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { createDb, schema } from '@seo-agent/db'
import { authEnv } from './env'

const { db } = createDb()

const secureCookies = authEnv.baseUrl.startsWith('https://')

export const auth = betterAuth({
  appName: 'SEO Agent',
  baseURL: authEnv.baseUrl,
  secret: authEnv.secret,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      users: schema.users,
      sessions: schema.sessions,
      accounts: schema.accounts,
      verification: schema.verifications
    },
    usePlural: true
  }),
  user: {
    modelName: 'users',
    fields: {
      name: 'name',
      email: 'email',
      emailVerified: 'email_verified',
      image: 'image_url',
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  },
  session: {
    modelName: 'sessions',
    fields: {
      userId: 'user_id',
      token: 'token',
      expiresAt: 'expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      ipAddress: 'ip_address',
      userAgent: 'user_agent'
    },
    storeSessionInDatabase: true,
    expiresIn: 60 * 60 * 24 * 30
  },
  account: {
    modelName: 'accounts',
    fields: {
      userId: 'user_id',
      providerId: 'provider_id',
      accountId: 'account_id',
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
      idToken: 'id_token',
      accessTokenExpiresAt: 'access_token_expires_at',
      refreshTokenExpiresAt: 'refresh_token_expires_at',
      scope: 'scope',
      password: 'password',
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  },
  verification: {
    modelName: 'verifications',
    fields: {
      identifier: 'identifier',
      value: 'value',
      expiresAt: 'expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  },
  socialProviders: {
    google: {
      clientId: authEnv.googleClientId,
      clientSecret: authEnv.googleClientSecret,
      prompt: 'select_account'
    }
  },
  advanced: {
    defaultCookieAttributes: {
      sameSite: 'lax',
      secure: secureCookies
    }
  }
})

const normalizeSessionResult = (
  result: unknown
): { session: unknown | null; headers?: Headers } => {
  if (result instanceof Response) {
    return { session: null, headers: result.headers }
  }

  if (result && typeof result === 'object' && 'response' in result && 'headers' in result) {
    const typed = result as { response: unknown; headers: Headers }
    return { session: typed.response ?? null, headers: typed.headers }
  }

  return { session: result as unknown }
}

export const getSession = async (request: Request) => {
  const result = await auth.api.getSession({
    headers: request.headers,
    returnHeaders: true
  })
  return normalizeSessionResult(result)
}

export const requireSession = async (request: Request) => {
  const { session, headers } = await getSession(request)
  if (!session) {
    const error = new Error('Unauthorized')
    ;(error as Error & { status?: number }).status = 401
    throw error
  }
  return { session, headers }
}

export const handleAuthRequest = (request: Request) => auth.handler(request)
