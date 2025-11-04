import { planRepo } from '@entities/article/planner'
import { articlesRepo } from '@entities/article/repository'

const websiteId = process.argv[2]
const limit = Number(process.argv[3] ?? '10')

if (!websiteId) {
  console.error('usage: node --import tsx scripts/show-plan.ts <websiteId> [limit]')
  process.exit(1)
}

(async () => {
  const items = await planRepo.list(websiteId, Number.isFinite(limit) && limit > 0 ? limit : 30)
  const enriched = await Promise.all(
    items.map(async (item) => {
      const article = await articlesRepo.get(item.id)
      return {
        id: item.id,
        date: item.scheduledDate,
        status: item.status,
        title: item.title,
        outline: Array.isArray(item.outlineJson) ? item.outlineJson.length : 0,
        hasBody: Boolean(article?.bodyHtml && String(article.bodyHtml).trim().length > 0)
      }
    })
  )
  console.log(JSON.stringify({ websiteId, count: enriched.length, items: enriched }, null, 2))
})()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
