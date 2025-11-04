import { hasDatabase, getDb } from '@common/infra/db'
import { articleAttachments } from './db/schema.attachments'
import { eq } from 'drizzle-orm'

export const attachmentsRepo = {
  async listByArticle(articleId: string) {
    if (!hasDatabase()) return []
    const db = getDb()
    const rows = await db.select().from(articleAttachments).where(eq(articleAttachments.articleId, articleId)).orderBy((articleAttachments as any).order)
    return rows as Array<{ id: string; type: string; url: string; caption?: string | null; order?: number | null }>
  },

  async replaceForArticle(articleId: string, input: { images?: Array<{ src: string; alt?: string; caption?: string }>; youtube?: Array<{ id: string; title?: string }> }) {
    if (!hasDatabase()) return { inserted: 0 }
    const db = getDb()
    const rows: Array<{ id: string; articleId: string; type: string; url: string; caption?: string | null; order?: number | null }> = []
    let order = 0
    for (const img of input.images || []) {
      const id = genId('att')
      const caption = img.caption || img.alt || null
      rows.push({ id, articleId, type: 'image', url: img.src, caption, order: order++ })
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
  }
}

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

