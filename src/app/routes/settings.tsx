import { createFileRoute } from '@tanstack/react-router'
import { loader } from '@pages/settings/loader'
import { Page } from '@pages/settings/page'

export const Route = createFileRoute('/settings')({
  loader,
  component: Page
})

