/**
 * Environment Configuration with Validation
 *
 * Validates all environment variables at startup with clear error messages.
 * Uses envalid for type-safe environment access.
 */

import { cleanEnv, str, port, bool, num } from 'envalid'

/**
 * Validated environment configuration
 */
export const env = cleanEnv(process.env, {
  // Server configuration
  NODE_ENV: str({
    choices: ['development', 'production', 'test'] as const,
    default: 'development',
    desc: 'Application environment',
  }),
  PORT: port({
    default: 3000,
    desc: 'Server port',
  }),

  // CORS configuration
  CORS_ORIGINS: str({
    default: '',
    desc: 'Comma-separated list of allowed origins (empty = localhost only in dev)',
  }),

  // Authentication
  API_KEYS: str({
    default: '',
    desc: 'Comma-separated list of valid API keys (empty = auth disabled in dev)',
  }),

  // Rate limiting
  RATE_LIMIT_MAX: num({
    default: 100,
    desc: 'Maximum requests per window',
  }),
  RATE_LIMIT_WINDOW_MS: num({
    default: 60000,
    desc: 'Rate limit window in milliseconds',
  }),

  // Proxy trust configuration (for X-Forwarded-For header)
  // Set to number of trusted proxies (e.g., 1 for single nginx)
  // or 'loopback' for local proxies, or 'uniquelocal' for private IPs
  TRUST_PROXY: str({
    default: '1',
    desc: 'Express trust proxy setting (number of hops, "loopback", "uniquelocal", or "false")',
  }),

  // Logging
  LOG_LEVEL: str({
    choices: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const,
    default: 'info',
    desc: 'Logging level',
  }),

  // Graceful shutdown
  SHUTDOWN_TIMEOUT_MS: num({
    default: 30000,
    desc: 'Graceful shutdown timeout in milliseconds',
  }),

  // Monitoring
  SENTRY_DSN: str({
    default: '',
    desc: 'Sentry DSN for error tracking (optional)',
  }),
  METRICS_ENABLED: str({
    choices: ['true', 'false'] as const,
    default: 'true',
    desc: 'Enable Prometheus metrics endpoint',
  }),
})

/**
 * Log startup warnings for potentially insecure configurations
 */
export function logConfigWarnings(logger: { warn: (msg: string) => void }): void {
  if (env.isProduction) {
    if (!env.API_KEYS) {
      logger.warn('API_KEYS not set in production - authentication disabled')
    }
    if (!env.CORS_ORIGINS) {
      logger.warn('CORS_ORIGINS not set in production - only localhost allowed')
    }
  }
}

/**
 * Check if running in production
 */
export const isProduction = env.isProduction

/**
 * Check if running in development
 */
export const isDevelopment = env.isDevelopment

/**
 * Check if running in test
 */
export const isTest = env.isTest
