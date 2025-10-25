// @ts-nocheck
import { PolarWebhookEventSchema } from '@seo-agent/domain'
import { createFileRoute } from '@tanstack/react-router'
import {
  getPolarSignatureHeaderName,
  getPolarSignatureTolerance,
  getPolarWebhookSecret,
  PolarWebhookError,
  processPolarWebhook,
  verifyPolarSignature
} from '~/server/services/polar'
import { httpError, json, safeHandler } from '../utils'

const parseJsonBody = (rawBody: string) => {
  try {
    return JSON.parse(rawBody)
  } catch (error) {
    console.warn('Polar webhook payload is not valid JSON', error)
    return null
  }
}

export const Route = createFileRoute('/api/webhooks/polar')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        const secret = getPolarWebhookSecret()
        if (!secret) {
          console.error('Polar webhook secret not configured')
          return httpError(500, 'Polar webhook secret not configured')
        }

        const headerName = getPolarSignatureHeaderName()
        const signatureHeader =
          request.headers.get(headerName) ?? request.headers.get('polar-signature')

        if (!signatureHeader) {
          console.warn('Missing Polar signature header', { headerName })
          return httpError(400, 'Missing Polar signature header')
        }

        const rawBody = await request.text()
        const tolerance = getPolarSignatureTolerance()
        if (!verifyPolarSignature(rawBody, signatureHeader, secret, tolerance)) {
          console.warn('Polar webhook signature verification failed', {
            headerName,
            providedHeader: signatureHeader
          })
          return httpError(400, 'Invalid Polar signature')
        }

        const parsed = parseJsonBody(rawBody)
        if (!parsed) {
          return httpError(400, 'Invalid Polar webhook payload')
        }

        const validated = PolarWebhookEventSchema.safeParse(parsed)
        if (!validated.success) {
          console.warn('Polar webhook payload failed validation', validated.error.flatten())
          return httpError(400, 'Invalid Polar webhook payload', validated.error.flatten())
        }

        const event = validated.data

        try {
          const result = await processPolarWebhook(event)
          if (result.status === 'ignored') {
            return json({ status: 'ignored', eventType: result.eventType })
          }

          return json({
            status: 'processed',
            orgId: result.orgId,
            plan: result.plan,
            entitlements: result.entitlements
          })
        } catch (error) {
          if (error instanceof PolarWebhookError) {
            const context = { eventType: event.type, orgId: event.data.orgId, code: error.code }
            console.error('Polar webhook processing error', context, error.details)
            if (typeof process !== 'undefined' && typeof process.emitWarning === 'function') {
              process.emitWarning(`Polar webhook error: ${error.message}`, {
                code: error.code,
                detail: JSON.stringify(context)
              })
            }
            if (error.status >= 400 && error.status < 500) {
              return httpError(error.status, error.message, error.details)
            }
          } else {
            console.error('Unexpected Polar webhook failure', error)
            if (typeof process !== 'undefined' && typeof process.emitWarning === 'function') {
              process.emitWarning('Unexpected Polar webhook failure', {
                code: 'polar_webhook_unexpected_error'
              })
            }
          }

          return httpError(500, 'Failed to process Polar webhook')
        }
      })
    }
  }
})
