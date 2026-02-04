/**
 * Webhook Routes
 *
 * CRUD for agent webhook registrations + Helius ingest endpoint.
 *
 * POST   /webhooks/register     — Register a webhook
 * DELETE /webhooks/:id          — Unregister a webhook
 * GET    /webhooks              — List registered webhooks
 * POST   /internal/helius       — Helius webhook callback (no API key auth)
 */

import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { validateRequest } from '../middleware'
import { webhookStore } from '../stores/webhook-store'
import { heliusListenerService } from '../services/helius-listener'
import type {
  ApiResponse,
  RegisterWebhookResponse,
  WebhookListItem,
} from '../types/api'

const router: Router = Router()

/**
 * Validation schemas for webhook endpoints
 */
const webhookSchemas = {
  register: z.object({
    url: z.string().url('Must be a valid URL'),
    viewingPrivateKey: z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/, 'Must be 0x-prefixed 32-byte hex'),
    spendingPublicKey: z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/, 'Must be 0x-prefixed 32-byte hex'),
  }),

  unregister: z.object({
    id: z.string().min(1),
  }),
}

/**
 * POST /webhooks/register
 * Register a webhook to receive payment notifications
 */
router.post(
  '/register',
  validateRequest({ body: webhookSchemas.register }),
  (req: Request, res: Response) => {
    const { url, viewingPrivateKey, spendingPublicKey } = req.body

    try {
      const registration = webhookStore.register(url, viewingPrivateKey, spendingPublicKey)

      const response: ApiResponse<RegisterWebhookResponse> = {
        success: true,
        data: {
          id: registration.id,
          url: registration.url,
          secret: registration.secret,
          createdAt: registration.createdAt,
        },
      }

      res.status(201).json(response)
    } catch (error) {
      if ((error as Error).message === 'WEBHOOK_STORE_FULL') {
        res.status(503).json({
          success: false,
          error: {
            code: 'WEBHOOK_STORE_FULL',
            message: 'Maximum webhook registrations reached',
          },
        })
        return
      }
      throw error
    }
  }
)

/**
 * DELETE /webhooks/:id
 * Unregister a webhook
 */
router.delete(
  '/:id',
  validateRequest({ params: webhookSchemas.unregister }),
  (req: Request, res: Response) => {
    const removed = webhookStore.unregister(req.params.id as string)

    if (!removed) {
      res.status(404).json({
        success: false,
        error: {
          code: 'WEBHOOK_NOT_FOUND',
          message: 'Webhook not found',
        },
      })
      return
    }

    res.status(204).send()
  }
)

/**
 * GET /webhooks
 * List all registered webhooks (never exposes keys or secret)
 */
router.get('/', (_req: Request, res: Response) => {
  const webhooks = webhookStore.getAllForList()

  const response: ApiResponse<{ webhooks: WebhookListItem[] }> = {
    success: true,
    data: { webhooks },
  }

  res.json(response)
})

/**
 * POST /internal/helius
 * Helius webhook callback endpoint
 *
 * Authentication: Helius HMAC signature (not API key).
 * This path is added to AUTH_SKIP_PATHS in server.ts.
 * Returns 200 immediately to Helius; processing is async.
 */
router.post('/internal/helius', async (req: Request, res: Response) => {
  const headers = {
    signature: req.headers['x-helius-signature'] as string | undefined,
    rawBody: typeof req.body === 'string' ? req.body : JSON.stringify(req.body),
  }

  try {
    const matchCount = await heliusListenerService.processIncoming(req.body, headers)
    res.status(200).json({ success: true, matched: matchCount })
  } catch (error) {
    if ((error as Error).message === 'HELIUS_SIGNATURE_INVALID') {
      res.status(401).json({
        success: false,
        error: {
          code: 'HELIUS_SIGNATURE_INVALID',
          message: 'Invalid Helius webhook signature',
        },
      })
      return
    }
    throw error
  }
})

export default router
