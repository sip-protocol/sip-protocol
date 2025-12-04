import { Router, Request, Response } from 'express'
import type { HealthResponse, ApiResponse } from '../types/api'
import { isServerShuttingDown } from '../shutdown'

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
router.get('/', (req: Request, res: Response) => {
  const shuttingDown = isServerShuttingDown()
  const status = shuttingDown ? 'shutting_down' : 'healthy'
  const statusCode = shuttingDown ? 503 : 200

  const response: ApiResponse<HealthResponse> = {
    success: !shuttingDown,
    data: {
      status: status as 'healthy',
      version: process.env.npm_package_version || '0.1.0',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
    },
  }

  res.status(statusCode).json(response)
})

export default router
