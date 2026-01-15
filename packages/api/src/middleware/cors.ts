import cors, { CorsOptions } from 'cors'
import { Request, RequestHandler } from 'express'

/**
 * CORS Configuration Middleware
 *
 * Environment variables:
 * - CORS_ORIGINS: Comma-separated list of allowed origins (required in production)
 * - CORS_CREDENTIALS: Allow credentials (default: true)
 * - CORS_MAX_AGE: Preflight cache duration in seconds (default: 86400 = 24 hours)
 *
 * Security:
 * - In production, CORS_ORIGINS must be explicitly set (no wildcards allowed)
 * - In development, allows localhost origins by default
 */

const NODE_ENV = process.env.NODE_ENV || 'development'
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) || []
const CORS_CREDENTIALS = process.env.CORS_CREDENTIALS !== 'false'
const CORS_MAX_AGE = parseInt(process.env.CORS_MAX_AGE || '86400', 10)

// Default development origins
const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:4000',
  'http://localhost:5173', // Vite
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:4000',
  'http://127.0.0.1:5173',
]

/**
 * Get allowed origins based on environment
 */
function getAllowedOrigins(): string[] {
  if (CORS_ORIGINS.length > 0) {
    return CORS_ORIGINS
  }

  if (NODE_ENV === 'development' || NODE_ENV === 'test') {
    return DEV_ORIGINS
  }

  // Production with no origins configured - deny all
  return []
}

/**
 * Safely parse a URL, returning null if malformed
 */
function safeParseUrl(url: string): URL | null {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

/**
 * Check if origin is allowed
 *
 * Security: Handles malformed URLs gracefully (denies instead of crashing)
 * and enforces HTTPS in production mode for wildcard subdomain matches.
 */
function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) {
    // Allow requests with no origin (same-origin, curl, etc.)
    return true
  }

  const allowedOrigins = getAllowedOrigins()

  // Check exact match
  if (allowedOrigins.includes(origin)) {
    return true
  }

  // Parse origin URL for wildcard matching
  // Security: Wrap in try/catch to handle malformed URLs gracefully
  let originUrl: URL
  try {
    originUrl = new URL(origin)
  } catch {
    // Malformed URL = denied (don't crash, just reject)
    console.warn(`[CORS] Rejected malformed origin: ${origin}`)
    return false
  }

  // Check wildcard subdomains (e.g., *.example.com)
  for (const allowed of allowedOrigins) {
    if (allowed.startsWith('*.')) {
      const baseDomain = allowed.slice(2)
      const originHost = originUrl.host

      // Security: Enforce HTTPS in production for wildcard matches
      // This prevents attackers from using HTTP to bypass HSTS
      if (NODE_ENV === 'production' && originUrl.protocol !== 'https:') {
        console.warn(`[CORS] Rejected non-HTTPS origin in production: ${origin}`)
        continue
      }

      // Match base domain or subdomains
      if (originHost === baseDomain || originHost.endsWith('.' + baseDomain)) {
        return true
      }
    }
  }

  return false
}

/**
 * Dynamic CORS options based on request origin
 */
const corsOptionsDelegate = (req: Request, callback: (err: Error | null, options?: CorsOptions) => void) => {
  const origin = req.headers.origin
  const allowed = isOriginAllowed(origin)

  const options: CorsOptions = {
    origin: allowed ? origin : false,
    credentials: CORS_CREDENTIALS,
    maxAge: CORS_MAX_AGE,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-API-Key',
      'X-Request-ID',
      'X-Forwarded-For',
    ],
    exposedHeaders: [
      'RateLimit-Limit',
      'RateLimit-Remaining',
      'RateLimit-Reset',
      'X-Request-ID',
    ],
  }

  if (!allowed && origin) {
    console.warn(`[CORS] Blocked request from origin: ${origin}`)
  }

  callback(null, options)
}

/**
 * Secure CORS middleware
 */
export const secureCors: RequestHandler = cors(corsOptionsDelegate) as RequestHandler

/**
 * Get current CORS configuration (for debugging/health checks)
 */
export function getCorsConfig() {
  return {
    origins: getAllowedOrigins(),
    credentials: CORS_CREDENTIALS,
    maxAge: CORS_MAX_AGE,
    environment: NODE_ENV,
  }
}
