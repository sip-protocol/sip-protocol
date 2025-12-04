/**
 * Prometheus Metrics Endpoint Tests
 */

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../src/server'

describe('Metrics Endpoint', () => {
  describe('GET /metrics', () => {
    it('should return Prometheus-format metrics', async () => {
      const response = await request(app).get('/metrics')

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toContain('text/plain')
      expect(response.text).toContain('# HELP')
      expect(response.text).toContain('# TYPE')
    })

    it('should include default Node.js metrics', async () => {
      const response = await request(app).get('/metrics')

      expect(response.text).toContain('nodejs_version_info')
      expect(response.text).toContain('process_cpu_')
      expect(response.text).toContain('nodejs_heap_')
    })

    it('should include HTTP request metrics', async () => {
      // Make a request first to generate metrics
      await request(app).get('/api/v1/health')

      const response = await request(app).get('/metrics')

      expect(response.text).toContain('sip_api_http_requests_total')
      expect(response.text).toContain('sip_api_http_request_duration_seconds')
    })

    it('should include SIP-specific metrics', async () => {
      const response = await request(app).get('/metrics')

      expect(response.text).toContain('sip_stealth_address_generations_total')
      expect(response.text).toContain('sip_commitment_creations_total')
      expect(response.text).toContain('sip_proof_generations_total')
      expect(response.text).toContain('sip_swap_requests_total')
      expect(response.text).toContain('sip_quote_requests_total')
    })

    it('should track active connections', async () => {
      const response = await request(app).get('/metrics')

      expect(response.text).toContain('sip_api_active_connections')
    })

    it('should not count /metrics endpoint itself', async () => {
      // Make multiple requests to /metrics
      await request(app).get('/metrics')
      await request(app).get('/metrics')

      const response = await request(app).get('/metrics')

      // The /metrics endpoint should not be counted in HTTP metrics
      // (filtered out to avoid recursion)
      expect(response.text).not.toContain('path="/metrics"')
    })
  })
})
