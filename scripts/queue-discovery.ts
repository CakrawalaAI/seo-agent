import { publishJob, queueEnabled } from '../src/common/infra/queue'
import { getDb } from '../src/common/infra/db'
import { projects } from '../src/entities/project/db/schema'
import { desc, eq } from 'drizzle-orm'

async function main() {
  const db = getDb()
  const argId = process.argv[2]
  const proj = argId
    ? (await db.select().from(projects).where(eq(projects.id as any, argId)).limit(1))[0]
    : (await db.select().from(projects).orderBy(desc(projects.createdAt as any)).limit(1))[0]
  if (!proj) { console.log('no project'); return }
  const projectId = (proj as any).id as string
  if (!queueEnabled()) { console.error('queue disabled'); return }
  await publishJob({ type: 'discovery', payload: { projectId } })
  console.log('queued discovery for', projectId)
}

main().catch((e) => { console.error(e); process.exit(1) })
