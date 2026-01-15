import rateLimit from 'express-rate-limit'
import { Request, Response } from 'express'

/**
 * Rate limiting configuration
 *
 * Environment variables:
 * - RATE_LIMIT_WINDOW_MS: Window size in milliseconds (default: 60000 = 1 minute)
 * - RATE_LIMIT_MAX_REQUESTS: Max requests per window (default: 100)
 * - RATE_LIMIT_SKIP_FAILED: Skip failed requests from count (default: false)
 *
 * SECURITY NOTE: This rate limiter relies on Express trust proxy configuration
 * to properly extract client IP from X-Forwarded-For header when behind a reverse proxy.
 * Ensure TRUST_PROXY is correctly set in your environment configuration.
 * See: https://expressjs.com/en/guide/behind-proxies.html
 */

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10)
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10)
const SKIP_FAILED = process.env.RATE_LIMIT_SKIP_FAILED === 'true'

/**
 * Key generator that uses req.ip (which respects trust proxy settings)
 * This ensures proper IP extraction when behind reverse proxy
 */
const keyGenerator = (req: Request): string => {
  // req.ip is set by Express based on trust proxy configuration
  // Falls back to socket address if no proxy
  return req.ip || req.socket?.remoteAddress || 'unknown'
}

/**
 * Standard rate limiter for general API endpoints
 */
export const rateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_REQUESTS,
  skipFailedRequests: SKIP_FAILED,
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // Use custom key generator that respects trust proxy
  keyGenerator,
  // Enable validation now that trust proxy is properly configured
  validate: { xForwardedForHeader: true },
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
  keyGenerator,
  validate: { xForwardedForHeader: true },
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
