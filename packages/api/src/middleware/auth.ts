import { Request, Response, NextFunction } from 'express'
import { timingSafeEqual } from 'crypto'

/**
 * API Key Authentication Middleware
 *
 * Environment variables:
 * - API_KEYS: Comma-separated list of valid API keys
 * - AUTH_ENABLED: Enable/disable authentication (default: true in production)
 * - AUTH_SKIP_PATHS: Comma-separated paths to skip auth (default: /health,/)
 *
 * Headers:
 * - X-API-Key: The API key to authenticate with
 * - Authorization: Bearer <api-key> (alternative)
 */

const API_KEYS = (process.env.API_KEYS || '').split(',').filter(Boolean)
const NODE_ENV = process.env.NODE_ENV || 'development'
const AUTH_ENABLED = process.env.AUTH_ENABLED !== 'false' && NODE_ENV === 'production'
const SKIP_PATHS = (process.env.AUTH_SKIP_PATHS || '/health,/').split(',').map(p => p.trim())

/**
 * Timing-safe comparison of API keys
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch {
    return false
  }
}

/**
 * Check if a given API key is valid
 */
function isValidApiKey(key: string): boolean {
  return API_KEYS.some(validKey => safeCompare(key, validKey))
}

/**
 * Extract API key from request headers
 */
function extractApiKey(req: Request): string | null {
  // Check X-API-Key header first
  const apiKeyHeader = req.headers['x-api-key']
  if (typeof apiKeyHeader === 'string' && apiKeyHeader) {
    return apiKeyHeader
  }

  // Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  return null
}

/**
 * Authentication middleware
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  // Skip auth in development if not explicitly enabled
  if (!AUTH_ENABLED) {
    return next()
  }

  // Skip auth for certain paths
  const path = req.path.replace('/api/v1', '')
  if (SKIP_PATHS.some(skipPath => path === skipPath || path.startsWith(skipPath + '/'))) {
    return next()
  }

  // Check if API keys are configured
  if (API_KEYS.length === 0) {
    console.warn('[Auth] No API keys configured. Set API_KEYS environment variable.')
    return res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_NOT_CONFIGURED',
        message: 'Authentication is enabled but no API keys are configured',
      },
    })
  }

  // Extract and validate API key
  const apiKey = extractApiKey(req)

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'API key required. Provide via X-API-Key header or Authorization: Bearer <key>',
      },
    })
  }

  if (!isValidApiKey(apiKey)) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_API_KEY',
        message: 'Invalid API key',
      },
    })
  }

  // API key is valid
  next()
}

/**
 * Check if authentication is enabled
 */
export function isAuthEnabled(): boolean {
  return AUTH_ENABLED
}

/**
 * Get the number of configured API keys
 */
export function getApiKeyCount(): number {
  return API_KEYS.length
}
