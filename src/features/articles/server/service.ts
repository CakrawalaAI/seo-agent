import {
  getArticle,
  publishArticle,
  updateArticle,
  type UpdateArticlePayload
} from '@entities/article/service'
import type { Article, PublishArticleResult } from '@entities'

export type ArticlesService = {
  getById: (articleId: string) => Promise<Article | null>
  update: (articleId: string, payload: UpdateArticlePayload) => Promise<Article>
  publish: (articleId: string, integrationId: string) => Promise<PublishArticleResult>
}

export const articlesService: ArticlesService = {
  getById: getArticle,
  update: updateArticle,
  publish: publishArticle
}
