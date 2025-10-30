// Temporary type augmentation to satisfy TS until generator updates
import '@tanstack/react-router'

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/articles/$articleId/edit': any
  }
}

