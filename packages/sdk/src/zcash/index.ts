/**
 * Zcash Module
 *
 * Provides Zcash RPC client, shielded transaction support,
 * and cross-chain swap service for ETH/SOL → ZEC routes.
 */

// RPC Client
export { ZcashRPCClient, ZcashRPCError, createZcashClient } from './rpc-client'

// Shielded Service
export {
  ZcashShieldedService,
  createZcashShieldedService,
} from './shielded-service'

export type {
  ZcashShieldedServiceConfig,
  ShieldedSendParams,
  ShieldedSendResult,
  ReceivedNote,
  ShieldedBalance,
  ExportedViewingKey,
} from './shielded-service'

// Swap Service (ETH/SOL → ZEC)
export {
  ZcashSwapService,
  createZcashSwapService,
} from './swap-service'

export type {
  ZcashSwapServiceConfig,
  ZcashSwapSourceChain,
  ZcashSwapSourceToken,
  ZcashQuoteParams,
  ZcashQuote,
  ZcashSwapParams,
  ZcashSwapResult,
  ZcashSwapStatus,
  BridgeProvider,
  BridgeQuoteParams,
  BridgeQuote,
  BridgeSwapParams,
  BridgeSwapResult,
  PriceFeed,
} from './swap-service'

// Bridge Module (ETH/SOL → ZEC with shielding)
export { ZcashBridge, createZcashBridge } from './bridge'

export type {
  ZcashBridgeConfig,
  BridgeRoute,
  BridgeParams,
  BridgeResult,
  BridgeStatus,
} from './bridge'

// Re-export types from types package
export type {
  ZcashConfig,
  ZcashNetwork,
  ZcashAddressType,
  ZcashReceiverType,
  ZcashAddressInfo,
  ZcashNewAccount,
  ZcashAccountAddress,
  ZcashPoolBalance,
  ZcashAccountBalance,
  ZcashPool,
  ZcashUnspentNote,
  ZcashSendRecipient,
  ZcashPrivacyPolicy,
  ZcashShieldedSendParams,
  ZcashOperationStatus,
  ZcashOperationTxResult,
  ZcashOperationError,
  ZcashOperation,
  ZcashBlockHeader,
  ZcashBlock,
  ZcashRPCRequest,
  ZcashRPCResponse,
  ZcashBlockchainInfo,
  ZcashNetworkInfo,
} from '@sip-protocol/types'

export { ZcashErrorCode } from '@sip-protocol/types'
