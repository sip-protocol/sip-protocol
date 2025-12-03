import express, { Express } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import router from './routes'
import { errorHandler, notFoundHandler } from './middleware'

const app: Express = express()

// Environment configuration
const PORT = process.env.PORT || 3000
const NODE_ENV = process.env.NODE_ENV || 'development'
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'

// Security middleware
app.use(helmet())
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
}))

// Body parsing middleware
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

// Compression middleware
app.use(compression())

// Logging middleware
app.use(morgan(NODE_ENV === 'development' ? 'dev' : 'combined'))

// API routes
app.use('/api/v1', router)

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: '@sip-protocol/api',
    version: '0.1.0',
    description: 'REST API service for SIP Protocol SDK',
    documentation: '/api/v1/health',
    endpoints: {
      health: 'GET /api/v1/health',
      stealth: 'POST /api/v1/stealth/generate',
      commitment: 'POST /api/v1/commitment/create',
      proof: 'POST /api/v1/proof/funding',
      quote: 'POST /api/v1/quote',
      swap: 'POST /api/v1/swap',
      swapStatus: 'GET /api/v1/swap/:id/status',
    },
  })
})

// 404 handler
app.use(notFoundHandler)

// Error handler (must be last)
app.use(errorHandler)

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════╗
║  SIP Protocol REST API                             ║
║  Version: 0.1.0                                    ║
║  Port: ${PORT}                                         ║
║  Environment: ${NODE_ENV}                              ║
║  Documentation: http://localhost:${PORT}/              ║
╚════════════════════════════════════════════════════╝
    `)
  })
}

export default app
