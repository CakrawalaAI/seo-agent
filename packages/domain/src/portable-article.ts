import { z } from 'zod'

export const PortableArticleBlockSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('paragraph'),
    html: z.string()
  }),
  z.object({
    kind: z.literal('quote'),
    html: z.string(),
    citation: z.string().optional()
  }),
  z.object({
    kind: z.literal('image'),
    src: z.string(),
    alt: z.string().optional(),
    caption: z.string().optional()
  }),
  z.object({
    kind: z.literal('embed'),
    provider: z.string(),
    url: z.string().url(),
    html: z.string().optional()
  })
])

export type PortableArticleBlock = z.infer<typeof PortableArticleBlockSchema>

export const PortableArticleDocumentSchema = z.object({
  metadata: z.object({
    title: z.string(),
    description: z.string().optional(),
    canonicalUrl: z.string().url().optional(),
    tags: z.array(z.string()).optional(),
    locale: z.string().min(2).optional()
  }),
  content: z.array(PortableArticleBlockSchema)
})

export type PortableArticleDocument = z.infer<typeof PortableArticleDocumentSchema>
