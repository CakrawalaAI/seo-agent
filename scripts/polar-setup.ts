/**
 * Polar setup for seat-based pricing
 *
 * Creates a recurring product with a seat-based price ($50/seat, monthly).
 * Adds metadata.unit_posts=30
 * Prints: export POLAR_PRICE_POSTS_30="price_..."
 *
 * Env:
 *  - POLAR_ACCESS_TOKEN (required)
 *  - POLAR_ORG_ID (required unless org token)
 *  - POLAR_SERVER=sandbox|production (optional; default production)
 *
 * Usage:
 *  bun run polar:setup
 */

const TOKEN = process.env.POLAR_ACCESS_TOKEN || ''
const ORG_ID = process.env.POLAR_ORG_ID || ''
const SERVER = (process.env.POLAR_SERVER || '').toLowerCase() === 'sandbox' ? 'https://sandbox-api.polar.sh/v1' : 'https://api.polar.sh/v1'

if (!TOKEN) {
  console.error('POLAR_ACCESS_TOKEN is required')
  process.exit(1)
}

async function createFixedProductAndPrice() {
  const body = {
    organization_id: ORG_ID || null,
    name: 'SEO Agent Plan (Monthly 30 posts)',
    description: 'One plan = 30 post credits per month. Unlimited websites/members.',
    metadata: { unit_posts: 30 },
    recurring_interval: 'month',
    prices: [
      {
        amount_type: 'fixed',
        price_currency: 'usd',
        price_amount: 5000,
        metadata: { unit_posts: 30, multiplier: 1 }
      }
    ]
  }
  const res = await fetch(`${SERVER}/products`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`create product failed: ${res.status}`)
  const json: any = await res.json().catch(() => ({}))
  const priceId = json?.prices?.[0]?.id || json?.data?.prices?.[0]?.id
  const productId = json?.id || json?.data?.id
  if (!priceId) throw new Error('no price id returned')
  console.log(`Created product ${productId} with seat price ${priceId}`)
  return priceId
}

async function main() {
  const priceId = await createFixedProductAndPrice()
  console.log('\nExport this for the app:')
  console.log(`export POLAR_PRICE_POSTS_30="${priceId}"`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
