import { Route as RootRoute } from './routes/__root'
import { Route as IndexRoute } from './routes/index'
import { Route as ApiArticlesRoute } from './routes/api/articles'
import { Route as ApiAuthCallbackProviderRoute } from './routes/api/auth/callback/$provider'
import { Route as ApiAuthSignInSocialRoute } from './routes/api/auth/sign-in/social'
import { Route as ApiCrawlJobStatusRoute } from './routes/api/crawl/$jobId/status'
import { Route as ApiCrawlRunRoute } from './routes/api/crawl/run'
import { Route as ApiDiscoveryStartRoute } from './routes/api/discovery/start'
import { Route as ApiHealthRoute } from './routes/api/health'
import { Route as ApiIntegrationsRoute } from './routes/api/integrations'
import { Route as ApiIntegrationTestRoute } from './routes/api/integrations/$integrationId/test'
import { Route as ApiKeywordsRoute } from './routes/api/keywords'
import { Route as ApiKeywordsKeywordIdRoute } from './routes/api/keywords/$keywordId'
import { Route as ApiJobRoute } from './routes/api/jobs/$jobId'
import { Route as ApiMeRoute } from './routes/api/me'
import { Route as ApiOrgsRoute } from './routes/api/orgs'
import { Route as ApiPlanItemsRoute } from './routes/api/plan-items'
import { Route as ApiProjectsRoute } from './routes/api/projects'
import { Route as ApiProjectJobsRoute } from './routes/api/projects/$projectId/jobs'
import { Route as ApiProjectIndexRoute } from './routes/api/projects/$projectId/index'
import { Route as ApiProjectSnapshotRoute } from './routes/api/projects/$projectId/snapshot'
import { Route as ApiSchedulesRunRoute } from './routes/api/schedules/run'
import { Route as DashboardRoute } from './routes/dashboard'
import { Route as LoginRoute } from './routes/login'
import { Route as ProjectsIndexRoute } from './routes/projects/index'
import { Route as ProjectsProjectIdLayoutRoute } from './routes/projects/$projectId/__layout'
import { Route as ProjectsProjectIdArticlesRoute } from './routes/projects/$projectId/articles'
import { Route as ProjectsProjectIdIndexRoute } from './routes/projects/$projectId/index'
import { Route as ProjectsProjectIdIntegrationsRoute } from './routes/projects/$projectId/integrations'
import { Route as ProjectsProjectIdKeywordsRoute } from './routes/projects/$projectId/keywords'

const ProjectsProjectRoutes = ProjectsProjectIdLayoutRoute.addChildren([
  ProjectsProjectIdIndexRoute,
  ProjectsProjectIdKeywordsRoute,
  ProjectsProjectIdArticlesRoute,
  ProjectsProjectIdIntegrationsRoute
])

export const routeTree = RootRoute.addChildren([
  IndexRoute,
  ApiArticlesRoute,
  ApiAuthCallbackProviderRoute,
  ApiAuthSignInSocialRoute,
  ApiCrawlJobStatusRoute,
  ApiCrawlRunRoute,
  ApiDiscoveryStartRoute,
  ApiHealthRoute,
  ApiIntegrationsRoute,
  ApiIntegrationTestRoute,
  ApiKeywordsRoute,
  ApiKeywordsKeywordIdRoute,
  ApiJobRoute,
  ApiMeRoute,
  ApiOrgsRoute,
  ApiPlanItemsRoute,
  ApiProjectsRoute,
  ApiProjectJobsRoute,
  ApiProjectIndexRoute,
  ApiProjectSnapshotRoute,
  ApiSchedulesRunRoute,
  DashboardRoute,
  LoginRoute,
  ProjectsIndexRoute,
  ProjectsProjectRoutes
])

export type RouteTree = typeof routeTree
