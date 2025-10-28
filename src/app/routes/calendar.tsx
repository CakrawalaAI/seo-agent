import { createFileRoute } from '@tanstack/react-router'
import { loader } from '@pages/calendar/loader'
import { Page } from '@pages/calendar/page'

export const Route = createFileRoute('/calendar')({
  loader,
  component: Page
})

