import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getBackblazeConfig } from './config'

export type SignedUrlOptions = {
  expiresInSeconds?: number
  contentType?: string
  contentLength?: number
}

type SignedUrlResponse = {
  url: string
  expiresAt: number
  bucket: string
  key: string
}

let cached: { client: S3Client; bucket: string; defaultTtl: number; endpoint: string } | null = null

function ensureClient() {
  if (cached) return cached
  const config = getBackblazeConfig()
  if (!config) throw new Error('Backblaze S3 not configured')
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.keyId,
      secretAccessKey: config.applicationKey
    },
    forcePathStyle: true
  })
  cached = { client, bucket: config.bucket, defaultTtl: config.urlTtlSeconds, endpoint: config.endpoint.replace(/\/+$/, '') }
  return cached
}

export function getArticleMediaKey(articleId: string, filename: string) {
  const safeId = sanitizeSegment(articleId || 'unknown')
  const safeFile = sanitizeSegment(filename || `${Date.now()}`)
  return `articles/${safeId}/${safeFile}`
}

export async function createPutSignedUrl(key: string, options?: SignedUrlOptions): Promise<SignedUrlResponse> {
  const { client, bucket, defaultTtl } = ensureClient()
  const expiresIn = Math.max(1, Math.min(60 * 60, options?.expiresInSeconds ?? defaultTtl))
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: options?.contentType,
    ContentLength: options?.contentLength
  })
  const url = await getSignedUrl(client, command, { expiresIn })
  return {
    url,
    key,
    bucket,
    expiresAt: Date.now() + expiresIn * 1000
  }
}

export async function createGetSignedUrl(key: string, options?: SignedUrlOptions): Promise<SignedUrlResponse> {
  const { client, bucket, defaultTtl } = ensureClient()
  const expiresIn = Math.max(1, Math.min(60 * 60, options?.expiresInSeconds ?? defaultTtl))
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key
  })
  const url = await getSignedUrl(client, command, { expiresIn })
  return {
    url,
    key,
    bucket,
    expiresAt: Date.now() + expiresIn * 1000
  }
}

export async function createDeleteSignedUrl(key: string, options?: SignedUrlOptions): Promise<SignedUrlResponse> {
  const { client, bucket, defaultTtl } = ensureClient()
  const expiresIn = Math.max(1, Math.min(60 * 60, options?.expiresInSeconds ?? defaultTtl))
  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key
  })
  const url = await getSignedUrl(client, command, { expiresIn })
  return {
    url,
    key,
    bucket,
    expiresAt: Date.now() + expiresIn * 1000
  }
}

export async function deleteObject(key: string): Promise<void> {
  const { client, bucket } = ensureClient()
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key
    })
  )
}

export function buildPublicUrl(key: string) {
  const info = ensureClient()
  const cleanKey = key.replace(/^\/+/, '')
  return `${info.endpoint}/${info.bucket}/${cleanKey}`
}

function sanitizeSegment(segment: string) {
  return segment
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120) || 'file'
}
