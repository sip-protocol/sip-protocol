import rateLimit from 'express-rate-limit'
import { Request, Response } from 'express'

/**
 * Rate limiting configuration
 *
 * Environment variables:
 * - RATE_LIMIT_WINDOW_MS: Window size in milliseconds (default: 60000 = 1 minute)
 * - RATE_LIMIT_MAX_REQUESTS: Max requests per window (default: 100)
 * - RATE_LIMIT_SKIP_FAILED: Skip failed requests from count (default: false)
 */

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10)
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10)
const SKIP_FAILED = process.env.RATE_LIMIT_SKIP_FAILED === 'true'

/**
 * Standard rate limiter for general API endpoints
 */
export const rateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_REQUESTS,
  skipFailedRequests: SKIP_FAILED,
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // Use default keyGenerator (handles IPv6 properly)
  validate: { xForwardedForHeader: false }, // Disable IPv6 validation warning
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
        details: {
          retryAfter: Math.ceil(WINDOW_MS / 1000),
          limit: MAX_REQUESTS,
          windowMs: WINDOW_MS,
        },
      },
    })
  },
  skip: (req: Request) => {
    // Skip rate limiting for health checks
    return req.path === '/api/v1/health' || req.path === '/'
  },
})

/**
 * Strict rate limiter for sensitive endpoints (auth, proofs)
 */
export const strictRateLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 10, // 10 requests per minute
  skipFailedRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded for sensitive endpoint',
        details: {
          retryAfter: 60,
          limit: 10,
          windowMs: 60000,
        },
      },
    })
  },
})
