/**
 * Middleware Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import app from '../src/server'

describe('Validation Middleware', () => {
  describe('Request Body Validation', () => {
    it('should pass valid request body', async () => {
      const response = await request(app)
        .post('/api/v1/commitment/create')
        .send({ value: '1000' })
        .expect(200)

      expect(response.body.success).toBe(true)
    })

    it('should reject invalid request body', async () => {
      const response = await request(app)
        .post('/api/v1/commitment/create')
        .send({ invalid: 'field' })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
      expect(response.body.error.message).toBe('Invalid request data')
      expect(response.body.error.details).toBeDefined()
      expect(Array.isArray(response.body.error.details)).toBe(true)
    })

    it('should provide detailed error information', async () => {
      const response = await request(app)
        .post('/api/v1/commitment/create')
        .send({})
        .expect(400)

      expect(response.body.error.details.length).toBeGreaterThan(0)
      expect(response.body.error.details[0]).toHaveProperty('path')
      expect(response.body.error.details[0]).toHaveProperty('message')
    })
  })

  describe('Params Validation', () => {
    it('should validate path parameters', async () => {
      const response = await request(app)
        .get('/api/v1/swap/test-id/status')
        .expect(404) // Not found, but validation passed

      expect(response.body.error.code).toBe('SWAP_NOT_FOUND')
    })
  })
})

describe('Error Handler Middleware', () => {
  // Suppress console.error during these tests
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('404 Not Found Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/v1/unknown-route')
        .expect(404)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('NOT_FOUND')
      expect(response.body.error.message).toContain('Route')
      expect(response.body.error.message).toContain('not found')
    })

    it('should include method in 404 message', async () => {
      const response = await request(app)
        .post('/api/v1/does-not-exist')
        .expect(404)

      expect(response.body.error.message).toContain('POST')
    })

    it('should include path in 404 message', async () => {
      const response = await request(app)
        .get('/api/v1/some-random-path')
        .expect(404)

      expect(response.body.error.message).toContain('/api/v1/some-random-path')
    })
  })

  describe('Response Format', () => {
    it('should return consistent error format', async () => {
      const response = await request(app)
        .post('/api/v1/commitment/create')
        .send({ invalid: true })
        .expect(400)

      expect(response.body).toHaveProperty('success', false)
      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toHaveProperty('code')
      expect(response.body.error).toHaveProperty('message')
    })

    it('should return consistent success format', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200)

      expect(response.body).toHaveProperty('success', true)
      expect(response.body).toHaveProperty('data')
    })
  })
})

describe('Content-Type Handling', () => {
  it('should accept application/json', async () => {
    const response = await request(app)
      .post('/api/v1/commitment/create')
      .set('Content-Type', 'application/json')
      .send({ value: '1000' })
      .expect(200)

    expect(response.body.success).toBe(true)
  })

  it('should handle missing Content-Type header', async () => {
    // supertest defaults to JSON but this tests the body parsing
    const response = await request(app)
      .post('/api/v1/commitment/create')
      .send({ value: '1000' })
      .expect(200)

    expect(response.body.success).toBe(true)
  })
})
