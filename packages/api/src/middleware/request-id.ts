/**
 * Request ID Middleware
 *
 * Generates unique request IDs for request correlation across services.
 *
 * Features:
 * - Accepts client-provided X-Request-ID header for end-to-end tracing
 * - Generates UUID v4 if no client ID provided
 * - Sets X-Request-ID response header for client correlation
 * - Attaches requestId to request object for use in routes/logging
 *
 * @example Client-side usage
 * ```typescript
 * // Send request with ID for tracing
 * const response = await fetch('/api/v1/swap', {
 *   headers: { 'X-Request-ID': crypto.randomUUID() }
 * })
 *
 * // Use response ID for error reporting
 * const requestId = response.headers.get('X-Request-ID')
 * if (!response.ok) {
 *   console.error(`Request ${requestId} failed`)
 * }
 * ```
 */

import { Request, Response, NextFunction, RequestHandler } from 'express'
import crypto from 'crypto'

/** Extended Request interface with requestId */
export interface RequestWithId extends Request {
  requestId: string
}

/**
 * Type guard to check if request has requestId
 */
export function hasRequestId(req: Request): req is RequestWithId {
  return 'requestId' in req && typeof (req as RequestWithId).requestId === 'string'
}

/**
 * Request ID middleware
 *
 * Should be added early in the middleware chain (after shutdown middleware)
 * so all subsequent middleware can access req.requestId.
 */
export const requestIdMiddleware: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Accept client-provided ID or generate new one
  const clientId = req.headers['x-request-id']
  const requestId = (typeof clientId === 'string' && clientId.length > 0)
    ? clientId
    : crypto.randomUUID()

  // Attach to request for downstream use
  ;(req as RequestWithId).requestId = requestId

  // Set response header for client correlation
  res.setHeader('X-Request-ID', requestId)

  next()
}
