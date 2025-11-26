/**
 * Zcash Module
 *
 * Provides Zcash RPC client and shielded transaction support.
 */

export { ZcashRPCClient, ZcashRPCError, createZcashClient } from './rpc-client'

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
