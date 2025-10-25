import type { Route as RootRoute } from './routes/__root'
import type { Route as IndexRoute } from './routes/index'
import type { Route as ApiArticlesRoute } from './routes/api/articles'
import type { Route as ApiAuthCallbackProviderRoute } from './routes/api/auth/callback/$provider'
import type { Route as ApiAuthSignInSocialRoute } from './routes/api/auth/sign-in/social'
import type { Route as ApiCrawlJobStatusRoute } from './routes/api/crawl/$jobId/status'
import type { Route as ApiCrawlRunRoute } from './routes/api/crawl/run'
import type { Route as ApiDiscoveryStartRoute } from './routes/api/discovery/start'
import type { Route as ApiHealthRoute } from './routes/api/health'
import type { Route as ApiIntegrationsRoute } from './routes/api/integrations'
import type { Route as ApiKeywordsRoute } from './routes/api/keywords'
import type { Route as ApiKeywordsKeywordIdRoute } from './routes/api/keywords/$keywordId'
import type { Route as ApiJobRoute } from './routes/api/jobs/$jobId'
import type { Route as ApiMeRoute } from './routes/api/me'
import type { Route as ApiOrgsRoute } from './routes/api/orgs'
import type { Route as ApiPlanItemsRoute } from './routes/api/plan-items'
import type { Route as ApiProjectsRoute } from './routes/api/projects'
import type { Route as ApiProjectJobsRoute } from './routes/api/projects/$projectId/jobs'
import type { Route as ApiProjectSnapshotRoute } from './routes/api/projects/$projectId/snapshot'
import type { Route as ApiSchedulesRunRoute } from './routes/api/schedules/run'
import type { Route as DashboardRoute } from './routes/dashboard'
import type { Route as LoginRoute } from './routes/login'
import type { Route as ProjectsIndexRoute } from './routes/projects/index'
import type { Route as ProjectsProjectIdRoute } from './routes/projects/$projectId/index'

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': IndexRoute
    '/api/articles': ApiArticlesRoute
    '/api/auth/callback/$provider': ApiAuthCallbackProviderRoute
    '/api/auth/sign-in/social': ApiAuthSignInSocialRoute
    '/api/crawl/$jobId/status': ApiCrawlJobStatusRoute
    '/api/crawl/run': ApiCrawlRunRoute
    '/api/discovery/start': ApiDiscoveryStartRoute
    '/api/health': ApiHealthRoute
    '/api/integrations': ApiIntegrationsRoute
    '/api/keywords': ApiKeywordsRoute
    '/api/keywords/$keywordId': ApiKeywordsKeywordIdRoute
    '/api/jobs/$jobId': ApiJobRoute
    '/api/me': ApiMeRoute
    '/api/orgs': ApiOrgsRoute
    '/api/plan-items': ApiPlanItemsRoute
    '/api/projects': ApiProjectsRoute
    '/api/projects/$projectId/jobs': ApiProjectJobsRoute
    '/api/projects/$projectId/snapshot': ApiProjectSnapshotRoute
    '/api/schedules/run': ApiSchedulesRunRoute
    '/dashboard': DashboardRoute
    '/login': LoginRoute
    '/projects': ProjectsIndexRoute
    '/projects/$projectId': ProjectsProjectIdRoute
  }
}
