import { useState } from 'react'
import { authClient } from '@common/auth/client'

export function Page() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await authClient.signIn.social({
        provider: 'google',
        callbackURL: '/dashboard',
        errorCallbackURL: '/login?error=oauth'
      })
      // better-auth client auto-redirects if res.data.url present
      if (!res?.data?.url && res?.error) {
        setError(res.error.message || 'Could not start Google sign-in.')
      }
    } catch (err) {
      console.error('google sign-in failed', err)
      setError('Could not start Google sign-in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-16">
      <header className="space-y-2 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">SEO Agent</p>
        <h1 className="text-3xl font-semibold">Sign in</h1>
        <p className="text-sm text-muted-foreground">Continue with Google to manage your projects and automation.</p>
      </header>
      <div className="flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          disabled={loading}
        >
          {loading ? 'Opening Google...' : 'Sign in with Google'}
        </button>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <p className="text-xs text-muted-foreground">You will be redirected to Google to continue.</p>
      </div>
    </main>
  )
}
