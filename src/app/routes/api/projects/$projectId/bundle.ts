// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession } from '@app/api-utils'
import * as path from 'node:path'
import * as fs from 'node:fs'
import { latestRunDir } from '@common/bundle/store'
import { projectsRepo } from '@entities/project/repository'

function listFiles(base: string, max = 200) {
  const out: string[] = []
  function walk(p: string) {
    const entries = fs.readdirSync(p, { withFileTypes: true })
    for (const e of entries) {
      const full = path.join(p, e.name)
      const rel = path.relative(base, full)
      if (e.isDirectory()) {
        walk(full)
      } else {
        out.push(rel)
        if (out.length >= max) return
      }
    }
  }
  try { walk(base) } catch {}
  return out
}

export const Route = createFileRoute('/api/projects/$projectId/bundle')({
  server: {
    handlers: {
      GET: safeHandler(async ({ params, request }) => {
        await requireSession(request)
        const project = projectsRepo.get(params.projectId)
        if (!project) return httpError(404, 'Project not found')
        const base = latestRunDir(params.projectId)
        const files = listFiles(base)
        return json({ base, files })
      })
    }
  }
})

