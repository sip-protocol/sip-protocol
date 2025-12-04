/**
 * Sui Wallet Adapter
 *
 * Implementation of WalletAdapter for Sui blockchain.
 * Supports Sui Wallet, Ethos, Suiet, and other Sui wallets.
 */

import type {
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
import type {
  SuiWalletProvider,
  SuiAdapterConfig,
  SuiWalletName,
  SuiAccountInfo,
  SuiTransactionBlock,
  SuiSignMessageInput,
} from './types'
import {
  getSuiProvider,
  suiPublicKeyToHex,
  getDefaultSuiRpcEndpoint,
} from './types'

/**
 * Sui wallet adapter
 *
 * Provides SIP-compatible wallet interface for Sui.
 * Works with Sui Wallet, Ethos, Suiet, and other Sui wallets.
 *
 * @example Browser usage with Sui Wallet
 * ```typescript
 * const wallet = new SuiWalletAdapter({ wallet: 'sui-wallet' })
 * await wallet.connect()
 *
 * const balance = await wallet.getBalance()
 * console.log(`Balance: ${balance} MIST`)
 *
 * // Sign a message
 * const sig = await wallet.signMessage(new TextEncoder().encode('Hello'))
 * ```
 *
 * @example With custom RPC endpoint
 * ```typescript
 * const wallet = new SuiWalletAdapter({
 *   wallet: 'sui-wallet',
 *   network: 'testnet',
 *   rpcEndpoint: 'https://my-rpc.example.com',
 * })
 * ```
 */
export class SuiWalletAdapter extends BaseWalletAdapter {
  readonly chain = 'sui' as const
  readonly name: string

  private provider: SuiWalletProvider | undefined
  private walletName: SuiWalletName
  private network: string
  private rpcEndpoint: string
  private accounts: SuiAccountInfo[] = []

  // Event handler references for cleanup
  private accountChangeHandler?: (...args: any[]) => void
  private disconnectHandler?: (...args: any[]) => void

  constructor(config: SuiAdapterConfig = {}) {
    super()
    this.walletName = config.wallet ?? 'sui-wallet'
    this.name = `sui-${this.walletName}`
    this.network = config.network ?? 'mainnet'
    this.rpcEndpoint = config.rpcEndpoint ?? getDefaultSuiRpcEndpoint(this.network)

    // Allow injecting provider for testing
    if (config.provider) {
      this.provider = config.provider
    }
  }

  /**
   * Get the current Sui network
   */
  getNetwork(): string {
    return this.network
  }

  /**
   * Get the RPC endpoint
   */
  getRpcEndpoint(): string {
    return this.rpcEndpoint
  }

  /**
   * Set the RPC endpoint
   */
  setRpcEndpoint(endpoint: string): void {
    this.rpcEndpoint = endpoint
  }

  /**
   * Get all connected accounts
   */
  getAccounts(): SuiAccountInfo[] {
    return [...this.accounts]
  }

  /**
   * Connect to the wallet
   */
  async connect(): Promise<void> {
    this._connectionState = 'connecting'

    try {
      // Get provider if not already set
      if (!this.provider) {
        this.provider = getSuiProvider(this.walletName)
      }

      if (!this.provider) {
        this.setError(
          WalletErrorCode.NOT_INSTALLED,
          `${this.walletName} wallet is not installed`
        )
        throw new WalletError(
          `${this.walletName} wallet is not installed`,
          WalletErrorCode.NOT_INSTALLED
        )
      }

      // Request permissions
      const hasPermissions = await this.provider.hasPermissions()
      if (!hasPermissions) {
        await this.provider.requestPermissions()
      }

      // Get accounts
      this.accounts = await this.provider.getAccounts()

      if (!this.accounts || this.accounts.length === 0) {
        throw new WalletError(
          'No accounts returned from wallet',
          WalletErrorCode.CONNECTION_FAILED
        )
      }

      // Set up event handlers
      this.setupEventHandlers()

      // Use first account
      const firstAccount = this.accounts[0]
      const address = firstAccount.address
      const hexPubKey = suiPublicKeyToHex(firstAccount.publicKey)
      this.setConnected(address, hexPubKey)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed'

      // Check if user rejected
      if (message.includes('User rejected') || message.includes('rejected') || message.includes('User disapproved')) {
        this.setError(WalletErrorCode.CONNECTION_REJECTED, message)
        throw new WalletError(message, WalletErrorCode.CONNECTION_REJECTED)
      }

      this.setError(WalletErrorCode.CONNECTION_FAILED, message)
      throw error instanceof WalletError
        ? error
        : new WalletError(message, WalletErrorCode.CONNECTION_FAILED, { cause: error as Error })
    }
  }

  /**
   * Disconnect from the wallet
   */
  async disconnect(): Promise<void> {
    this.cleanupEventHandlers()

    this.setDisconnected('User disconnected')
    this.provider = undefined
    this.accounts = []
  }

  /**
   * Sign a message
   */
  async signMessage(message: Uint8Array): Promise<Signature> {
    this.requireConnected()

    if (!this.provider) {
      throw new WalletError('Provider not available', WalletErrorCode.NOT_CONNECTED)
    }

    try {
      const input: SuiSignMessageInput = {
        message,
        account: this.accounts[0],
      }

      const response = await this.provider.signMessage(input)

      // Convert signature to hex if it's base64
      let signatureHex: string
      if (response.signature.startsWith('0x')) {
        signatureHex = response.signature
      } else {
        // Assume base64
        const sigBytes = Buffer.from(response.signature, 'base64')
        signatureHex = `0x${sigBytes.toString('hex')}`
      }

      return {
        signature: signatureHex as HexString,
        publicKey: this._publicKey as HexString,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Signing failed'

      if (message.includes('User rejected') || message.includes('rejected') || message.includes('User disapproved')) {
        throw new WalletError(message, WalletErrorCode.SIGNING_REJECTED)
      }

      throw new WalletError(message, WalletErrorCode.SIGNING_FAILED, {
        cause: error as Error,
      })
    }
  }

  /**
   * Sign a transaction
   *
   * The transaction data should be a SuiTransactionBlock
   */
  async signTransaction(tx: UnsignedTransaction): Promise<SignedTransaction> {
    this.requireConnected()

    if (!this.provider) {
      throw new WalletError('Provider not available', WalletErrorCode.NOT_CONNECTED)
    }

    try {
      const suiTx = tx.data as SuiTransactionBlock
      const signedTx = await this.provider.signTransactionBlock({
        transactionBlock: suiTx,
        account: this.accounts[0],
      })

      // Convert signature to hex
      let signatureHex: string
      if (signedTx.signature.startsWith('0x')) {
        signatureHex = signedTx.signature
      } else {
        const sigBytes = Buffer.from(signedTx.signature, 'base64')
        signatureHex = `0x${sigBytes.toString('hex')}`
      }

      // Convert transaction bytes to hex
      let txBytesHex: string
      if (signedTx.transactionBlockBytes.startsWith('0x')) {
        txBytesHex = signedTx.transactionBlockBytes
      } else {
        const txBytes = Buffer.from(signedTx.transactionBlockBytes, 'base64')
        txBytesHex = `0x${txBytes.toString('hex')}`
      }

      return {
        unsigned: tx,
        signatures: [
          {
            signature: signatureHex as HexString,
            publicKey: this._publicKey as HexString,
          },
        ],
        serialized: txBytesHex as HexString,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Signing failed'

      if (message.includes('User rejected') || message.includes('rejected') || message.includes('User disapproved')) {
        throw new WalletError(message, WalletErrorCode.SIGNING_REJECTED)
      }

      throw new WalletError(message, WalletErrorCode.SIGNING_FAILED, {
        cause: error as Error,
      })
    }
  }

  /**
   * Sign and send a transaction
   */
  async signAndSendTransaction(tx: UnsignedTransaction): Promise<TransactionReceipt> {
    this.requireConnected()

    if (!this.provider) {
      throw new WalletError('Provider not available', WalletErrorCode.NOT_CONNECTED)
    }

    try {
      const suiTx = tx.data as SuiTransactionBlock
      const response = await this.provider.signAndExecuteTransactionBlock({
        transactionBlock: suiTx,
        account: this.accounts[0],
      })

      return {
        txHash: (response.digest.startsWith('0x')
          ? response.digest
          : `0x${response.digest}`) as HexString,
        status: 'pending', // Transaction is sent but not confirmed yet
        timestamp: Date.now(),
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Transaction failed'

      if (message.includes('User rejected') || message.includes('rejected') || message.includes('User disapproved')) {
        throw new WalletError(message, WalletErrorCode.TRANSACTION_REJECTED)
      }

      if (message.includes('insufficient') || message.includes('Insufficient')) {
        throw new WalletError(message, WalletErrorCode.INSUFFICIENT_FUNDS)
      }

      throw new WalletError(message, WalletErrorCode.TRANSACTION_FAILED, {
        cause: error as Error,
      })
    }
  }

  /**
   * Get native SUI balance (in MIST - 1 SUI = 1,000,000,000 MIST)
   */
  async getBalance(): Promise<bigint> {
    this.requireConnected()

    try {
      const response = await fetch(this.rpcEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'suix_getBalance',
          params: [this._address],
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch balance: ${response.statusText}`)
      }

      const data = await response.json()
      const balance = data.result?.totalBalance ?? '0'

      return BigInt(balance)
    } catch (error) {
      throw new WalletError(
        'Failed to get balance',
        WalletErrorCode.UNKNOWN,
        { cause: error as Error }
      )
    }
  }

  /**
   * Get token balance for a specific coin type
   */
  async getTokenBalance(asset: Asset): Promise<bigint> {
    this.requireConnected()

    if (asset.chain !== 'sui') {
      throw new WalletError(
        `Asset chain ${asset.chain} not supported by Sui adapter`,
        WalletErrorCode.UNSUPPORTED_CHAIN
      )
    }

    // Native SUI
    if (!asset.address || asset.address === '0x2::sui::SUI') {
      return this.getBalance()
    }

    try {
      const coinType = asset.address
      const response = await fetch(this.rpcEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'suix_getBalance',
          params: [this._address, coinType],
        }),
      })

      if (!response.ok) {
        return 0n
      }

      const data = await response.json()
      const balance = data.result?.totalBalance ?? '0'

      return BigInt(balance)
    } catch {
      // Token account might not exist
      return 0n
    }
  }

  /**
   * Set up wallet event handlers
   */
  private setupEventHandlers(): void {
    if (!this.provider?.on) return

    this.accountChangeHandler = (accounts: SuiAccountInfo[]) => {
      if (!accounts || accounts.length === 0) {
        this.setDisconnected('Account changed')
        return
      }

      const previousAddress = this._address
      const newAccount = accounts[0]
      const newAddress = newAccount.address

      if (newAddress && newAddress !== previousAddress) {
        this.accounts = accounts
        this._address = newAddress
        this._publicKey = suiPublicKeyToHex(newAccount.publicKey)
        this.emitAccountChanged(previousAddress, newAddress)
      }
    }
    this.provider.on('accountChanged', this.accountChangeHandler)

    this.disconnectHandler = () => {
      this.setDisconnected('Wallet disconnected')
    }
    this.provider.on('disconnect', this.disconnectHandler)
  }

  /**
   * Clean up wallet event handlers
   */
  private cleanupEventHandlers(): void {
    if (!this.provider?.off) return

    if (this.accountChangeHandler) {
      this.provider.off('accountChanged', this.accountChangeHandler)
    }
    if (this.disconnectHandler) {
      this.provider.off('disconnect', this.disconnectHandler)
    }

    this.accountChangeHandler = undefined
    this.disconnectHandler = undefined
  }
}

/**
 * Create a Sui wallet adapter with default configuration
 */
export function createSuiAdapter(
  config: SuiAdapterConfig = {}
): SuiWalletAdapter {
  return new SuiWalletAdapter(config)
}
