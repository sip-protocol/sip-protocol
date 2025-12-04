/**
 * Commitment Endpoint Tests
 */

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../src/server'

describe('Commitment Endpoint', () => {
  describe('POST /api/v1/commitment/create', () => {
    it('should create commitment for valid value', async () => {
      const response = await request(app)
        .post('/api/v1/commitment/create')
        .send({ value: '1000000000' })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.commitment).toMatch(/^0x[0-9a-f]+$/i)
      expect(response.body.data.blindingFactor).toMatch(/^0x[0-9a-f]+$/i)
    })

    it('should create commitment with custom blinding factor', async () => {
      const blindingFactor = '0x' + '1'.repeat(64)
      const response = await request(app)
        .post('/api/v1/commitment/create')
        .send({
          value: '1000000000',
          blindingFactor,
        })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.commitment).toBeDefined()
      expect(response.body.data.blindingFactor).toBeDefined()
    })

    it('should create unique commitments for same value', async () => {
      const value = '1000000000'

      const response1 = await request(app)
        .post('/api/v1/commitment/create')
        .send({ value })
        .expect(200)

      const response2 = await request(app)
        .post('/api/v1/commitment/create')
        .send({ value })
        .expect(200)

      // Different random blinding factors produce different commitments
      expect(response1.body.data.commitment).not.toBe(response2.body.data.commitment)
      expect(response1.body.data.blindingFactor).not.toBe(response2.body.data.blindingFactor)
    })

    it('should create same commitment with same blinding factor', async () => {
      const value = '1000000000'
      const blindingFactor = '0x' + '1'.repeat(64)

      const response1 = await request(app)
        .post('/api/v1/commitment/create')
        .send({ value, blindingFactor })
        .expect(200)

      const response2 = await request(app)
        .post('/api/v1/commitment/create')
        .send({ value, blindingFactor })
        .expect(200)

      // Same inputs produce same commitment
      expect(response1.body.data.commitment).toBe(response2.body.data.commitment)
    })

    it('should handle zero value', async () => {
      const response = await request(app)
        .post('/api/v1/commitment/create')
        .send({ value: '0' })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.commitment).toBeDefined()
    })

    it('should handle large values', async () => {
      const largeValue = '999999999999999999999999999999'
      const response = await request(app)
        .post('/api/v1/commitment/create')
        .send({ value: largeValue })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.commitment).toBeDefined()
    })

    it('should reject missing value', async () => {
      const response = await request(app)
        .post('/api/v1/commitment/create')
        .send({})
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject non-numeric value', async () => {
      const response = await request(app)
        .post('/api/v1/commitment/create')
        .send({ value: 'not-a-number' })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject negative value', async () => {
      const response = await request(app)
        .post('/api/v1/commitment/create')
        .send({ value: '-1000' })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject invalid blinding factor format', async () => {
      const response = await request(app)
        .post('/api/v1/commitment/create')
        .send({
          value: '1000',
          blindingFactor: 'not-hex',
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject blinding factor without 0x prefix', async () => {
      const response = await request(app)
        .post('/api/v1/commitment/create')
        .send({
          value: '1000',
          blindingFactor: '1'.repeat(64),
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })
  })
})
