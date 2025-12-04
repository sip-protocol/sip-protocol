/**
 * Structured Logger
 *
 * Production-ready logging with pino.
 * - JSON format in production for log aggregation
 * - Pretty printed in development
 * - Request ID tracking
 * - Log levels configurable via LOG_LEVEL
 */

import pino from 'pino'
import pinoHttp from 'pino-http'
import crypto from 'crypto'
import { env } from './config'

/**
 * Base logger configuration
 */
const loggerConfig: pino.LoggerOptions = {
  level: env.LOG_LEVEL,
  base: {
    service: 'sip-api',
    version: '0.1.0',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
}

/**
 * Add pretty printing in development
 */
if (env.isDevelopment) {
  loggerConfig.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname,service,version',
    },
  }
}

/**
 * Main application logger
 */
export const logger = pino(loggerConfig)

/**
 * HTTP request logger middleware
 *
 * Automatically logs all incoming requests with:
 * - Request ID (from header or generated)
 * - Method and URL
 * - Response status and time
 * - Log level based on status code
 */
export const requestLogger = pinoHttp({
  logger,
  genReqId: (req) => {
    const existingId = req.headers['x-request-id']
    if (existingId && typeof existingId === 'string') {
      return existingId
    }
    return crypto.randomUUID()
  },
  customLogLevel: (_req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error'
    if (res.statusCode >= 400) return 'warn'
    return 'info'
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} ${res.statusCode}`
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} ${res.statusCode} - ${err.message}`
  },
  // Don't log health checks in production
  autoLogging: {
    ignore: (req) => {
      return req.url === '/api/v1/health' && env.isProduction
    },
  },
})

/**
 * Create a child logger with additional context
 */
export function createChildLogger(context: Record<string, unknown>) {
  return logger.child(context)
}

export default logger
