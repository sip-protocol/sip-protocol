/**
 * Prometheus Metrics
 *
 * Exposes metrics for monitoring:
 * - HTTP request count and latency
 * - SIP-specific operation metrics
 * - Default Node.js metrics (memory, CPU, event loop)
 */

import { Registry, Counter, Histogram, collectDefaultMetrics, Gauge } from 'prom-client'
import { Request, Response, NextFunction } from 'express'

// Create a registry for all metrics
export const register = new Registry()

// Add default Node.js metrics
collectDefaultMetrics({
  register,
  prefix: 'sip_api_',
})

// HTTP request counter
export const httpRequestsTotal = new Counter({
  name: 'sip_api_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'] as const,
  registers: [register],
})

// HTTP request duration histogram
export const httpRequestDuration = new Histogram({
  name: 'sip_api_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'path', 'status'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
})

// SIP-specific metrics
export const stealthAddressGenerations = new Counter({
  name: 'sip_stealth_address_generations_total',
  help: 'Total number of stealth address generations',
  labelNames: ['chain'] as const,
  registers: [register],
})

export const commitmentCreations = new Counter({
  name: 'sip_commitment_creations_total',
  help: 'Total number of commitment creations',
  registers: [register],
})

export const proofGenerations = new Counter({
  name: 'sip_proof_generations_total',
  help: 'Total number of proof generations',
  labelNames: ['type'] as const,
  registers: [register],
})

export const proofGenerationDuration = new Histogram({
  name: 'sip_proof_generation_duration_seconds',
  help: 'Duration of proof generation in seconds',
  labelNames: ['type'] as const,
  buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30, 60],
  registers: [register],
})

export const activeConnections = new Gauge({
  name: 'sip_api_active_connections',
  help: 'Number of active connections',
  registers: [register],
})

export const swapRequests = new Counter({
  name: 'sip_swap_requests_total',
  help: 'Total number of swap requests',
  labelNames: ['from_chain', 'to_chain', 'status'] as const,
  registers: [register],
})

export const quoteRequests = new Counter({
  name: 'sip_quote_requests_total',
  help: 'Total number of quote requests',
  labelNames: ['from_chain', 'to_chain'] as const,
  registers: [register],
})

/**
 * Normalize path to avoid high-cardinality labels
 * Replaces dynamic segments like IDs with placeholders
 */
function normalizePath(path: string): string {
  return path
    // Replace UUIDs
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    // Replace hex addresses (0x...)
    .replace(/0x[0-9a-fA-F]{40,}/g, ':address')
    // Replace numeric IDs
    .replace(/\/\d+/g, '/:id')
    // Collapse multiple slashes
    .replace(/\/+/g, '/')
}

/**
 * Express middleware to track HTTP metrics
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip metrics endpoint itself to avoid recursion
  if (req.path === '/metrics') {
    return next()
  }

  const startTime = process.hrtime.bigint()

  // Track active connections
  activeConnections.inc()

  // On response finish, record metrics
  res.on('finish', () => {
    const endTime = process.hrtime.bigint()
    const durationSeconds = Number(endTime - startTime) / 1e9

    const path = normalizePath(req.route?.path || req.path)
    const labels = {
      method: req.method,
      path,
      status: res.statusCode.toString(),
    }

    httpRequestsTotal.inc(labels)
    httpRequestDuration.observe(labels, durationSeconds)

    activeConnections.dec()
  })

  next()
}

/**
 * Helper to record SIP operation metrics
 */
export const sipMetrics = {
  recordStealthGeneration(chain: string): void {
    stealthAddressGenerations.inc({ chain })
  },

  recordCommitmentCreation(): void {
    commitmentCreations.inc()
  },

  recordProofGeneration(type: string, durationSeconds: number): void {
    proofGenerations.inc({ type })
    proofGenerationDuration.observe({ type }, durationSeconds)
  },

  recordSwapRequest(fromChain: string, toChain: string, status: string): void {
    swapRequests.inc({ from_chain: fromChain, to_chain: toChain, status })
  },

  recordQuoteRequest(fromChain: string, toChain: string): void {
    quoteRequests.inc({ from_chain: fromChain, to_chain: toChain })
  },
}
