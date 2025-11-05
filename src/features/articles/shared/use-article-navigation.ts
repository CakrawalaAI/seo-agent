import { useCallback } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { log } from '@src/common/logger'

type NavigateOptions = {
  replace?: boolean
}

export function useArticleNavigation() {
  const navigate = useNavigate()
  const search = useRouterState({ select: (state) => (state.location.search ?? {}) as Record<string, unknown> })

  const navigateToArticle = useCallback(
    (articleId: string, options: NavigateOptions = {}) => {
      const currentSearch = { ...search }
      const nextSearch = { ...search }
      delete (nextSearch as any).mode
      log.info('[article.nav] navigateToArticle', {
        articleId,
        replace: Boolean(options.replace),
        currentSearch,
        nextSearch
      })
      navigate({ to: '/articles/$articleId', params: { articleId }, search: nextSearch as any, replace: options.replace })
    },
    [navigate, search]
  )

  const viewArticle = useCallback(
    (articleId: string, options?: NavigateOptions) => {
      log.info('[article.nav] viewArticle', { articleId, options: options ?? null })
      navigateToArticle(articleId, options)
    },
    [navigateToArticle]
  )

  const editArticle = useCallback(
    (articleId: string, options?: NavigateOptions) => {
      log.info('[article.nav] editArticle', { articleId, options: options ?? null })
      navigateToArticle(articleId, options)
    },
    [navigateToArticle]
  )

  const goToArticlesIndex = useCallback(
    (options?: { replace?: boolean }) => {
      const currentSearch = { ...search }
      const nextSearch = { ...search }
      delete (nextSearch as any).mode
      log.info('[article.nav] goToArticlesIndex', {
        replace: Boolean(options?.replace),
        currentSearch,
        nextSearch
      })
      navigate({ to: '/articles', search: nextSearch as any, replace: options?.replace })
    },
    [navigate, search]
  )

  return { navigateToArticle, viewArticle, editArticle, goToArticlesIndex }
}
