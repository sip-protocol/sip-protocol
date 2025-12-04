/**
 * Stealth Endpoint Tests
 */

import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../src/server'
import { generateStealthMetaAddress } from '@sip-protocol/sdk'

describe('Stealth Endpoint', () => {
  describe('POST /api/v1/stealth/generate', () => {
    let validMetaAddress: {
      chain: string
      recipientMetaAddress: {
        spendingKey: string
        viewingKey: string
        chain: string
        label?: string
      }
    }

    beforeAll(() => {
      // Generate valid keys for testing
      const { metaAddress } = generateStealthMetaAddress('ethereum')
      validMetaAddress = {
        chain: 'ethereum',
        recipientMetaAddress: {
          spendingKey: metaAddress.spendingKey,
          viewingKey: metaAddress.viewingKey,
          chain: 'ethereum',
        },
      }
    })

    it('should generate stealth address with valid meta-address', async () => {
      const response = await request(app)
        .post('/api/v1/stealth/generate')
        .send(validMetaAddress)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.stealthAddress).toBeDefined()
      expect(response.body.data.stealthAddress.address).toMatch(/^0x[0-9a-f]+$/i)
      expect(response.body.data.stealthAddress.ephemeralPublicKey).toMatch(/^0x[0-9a-f]+$/i)
      expect(response.body.data.stealthAddress.viewTag).toBeDefined()
    })

    it('should accept label in meta-address', async () => {
      const response = await request(app)
        .post('/api/v1/stealth/generate')
        .send({
          ...validMetaAddress,
          recipientMetaAddress: {
            ...validMetaAddress.recipientMetaAddress,
            label: 'my-wallet',
          },
        })
        .expect(200)

      expect(response.body.success).toBe(true)
    })

    it('should reject missing chain', async () => {
      const response = await request(app)
        .post('/api/v1/stealth/generate')
        .send({
          recipientMetaAddress: validMetaAddress.recipientMetaAddress,
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject missing recipientMetaAddress', async () => {
      const response = await request(app)
        .post('/api/v1/stealth/generate')
        .send({
          chain: 'ethereum',
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject invalid chain', async () => {
      const response = await request(app)
        .post('/api/v1/stealth/generate')
        .send({
          chain: 'invalid-chain',
          recipientMetaAddress: validMetaAddress.recipientMetaAddress,
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject invalid spending key format', async () => {
      const response = await request(app)
        .post('/api/v1/stealth/generate')
        .send({
          chain: 'ethereum',
          recipientMetaAddress: {
            ...validMetaAddress.recipientMetaAddress,
            spendingKey: 'not-a-hex-key',
          },
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject invalid viewing key format', async () => {
      const response = await request(app)
        .post('/api/v1/stealth/generate')
        .send({
          chain: 'ethereum',
          recipientMetaAddress: {
            ...validMetaAddress.recipientMetaAddress,
            viewingKey: 'invalid',
          },
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should support solana chain', async () => {
      const { metaAddress } = generateStealthMetaAddress('solana')
      const response = await request(app)
        .post('/api/v1/stealth/generate')
        .send({
          chain: 'solana',
          recipientMetaAddress: {
            spendingKey: metaAddress.spendingKey,
            viewingKey: metaAddress.viewingKey,
            chain: 'solana',
          },
        })
        .expect(200)

      expect(response.body.success).toBe(true)
    })

    it('should support near chain', async () => {
      const { metaAddress } = generateStealthMetaAddress('near')
      const response = await request(app)
        .post('/api/v1/stealth/generate')
        .send({
          chain: 'near',
          recipientMetaAddress: {
            spendingKey: metaAddress.spendingKey,
            viewingKey: metaAddress.viewingKey,
            chain: 'near',
          },
        })
        .expect(200)

      expect(response.body.success).toBe(true)
    })

    it('should return consistent structure across chains', async () => {
      const chains = ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base'] as const

      for (const chain of chains) {
        const { metaAddress } = generateStealthMetaAddress(chain)
        const response = await request(app)
          .post('/api/v1/stealth/generate')
          .send({
            chain,
            recipientMetaAddress: {
              spendingKey: metaAddress.spendingKey,
              viewingKey: metaAddress.viewingKey,
              chain,
            },
          })
          .expect(200)

        expect(response.body.success).toBe(true)
        expect(response.body.data.stealthAddress).toHaveProperty('address')
        expect(response.body.data.stealthAddress).toHaveProperty('ephemeralPublicKey')
        expect(response.body.data.stealthAddress).toHaveProperty('viewTag')
      }
    })
  })
})
