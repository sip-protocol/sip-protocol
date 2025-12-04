/**
 * Swap and Quote Endpoint Tests
 */

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../src/server'

describe('Quote Endpoint', () => {
  describe('POST /api/v1/quote', () => {
    const validQuoteRequest = {
      inputChain: 'ethereum',
      inputToken: 'ETH',
      inputAmount: '1000000000',
      outputChain: 'solana',
      outputToken: 'SOL',
    }

    it('should return quote for valid request', async () => {
      const response = await request(app)
        .post('/api/v1/quote')
        .send(validQuoteRequest)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.quoteId).toBeDefined()
      expect(response.body.data.inputAmount).toBe(validQuoteRequest.inputAmount)
      expect(response.body.data.outputAmount).toBeDefined()
      expect(response.body.data.rate).toBeDefined()
      expect(response.body.data.estimatedTime).toBeGreaterThan(0)
    })

    it('should return fee breakdown', async () => {
      const response = await request(app)
        .post('/api/v1/quote')
        .send(validQuoteRequest)
        .expect(200)

      expect(response.body.data.fees).toBeDefined()
      expect(response.body.data.fees.network).toBeDefined()
      expect(response.body.data.fees.protocol).toBeDefined()
    })

    it('should return route information', async () => {
      const response = await request(app)
        .post('/api/v1/quote')
        .send(validQuoteRequest)
        .expect(200)

      expect(response.body.data.route).toBeDefined()
      expect(response.body.data.route.steps).toBeDefined()
      expect(Array.isArray(response.body.data.route.steps)).toBe(true)
      expect(response.body.data.route.steps.length).toBeGreaterThan(0)
    })

    it('should accept slippage tolerance', async () => {
      const response = await request(app)
        .post('/api/v1/quote')
        .send({
          ...validQuoteRequest,
          slippageTolerance: 2.5,
        })
        .expect(200)

      expect(response.body.success).toBe(true)
    })

    it('should reject missing inputChain', async () => {
      const { inputChain, ...incomplete } = validQuoteRequest
      const response = await request(app)
        .post('/api/v1/quote')
        .send(incomplete)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject missing inputToken', async () => {
      const { inputToken, ...incomplete } = validQuoteRequest
      const response = await request(app)
        .post('/api/v1/quote')
        .send(incomplete)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject missing inputAmount', async () => {
      const { inputAmount, ...incomplete } = validQuoteRequest
      const response = await request(app)
        .post('/api/v1/quote')
        .send(incomplete)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject invalid chain', async () => {
      const response = await request(app)
        .post('/api/v1/quote')
        .send({
          ...validQuoteRequest,
          inputChain: 'invalid-chain',
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject negative slippage', async () => {
      const response = await request(app)
        .post('/api/v1/quote')
        .send({
          ...validQuoteRequest,
          slippageTolerance: -1,
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject slippage over 100', async () => {
      const response = await request(app)
        .post('/api/v1/quote')
        .send({
          ...validQuoteRequest,
          slippageTolerance: 101,
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should support cross-chain quotes', async () => {
      const chains = [
        { input: 'ethereum', output: 'solana' },
        { input: 'solana', output: 'near' },
        { input: 'polygon', output: 'arbitrum' },
      ]

      for (const { input, output } of chains) {
        const response = await request(app)
          .post('/api/v1/quote')
          .send({
            inputChain: input,
            inputToken: 'TOKEN',
            inputAmount: '1000000000',
            outputChain: output,
            outputToken: 'TOKEN',
          })
          .expect(200)

        expect(response.body.success).toBe(true)
      }
    })
  })
})

describe('Swap Endpoint', () => {
  // Note: The swap endpoint is at /api/v1/swap/swap due to route mounting
  describe('POST /api/v1/swap/swap', () => {
    const validSwapRequest = {
      intentId: 'intent-123',
      quoteId: 'quote-123',
    }

    it('should initiate swap with valid request', async () => {
      const response = await request(app)
        .post('/api/v1/swap/swap')
        .send(validSwapRequest)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.swapId).toBeDefined()
      expect(response.body.data.status).toBe('pending')
      expect(response.body.data.timestamp).toBeDefined()
    })

    it('should accept privacy level', async () => {
      const response = await request(app)
        .post('/api/v1/swap/swap')
        .send({
          ...validSwapRequest,
          privacy: 'shielded',
        })
        .expect(200)

      expect(response.body.success).toBe(true)
    })

    it('should accept viewing key with compliant privacy', async () => {
      const response = await request(app)
        .post('/api/v1/swap/swap')
        .send({
          ...validSwapRequest,
          privacy: 'compliant',
          viewingKey: '0x' + '1'.repeat(64),
        })
        .expect(200)

      expect(response.body.success).toBe(true)
    })

    it('should reject missing intentId', async () => {
      const response = await request(app)
        .post('/api/v1/swap/swap')
        .send({
          quoteId: 'quote-123',
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject missing quoteId', async () => {
      const response = await request(app)
        .post('/api/v1/swap/swap')
        .send({
          intentId: 'intent-123',
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject invalid privacy level', async () => {
      const response = await request(app)
        .post('/api/v1/swap/swap')
        .send({
          ...validSwapRequest,
          privacy: 'invalid-level',
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject invalid viewing key format', async () => {
      const response = await request(app)
        .post('/api/v1/swap/swap')
        .send({
          ...validSwapRequest,
          viewingKey: 'not-a-hex',
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('GET /api/v1/swap/:id/status', () => {
    it('should return 404 for non-existent swap', async () => {
      const response = await request(app)
        .get('/api/v1/swap/non-existent-swap/status')
        .expect(404)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('SWAP_NOT_FOUND')
    })

    it('should return status for created swap', async () => {
      // First create a swap
      const createResponse = await request(app)
        .post('/api/v1/swap/swap')
        .send({
          intentId: 'intent-status-test',
          quoteId: 'quote-status-test',
        })
        .expect(200)

      const swapId = createResponse.body.data.swapId

      // Then check status
      const statusResponse = await request(app)
        .get(`/api/v1/swap/${swapId}/status`)
        .expect(200)

      expect(statusResponse.body.success).toBe(true)
      expect(statusResponse.body.data.id).toBe(swapId)
      expect(statusResponse.body.data.status).toBe('pending')
      expect(statusResponse.body.data.createdAt).toBeDefined()
      expect(statusResponse.body.data.updatedAt).toBeDefined()
    })
  })
})
