import { Request, Response, NextFunction } from 'express'
import { SIPError, ValidationError, isSIPError } from '@sip-protocol/sdk'
import { logger } from '../logger'
import { env } from '../config'
import { captureException } from '../monitoring'

/**
 * Global error handler middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log error with structured logger
  logger.error({
    path: req.path,
    method: req.method,
    error: err.message,
    stack: err.stack,
  }, 'API Error')

  // Handle SIP SDK errors
  if (isSIPError(err)) {
    const sipError = err as SIPError
    // Check if it's a ValidationError with field property
    const isValidationError = err instanceof ValidationError
    return res.status(400).json({
      success: false,
      error: {
        code: sipError.code,
        message: sipError.message,
        details: {
          ...(isValidationError && { field: (err as ValidationError).field }),
          ...sipError.context,
        },
      },
    })
  }

  // Capture to Sentry (for 5xx errors)
  captureException(err, {
    path: req.path,
    method: req.method,
  })

  // Handle generic errors
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      details: env.isDevelopment ? err.message : undefined,
    },
  })
}

/**
 * 404 handler
 */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  })
}
