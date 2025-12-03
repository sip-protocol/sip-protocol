/**
 * Ledger Hardware Wallet Adapter
 *
 * Provides integration with Ledger hardware wallets (Nano S, Nano X, etc.)
 * for secure transaction signing.
 *
 * @example
 * ```typescript
 * import { LedgerWalletAdapter } from '@sip-protocol/sdk'
 *
 * const ledger = new LedgerWalletAdapter({
 *   chain: 'ethereum',
 *   accountIndex: 0,
 * })
 *
 * await ledger.connect()
 * const signature = await ledger.signMessage(message)
 * ```
 *
 * @remarks
 * Requires Ledger device with appropriate app installed:
 * - Ethereum: Ethereum app
 * - Solana: Solana app
 *
 * External dependencies (install separately):
 * - @ledgerhq/hw-transport-webusb
 * - @ledgerhq/hw-app-eth (for Ethereum)
 * - @ledgerhq/hw-app-solana (for Solana)
 */

import type {
  ChainId,
  HexString,
  Asset,
  Signature,
  UnsignedTransaction,
  SignedTransaction,
  TransactionReceipt,
} from '@sip-protocol/types'
import { WalletErrorCode } from '@sip-protocol/types'
import { BaseWalletAdapter } from '../base-adapter'
import { WalletError } from '../errors'
import {
  type LedgerConfig,
  type HardwareDeviceInfo,
  type HardwareAccount,
  type HardwareSignature,
  type HardwareEthereumTx,
  type HardwareTransport,
  HardwareErrorCode,
  HardwareWalletError,
  getDerivationPath,
  supportsWebUSB,
} from './types'

/**
 * Ledger wallet adapter
 *
 * Supports Ethereum and Solana chains via Ledger device apps.
 */
export class LedgerWalletAdapter extends BaseWalletAdapter {
  readonly chain: ChainId
  readonly name: string = 'ledger'

  private config: LedgerConfig
  private transport: HardwareTransport | null = null
  private app: LedgerApp | null = null
  private _derivationPath: string
  private _deviceInfo: HardwareDeviceInfo | null = null
  private _account: HardwareAccount | null = null

  constructor(config: LedgerConfig) {
    super()
    this.chain = config.chain
    this.config = {
      accountIndex: 0,
      timeout: 30000,
      ...config,
    }
    this._derivationPath = config.derivationPath ??
      getDerivationPath(config.chain, config.accountIndex ?? 0)
  }

  /**
   * Get device information
   */
  get deviceInfo(): HardwareDeviceInfo | null {
    return this._deviceInfo
  }

  /**
   * Get current derivation path
   */
  get derivationPath(): string {
    return this._derivationPath
  }

  /**
   * Get current account
   */
  get account(): HardwareAccount | null {
    return this._account
  }

  /**
   * Connect to Ledger device
   */
  async connect(): Promise<void> {
    if (!supportsWebUSB()) {
      throw new HardwareWalletError(
        'WebUSB not supported in this browser',
        HardwareErrorCode.TRANSPORT_ERROR,
        'ledger'
      )
    }

    this._connectionState = 'connecting'

    try {
      // Dynamic import of Ledger transport
      // Users must install @ledgerhq/hw-transport-webusb
      const TransportWebUSB = await this.loadTransport()

      // Open transport
      this.transport = await TransportWebUSB.create() as unknown as HardwareTransport

      // Load appropriate app
      this.app = await this.loadApp()

      // Get account from device
      this._account = await this.getAccountFromDevice()

      this._deviceInfo = {
        manufacturer: 'ledger',
        model: 'unknown', // Would be detected from transport
        isLocked: false,
        currentApp: this.getAppName(),
      }

      this.setConnected(this._account.address, this._account.publicKey)
    } catch (error) {
      this._connectionState = 'error'
      throw this.handleError(error)
    }
  }

