import { planRepo } from '@entities/plan/repository'
import { articlesRepo } from '@entities/article/repository'
import { generateBody, draftTitleOutline } from '@common/providers/llm'

export async function processGenerate(payload: { projectId: string; planItemId: string }) {
  const found = planRepo.findById(payload.planItemId)
  if (!found) return
  const { item } = found
  const draft = articlesRepo.createDraft({
    projectId: payload.projectId,
    planItemId: item.id,
    title: item.title,
    outline: Array.isArray(item.outlineJson) ? (item.outlineJson as any) : undefined
  })
  try {
    // Generate outline first if missing
    const needOutline = !draft.outlineJson || draft.outlineJson.length === 0
    let outline = draft.outlineJson ?? []
    if (needOutline) {
      try {
        const o = await draftTitleOutline(draft.title ?? item.title)
        outline = o.outline
        articlesRepo.update(draft.id, { outlineJson: outline })
      } catch {}
    }
    const { bodyHtml } = await generateBody({ title: draft.title ?? item.title, outline })
    articlesRepo.update(draft.id, { bodyHtml })
  } catch {
    // leave stub body
  }
}
