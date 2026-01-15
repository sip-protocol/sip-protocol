import { Router, Request, Response } from 'express'
import type { HealthResponse, ApiResponse } from '../types/api'
import { isServerShuttingDown } from '../shutdown'
import { getProofProviderStatus } from './proof'

const router: Router = Router()

const startTime = Date.now()

/**
 * GET /health
 * Health check endpoint
 *
 * @openapi
 * /health:
 *   get:
 *     summary: Health check
 *     description: Check if the API service is running
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [healthy]
 *                     version:
 *                       type: string
 *                     timestamp:
 *                       type: string
 *                     uptime:
 *                       type: number
 */
router.get('/', (_req: Request, res: Response) => {
  const shuttingDown = isServerShuttingDown()
  const proofStatus = getProofProviderStatus()

  // Health is determined by both server state and proof provider readiness
  const isHealthy = !shuttingDown && proofStatus.ready
  const status = shuttingDown ? 'shutting_down' : (proofStatus.ready ? 'healthy' : 'not_ready')
  const statusCode = isHealthy ? 200 : 503

  const response: ApiResponse<HealthResponse & { proofProvider?: ReturnType<typeof getProofProviderStatus> }> = {
    success: isHealthy,
    data: {
      status: status as 'healthy',
      version: process.env.npm_package_version || '0.1.0',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      proofProvider: proofStatus,
    },
  }

  res.status(statusCode).json(response)
})

/**
 * GET /health/live
 * Kubernetes-style liveness probe - always returns OK if process is running
 */
router.get('/live', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'alive',
      timestamp: new Date().toISOString(),
    },
  })
})

/**
 * GET /health/ready
 * Kubernetes-style readiness probe - returns OK only if all dependencies ready
 */
router.get('/ready', (_req: Request, res: Response) => {
  const proofStatus = getProofProviderStatus()
  const shuttingDown = isServerShuttingDown()
  const isReady = !shuttingDown && proofStatus.ready

  if (!isReady) {
    return res.status(503).json({
      success: false,
      data: {
        status: 'not_ready',
        reason: shuttingDown ? 'shutting_down' : 'proof_provider_initializing',
        proofProvider: proofStatus,
      },
    })
  }

  res.json({
    success: true,
    data: {
      status: 'ready',
      proofProvider: proofStatus,
    },
  })
})

export default router
