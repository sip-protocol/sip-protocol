/**
 * Wallet-specific errors for SIP SDK
 */

import { SIPError, ErrorCode } from '../errors'
import { WalletErrorCode, type WalletErrorCodeType } from '@sip-protocol/types'

/**
 * Error thrown by wallet adapters
 */
export class WalletError extends SIPError {
  readonly walletCode: WalletErrorCodeType

  constructor(
    message: string,
    walletCode: WalletErrorCodeType = WalletErrorCode.UNKNOWN,
    options?: { cause?: Error; context?: Record<string, unknown> }
  ) {
    super(message, ErrorCode.WALLET_ERROR, options)
    this.walletCode = walletCode
    this.name = 'WalletError'
  }

  /**
   * Check if this is a connection-related error
   */
  isConnectionError(): boolean {
    const codes: WalletErrorCodeType[] = [
      WalletErrorCode.NOT_INSTALLED,
      WalletErrorCode.CONNECTION_REJECTED,
      WalletErrorCode.CONNECTION_FAILED,
      WalletErrorCode.NOT_CONNECTED,
    ]
    return codes.includes(this.walletCode)
  }

  /**
   * Check if this is a signing-related error
   */
  isSigningError(): boolean {
    const codes: WalletErrorCodeType[] = [
      WalletErrorCode.SIGNING_REJECTED,
      WalletErrorCode.SIGNING_FAILED,
      WalletErrorCode.INVALID_MESSAGE,
    ]
    return codes.includes(this.walletCode)
  }

  /**
   * Check if this is a transaction-related error
   */
  isTransactionError(): boolean {
    const codes: WalletErrorCodeType[] = [
      WalletErrorCode.INSUFFICIENT_FUNDS,
      WalletErrorCode.TRANSACTION_REJECTED,
      WalletErrorCode.TRANSACTION_FAILED,
      WalletErrorCode.INVALID_TRANSACTION,
    ]
    return codes.includes(this.walletCode)
  }

  /**
   * Check if this is a privacy-related error
   */
  isPrivacyError(): boolean {
    const codes: WalletErrorCodeType[] = [
      WalletErrorCode.STEALTH_NOT_SUPPORTED,
      WalletErrorCode.VIEWING_KEY_NOT_SUPPORTED,
      WalletErrorCode.SHIELDED_NOT_SUPPORTED,
    ]
    return codes.includes(this.walletCode)
  }

  /**
   * Check if this error was caused by user rejection
   */
  isUserRejection(): boolean {
    const codes: WalletErrorCodeType[] = [
      WalletErrorCode.CONNECTION_REJECTED,
      WalletErrorCode.SIGNING_REJECTED,
      WalletErrorCode.TRANSACTION_REJECTED,
      WalletErrorCode.CHAIN_SWITCH_REJECTED,
    ]
    return codes.includes(this.walletCode)
  }
}

/**
 * Create a WalletError for not connected state
 */
export function notConnectedError(): WalletError {
  return new WalletError(
    'Wallet not connected. Call connect() first.',
    WalletErrorCode.NOT_CONNECTED
  )
}

/**
 * Create a WalletError for feature not supported
 */
export function featureNotSupportedError(
  feature: string,
  code: WalletErrorCodeType = WalletErrorCode.UNKNOWN
): WalletError {
  return new WalletError(`${feature} is not supported by this wallet`, code)
}
