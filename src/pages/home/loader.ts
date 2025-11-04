import { Polar } from '@polar-sh/sdk'
import type { Product } from '@polar-sh/sdk/models/components/product'
import type { ProductPriceFixed } from '@polar-sh/sdk/models/components/productpricefixed'
import { log } from '@src/common/logger'

export type PricingPlan = {
  productId: string
  name: string
  description: string | null
  priceCents: number
  currency: string
  billingInterval: 'monthly' | 'yearly'
  trialDays: number | null
}

export type HomeLoaderData = {
  monthly: PricingPlan
  yearly: PricingPlan
  source: 'polar' | 'fallback'
}

const FALLBACK_DATA: HomeLoaderData = {
  monthly: {
    productId: '6f466012-8cb3-4f5b-815d-3d4e9b7be9d8',
    name: 'SEO Agent Business Subscription',
    description: 'Automated SEO engine for one organization and website.',
    priceCents: 9900,
    currency: 'USD',
    billingInterval: 'monthly',
    trialDays: 3
  },
  yearly: {
    productId: '82642ace-3cc7-491f-b0ff-fb4bb4c4184e',
    name: 'SEO Agent Business Subscription Yearly',
    description: 'Same plan billed annually with two months free.',
    priceCents: 99900,
    currency: 'USD',
    billingInterval: 'yearly',
    trialDays: 3
  },
  source: 'fallback'
}

export async function loader(): Promise<HomeLoaderData> {
  const token = process.env.POLAR_ACCESS_TOKEN
  const monthlyId = process.env.POLAR_PRODUCT_MONTHLY_ID || FALLBACK_DATA.monthly.productId
  const yearlyId = process.env.POLAR_PRODUCT_YEARLY_ID || FALLBACK_DATA.yearly.productId

  if (!token) {
    return FALLBACK_DATA
  }

  const serverEnv = (process.env.POLAR_SERVER || '').toLowerCase() === 'sandbox'

  try {
    const polar = new Polar({
      accessToken: token,
      ...(serverEnv ? { server: 'sandbox' as const } : {})
    })

    const [monthly, yearly] = await Promise.all([
      fetchProduct(polar, monthlyId, 'monthly'),
      fetchProduct(polar, yearlyId, 'yearly')
    ])

    if (!monthly || !yearly) {
      return FALLBACK_DATA
    }

    return {
      monthly,
      yearly,
      source: 'polar'
    }
  } catch (error) {
    log.warn('[home.loader] Polar SDK error', { message: (error as Error)?.message })
    return FALLBACK_DATA
  }
}

async function fetchProduct(polar: Polar, productId: string, interval: 'monthly' | 'yearly'): Promise<PricingPlan | null> {
  try {
    const product = await polar.products.get({ id: productId })
    const price = Array.isArray(product?.prices)
      ? product.prices.find((p): p is ProductPriceFixed => isFixedPrice(p))
      : null

    if (!price) {
      log.warn('[home.loader] Price record missing', { productId })
      return null
    }

    const priceCents = Number(price.priceAmount ?? 0)
    if (!Number.isFinite(priceCents) || priceCents <= 0) {
      log.warn('[home.loader] Invalid price amount', { productId, priceAmount: price.priceAmount })
      return null
    }

    const currency = typeof price.priceCurrency === 'string' ? price.priceCurrency.toUpperCase() : 'USD'
    const trialDays =
      typeof product?.trialInterval === 'string' && product.trialInterval === 'day'
        ? coerceNumber(product.trialIntervalCount, null)
        : null

    return {
      productId,
      name: String(product?.name ?? `Plan (${interval})`),
      description: typeof product?.description === 'string' ? product.description : null,
      priceCents,
      currency,
      billingInterval: interval,
      trialDays
    }
  } catch (error) {
    log.warn('[home.loader] Failed to fetch product', { productId, message: (error as Error)?.message })
    return null
  }
}

function coerceNumber(value: unknown, fallback: number | null): number | null {
  const num = typeof value === 'string' ? Number(value) : value
  if (typeof num === 'number' && Number.isFinite(num)) {
    return Math.max(0, Math.floor(num))
  }
  return fallback
}

function isFixedPrice(price: Product['prices'][number]): price is ProductPriceFixed {
  return price?.amountType === 'fixed' && typeof (price as ProductPriceFixed).priceAmount === 'number'
}
