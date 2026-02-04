/**
 * Helius Webhook Listener Service
 *
 * Ingests raw Helius webhook payloads and fans out to registered
 * agent webhooks. For each active registration, checks if the
 * transaction contains a stealth payment for that agent.
 *
 * Uses the SDK's processWebhookTransaction() for payment detection
 * and verifyWebhookSignature() for Helius signature verification.
 */

import {
  processWebhookTransaction,
  verifyWebhookSignature,
} from '@sip-protocol/sdk'
import type { HeliusWebhookTransaction } from '@sip-protocol/sdk'
import { webhookStore } from '../stores/webhook-store'
import { webhookDeliveryService } from './webhook-delivery'
import { logger } from '../logger'
import { env } from '../config'

export class HeliusListenerService {
  /**
   * Process an incoming Helius webhook payload
   *
   * 1. Verify Helius signature (if configured)
   * 2. For each active registration, check if payment is for them
   * 3. On match, queue delivery to the agent's URL
   *
   * @returns Number of matched deliveries queued
   */
  async processIncoming(
    payload: HeliusWebhookTransaction | HeliusWebhookTransaction[],
    headers: { signature?: string; rawBody?: string }
  ): Promise<number> {
    // Verify Helius signature if secret is configured
    if (env.HELIUS_WEBHOOK_SECRET && headers.rawBody) {
      const valid = verifyWebhookSignature(
        headers.rawBody,
        headers.signature,
        env.HELIUS_WEBHOOK_SECRET
      )
      if (!valid) {
        logger.warn('Helius webhook signature verification failed')
        throw new Error('HELIUS_SIGNATURE_INVALID')
      }
    }

    const transactions = Array.isArray(payload) ? payload : [payload]
    const registrations = webhookStore.getAll()

    if (registrations.length === 0) {
      logger.debug('No active webhook registrations, skipping processing')
      return 0
    }

    let matchCount = 0

    for (const tx of transactions) {
      for (const registration of registrations) {
        try {
          const payment = await processWebhookTransaction(
            tx,
            registration.viewingPrivateKey,
            registration.spendingPublicKey
          )

          if (payment) {
            matchCount++
            webhookDeliveryService.queueDelivery(registration, payment)
            logger.info(
              {
                webhookId: registration.id,
                txSignature: payment.txSignature,
              },
              'Payment matched, delivery queued'
            )
          }
        } catch (error) {
          logger.warn(
            {
              webhookId: registration.id,
              error: (error as Error).message,
            },
            'Error checking transaction against registration'
          )
        }
      }
    }

    logger.info(
      {
        transactions: transactions.length,
        registrations: registrations.length,
        matches: matchCount,
      },
      'Helius webhook processed'
    )

    return matchCount
  }
}

export const heliusListenerService = new HeliusListenerService()
