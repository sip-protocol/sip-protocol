/**
 * Webhook Delivery Service
 *
 * Delivers payment notifications to registered agent URLs with:
 * - HMAC-SHA256 signature (X-SIP-Signature header)
 * - Exponential backoff retry (1s, 4s, 16s)
 * - Graceful shutdown drain
 */

import { hmac } from '@noble/hashes/hmac'
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex } from '@noble/hashes/utils'
import { logger } from '../logger'
import { env } from '../config'
import type { WebhookDeliveryPayload } from '../types/api'
import type { WebhookRegistration } from '../stores/webhook-store'
import type { SolanaScanResult } from '@sip-protocol/sdk'

/**
 * Compute HMAC-SHA256 signature for webhook payload
 */
export function computeHmacSignature(secret: string, body: string): string {
  const encoder = new TextEncoder()
  const sig = bytesToHex(hmac(sha256, encoder.encode(secret), encoder.encode(body)))
  return `sha256=${sig}`
}

/**
 * Sleep helper for retry backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export class WebhookDeliveryService {
  private readonly maxRetries: number
  private pendingDeliveries = new Set<Promise<void>>()

  constructor(maxRetries?: number) {
    this.maxRetries = maxRetries ?? env.WEBHOOK_DELIVERY_MAX_RETRIES
  }

  /**
   * Build the delivery payload from a scan result
   */
  buildPayload(registration: WebhookRegistration, payment: SolanaScanResult): WebhookDeliveryPayload {
    return {
      event: 'payment.received',
      webhookId: registration.id,
      timestamp: new Date().toISOString(),
      data: {
        txSignature: payment.txSignature,
        stealthAddress: payment.stealthAddress,
        ephemeralPublicKey: payment.ephemeralPublicKey,
        amount: payment.amount.toString(),
        mint: payment.mint,
        tokenSymbol: payment.tokenSymbol,
        slot: payment.slot,
        blockTime: payment.timestamp,
      },
    }
  }

  /**
   * Deliver a payment notification to a registered webhook
   *
   * Retries with exponential backoff on failure.
   */
  async deliver(registration: WebhookRegistration, payment: SolanaScanResult): Promise<boolean> {
    const payload = this.buildPayload(registration, payment)
    const body = JSON.stringify(payload)
    const signature = computeHmacSignature(registration.secret, body)

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(registration.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-SIP-Signature': signature,
            'X-SIP-Webhook-Id': registration.id,
          },
          body,
          signal: AbortSignal.timeout(10_000),
        })

        if (response.ok) {
          logger.info(
            { webhookId: registration.id, attempt, status: response.status },
            'Webhook delivered'
          )
          return true
        }

        logger.warn(
          { webhookId: registration.id, attempt, status: response.status },
          'Webhook delivery failed (non-2xx)'
        )
      } catch (error) {
        logger.warn(
          { webhookId: registration.id, attempt, error: (error as Error).message },
          'Webhook delivery error'
        )
      }

      if (attempt < this.maxRetries) {
        const backoffMs = Math.pow(4, attempt) * 1000 // 1s, 4s, 16s
        await sleep(backoffMs)
      }
    }

    logger.error(
      { webhookId: registration.id, maxRetries: this.maxRetries },
      'Webhook delivery exhausted all retries'
    )
    return false
  }

  /**
   * Queue a delivery (fire-and-forget with tracking)
   */
  queueDelivery(registration: WebhookRegistration, payment: SolanaScanResult): void {
    const promise: Promise<void> = this.deliver(registration, payment)
      .then(() => {})
      .catch(err => {
        logger.error({ webhookId: registration.id, err }, 'Unhandled webhook delivery error')
      })
      .finally(() => {
        this.pendingDeliveries.delete(promise)
      })
    this.pendingDeliveries.add(promise)
  }

  /**
   * Wait for all pending deliveries to complete (graceful shutdown)
   */
  async drainPending(): Promise<void> {
    if (this.pendingDeliveries.size > 0) {
      logger.info({ pending: this.pendingDeliveries.size }, 'Draining pending webhook deliveries')
      await Promise.allSettled(this.pendingDeliveries)
      logger.info('All webhook deliveries drained')
    }
  }
}

export const webhookDeliveryService = new WebhookDeliveryService()
