/**
 * Network Adapters for SIP Protocol
 *
 * Provides integration with external networks and services.
 */

// NEAR Intents (1Click API)
export { OneClickClient } from './oneclick-client'
export {
  NEARIntentsAdapter,
  createNEARIntentsAdapter,
} from './near-intents'

export type {
  SwapRequest,
  PreparedSwap,
  SwapResult,
  NEARIntentsAdapterConfig,
} from './near-intents'
