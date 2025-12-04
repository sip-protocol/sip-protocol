/**
 * Monitoring Module
 *
 * Exports all monitoring functionality:
 * - Sentry error tracking
 * - Prometheus metrics
 */

export {
  initSentry,
  isSentryEnabled,
  captureException,
  captureMessage,
  setUser,
  setTags,
  setupSentryErrorHandler,
  sentryRequestHandler,
  sentryErrorHandler,
  flushSentry,
  Sentry,
} from './sentry'

export {
  register,
  httpRequestsTotal,
  httpRequestDuration,
  stealthAddressGenerations,
  commitmentCreations,
  proofGenerations,
  proofGenerationDuration,
  activeConnections,
  swapRequests,
  quoteRequests,
  metricsMiddleware,
  sipMetrics,
} from './metrics'
