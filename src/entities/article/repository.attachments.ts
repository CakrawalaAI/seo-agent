import { hasDatabase, getDb } from '@common/infra/db'
import { articleAttachments } from './db/schema.attachments'
import { eq, and } from 'drizzle-orm'

export const attachmentsRepo = {
  async listByArticle(articleId: string) {
    if (!hasDatabase()) return []
    const db = getDb()
    const rows = await db
      .select()
      .from(articleAttachments)
      .where(eq(articleAttachments.articleId, articleId))
      .orderBy((articleAttachments as any).order)
    return rows as Array<{ id: string; type: string; url: string; caption?: string | null; order?: number | null; storageKey?: string | null }>
  },

  async replaceForArticle(
    articleId: string,
    input: { images?: Array<{ src: string; alt?: string; caption?: string; storageKey?: string }>; youtube?: Array<{ id: string; title?: string }> }
  ) {
    if (!hasDatabase()) return { inserted: 0 }
    const db = getDb()
    const rows: Array<{ id: string; articleId: string; type: string; url: string; caption?: string | null; order?: number | null; storageKey?: string | null }> = []
    let order = 0
    for (const img of input.images || []) {
      const id = genId('att')
      const caption = img.caption || img.alt || null
      rows.push({ id, articleId, type: 'image', url: img.src, caption, storageKey: img.storageKey || null, order: order++ })
    }
    for (const yt of input.youtube || []) {
      if (!yt.id) continue
      const id = genId('att')
      const url = `https://www.youtube.com/watch?v=${yt.id}`
      rows.push({ id, articleId, type: 'youtube', url, caption: yt.title || null, order: order++ })
    }
    await db.transaction(async (tx) => {
      await tx.delete(articleAttachments).where(eq(articleAttachments.articleId, articleId))
      if (rows.length) {
        await tx.insert(articleAttachments).values(rows as any)
      }
    })
    return { inserted: rows.length }
  },

  async add(articleId: string, input: { type: 'image' | 'youtube' | 'file'; url: string; caption?: string | null; storageKey?: string | null; order?: number | null }) {
    if (!hasDatabase()) return { id: '', inserted: 0 }
    const db = getDb()
    const row = {
      id: genId('att'),
      articleId,
      type: input.type,
      url: input.url,
      caption: input.caption ?? null,
      storageKey: input.storageKey ?? null,
      order: input.order ?? null
    }
    await db.insert(articleAttachments).values(row as any)
    return { id: row.id, inserted: 1 }
  },

  async remove(articleId: string, attachmentId: string) {
    if (!hasDatabase()) return { deleted: 0 }
    const db = getDb()
    const result = await db
      .delete(articleAttachments)
      .where(and(eq(articleAttachments.articleId, articleId), eq(articleAttachments.id, attachmentId)))
      .returning({ id: articleAttachments.id })
    return { deleted: result.length }
  }
}

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
