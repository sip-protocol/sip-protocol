import { Router } from 'express'
import healthRouter from './health'
import stealthRouter from './stealth'
import commitmentRouter from './commitment'
import proofRouter from './proof'
import swapRouter from './swap'

const router: Router = Router()

// Mount routes
router.use('/health', healthRouter)
router.use('/stealth', stealthRouter)
router.use('/commitment', commitmentRouter)
router.use('/proof', proofRouter)
router.use('/quote', swapRouter)  // POST /quote
router.use('/swap', swapRouter)   // POST /swap and GET /swap/:id/status

export default router
