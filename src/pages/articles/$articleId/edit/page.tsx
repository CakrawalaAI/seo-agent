import { useRouter } from '@tanstack/react-router'
import { ArticleEditor } from '@features/articles/client/ArticleEditor'
import { useState } from 'react'

/**
 * Article edit page with rich text editor.
 * Consumed by route: /articles/$articleId/edit
 */
export function Page({ articleId }: { articleId: string }) {
  const router = useRouter()
  const [article, setArticle] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch article on mount
  useState(() => {
    fetch(`/api/articles/${articleId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject('Failed to load article')))
      .then((data) => {
        setArticle(data)
        setIsLoading(false)
      })
      .catch((err) => {
        setError(String(err))
        setIsLoading(false)
      })
  })

  const handleSave = async (bodyHtml: string) => {
    const res = await fetch(`/api/articles/${articleId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bodyHtml })
    })

    if (!res.ok) {
      throw new Error('Failed to save article')
    }

    // Navigate back to article list or show success toast
    router.navigate({ to: '/articles' })
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <p className="text-gray-500">Loading article...</p>
      </div>
    )
  }

  if (error || !article) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <p className="text-red-600">Error: {error ?? 'Article not found'}</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{article.title || 'Untitled Article'}</h1>
        <p className="text-gray-500">
          Status: <span className="capitalize">{article.status}</span>
        </p>
      </div>

      <ArticleEditor
        initialContent={article.bodyHtml}
        onSave={handleSave}
        placeholder="Write your article content here..."
        className="mb-6"
      />

      <div className="flex gap-4">
        <button
          onClick={() => router.history.back()}
          className="px-4 py-2 border rounded hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
