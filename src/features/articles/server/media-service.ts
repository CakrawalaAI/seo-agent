import { attachmentsRepo } from '@entities/article/repository.attachments'
import { getArticleMediaKey, createPutSignedUrl, createGetSignedUrl, deleteObject, buildPublicUrl } from '@common/infra/s3'
import { log } from '@src/common/logger'

const DEFAULT_UPLOAD_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

type UploadRequest = {
  articleId: string
  filename: string
  contentType?: string
  contentLength?: number
}

type ExistingRequest = {
  articleId: string
  attachmentId?: string
  storageKey?: string
}

export async function issueUploadUrl(input: UploadRequest) {
  validateFilename(input.filename)
  const storageKey = getArticleMediaKey(input.articleId, input.filename)
  const put = await createPutSignedUrl(storageKey, {
    contentType: input.contentType,
    contentLength: input.contentLength
  })
  const publicUrl = buildPublicUrl(storageKey)
  const acceptedContentType = input.contentType && DEFAULT_UPLOAD_CONTENT_TYPES.includes(input.contentType.toLowerCase())
  return {
    uploadUrl: put.url,
    expiresAt: put.expiresAt,
    storageKey,
    publicUrl,
    isRecommendedType: acceptedContentType
  }
}

export async function issueDownloadUrl(input: ExistingRequest) {
  const key = await resolveStorageKey(input)
  const signed = await createGetSignedUrl(key)
  return {
    downloadUrl: signed.url,
    expiresAt: signed.expiresAt,
    storageKey: key
  }
}

export async function deleteAttachment(input: ExistingRequest) {
  if (!input.attachmentId && !input.storageKey) throw new Error('attachmentId or storageKey required')
  const key = await resolveStorageKey(input)
  try {
    await deleteObject(key)
  } catch (error) {
    log.warn('[media-service] storage delete failed', { key, error: (error as Error)?.message })
  }
  if (input.attachmentId) {
    await attachmentsRepo.remove(input.articleId, input.attachmentId)
  }
  return { storageKey: key }
}

async function resolveStorageKey(input: ExistingRequest): Promise<string> {
  if (input.storageKey) return input.storageKey
  if (!input.attachmentId) throw new Error('storageKey or attachmentId required')
  const attachments = await attachmentsRepo.listByArticle(input.articleId)
  const found = attachments.find((att) => att.id === input.attachmentId)
  if (!found?.storageKey) {
    log.warn('[media-service] missing storage key', { articleId: input.articleId, attachmentId: input.attachmentId })
    throw new Error('attachment missing storage key')
  }
  return found.storageKey
}

function validateFilename(filename: string) {
  const invalid = /[^\w.\-]/g
  if (!filename || filename.length > 140 || invalid.test(filename)) {
    throw new Error('invalid filename')
  }
}
