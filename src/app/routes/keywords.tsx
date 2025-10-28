import { createFileRoute } from '@tanstack/react-router'
import { loader } from '@pages/keywords/loader'
import { Page } from '@pages/keywords/page'

export const Route = createFileRoute('/keywords')({
  loader,
  component: Page
})

