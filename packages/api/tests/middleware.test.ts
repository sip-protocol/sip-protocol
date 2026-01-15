/**
 * Middleware Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import app from '../src/server'
import {
  amountSchema,
  calculateMinAmount,
  percentToBps,
  MAX_UINT256
} from '../src/middleware'

describe('Amount Schema Validation', () => {
  describe('Valid amounts', () => {
    it('should accept valid positive integers', () => {
      expect(amountSchema.safeParse('1').success).toBe(true)
      expect(amountSchema.safeParse('100').success).toBe(true)
      expect(amountSchema.safeParse('1000000000').success).toBe(true)
      expect(amountSchema.safeParse('123456789012345678901234567890').success).toBe(true)
    })

    it('should accept maximum uint256 value', () => {
      const maxUint256 = MAX_UINT256.toString()
      expect(amountSchema.safeParse(maxUint256).success).toBe(true)
    })
  })

  describe('Invalid amounts', () => {
    it('should reject zero', () => {
      const result = amountSchema.safeParse('0')
      expect(result.success).toBe(false)
    })

    it('should reject leading zeros', () => {
      expect(amountSchema.safeParse('01').success).toBe(false)
      expect(amountSchema.safeParse('00001').success).toBe(false)
      expect(amountSchema.safeParse('0123').success).toBe(false)
    })

    it('should reject negative numbers', () => {
      expect(amountSchema.safeParse('-1').success).toBe(false)
      expect(amountSchema.safeParse('-100').success).toBe(false)
    })

    it('should reject non-numeric strings', () => {
      expect(amountSchema.safeParse('abc').success).toBe(false)
      expect(amountSchema.safeParse('12abc').success).toBe(false)
      expect(amountSchema.safeParse('1.5').success).toBe(false)
      expect(amountSchema.safeParse('1e18').success).toBe(false)
    })

    it('should reject empty string', () => {
      expect(amountSchema.safeParse('').success).toBe(false)
    })

    it('should reject values exceeding uint256', () => {
      const overUint256 = (MAX_UINT256 + 1n).toString()
      const result = amountSchema.safeParse(overUint256)
      expect(result.success).toBe(false)
    })

    it('should reject strings longer than 78 chars', () => {
      const tooLong = '1'.repeat(79)
      const result = amountSchema.safeParse(tooLong)
      expect(result.success).toBe(false)
    })
  })
})

describe('Safe Slippage Calculation', () => {
  describe('calculateMinAmount', () => {
    it('should calculate correct min amount with 1% slippage', () => {
      const input = 1000000n
      const result = calculateMinAmount(input, 100) // 100 bps = 1%
      expect(result).toBe(990000n)
    })

    it('should calculate correct min amount with 0.5% slippage', () => {
      const input = 1000000n
      const result = calculateMinAmount(input, 50) // 50 bps = 0.5%
      expect(result).toBe(995000n)
    })

    it('should handle 0% slippage (no reduction)', () => {
      const input = 1000000n
      const result = calculateMinAmount(input, 0)
      expect(result).toBe(1000000n)
    })

    it('should handle 100% slippage (full reduction)', () => {
      const input = 1000000n
      const result = calculateMinAmount(input, 10000) // 10000 bps = 100%
      expect(result).toBe(0n)
    })

    it('should throw for negative slippage', () => {
      expect(() => calculateMinAmount(1000n, -1)).toThrow('Invalid slippage')
    })

    it('should throw for slippage > 100%', () => {
      expect(() => calculateMinAmount(1000n, 10001)).toThrow('Invalid slippage')
    })

    it('should handle large amounts without overflow', () => {
      const largeAmount = MAX_UINT256 / 2n
      // Should not throw
      const result = calculateMinAmount(largeAmount, 100)
      expect(result).toBeLessThan(largeAmount)
    })
  })

  describe('percentToBps', () => {
    it('should convert percentage to basis points', () => {
      expect(percentToBps(1)).toBe(100)
      expect(percentToBps(0.5)).toBe(50)
      expect(percentToBps(100)).toBe(10000)
      expect(percentToBps(0.01)).toBe(1)
    })

    it('should floor decimal results', () => {
      expect(percentToBps(0.015)).toBe(1) // 1.5 floored
      expect(percentToBps(1.999)).toBe(199)
    })
  })
})

describe('Request ID Middleware', () => {
  it('should generate X-Request-ID if not provided', async () => {
    const response = await request(app)
      .get('/api/v1/health')
      .expect(200)

    const requestId = response.headers['x-request-id']
    expect(requestId).toBeDefined()
    // UUID v4 format
    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
  })

  it('should accept client-provided X-Request-ID', async () => {
    const clientRequestId = 'client-req-12345'

    const response = await request(app)
      .get('/api/v1/health')
      .set('X-Request-ID', clientRequestId)
      .expect(200)

    expect(response.headers['x-request-id']).toBe(clientRequestId)
  })

  it('should include request ID in all responses', async () => {
    // Success response
    const successResponse = await request(app)
      .get('/api/v1/health')
      .expect(200)
    expect(successResponse.headers['x-request-id']).toBeDefined()

    // Error response
    const errorResponse = await request(app)
      .get('/api/v1/unknown-route')
      .expect(404)
    expect(errorResponse.headers['x-request-id']).toBeDefined()
  })

  it('should use unique IDs for different requests', async () => {
    const response1 = await request(app).get('/api/v1/health')
    const response2 = await request(app).get('/api/v1/health')

    expect(response1.headers['x-request-id']).not.toBe(response2.headers['x-request-id'])
  })
})

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

  describe('Amount Validation (API Level)', () => {
    it('should reject zero amount in commitment creation', async () => {
      const response = await request(app)
        .post('/api/v1/commitment/create')
        .send({ value: '0' })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject leading zeros in amount', async () => {
      const response = await request(app)
        .post('/api/v1/commitment/create')
        .send({ value: '0100' })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject non-numeric amount', async () => {
      const response = await request(app)
        .post('/api/v1/commitment/create')
        .send({ value: 'abc' })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject amount exceeding uint256', async () => {
      const overUint256 = (MAX_UINT256 + 1n).toString()
      const response = await request(app)
        .post('/api/v1/commitment/create')
        .send({ value: overUint256 })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should accept valid amount', async () => {
      const response = await request(app)
        .post('/api/v1/commitment/create')
        .send({ value: '1000000000' })
        .expect(200)

      expect(response.body.success).toBe(true)
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

describe('CORS Handling', () => {
  it('should handle requests without Origin header', async () => {
    // Requests without Origin (same-origin, curl) should be allowed
    const response = await request(app)
      .get('/api/v1/health')
      .expect(200)

    expect(response.body.success).toBe(true)
  })

  it('should handle requests with valid localhost Origin in development', async () => {
    const response = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'http://localhost:3000')
      .expect(200)

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000')
  })

  it('should handle OPTIONS preflight requests', async () => {
    const response = await request(app)
      .options('/api/v1/health')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET')
      .expect(204)

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000')
    expect(response.headers['access-control-allow-methods']).toContain('GET')
  })

  it('should handle malformed Origin headers gracefully', async () => {
    // Malformed URLs should not crash the server
    const response = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'not-a-valid-url')
      .expect(200)

    // Should still respond but without CORS headers (blocked)
    expect(response.body.success).toBe(true)
  })

  it('should handle Origin with invalid protocol', async () => {
    const response = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'javascript:alert(1)')
      .expect(200)

    // Should still respond but without CORS headers (blocked)
    expect(response.body.success).toBe(true)
  })

  it('should handle empty Origin header', async () => {
    const response = await request(app)
      .get('/api/v1/health')
      .set('Origin', '')
      .expect(200)

    expect(response.body.success).toBe(true)
  })
})
