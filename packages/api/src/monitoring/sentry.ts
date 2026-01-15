/**
 * Sentry Error Monitoring
 *
 * Integrates Sentry for production error tracking:
 * - Captures unhandled exceptions
 * - Captures unhandled promise rejections
 * - Provides stack traces with source maps
 * - Enriches errors with request context
 */

import * as Sentry from '@sentry/node'
import type { Express, ErrorRequestHandler } from 'express'
import { env } from '../config'

let isInitialized = false

/**
 * Initialize Sentry error monitoring
 *
 * Only initializes if SENTRY_DSN is provided
 */
export function initSentry(): void {
  if (isInitialized) return

  if (!env.SENTRY_DSN) {
    if (env.isProduction) {
      console.warn('[Sentry] SENTRY_DSN not set - error monitoring disabled')
    }
    return
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    release: `sip-api@${process.env.npm_package_version || '0.1.0'}`,

    // Performance monitoring
    tracesSampleRate: env.isProduction ? 0.1 : 1.0,

    // Filter out noisy errors
    ignoreErrors: [
      // Expected client errors
      'Request validation failed',
      'Unauthorized',
      // Network issues
      'ECONNRESET',
      'EPIPE',
    ],

    // Add extra context
    beforeSend(event) {
      // Don't send events in test environment
      if (env.NODE_ENV === 'test') {
        return null
      }

      // Add request ID tag for correlation
      const requestId = event.request?.headers?.['x-request-id']
      if (requestId && typeof requestId === 'string') {
        event.tags = { ...event.tags, requestId }
      }

      // Sanitize sensitive data
      if (event.request?.headers) {
        delete event.request.headers['authorization']
        delete event.request.headers['x-api-key']
        delete event.request.headers['cookie']
      }

      return event
    },

    // Capture breadcrumbs for debugging
    beforeBreadcrumb(breadcrumb) {
      // Filter out health check noise
      if (breadcrumb.category === 'http' && breadcrumb.data?.url?.includes('/health')) {
        return null
      }
      return breadcrumb
    },
  })

  isInitialized = true
  console.log('[Sentry] Initialized for environment:', env.NODE_ENV)
}

/**
 * Check if Sentry is initialized
 */
export function isSentryEnabled(): boolean {
  return isInitialized && !!env.SENTRY_DSN
}

/**
 * Capture an exception with optional context
 */
export function captureException(
  error: Error,
  context?: Record<string, unknown>
): string | undefined {
  if (!isSentryEnabled()) return undefined

  return Sentry.captureException(error, {
    extra: context,
  })
}

/**
 * Capture a message with severity level
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info'
): string | undefined {
  if (!isSentryEnabled()) return undefined

  return Sentry.captureMessage(message, level)
}

/**
 * Set user context for error tracking
 */
export function setUser(user: { id: string; [key: string]: unknown } | null): void {
  if (!isSentryEnabled()) return

  Sentry.setUser(user)
}

/**
 * Add context tags
 */
export function setTags(tags: Record<string, string>): void {
  if (!isSentryEnabled()) return

  Sentry.setTags(tags)
}

/**
 * Setup Express error handler for Sentry
 * Call after all routes are registered
 */
export function setupSentryErrorHandler(app: Express): void {
  if (!isSentryEnabled()) return

  Sentry.setupExpressErrorHandler(app)
}

/**
 * Create a no-op request handler middleware
 * Sentry v10 uses auto-instrumentation, but we keep this for compatibility
 */
export function sentryRequestHandler(
  _req: unknown,
  _res: unknown,
  next: () => void
): void {
  next()
}

/**
 * Create a no-op error handler for compatibility
 * Actual error handling is done via setupSentryErrorHandler
 */
export const sentryErrorHandler: ErrorRequestHandler = (err, _req, _res, next) => {
  // Sentry v10 captures errors automatically via setupExpressErrorHandler
  // This middleware is kept for API compatibility
  next(err)
}

/**
 * Flush pending events (call before shutdown)
 */
export async function flushSentry(timeout = 2000): Promise<boolean> {
  if (!isSentryEnabled()) return true

  return Sentry.close(timeout)
}

export { Sentry }
