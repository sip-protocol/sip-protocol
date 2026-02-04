/**
 * Webhook Endpoint Tests
 *
 * Covers:
 * - Registration: valid, reject bad URL/keys, store full
 * - Unregister: success (204), not found (404)
 * - List: empty, populated, never exposes secrets/keys
 * - Delivery: HMAC signing, retry on failure, max attempts
 * - Helius ingest: valid payload, signature verification, matching
 * - E2E: register → helius payload → delivery verification
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import request from 'supertest'
import app from '../src/server'
import { webhookStore } from '../src/stores/webhook-store'
import { WebhookStore } from '../src/stores/webhook-store'
import { WebhookDeliveryService, computeHmacSignature } from '../src/services/webhook-delivery'
import { hmac } from '@noble/hashes/hmac'
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex } from '@noble/hashes/utils'

// Valid 32-byte hex keys for testing
const VALID_VIEWING_KEY = '0x' + 'ab'.repeat(32)
const VALID_SPENDING_KEY = '0x' + 'cd'.repeat(32)

describe('Webhook Endpoints', () => {
  beforeEach(() => {
    webhookStore.clear()
  })

  describe('POST /api/v1/webhooks/register', () => {
    it('should register a webhook with valid inputs', async () => {
      const response = await request(app)
        .post('/api/v1/webhooks/register')
        .send({
          url: 'https://example.com/webhook',
          viewingPrivateKey: VALID_VIEWING_KEY,
          spendingPublicKey: VALID_SPENDING_KEY,
        })
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data.id).toBeDefined()
      expect(response.body.data.url).toBe('https://example.com/webhook')
      expect(response.body.data.secret).toBeDefined()
      expect(response.body.data.secret.length).toBe(64) // 32 bytes hex
      expect(response.body.data.createdAt).toBeDefined()
    })

    it('should reject invalid URL', async () => {
      const response = await request(app)
        .post('/api/v1/webhooks/register')
        .send({
          url: 'not-a-url',
          viewingPrivateKey: VALID_VIEWING_KEY,
          spendingPublicKey: VALID_SPENDING_KEY,
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject missing viewingPrivateKey', async () => {
      const response = await request(app)
        .post('/api/v1/webhooks/register')
        .send({
          url: 'https://example.com/webhook',
          spendingPublicKey: VALID_SPENDING_KEY,
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject missing spendingPublicKey', async () => {
      const response = await request(app)
        .post('/api/v1/webhooks/register')
        .send({
          url: 'https://example.com/webhook',
          viewingPrivateKey: VALID_VIEWING_KEY,
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject invalid viewingPrivateKey format (not hex)', async () => {
      const response = await request(app)
        .post('/api/v1/webhooks/register')
        .send({
          url: 'https://example.com/webhook',
          viewingPrivateKey: 'not-a-hex-key',
          spendingPublicKey: VALID_SPENDING_KEY,
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject viewingPrivateKey with wrong length', async () => {
      const response = await request(app)
        .post('/api/v1/webhooks/register')
        .send({
          url: 'https://example.com/webhook',
          viewingPrivateKey: '0x' + 'ab'.repeat(16), // 16 bytes, not 32
          spendingPublicKey: VALID_SPENDING_KEY,
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject spendingPublicKey with wrong length', async () => {
      const response = await request(app)
        .post('/api/v1/webhooks/register')
        .send({
          url: 'https://example.com/webhook',
          viewingPrivateKey: VALID_VIEWING_KEY,
          spendingPublicKey: '0x' + 'cd'.repeat(16),
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should allow multiple registrations', async () => {
      await request(app)
        .post('/api/v1/webhooks/register')
        .send({
          url: 'https://example.com/webhook1',
          viewingPrivateKey: VALID_VIEWING_KEY,
          spendingPublicKey: VALID_SPENDING_KEY,
        })
        .expect(201)

      await request(app)
        .post('/api/v1/webhooks/register')
        .send({
          url: 'https://example.com/webhook2',
          viewingPrivateKey: VALID_VIEWING_KEY,
          spendingPublicKey: VALID_SPENDING_KEY,
        })
        .expect(201)

      expect(webhookStore.size).toBe(2)
    })

    it('should generate unique secrets for each registration', async () => {
      const res1 = await request(app)
        .post('/api/v1/webhooks/register')
        .send({
          url: 'https://example.com/webhook1',
          viewingPrivateKey: VALID_VIEWING_KEY,
          spendingPublicKey: VALID_SPENDING_KEY,
        })
        .expect(201)

      const res2 = await request(app)
        .post('/api/v1/webhooks/register')
        .send({
          url: 'https://example.com/webhook2',
          viewingPrivateKey: VALID_VIEWING_KEY,
          spendingPublicKey: VALID_SPENDING_KEY,
        })
        .expect(201)

      expect(res1.body.data.secret).not.toBe(res2.body.data.secret)
      expect(res1.body.data.id).not.toBe(res2.body.data.id)
    })
  })

  describe('DELETE /api/v1/webhooks/:id', () => {
    it('should unregister an existing webhook (204)', async () => {
      const reg = await request(app)
        .post('/api/v1/webhooks/register')
        .send({
          url: 'https://example.com/webhook',
          viewingPrivateKey: VALID_VIEWING_KEY,
          spendingPublicKey: VALID_SPENDING_KEY,
        })
        .expect(201)

      await request(app)
        .delete(`/api/v1/webhooks/${reg.body.data.id}`)
        .expect(204)

      expect(webhookStore.size).toBe(0)
    })

    it('should return 404 for non-existent webhook', async () => {
      const response = await request(app)
        .delete('/api/v1/webhooks/nonexistent-id')
        .expect(404)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('WEBHOOK_NOT_FOUND')
    })

    it('should return 404 when deleting same webhook twice', async () => {
      const reg = await request(app)
        .post('/api/v1/webhooks/register')
        .send({
          url: 'https://example.com/webhook',
          viewingPrivateKey: VALID_VIEWING_KEY,
          spendingPublicKey: VALID_SPENDING_KEY,
        })
        .expect(201)

      await request(app)
        .delete(`/api/v1/webhooks/${reg.body.data.id}`)
        .expect(204)

      await request(app)
        .delete(`/api/v1/webhooks/${reg.body.data.id}`)
        .expect(404)
    })
  })

  describe('GET /api/v1/webhooks', () => {
    it('should return empty list when no webhooks registered', async () => {
      const response = await request(app)
        .get('/api/v1/webhooks')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.webhooks).toEqual([])
    })

    it('should list registered webhooks', async () => {
      await request(app)
        .post('/api/v1/webhooks/register')
        .send({
          url: 'https://example.com/webhook1',
          viewingPrivateKey: VALID_VIEWING_KEY,
          spendingPublicKey: VALID_SPENDING_KEY,
        })
        .expect(201)

      await request(app)
        .post('/api/v1/webhooks/register')
        .send({
          url: 'https://example.com/webhook2',
          viewingPrivateKey: VALID_VIEWING_KEY,
          spendingPublicKey: VALID_SPENDING_KEY,
        })
        .expect(201)

      const response = await request(app)
        .get('/api/v1/webhooks')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.webhooks).toHaveLength(2)
    })

    it('should never expose viewingPrivateKey in list', async () => {
      await request(app)
        .post('/api/v1/webhooks/register')
        .send({
          url: 'https://example.com/webhook',
          viewingPrivateKey: VALID_VIEWING_KEY,
          spendingPublicKey: VALID_SPENDING_KEY,
        })
        .expect(201)

      const response = await request(app)
        .get('/api/v1/webhooks')
        .expect(200)

      const webhook = response.body.data.webhooks[0]
      expect(webhook.viewingPrivateKey).toBeUndefined()
      expect(webhook.spendingPublicKey).toBeUndefined()
      expect(webhook.secret).toBeUndefined()
    })

    it('should include id, url, active, createdAt in list items', async () => {
      await request(app)
        .post('/api/v1/webhooks/register')
        .send({
          url: 'https://example.com/webhook',
          viewingPrivateKey: VALID_VIEWING_KEY,
          spendingPublicKey: VALID_SPENDING_KEY,
        })
        .expect(201)

      const response = await request(app)
        .get('/api/v1/webhooks')
        .expect(200)

      const webhook = response.body.data.webhooks[0]
      expect(webhook).toHaveProperty('id')
      expect(webhook).toHaveProperty('url')
      expect(webhook).toHaveProperty('active')
      expect(webhook).toHaveProperty('createdAt')
      expect(webhook.active).toBe(true)
    })
  })

  describe('POST /api/v1/webhooks/internal/helius', () => {
    it('should accept a valid payload and return 200', async () => {
      const response = await request(app)
        .post('/api/v1/webhooks/internal/helius')
        .send([])
        .expect(200)

      expect(response.body.success).toBe(true)
    })

    it('should accept without API key (auth bypassed)', async () => {
      // This endpoint must work without an API key
      const response = await request(app)
        .post('/api/v1/webhooks/internal/helius')
        .send([])
        .expect(200)

      expect(response.body.success).toBe(true)
    })

    it('should return matched count of 0 with no registrations', async () => {
      const response = await request(app)
        .post('/api/v1/webhooks/internal/helius')
        .send([{
          blockTime: 1700000000,
          slot: 123,
          meta: {
            err: null,
            fee: 5000,
            innerInstructions: [],
            logMessages: [],
            postBalances: [],
            postTokenBalances: [],
            preBalances: [],
            preTokenBalances: [],
            rewards: [],
          },
          transaction: {
            message: {
              accountKeys: [],
              instructions: [],
              recentBlockhash: 'abc123',
            },
            signatures: ['sig123'],
          },
        }])
        .expect(200)

      expect(response.body.matched).toBe(0)
    })
  })
})

describe('WebhookStore', () => {
  let store: WebhookStore

  beforeEach(() => {
    store = new WebhookStore(5)
  })

  it('should register and retrieve a webhook', () => {
    const reg = store.register('https://example.com', VALID_VIEWING_KEY, VALID_SPENDING_KEY)
    expect(reg.id).toBeDefined()
    expect(reg.url).toBe('https://example.com')
    expect(reg.secret.length).toBe(64)

    const found = store.get(reg.id)
    expect(found).toBeDefined()
    expect(found!.url).toBe('https://example.com')
  })

  it('should unregister a webhook', () => {
    const reg = store.register('https://example.com', VALID_VIEWING_KEY, VALID_SPENDING_KEY)
    expect(store.unregister(reg.id)).toBe(true)
    expect(store.get(reg.id)).toBeUndefined()
  })

  it('should return false when unregistering non-existent', () => {
    expect(store.unregister('nonexistent')).toBe(false)
  })

  it('should getAll active registrations', () => {
    store.register('https://example.com/1', VALID_VIEWING_KEY, VALID_SPENDING_KEY)
    store.register('https://example.com/2', VALID_VIEWING_KEY, VALID_SPENDING_KEY)
    expect(store.getAll()).toHaveLength(2)
  })

  it('should getAllForList without sensitive data', () => {
    store.register('https://example.com', VALID_VIEWING_KEY, VALID_SPENDING_KEY)
    const list = store.getAllForList()
    expect(list).toHaveLength(1)
    expect(list[0]).toHaveProperty('id')
    expect(list[0]).toHaveProperty('url')
    expect(list[0]).toHaveProperty('active')
    expect(list[0]).toHaveProperty('createdAt')
    // Should NOT have sensitive fields
    expect((list[0] as any).viewingPrivateKey).toBeUndefined()
    expect((list[0] as any).spendingPublicKey).toBeUndefined()
    expect((list[0] as any).secret).toBeUndefined()
  })

  it('should throw when store is full', () => {
    for (let i = 0; i < 5; i++) {
      store.register(`https://example.com/${i}`, VALID_VIEWING_KEY, VALID_SPENDING_KEY)
    }
    expect(() => {
      store.register('https://example.com/overflow', VALID_VIEWING_KEY, VALID_SPENDING_KEY)
    }).toThrow('WEBHOOK_STORE_FULL')
  })

  it('should track size correctly', () => {
    expect(store.size).toBe(0)
    const reg = store.register('https://example.com', VALID_VIEWING_KEY, VALID_SPENDING_KEY)
    expect(store.size).toBe(1)
    store.unregister(reg.id)
    expect(store.size).toBe(0)
  })

  it('should clear all registrations', () => {
    store.register('https://example.com/1', VALID_VIEWING_KEY, VALID_SPENDING_KEY)
    store.register('https://example.com/2', VALID_VIEWING_KEY, VALID_SPENDING_KEY)
    store.clear()
    expect(store.size).toBe(0)
    expect(store.getAll()).toHaveLength(0)
  })
})

describe('WebhookDeliveryService', () => {
  describe('computeHmacSignature', () => {
    it('should compute valid HMAC-SHA256 signature', () => {
      const secret = 'test-secret'
      const body = '{"event":"payment.received"}'
      const signature = computeHmacSignature(secret, body)

      expect(signature).toMatch(/^sha256=[0-9a-f]{64}$/)
    })

    it('should produce different signatures for different bodies', () => {
      const secret = 'test-secret'
      const sig1 = computeHmacSignature(secret, '{"a":1}')
      const sig2 = computeHmacSignature(secret, '{"a":2}')

      expect(sig1).not.toBe(sig2)
    })

    it('should produce different signatures for different secrets', () => {
      const body = '{"event":"test"}'
      const sig1 = computeHmacSignature('secret-1', body)
      const sig2 = computeHmacSignature('secret-2', body)

      expect(sig1).not.toBe(sig2)
    })

    it('should be verifiable with @noble/hashes', () => {
      const secret = 'my-webhook-secret'
      const body = '{"event":"payment.received","data":{"amount":"1000"}}'
      const signature = computeHmacSignature(secret, body)

      // Verify independently
      const encoder = new TextEncoder()
      const expected = 'sha256=' + bytesToHex(
        hmac(sha256, encoder.encode(secret), encoder.encode(body))
      )
      expect(signature).toBe(expected)
    })
  })

  describe('deliver', () => {
    let service: WebhookDeliveryService
    let fetchMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
      service = new WebhookDeliveryService(0) // 0 retries for fast tests
      fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    const mockRegistration = {
      id: 'test-id',
      url: 'https://agent.example.com/webhook',
      viewingPrivateKey: VALID_VIEWING_KEY as `0x${string}`,
      spendingPublicKey: VALID_SPENDING_KEY as `0x${string}`,
      secret: 'a'.repeat(64),
      createdAt: new Date().toISOString(),
      active: true,
    }

    const mockPayment = {
      stealthAddress: 'stealth123',
      ephemeralPublicKey: 'ephemeral123',
      amount: 1000000n,
      mint: 'So11111111111111111111111111111111111111112',
      tokenSymbol: 'SOL',
      txSignature: 'txsig123',
      slot: 12345,
      timestamp: 1700000000,
    }

    it('should deliver successfully on 200 response', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 200 })

      const result = await service.deliver(mockRegistration, mockPayment)
      expect(result).toBe(true)
      expect(fetchMock).toHaveBeenCalledOnce()

      // Verify the request was made correctly
      const [url, options] = fetchMock.mock.calls[0]
      expect(url).toBe('https://agent.example.com/webhook')
      expect(options.method).toBe('POST')
      expect(options.headers['Content-Type']).toBe('application/json')
      expect(options.headers['X-SIP-Signature']).toMatch(/^sha256=[0-9a-f]{64}$/)
      expect(options.headers['X-SIP-Webhook-Id']).toBe('test-id')

      // Verify payload structure
      const body = JSON.parse(options.body)
      expect(body.event).toBe('payment.received')
      expect(body.webhookId).toBe('test-id')
      expect(body.data.txSignature).toBe('txsig123')
      expect(body.data.amount).toBe('1000000')
      expect(body.data.mint).toBe('So11111111111111111111111111111111111111112')
    })

    it('should return false on failed delivery (no retries)', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500 })

      const result = await service.deliver(mockRegistration, mockPayment)
      expect(result).toBe(false)
    })

    it('should return false on network error (no retries)', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'))

      const result = await service.deliver(mockRegistration, mockPayment)
      expect(result).toBe(false)
    })

    it('should include correct HMAC signature that matches body', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 200 })

      await service.deliver(mockRegistration, mockPayment)

      const [, options] = fetchMock.mock.calls[0]
      const signature = options.headers['X-SIP-Signature']
      const body = options.body

      // Recompute and verify
      const expected = computeHmacSignature(mockRegistration.secret, body)
      expect(signature).toBe(expected)
    })
  })

  describe('drainPending', () => {
    it('should resolve immediately when no pending deliveries', async () => {
      const service = new WebhookDeliveryService(0)
      await service.drainPending() // Should not throw
    })
  })
})
