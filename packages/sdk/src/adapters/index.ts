/**
 * Network Adapters for SIP Protocol
 *
 * Provides integration with external networks and services.
 *
 * ## Available Adapters
 *
 * ### Cross-Chain
 * - **NEARIntentsAdapter** — NEAR 1Click API for cross-chain swaps
 *
 * ### Solana DEX
 * - **JupiterAdapter** — Jupiter aggregator for private Solana swaps
 *
 * @example
 * ```typescript
 * import { JupiterAdapter, NEARIntentsAdapter } from '@sip-protocol/sdk'
 *
 * // Solana same-chain private swap
 * const jupiter = new JupiterAdapter()
 * const quote = await jupiter.getQuote({ inputMint: SOL, outputMint: USDC, amount: 1n })
 * const result = await jupiter.swapPrivate({ quote, wallet, recipientMetaAddress })
 *
 * // Cross-chain via NEAR Intents
 * const near = new NEARIntentsAdapter({ jwtToken })
 * const prepared = await near.prepareSwap(request, recipientMetaAddress)
 * ```
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

// Jupiter DEX (Solana)
export {
  JupiterAdapter,
  createJupiterAdapter,
  SOLANA_TOKEN_MINTS,
  JUPITER_API_ENDPOINT,
  SOLANA_RPC_ENDPOINTS,
} from './jupiter'

export type {
  JupiterAdapterConfig,
  JupiterQuoteRequest,
  JupiterQuote,
  JupiterSwapParams,
  JupiterPrivateSwapParams,
  JupiterSwapResult,
  JupiterPrivateSwapResult,
} from './jupiter'
