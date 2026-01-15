/**
 * Solana RPC Providers
 *
 * SIP is RPC-provider-agnostic — developers choose their preferred provider.
 *
 * @example
 * ```typescript
 * import { createProvider, scanForPayments } from '@sip-protocol/sdk'
 *
 * // Helius — efficient DAS queries (recommended for production)
 * const helius = createProvider('helius', {
 *   apiKey: process.env.HELIUS_API_KEY!
 * })
 *
 * // Generic — standard RPC, no API key needed
 * const generic = createProvider('generic', {
 *   endpoint: 'https://api.devnet.solana.com'
 * })
 *
 * // Same API, different backends
 * const payments = await scanForPayments({
 *   provider: helius,
 *   viewingPrivateKey,
 *   spendingPublicKey,
 * })
 * ```
 *
 * @packageDocumentation
 */

// Interface and factory
export {
  createProvider,
  type SolanaRPCProvider,
  type TokenAsset,
  type ProviderConfig,
  type ProviderType,
  type GenericProviderConfig,
} from './interface'

// Provider implementations
export { HeliusProvider, type HeliusProviderConfig } from './helius'
export { GenericProvider } from './generic'
export { QuickNodeProvider, type QuickNodeProviderConfig } from './quicknode'
export { TritonProvider, type TritonProviderConfig } from './triton'

// Webhook handler for real-time scanning
export {
  createWebhookHandler,
  processWebhookTransaction,
  verifyWebhookSignature,
  verifyAuthToken,
  type HeliusWebhookTransaction,
  type HeliusEnhancedTransaction,
  type HeliusWebhookPayload,
  type WebhookHandlerConfig,
  type WebhookProcessResult,
  type WebhookRequest,
  type WebhookHandler,
} from './webhook'

// Enhanced Transactions API for human-readable tx data
export {
  HeliusEnhanced,
  createHeliusEnhanced,
  type HeliusEnhancedConfig,
} from './helius-enhanced'

// Enhanced Transactions types
export type {
  EnhancedTransactionType,
  NativeTransfer,
  TokenTransfer,
  NftTransfer,
  SwapEvent,
  EnhancedTransactionEvents,
  EnhancedAccountData,
  EnhancedTransaction,
  ParseTransactionsOptions,
  GetTransactionHistoryOptions,
  PrivacyDisplayOptions,
  SIPTransactionMetadata,
  SIPEnhancedTransaction,
  TransactionSummary,
} from './helius-enhanced-types'