  /**
   * Disconnect from Ledger device
   */
  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.transport.close()
      this.transport = null
    }
    this.app = null
    this._account = null
    this._deviceInfo = null
    this.setDisconnected()
  }

  /**
   * Sign a message
   */
  async signMessage(message: Uint8Array): Promise<Signature> {
    this.requireConnected()

    if (!this.app) {
      throw new HardwareWalletError(
        'Ledger app not loaded',
        HardwareErrorCode.APP_NOT_OPEN,
        'ledger'
      )
    }

    try {
      const sig = await this.signMessageOnDevice(message)

      return {
        signature: sig.signature,
        publicKey: this._account!.publicKey,
      }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Sign a transaction
   */
  async signTransaction(tx: UnsignedTransaction): Promise<SignedTransaction> {
    this.requireConnected()

    if (!this.app) {
      throw new HardwareWalletError(
        'Ledger app not loaded',
        HardwareErrorCode.APP_NOT_OPEN,
        'ledger'
      )
    }

    try {
      const sig = await this.signTransactionOnDevice(tx)

      return {
        unsigned: tx,
        signatures: [
          {
            signature: sig.signature,
            publicKey: this._account!.publicKey,
          },
        ],
        serialized: sig.signature, // Actual implementation would serialize properly
      }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Sign and send transaction
   *
   * Note: Hardware wallets can only sign, not send. This returns a signed
   * transaction that must be broadcast separately.
   */
  async signAndSendTransaction(tx: UnsignedTransaction): Promise<TransactionReceipt> {
    // Hardware wallets can't send transactions directly
    // Sign and return as if pending broadcast
    const signed = await this.signTransaction(tx)

    // Return mock receipt - actual sending requires RPC/network
    return {
      txHash: signed.serialized.slice(0, 66) as HexString,
      status: 'pending',
    }
  }

  /**
   * Get native token balance
   *
   * Note: Hardware wallets don't track balances - this requires RPC.
   */
  async getBalance(): Promise<bigint> {
    throw new WalletError(
      'Hardware wallets do not track balances. Use an RPC provider.',
      WalletErrorCode.UNSUPPORTED_OPERATION
    )
  }

  /**
   * Get token balance
   *
   * Note: Hardware wallets don't track balances - this requires RPC.
   */
  async getTokenBalance(_asset: Asset): Promise<bigint> {
    throw new WalletError(
      'Hardware wallets do not track balances. Use an RPC provider.',
      WalletErrorCode.UNSUPPORTED_OPERATION
    )
  }

  // ─── Account Management ─────────────────────────────────────────────────────

  /**
   * Get multiple accounts from device
   */
  async getAccounts(startIndex: number = 0, count: number = 5): Promise<HardwareAccount[]> {
    this.requireConnected()

    const accounts: HardwareAccount[] = []

    for (let i = startIndex; i < startIndex + count; i++) {
      const path = getDerivationPath(this.chain, i)
      const account = await this.getAccountAtPath(path, i)
      accounts.push(account)
    }

    return accounts
  }

  /**
   * Switch to different account index
   */
  async switchAccount(accountIndex: number): Promise<HardwareAccount> {
    this.requireConnected()

    this._derivationPath = getDerivationPath(this.chain, accountIndex)
    this._account = await this.getAccountFromDevice()

    const previousAddress = this._address
    this.setConnected(this._account.address, this._account.publicKey)

    if (previousAddress !== this._account.address) {
      this.emitAccountChanged(previousAddress, this._account.address)
    }

    return this._account
  }

  // ─── Private Methods ────────────────────────────────────────────────────────

  /**
   * Load WebUSB transport dynamically
   */
  private async loadTransport(): Promise<TransportWebUSBType> {
    try {
      const module = await import('@ledgerhq/hw-transport-webusb')
      return module.default as unknown as TransportWebUSBType
    } catch {
      throw new HardwareWalletError(
        'Failed to load Ledger transport. Install @ledgerhq/hw-transport-webusb',
        HardwareErrorCode.TRANSPORT_ERROR,
        'ledger'
      )
    }
  }

  /**
   * Load chain-specific Ledger app
   */
  private async loadApp(): Promise<LedgerApp> {
    if (!this.transport) {
      throw new HardwareWalletError(
        'Transport not connected',
        HardwareErrorCode.TRANSPORT_ERROR,
        'ledger'
      )
    }

    try {
      if (this.chain === 'ethereum') {
        // @ts-expect-error - Dynamic import
        const module = await import('@ledgerhq/hw-app-eth')
        return new module.default(this.transport)
      } else if (this.chain === 'solana') {
        // @ts-expect-error - Dynamic import
        const module = await import('@ledgerhq/hw-app-solana')
        return new module.default(this.transport)
      } else {
        throw new HardwareWalletError(
          `Chain ${this.chain} not supported by Ledger adapter`,
          HardwareErrorCode.UNSUPPORTED,
          'ledger'
        )
      }
    } catch (error) {
      if (error instanceof HardwareWalletError) throw error

      throw new HardwareWalletError(
        `Failed to load Ledger app. Install @ledgerhq/hw-app-${this.chain}`,
        HardwareErrorCode.APP_NOT_OPEN,
        'ledger',
        error
      )
    }
  }

  /**
   * Get app name for current chain
   */
  private getAppName(): string {
    switch (this.chain) {
      case 'ethereum':
        return 'Ethereum'
      case 'solana':
        return 'Solana'
      default:
        return 'Unknown'
    }
  }

  /**
   * Get account from device at current derivation path
   */
  private async getAccountFromDevice(): Promise<HardwareAccount> {
    return this.getAccountAtPath(this._derivationPath, this.config.accountIndex ?? 0)
  }

  /**
   * Get account at specific derivation path
   */
  private async getAccountAtPath(path: string, index: number): Promise<HardwareAccount> {
    if (!this.app) {
      throw new HardwareWalletError(
        'App not loaded',
        HardwareErrorCode.APP_NOT_OPEN,
        'ledger'
      )
    }

    try {
      if (this.chain === 'ethereum') {
        const ethApp = this.app as EthApp
        const { address, publicKey } = await ethApp.getAddress(path)
        return {
          address,
          publicKey: `0x${publicKey}` as HexString,
          derivationPath: path,
          index,
          chain: this.chain,
        }
      } else if (this.chain === 'solana') {
        const solApp = this.app as unknown as SolanaApp
        const { address } = await solApp.getAddress(path)
        return {
          address: address.toString(),
          publicKey: address.toString() as HexString, // Base58 for Solana
          derivationPath: path,
          index,
          chain: this.chain,
        }
      }

      throw new HardwareWalletError(
        `Unsupported chain: ${this.chain}`,
        HardwareErrorCode.UNSUPPORTED,
        'ledger'
      )
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Sign message on device
   */
  private async signMessageOnDevice(message: Uint8Array): Promise<HardwareSignature> {
    if (this.chain === 'ethereum') {
      const ethApp = this.app as EthApp
      const messageHex = Buffer.from(message).toString('hex')
      const result = await ethApp.signPersonalMessage(this._derivationPath, messageHex)

      return {
        r: `0x${result.r}` as HexString,
        s: `0x${result.s}` as HexString,
        v: result.v,
        signature: `0x${result.r}${result.s}${result.v.toString(16).padStart(2, '0')}` as HexString,
      }
    }

    if (this.chain === 'solana') {
      const solApp = this.app as unknown as SolanaApp
      const result = await solApp.signOffchainMessage(this._derivationPath, message)

      return {
        r: '0x' as HexString,
        s: '0x' as HexString,
        v: 0,
        signature: `0x${Buffer.from(result.signature).toString('hex')}` as HexString,
      }
    }

    throw new HardwareWalletError(
      `Message signing not supported for ${this.chain}`,
      HardwareErrorCode.UNSUPPORTED,
      'ledger'
    )
  }

  /**
   * Sign transaction on device
   */
  private async signTransactionOnDevice(tx: UnsignedTransaction): Promise<HardwareSignature> {
    if (this.chain === 'ethereum') {
      const ethApp = this.app as EthApp
      const ethTx = tx.data as HardwareEthereumTx

      // Build raw transaction for signing
      const rawTx = this.buildRawEthereumTx(ethTx)
      const result = await ethApp.signTransaction(this._derivationPath, rawTx)

      return {
        r: `0x${result.r}` as HexString,
        s: `0x${result.s}` as HexString,
        v: parseInt(result.v, 16),
        signature: `0x${result.r}${result.s}${result.v}` as HexString,
      }
    }

    if (this.chain === 'solana') {
      const solApp = this.app as unknown as SolanaApp
      const txData = tx.data as Uint8Array
      const result = await solApp.signTransaction(this._derivationPath, txData)

      return {
        r: '0x' as HexString,
        s: '0x' as HexString,
        v: 0,
        signature: `0x${Buffer.from(result.signature).toString('hex')}` as HexString,
      }
    }

    throw new HardwareWalletError(
      `Transaction signing not supported for ${this.chain}`,
      HardwareErrorCode.UNSUPPORTED,
      'ledger'
    )
  }

  /**
   * Build raw Ethereum transaction for Ledger signing
   */
  private buildRawEthereumTx(tx: HardwareEthereumTx): string {
    // Simplified - actual implementation would use RLP encoding
    // This is a placeholder for the structure
    const fields = [
      tx.nonce,
      tx.gasPrice ?? tx.maxFeePerGas ?? '0x0',
      tx.gasLimit,
      tx.to,
      tx.value,
      tx.data ?? '0x',
    ]

    return fields.join('').replace(/0x/g, '')
  }

  /**
   * Handle and transform errors
   */
  private handleError(error: unknown): Error {
    if (error instanceof HardwareWalletError) {
      return error
    }

    if (error instanceof WalletError) {
      return error
    }

    const err = error as { statusCode?: number; message?: string; name?: string }

    // Ledger-specific error codes
    if (err.statusCode) {
      switch (err.statusCode) {
        case 0x6985: // User rejected
          return new HardwareWalletError(
            'Transaction rejected on device',
            HardwareErrorCode.USER_REJECTED,
            'ledger'
          )
        case 0x6a80: // Invalid data
          return new HardwareWalletError(
            'Invalid transaction data',
            HardwareErrorCode.TRANSPORT_ERROR,
            'ledger'
          )
        case 0x6b00: // Wrong app
          return new HardwareWalletError(
            `Please open the ${this.getAppName()} app on your Ledger`,
            HardwareErrorCode.APP_NOT_OPEN,
            'ledger'
          )
        case 0x6f00: // Technical error
          return new HardwareWalletError(
            'Device error. Try reconnecting.',
            HardwareErrorCode.TRANSPORT_ERROR,
            'ledger'
          )
      }
    }

    // Generic errors
    if (err.name === 'TransportOpenUserCancelled') {
      return new HardwareWalletError(
        'Device selection cancelled',
        HardwareErrorCode.USER_REJECTED,
        'ledger'
      )
    }

    if (err.message?.includes('No device selected')) {
      return new HardwareWalletError(
        'No Ledger device selected',
        HardwareErrorCode.DEVICE_NOT_FOUND,
        'ledger'
      )
    }

    return new HardwareWalletError(
      err.message ?? 'Unknown Ledger error',
      HardwareErrorCode.TRANSPORT_ERROR,
      'ledger',
      error
    )
  }
}

// ─── Type Stubs for Dynamic Imports ───────────────────────────────────────────

/**
 * Stub type for @ledgerhq/hw-transport-webusb
 */
interface TransportWebUSBType {
  create(): Promise<HardwareTransport>
}

/**
 * Generic Ledger app interface
 */
interface LedgerApp {
  getAddress(path: string): Promise<{ address: string; publicKey: string }>
}

/**
 * Ethereum Ledger app interface
 */
interface EthApp extends LedgerApp {
  signPersonalMessage(path: string, messageHex: string): Promise<{ r: string; s: string; v: number }>
  signTransaction(path: string, rawTx: string): Promise<{ r: string; s: string; v: string }>
}

/**
 * Solana Ledger app interface
 */
interface SolanaApp {
  getAddress(path: string): Promise<{ address: Uint8Array }>
  signTransaction(path: string, transaction: Uint8Array): Promise<{ signature: Uint8Array }>
  signOffchainMessage(path: string, message: Uint8Array): Promise<{ signature: Uint8Array }>
}

// ─── Factory Function ─────────────────────────────────────────────────────────

/**
 * Create a Ledger wallet adapter
 */
export function createLedgerAdapter(config: LedgerConfig): LedgerWalletAdapter {
  return new LedgerWalletAdapter(config)
}
