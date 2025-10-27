import { createFileRoute } from '@tanstack/react-router'
import { loader } from '@pages/home/loader'
import { Page } from '@pages/home/page'

export const Route = createFileRoute('/')({
  loader,
  component: Page
})
