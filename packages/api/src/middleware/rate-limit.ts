import rateLimit, { type Store } from 'express-rate-limit'
import { RedisStore, type SendCommandFn } from 'rate-limit-redis'
import { Redis } from 'ioredis'
import type { Request, Response } from 'express'

/**
 * Rate limiting configuration
 *
 * Environment variables:
 * - RATE_LIMIT_WINDOW_MS: Window size in milliseconds (default: 60000 = 1 minute)
 * - RATE_LIMIT_MAX_REQUESTS: Max requests per window (default: 100)
 * - RATE_LIMIT_SKIP_FAILED: Skip failed requests from count (default: false)
 * - RATE_LIMIT_STORE: Store type - 'redis' or 'memory' (default: 'memory')
 * - REDIS_URL: Redis connection URL (required if store is 'redis')
 *
 * SECURITY NOTE: This rate limiter relies on Express trust proxy configuration
 * to properly extract client IP from X-Forwarded-For header when behind a reverse proxy.
 * Ensure TRUST_PROXY is correctly set in your environment configuration.
 * See: https://expressjs.com/en/guide/behind-proxies.html
 */

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10)
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10)
const SKIP_FAILED = process.env.RATE_LIMIT_SKIP_FAILED === 'true'
const STORE_TYPE = process.env.RATE_LIMIT_STORE || 'memory'
const REDIS_URL = process.env.REDIS_URL

/**
 * Redis client singleton for rate limiting
 * Initialized lazily when Redis store is requested
 */
let redisClient: Redis | null = null
let redisConnectionFailed = false

/**
 * Get or create Redis client
 * Returns null if Redis is not configured or connection failed
 */
function getRedisClient(): Redis | null {
  if (redisConnectionFailed) {
    return null
  }

  if (!redisClient && REDIS_URL) {
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          console.warn('[rate-limit] Redis connection failed, falling back to memory store')
          redisConnectionFailed = true
          return null
        }
        return Math.min(times * 100, 1000)
      },
      lazyConnect: true,
    })

    redisClient.on('error', (err) => {
      console.warn('[rate-limit] Redis error:', err.message)
    })

    redisClient.on('connect', () => {
      console.log('[rate-limit] Redis connected successfully')
    })
  }

  return redisClient
}

/**
 * Check Redis connection health
 */
export async function checkRedisHealth(): Promise<{
  connected: boolean
  latencyMs?: number
  error?: string
}> {
  const client = getRedisClient()
  if (!client) {
    return { connected: false, error: 'Redis not configured' }
  }

  try {
    const start = Date.now()
    await client.ping()
    return { connected: true, latencyMs: Date.now() - start }
  } catch (err) {
    return {
      connected: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

/**
 * Get Redis connection status for health endpoint
 */
export function getRedisStatus(): {
  storeType: 'redis' | 'memory'
  configured: boolean
  connected: boolean
} {
  const client = getRedisClient()
  return {
    storeType: client && !redisConnectionFailed ? 'redis' : 'memory',
    configured: !!REDIS_URL,
    connected: client?.status === 'ready',
  }
}

/**
 * Create rate limit store based on configuration
 * Falls back to memory store if Redis is unavailable
 */
function createStore(prefix: string): Store | undefined {
  if (STORE_TYPE === 'redis' || REDIS_URL) {
    const client = getRedisClient()
    if (client && !redisConnectionFailed) {
      const sendCommand: SendCommandFn = async (...args: string[]) => {
        return client.call(args[0], ...args.slice(1)) as Promise<number | string>
      }
      return new RedisStore({
        sendCommand,
        prefix: `rl:${prefix}:`,
      })
    }
  }

  // Use default MemoryStore (undefined lets express-rate-limit use its default)
  return undefined
}

// Key generator is intentionally not customized - we use express-rate-limit's
// default behavior which properly handles IPv6 addresses via req.ip
// See: https://express-rate-limit.github.io/ERR_ERL_KEY_GEN_IPV6/

/**
 * Standard rate limiter for general API endpoints
 */
export const rateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_REQUESTS,
  skipFailedRequests: SKIP_FAILED,
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // Use Redis store if available, otherwise memory
  store: createStore('api'),
  handler: (_req: Request, res: Response) => {
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
  // Use Redis store if available with different prefix
  store: createStore('strict'),
  handler: (_req: Request, res: Response) => {
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

/**
 * Graceful shutdown for Redis client
 */
export async function shutdownRateLimiter(): Promise<void> {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
  }
}
