type CheckoutInput = { orgId: string; plan: string; successUrl: string; cancelUrl: string }

const API_URL = process.env.POLAR_API_URL || 'https://api.polar.sh/v1'
const API_KEY = process.env.POLAR_API_KEY || process.env.POLAR_ACCESS_TOKEN || ''

function configured() {
  return Boolean(API_KEY)
}

export async function createCheckoutSession(input: CheckoutInput): Promise<{ url: string } | null> {
  if (!configured()) return null
  try {
    const res = await fetch(`${API_URL}/checkouts`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        organization_id: input.orgId,
        plan: input.plan,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl
      })
    })
    if (!res.ok) return null
    const json = (await res.json().catch(() => ({}))) as any
    const url = json?.url || json?.data?.url
    if (typeof url === 'string') return { url }
    return null
  } catch {
    return null
  }
}

export async function getPortalUrl(orgId: string, returnUrl: string): Promise<{ url: string } | null> {
  if (!configured()) return null
  try {
    const res = await fetch(`${API_URL}/billing_portal/sessions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${API_KEY}`
      },
      body: JSON.stringify({ organization_id: orgId, return_url: returnUrl })
    })
    if (!res.ok) return null
    const json = (await res.json().catch(() => ({}))) as any
    const url = json?.url || json?.data?.url
    if (typeof url === 'string') return { url }
    return null
  } catch {
    return null
  }
}

