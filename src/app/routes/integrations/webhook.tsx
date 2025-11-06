import { createFileRoute } from '@tanstack/react-router'
import { Page } from '@pages/integrations/webhook/page'

// Normal child route; relies on parent /integrations auth guard.
export const Route = createFileRoute('/integrations/webhook')({
  component: Page
})
