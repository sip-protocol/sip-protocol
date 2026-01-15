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
 * Safely parse a URL and extract the host
 * Returns null if the URL is malformed
 */
function safeParseOrigin(origin: string): { host: string; protocol: string } | null {
  try {
    const url = new URL(origin)
    return { host: url.host, protocol: url.protocol }
  } catch {
    // Invalid URL - deny access
    return null
  }
}

/**
 * Check if origin is allowed
 *
 * Security considerations:
 * - Malformed URLs are denied (prevents crash attacks)
 * - Production enforces HTTPS (prevents protocol downgrade)
 * - Wildcard subdomains require valid URL parsing
 */
function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) {
    // Allow requests with no origin (same-origin, curl, etc.)
    return true
  }

  const allowedOrigins = getAllowedOrigins()

  // Check exact match first (fast path)
  if (allowedOrigins.includes(origin)) {
    return true
  }

  // Check if any allowed origins use wildcard subdomain matching
  const hasWildcardOrigins = allowedOrigins.some(o => o.startsWith('*.'))
  if (!hasWildcardOrigins) {
    return false
  }

  // Parse origin safely for wildcard matching
  const parsedOrigin = safeParseOrigin(origin)
  if (!parsedOrigin) {
    // Invalid URL = denied
    console.warn(`[CORS] Denied malformed origin: ${origin}`)
    return false
  }

  // In production, enforce HTTPS for security
  if (NODE_ENV === 'production' && parsedOrigin.protocol !== 'https:') {
    console.warn(`[CORS] Denied non-HTTPS origin in production: ${origin}`)
    return false
  }

  // Check wildcard subdomains (e.g., *.example.com)
  for (const allowed of allowedOrigins) {
    if (allowed.startsWith('*.')) {
      const baseDomain = allowed.slice(2)
      const originHost = parsedOrigin.host

      // Must match base domain exactly or be a valid subdomain
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
