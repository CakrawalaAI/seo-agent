import { createFileRoute } from '@tanstack/react-router'
import { Page } from '@pages/integrations/page'

export const Route = createFileRoute('/integrations/')({
  component: Page
})
