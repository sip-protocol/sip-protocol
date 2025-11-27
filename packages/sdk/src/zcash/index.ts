/**
 * Zcash Module
 *
 * Provides Zcash RPC client and shielded transaction support.
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
