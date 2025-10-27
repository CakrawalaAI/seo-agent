import { QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { routeTree } from './routeTree.gen'

export type RouterContext = {
  queryClient: QueryClient
}

export const createAppRouter = (options: Partial<RouterContext> = {}) => {
  const queryClient =
    options.queryClient ??
    new QueryClient({
      defaultOptions: {
        queries: {
          refetchOnWindowFocus: false,
          staleTime: 1000 * 60,
          retry: 1
        }
      }
    })

  const router = createRouter({
    routeTree,
    context: {
      queryClient
    },
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    scrollRestoration: true
  })

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
    handleRedirects: true,
    wrapQueryClient: true
  })

  return router
}

export const getRouter = async () => createAppRouter()

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
