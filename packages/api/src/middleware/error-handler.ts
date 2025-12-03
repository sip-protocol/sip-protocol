import { Request, Response, NextFunction } from 'express'
import { SIPError, isSIPError } from '@sip-protocol/sdk'

/**
 * Global error handler middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log error for debugging
  console.error('[API Error]', {
    path: req.path,
    method: req.method,
    error: err.message,
    stack: err.stack,
  })

  // Handle SIP SDK errors
  if (isSIPError(err)) {
    const sipError = err as SIPError
    return res.status(400).json({
      success: false,
      error: {
        code: sipError.code,
        message: sipError.message,
        details: {
          field: (sipError as any).field,
          expected: (sipError as any).expected,
        },
      },
    })
  }

  // Handle generic errors
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
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
