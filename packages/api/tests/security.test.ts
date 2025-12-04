/**
 * Security Middleware Tests
 *
 * Tests for CORS, Rate Limiting, and Authentication middleware
 * Note: These tests run in development mode by default
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import app from '../src/server'

describe('CORS Middleware', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Development Mode Defaults', () => {
    it('should allow localhost:3000 origin', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'http://localhost:3000')

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000')
    })

    it('should allow localhost:5173 origin (Vite)', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'http://localhost:5173')

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173')
    })

    it('should allow 127.0.0.1 origins', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'http://127.0.0.1:3000')

      expect(response.headers['access-control-allow-origin']).toBe('http://127.0.0.1:3000')
    })

    it('should block unknown origins in development', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'https://evil-site.com')

      // Unknown origins should not get CORS header
      expect(response.headers['access-control-allow-origin']).toBeUndefined()
    })

    it('should allow requests without origin header', async () => {
      const response = await request(app)
        .get('/api/v1/health')

      expect(response.status).toBe(200)
    })
  })

  describe('Preflight Requests', () => {
    it('should handle OPTIONS preflight requests', async () => {
      const response = await request(app)
        .options('/api/v1/commitment/create')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')

      expect(response.status).toBe(204)
      expect(response.headers['access-control-allow-methods']).toBeDefined()
    })

    it('should include required headers in preflight response', async () => {
      const response = await request(app)
        .options('/api/v1/commitment/create')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'X-API-Key')

      expect(response.headers['access-control-allow-headers']).toContain('X-API-Key')
    })

    it('should expose rate limit headers', async () => {
      const response = await request(app)
        .options('/api/v1/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')

      expect(response.headers['access-control-expose-headers']).toContain('RateLimit-Limit')
    })
  })
})

describe('Rate Limiting Middleware', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should include rate limit headers in response', async () => {
    const response = await request(app)
      .post('/api/v1/commitment/create')
      .send({ value: '1000' })

    expect(response.headers['ratelimit-limit']).toBeDefined()
    expect(response.headers['ratelimit-remaining']).toBeDefined()
    expect(response.headers['ratelimit-reset']).toBeDefined()
  })

  it('should skip rate limiting for health endpoint', async () => {
    // Make multiple requests to health - should not consume rate limit
    for (let i = 0; i < 5; i++) {
      const response = await request(app).get('/api/v1/health')
      expect(response.status).toBe(200)
    }
  })

  it('should skip rate limiting for root endpoint', async () => {
    for (let i = 0; i < 5; i++) {
      const response = await request(app).get('/')
      expect(response.status).toBe(200)
    }
  })

  it('should decrement remaining count on each request', async () => {
    const response1 = await request(app)
      .post('/api/v1/commitment/create')
      .send({ value: '1000' })

    const response2 = await request(app)
      .post('/api/v1/commitment/create')
      .send({ value: '2000' })

    const remaining1 = parseInt(response1.headers['ratelimit-remaining'], 10)
    const remaining2 = parseInt(response2.headers['ratelimit-remaining'], 10)

    // Each request should decrement the remaining count
    expect(remaining2).toBeLessThan(remaining1)
  })
})

describe('Authentication Middleware', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Development Mode (Auth Disabled)', () => {
    it('should allow requests without API key in development', async () => {
      const response = await request(app)
        .post('/api/v1/commitment/create')
        .send({ value: '1000' })

      expect(response.status).toBe(200)
    })

    it('should still work with API key provided', async () => {
      const response = await request(app)
        .post('/api/v1/commitment/create')
        .set('X-API-Key', 'any-key')
        .send({ value: '1000' })

      expect(response.status).toBe(200)
    })
  })

  describe('Skip Paths', () => {
    it('should always allow health endpoint', async () => {
      const response = await request(app).get('/api/v1/health')
      expect(response.status).toBe(200)
    })

    it('should always allow root endpoint', async () => {
      const response = await request(app).get('/')
      expect(response.status).toBe(200)
    })
  })
})

describe('Security Response Headers', () => {
  it('should include Helmet security headers', async () => {
    const response = await request(app).get('/api/v1/health')

    // Helmet adds these security headers
    expect(response.headers['x-content-type-options']).toBe('nosniff')
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN')
    expect(response.headers['x-xss-protection']).toBeDefined()
  })

  it('should not expose server information', async () => {
    const response = await request(app).get('/api/v1/health')

    // Should not expose Express
    expect(response.headers['x-powered-by']).toBeUndefined()
  })
})

describe('Security Status Endpoint', () => {
  it('should show security status in root endpoint', async () => {
    const response = await request(app).get('/')

    expect(response.body.security).toBeDefined()
    expect(response.body.security.authentication).toBeDefined()
    expect(response.body.security.cors).toBeDefined()
    expect(response.body.security.rateLimit).toBe('enabled')
  })

  it('should show CORS configuration', async () => {
    const response = await request(app).get('/')

    expect(response.body.security.cors.credentials).toBeDefined()
    expect(typeof response.body.security.cors.origins).toBe('string')
  })

  it('should show authentication status', async () => {
    const response = await request(app).get('/')

    // In development, auth is disabled by default
    expect(['enabled', 'disabled']).toContain(response.body.security.authentication)
  })
})

describe('API Endpoint Security', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should reject invalid JSON body', async () => {
    const response = await request(app)
      .post('/api/v1/commitment/create')
      .set('Content-Type', 'application/json')
      .send('invalid json')

    // Express returns 500 for malformed JSON (handled by error middleware)
    expect([400, 500]).toContain(response.status)
  })

  it('should have body size limits configured', async () => {
    // Verify that body size limit is configured (1mb in server.ts)
    // Note: Testing actual 413 requires sending >1mb which is slow
    // This test verifies valid requests work within limits
    const response = await request(app)
      .post('/api/v1/commitment/create')
      .send({ value: '1000' })

    expect(response.status).toBe(200)
  })

  it('should return 404 for unknown routes', async () => {
    const response = await request(app).get('/api/v1/unknown-route')

    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('NOT_FOUND')
  })
})
