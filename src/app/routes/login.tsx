import { createFileRoute } from '@tanstack/react-router'
import { loader } from '@pages/login/loader'
import { Page } from '@pages/login/page'

export const Route = createFileRoute('/login')({
  loader,
  component: Page
})
