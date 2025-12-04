/**
 * Prometheus Metrics Endpoint
 *
 * GET /metrics - Prometheus-compatible metrics
 */

import { Router, Request, Response } from 'express'
import { register } from '../monitoring'

const router: Router = Router()

/**
 * GET /metrics
 * Prometheus metrics endpoint
 *
 * Returns metrics in Prometheus text format for scraping
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    res.set('Content-Type', register.contentType)
    res.end(await register.metrics())
  } catch (err) {
    res.status(500).end()
  }
})

export default router
