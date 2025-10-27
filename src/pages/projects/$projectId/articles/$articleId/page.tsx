import { ArticleEditorScreen } from '@features/articles/client/article-editor-screen'

export function Page({ projectId, articleId }: { projectId: string; articleId: string }) {
  return <ArticleEditorScreen projectId={projectId} articleId={articleId} />
}

