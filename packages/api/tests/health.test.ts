/**
 * Health Endpoint Tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../src/server'

describe('Health Endpoint', () => {
  describe('GET /api/v1/health', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.status).toBe('healthy')
      expect(response.body.data.version).toBeDefined()
      expect(response.body.data.timestamp).toBeDefined()
      expect(response.body.data.uptime).toBeGreaterThanOrEqual(0)
    })

    it('should return valid ISO timestamp', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200)

      const timestamp = new Date(response.body.data.timestamp)
      expect(timestamp instanceof Date).toBe(true)
      expect(isNaN(timestamp.getTime())).toBe(false)
    })
  })

  describe('GET /', () => {
    it('should return API info', async () => {
      const response = await request(app)
        .get('/')
        .expect(200)

      expect(response.body.name).toBe('@sip-protocol/api')
      expect(response.body.version).toBeDefined()
      expect(response.body.endpoints).toBeDefined()
      expect(response.body.endpoints.health).toBe('GET /api/v1/health')
    })
  })

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/v1/unknown-route')
        .expect(404)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('NOT_FOUND')
    })
  })
})
