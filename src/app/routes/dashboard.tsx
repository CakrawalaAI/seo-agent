import { createFileRoute } from '@tanstack/react-router'
import { loader } from '@pages/dashboard/loader'
import { Page } from '@pages/dashboard/page'

export const Route = createFileRoute('/dashboard')({
  loader,
  component: Page
})
