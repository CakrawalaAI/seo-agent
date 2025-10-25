// @ts-nocheck
import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { getJobById } from '~/server/services/jobs'
import { httpError, json, safeHandler } from '../../utils'

const paramsSchema = z.object({ jobId: z.string().min(1) })

export const Route = createFileRoute('/api/jobs/$jobId')({
  server: {
    handlers: {
      GET: safeHandler(async ({ params }) => {
        const { jobId } = paramsSchema.parse(params)
        const job = await getJobById(jobId)
        if (!job) {
          return httpError(404, 'Job not found')
        }
        return json(job)
      })
    }
  }
})
