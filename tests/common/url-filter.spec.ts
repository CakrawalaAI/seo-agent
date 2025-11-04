import { describe, it, expect } from 'vitest'
import { isHtmlLike } from '../../src/common/crawl/url-filter'

describe('url-filter: isHtmlLike non-core flow exclusion', () => {
  const base = 'https://example.com'
  const shouldBlock = [
    '/login', '/logout', '/signin', '/sign-in', '/signup', '/sign_up', '/register',
    '/forgot-password', '/reset-password', '/verify-email', '/auth/callback', '/oauth/callback', '/sso/login', '/callback',
    '/account', '/settings', '/preferences', '/profile', '/me',
    '/admin', '/dashboard',
    '/billing', '/subscription', '/subscriptions', '/entitlement', '/portal', '/customer-portal', '/customers', '/invoices', '/payments', '/checkout', '/cart', '/orders',
    '/org', '/orgs', '/organization', '/organizations', '/team', '/teams', '/member', '/members', '/invite', '/invites', '/accept', '/join',
    '/graphql', '/api/internal'
  ]

  for (const p of shouldBlock) {
    it(`blocks non-core path: ${p}`, () => {
      expect(isHtmlLike(base + p)).toBe(false)
    })
  }

  const shouldAllow = [
    '/', '/features', '/pricing', '/blog', '/blog/how-to-prepare', '/resources/behavioral', '/about-us', '/contact', '/careers'
  ]

  for (const p of shouldAllow) {
    it(`allows content-like path: ${p}`, () => {
      expect(isHtmlLike(base + p)).toBe(true)
    })
  }

  const assets = [
    '/file.pdf', '/image.jpg', '/video.mp4', '/doc.docx'
  ]
  for (const p of assets) {
    it(`blocks non-html asset: ${p}`, () => {
      expect(isHtmlLike(base + p)).toBe(false)
    })
  }
})

