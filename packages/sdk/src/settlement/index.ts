/**
 * Settlement Backend Abstraction Layer
 *
 * Provides a unified interface for multiple settlement backends (NEAR Intents, Zcash, THORChain, etc.)
 *
 * @module settlement
 */

export {
  SwapStatus,
  type SettlementBackendName,
  type QuoteParams,
  type Quote,
  type SwapRoute,
  type SwapRouteStep,
  type SwapParams,
  type SwapResult,
  type SwapStatusResponse,
  type BackendCapabilities,
  type SettlementBackend,
  type SettlementBackendFactory,
  type SettlementBackendRegistry,
} from './interface'

export {
  SettlementRegistry,
  SettlementRegistryError,
  type Route,
} from './registry'

// Router
export {
  SmartRouter,
  createSmartRouter,
  type RouteWithQuote,
  type QuoteComparison,
  type FindBestRouteParams,
} from './router'

// Circuit Breaker
export {
  CircuitBreaker,
  type CircuitState,
  type CircuitBreakerStatus,
  type CircuitBreakerEvents,
  type CircuitBreakerOptions,
} from './router'

// Backends
export {
  NEARIntentsBackend,
  createNEARIntentsBackend,
  ZcashNativeBackend,
  createZcashNativeBackend,
  type ZcashNativeBackendConfig,
} from './backends'
