declare module '@seo-agent/auth' {
  export const auth: unknown
  export const handleAuthRequest: (request: Request) => Promise<Response> | Response
  export const getSession: (
    request: Request
  ) => Promise<{ session: unknown; headers?: Headers }>
  export const requireSession: (
    request: Request
  ) => Promise<{ session: unknown; headers?: Headers }>
}
