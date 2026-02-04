/**
 * In-memory Webhook Registration Store
 *
 * Stores agent webhook registrations with bounded capacity.
 * Data is lost on restart (MVP limitation — future: Redis/SQLite).
 */

import { randomBytes } from 'crypto'
import type { HexString } from '@sip-protocol/types'
import { logger } from '../logger'
import { env } from '../config'

/**
 * Webhook registration entry
 */
export interface WebhookRegistration {
  id: string
  url: string
  viewingPrivateKey: HexString
  spendingPublicKey: HexString
  secret: string
  createdAt: string
  active: boolean
}

/**
 * Bounded in-memory store for webhook registrations
 */
export class WebhookStore {
  private registrations = new Map<string, WebhookRegistration>()
  private readonly maxSize: number

  constructor(maxSize?: number) {
    this.maxSize = maxSize ?? env.WEBHOOK_STORE_MAX_SIZE
    logger.info({ maxSize: this.maxSize }, 'WebhookStore initialized')
  }

  /**
   * Register a new webhook
   *
   * @returns The registration with secret (shown once only)
   */
  register(url: string, viewingPrivateKey: HexString, spendingPublicKey: HexString): WebhookRegistration {
    if (this.registrations.size >= this.maxSize) {
      throw new Error('WEBHOOK_STORE_FULL')
    }

    const id = randomBytes(16).toString('hex')
    const secret = randomBytes(32).toString('hex')

    const registration: WebhookRegistration = {
      id,
      url,
      viewingPrivateKey,
      spendingPublicKey,
      secret,
      createdAt: new Date().toISOString(),
      active: true,
    }

    this.registrations.set(id, registration)
    logger.info({ webhookId: id, url }, 'Webhook registered')
    return registration
  }

  /**
   * Unregister a webhook by ID
   *
   * @returns true if found and removed, false if not found
   */
  unregister(id: string): boolean {
    const existed = this.registrations.delete(id)
    if (existed) {
      logger.info({ webhookId: id }, 'Webhook unregistered')
    }
    return existed
  }

  /**
   * Get a registration by ID
   */
  get(id: string): WebhookRegistration | undefined {
    return this.registrations.get(id)
  }

  /**
   * Get all active registrations
   */
  getAll(): WebhookRegistration[] {
    return Array.from(this.registrations.values()).filter(r => r.active)
  }

  /**
   * Get all registrations (including inactive) for listing
   */
  getAllForList(): Array<{ id: string; url: string; active: boolean; createdAt: string }> {
    return Array.from(this.registrations.values()).map(r => ({
      id: r.id,
      url: r.url,
      active: r.active,
      createdAt: r.createdAt,
    }))
  }

  /**
   * Current store size
   */
  get size(): number {
    return this.registrations.size
  }

  /**
   * Clear all registrations (for testing)
   */
  clear(): void {
    this.registrations.clear()
  }
}

export const webhookStore = new WebhookStore()
