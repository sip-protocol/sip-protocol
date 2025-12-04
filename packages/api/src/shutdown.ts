/**
 * Graceful Shutdown Handler
 *
 * Handles SIGTERM and SIGINT signals to:
 * - Stop accepting new connections
 * - Allow in-flight requests to complete
 * - Clean up resources
 * - Exit gracefully
 */

import { Server } from 'http'
import { logger } from './logger'
import { env } from './config'

let isShuttingDown = false

/**
 * Check if server is currently shutting down
 */
export function isServerShuttingDown(): boolean {
  return isShuttingDown
}

/**
 * Setup graceful shutdown handlers
 *
 * @param server - HTTP server instance
 * @param cleanup - Optional cleanup function to run before exit
 */
export function setupGracefulShutdown(
  server: Server,
  cleanup?: () => Promise<void>
): void {
  const shutdown = async (signal: string) => {
    if (isShuttingDown) {
      logger.warn({ signal }, 'Shutdown already in progress, ignoring signal')
      return
    }

    isShuttingDown = true
    logger.info({ signal }, 'Received shutdown signal, starting graceful shutdown...')

    // Stop accepting new connections
    server.close(async (err) => {
      if (err) {
        logger.error({ err }, 'Error closing HTTP server')
        process.exit(1)
      }

      logger.info('HTTP server closed, no longer accepting connections')

      // Run cleanup if provided
      if (cleanup) {
        try {
          logger.info('Running cleanup tasks...')
          await cleanup()
          logger.info('Cleanup completed successfully')
        } catch (cleanupErr) {
          logger.error({ err: cleanupErr }, 'Error during cleanup')
        }
      }

      logger.info('Graceful shutdown complete, exiting')
      process.exit(0)
    })

    // Force exit after timeout
    setTimeout(() => {
      logger.error(
        { timeoutMs: env.SHUTDOWN_TIMEOUT_MS },
        'Graceful shutdown timeout exceeded, forcing exit'
      )
      process.exit(1)
    }, env.SHUTDOWN_TIMEOUT_MS)
  }

  // Handle termination signals
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  // Handle uncaught errors
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception, shutting down')
    shutdown('uncaughtException')
  })

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled rejection, shutting down')
    shutdown('unhandledRejection')
  })

  logger.debug('Graceful shutdown handlers registered')
}

/**
 * Middleware to reject new requests during shutdown
 */
export function shutdownMiddleware(
  req: { path: string },
  res: { status: (code: number) => { json: (body: unknown) => void } },
  next: () => void
): void {
  if (isShuttingDown) {
    // Allow health checks to report unhealthy during shutdown
    if (req.path === '/api/v1/health') {
      return next()
    }

    res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Server is shutting down',
      },
    })
    return
  }
  next()
}
