import { getArticle, publishArticle, updateArticle, type UpdateArticlePayload, type ArticleDetail } from '@entities/article/service'
import type { PublishArticleResult } from '@entities'

export type ArticlesService = {
  getById: (articleId: string) => Promise<ArticleDetail>
  update: (articleId: string, payload: UpdateArticlePayload) => Promise<ArticleDetail>
  publish: (articleId: string, integrationId: string) => Promise<PublishArticleResult>
}

export const articlesService: ArticlesService = {
  getById: getArticle,
  update: updateArticle,
  publish: publishArticle
}
