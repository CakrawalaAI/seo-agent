import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@src/common/ui/button'
import { Input } from '@src/common/ui/input'
import { Label } from '@src/common/ui/label'
import { Badge } from '@src/common/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@src/common/ui/card'
import { ExternalLink, Image as ImageIcon, Loader2, Trash2, UploadCloud, Youtube } from 'lucide-react'
import type { ArticleAttachment } from '@entities'
import {
  requestArticleMediaUpload,
  completeArticleMedia,
  deleteArticleMedia,
  type ArticleMediaUploadResponse
} from '@entities/article/service'

type ArticleMediaManagerProps = {
  articleId: string
  attachments: ArticleAttachment[]
  disabled?: boolean
  onRefresh?: () => void | Promise<void>
}

export function ArticleMediaManager({ articleId, attachments, disabled, onRefresh }: ArticleMediaManagerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isUploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const resetInput = () => {
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (disabled) {
      toast.info('Uploads disabled in mock mode')
      resetInput()
      return
    }
    setUploading(true)
    try {
      const presign = await requestUpload(articleId, file)
      await uploadToStorage(presign, file)
      await completeArticleMedia(articleId, {
        action: 'complete',
        type: 'image',
        storageKey: presign.storageKey,
        url: presign.publicUrl,
        caption: file.name
      })
      toast.success('Image attached')
      await onRefresh?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setUploading(false)
      resetInput()
    }
  }

  const handleDelete = async (attachmentId: string) => {
    if (disabled) {
      toast.info('Mock mode: attachments read-only')
      return
    }
    setDeletingId(attachmentId)
    try {
      await deleteArticleMedia(articleId, attachmentId)
      toast.success('Attachment removed')
      await onRefresh?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete attachment')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attachments</CardTitle>
        <CardDescription>Upload reference images or review persisted media for downstream publishing.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 rounded-md border border-dashed p-4">
          <Label htmlFor="article-media-input" className="text-sm font-medium">
            Upload reference image
          </Label>
          <p className="text-xs text-muted-foreground">
            Accepted types: JPEG, PNG, WEBP, AVIF. Files upload directly to Backblaze and attach to this article.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              id="article-media-input"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              disabled={isUploading || disabled}
              onChange={handleFileChange}
              ref={inputRef}
            />
            <Button type="button" variant="outline" disabled={isUploading || disabled} asChild>
              <label htmlFor="article-media-input" className="inline-flex cursor-pointer items-center gap-2">
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                {isUploading ? 'Uploading…' : 'Select file'}
              </label>
            </Button>
          </div>
        </div>

        {attachments.length ? (
          <ul className="space-y-3 text-sm">
            {attachments.map((att) => (
              <li key={att.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="flex items-center gap-3">
                  <AttachmentIcon type={att.type} />
                  <div>
                    <div className="font-medium">{att.caption || att.url}</div>
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {att.url}
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="uppercase">
                    {att.type}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={disabled || deletingId === att.id}
                    onClick={() => handleDelete(att.id)}
                  >
                    {deletingId === att.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    <span className="sr-only">Remove attachment</span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No attachments stored for this article.</p>
        )}
      </CardContent>
    </Card>
  )
}

function AttachmentIcon({ type }: { type: ArticleAttachment['type'] }) {
  if (type === 'image') return <ImageIcon className="h-4 w-4 text-primary" />
  if (type === 'youtube') return <Youtube className="h-4 w-4 text-destructive" />
  return <ExternalLink className="h-4 w-4 text-muted-foreground" />
}

async function requestUpload(articleId: string, file: File): Promise<ArticleMediaUploadResponse> {
  return await requestArticleMediaUpload(articleId, {
    action: 'upload',
    filename: file.name,
    contentType: file.type || 'application/octet-stream',
    contentLength: file.size
  })
}

async function uploadToStorage(presign: ArticleMediaUploadResponse, file: File) {
  const res = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file
  })
  if (!res.ok) {
    throw new Error(`Storage upload failed (${res.status})`)
  }
}
