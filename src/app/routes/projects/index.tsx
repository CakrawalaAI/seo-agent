import { createFileRoute } from '@tanstack/react-router'
import { loader } from '@pages/projects/index/loader'
import { Page } from '@pages/projects/index/page'

export const Route = createFileRoute('/projects/')({
  loader,
  component: Page
})
