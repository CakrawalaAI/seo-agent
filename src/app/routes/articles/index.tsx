import { createFileRoute } from '@tanstack/react-router'
import { loader } from '@pages/articles/loader'
import { Page } from '@pages/articles/page'

export const Route = createFileRoute('/articles/')({
  loader,
  component: Page
})
