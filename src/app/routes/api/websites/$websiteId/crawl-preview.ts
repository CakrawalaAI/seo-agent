// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, requireSession, requireWebsiteAccess } from '@app/api-utils'
import { websitesRepo } from '@entities/website/repository'
import { fetchAndParseSitemapUrlsFlex } from '@common/crawl/sitemap'
import { env } from '@common/infra/env'
import { selectUrlsFromList } from '@common/providers/llm-helpers'

export const Route = createFileRoute('/api/websites/$websiteId/crawl-preview')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        await requireSession(request)
        await requireWebsiteAccess(request, params.websiteId)
        const website = await websitesRepo.get(params.websiteId)
        if (!website?.url) return httpError(404, 'Website not found')
        const siteUrl = website.url
        const includeSubdomains = Boolean(env.crawlAllowSubdomains)
        let candidates: string[] = []
        try {
          candidates = await fetchAndParseSitemapUrlsFlex(siteUrl, { includeSubdomains, hardCap: Math.max(1000, env.crawlBudgetPages * 10) })
        } catch {}
        if (candidates.length > 0) {
          const selected = await selectUrlsFromList(siteUrl, candidates, Math.max(1, env.crawlBudgetPages))
          return json({ mode: 'sitemap', candidatesCount: candidates.length, selected, includeSubdomains })
        }
        // No sitemap → provide a minimal fallback suggestion set (heuristics)
        const root = new URL(siteUrl)
        const heuristics = ['/pricing', '/plans', '/features', '/solutions', '/about', '/company', '/customers', '/blog', '/docs']
        const fallback = [root.toString(), ...heuristics.map((p) => new URL(p, root).toString())]
        return json({ mode: 'fallback', candidatesCount: 0, selected: fallback.slice(0, Math.max(1, env.crawlBudgetPages)), includeSubdomains })
      }
    }
  }
})
