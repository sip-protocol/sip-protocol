/**
 * Proof Endpoint Tests
 */

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../src/server'

describe('Proof Endpoint', () => {
  describe('POST /api/v1/proof/funding', () => {
    const validProofRequest = {
      balance: '1000000000',
      minRequired: '500000000',
      balanceBlinding: '0x' + '1'.repeat(64),
    }

    it('should generate funding proof with valid inputs', async () => {
      const response = await request(app)
        .post('/api/v1/proof/funding')
        .send(validProofRequest)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.proof).toBeDefined()
      expect(response.body.data.publicInputs).toBeDefined()
      expect(Array.isArray(response.body.data.publicInputs)).toBe(true)
    })

    it('should generate proof when balance equals minimum', async () => {
      const response = await request(app)
        .post('/api/v1/proof/funding')
        .send({
          balance: '1000000000',
          minRequired: '1000000000',
          balanceBlinding: '0x' + '1'.repeat(64),
        })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.proof).toBeDefined()
    })

    it('should generate proof for zero minimum', async () => {
      const response = await request(app)
        .post('/api/v1/proof/funding')
        .send({
          balance: '1000000000',
          minRequired: '0',
          balanceBlinding: '0x' + '1'.repeat(64),
        })
        .expect(200)

      expect(response.body.success).toBe(true)
    })

    it('should generate proof for large values', async () => {
      const response = await request(app)
        .post('/api/v1/proof/funding')
        .send({
          balance: '999999999999999999',
          minRequired: '100000000000000000',
          balanceBlinding: '0x' + '1'.repeat(64),
        })
        .expect(200)

      expect(response.body.success).toBe(true)
    })

    it('should reject missing balance', async () => {
      const response = await request(app)
        .post('/api/v1/proof/funding')
        .send({
          minRequired: '500000000',
          balanceBlinding: '0x' + '1'.repeat(64),
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject missing minRequired', async () => {
      const response = await request(app)
        .post('/api/v1/proof/funding')
        .send({
          balance: '1000000000',
          balanceBlinding: '0x' + '1'.repeat(64),
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject missing balanceBlinding', async () => {
      const response = await request(app)
        .post('/api/v1/proof/funding')
        .send({
          balance: '1000000000',
          minRequired: '500000000',
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject non-numeric balance', async () => {
      const response = await request(app)
        .post('/api/v1/proof/funding')
        .send({
          ...validProofRequest,
          balance: 'not-a-number',
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject non-numeric minRequired', async () => {
      const response = await request(app)
        .post('/api/v1/proof/funding')
        .send({
          ...validProofRequest,
          minRequired: 'abc',
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject invalid blinding factor format', async () => {
      const response = await request(app)
        .post('/api/v1/proof/funding')
        .send({
          ...validProofRequest,
          balanceBlinding: 'invalid',
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject blinding factor without 0x prefix', async () => {
      const response = await request(app)
        .post('/api/v1/proof/funding')
        .send({
          ...validProofRequest,
          balanceBlinding: '1'.repeat(64),
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })
  })
})
