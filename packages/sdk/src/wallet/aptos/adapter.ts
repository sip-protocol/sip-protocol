/**
 * Aptos Wallet Adapter
 *
 * Implementation of WalletAdapter for Aptos blockchain.
 * Supports Petra, Martian, Pontem, and other Aptos wallets.
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
  AptosWalletProvider,
  AptosAdapterConfig,
  AptosWalletName,
  AptosAccountInfo,
  AptosTransaction,
  AptosSignMessagePayload,
  AptosSignMessageResponse,
} from './types'
import {
  getAptosProvider,
  aptosPublicKeyToHex,
  getDefaultAptosRpcEndpoint,
} from './types'

/**
 * Aptos wallet adapter
 *
 * Provides SIP-compatible wallet interface for Aptos.
 * Works with Petra, Martian, Pontem, and other Aptos wallets.
 *
 * @example Browser usage with Petra
 * ```typescript
 * const wallet = new AptosWalletAdapter({ wallet: 'petra' })
 * await wallet.connect()
 *
 * const balance = await wallet.getBalance()
 * console.log(`Balance: ${balance} APT`)
 *
 * // Sign a message
 * const sig = await wallet.signMessage(new TextEncoder().encode('Hello'))
 * ```
 *
 * @example With custom RPC endpoint
 * ```typescript
 * const wallet = new AptosWalletAdapter({
 *   wallet: 'petra',
 *   network: 'testnet',
 *   rpcEndpoint: 'https://my-rpc.example.com',
 * })
 * ```
 */
export class AptosWalletAdapter extends BaseWalletAdapter {
  readonly chain = 'aptos' as const
  readonly name: string

  private provider: AptosWalletProvider | undefined
  private walletName: AptosWalletName
  private network: string
  private rpcEndpoint: string

  // Event handler references for cleanup
  private accountChangeHandler?: (account: AptosAccountInfo) => void
  private networkChangeHandler?: (network: { networkName: string }) => void
  private disconnectHandler?: () => void

  constructor(config: AptosAdapterConfig = {}) {
    super()
    this.walletName = config.wallet ?? 'petra'
    this.name = `aptos-${this.walletName}`
    this.network = config.network ?? 'mainnet'
    this.rpcEndpoint = config.rpcEndpoint ?? getDefaultAptosRpcEndpoint(this.network)

    // Allow injecting provider for testing
    if (config.provider) {
      this.provider = config.provider
    }
  }

  /**
   * Get the current Aptos network
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
   * Connect to the wallet
   */
  async connect(): Promise<void> {
    this._connectionState = 'connecting'

    try {
      // Get provider if not already set
      if (!this.provider) {
        this.provider = getAptosProvider(this.walletName)
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

      // Connect to wallet
      const account = await this.provider.connect()

      if (!account || !account.address) {
        throw new WalletError(
          'No account returned from wallet',
          WalletErrorCode.CONNECTION_FAILED
        )
      }

      // Set up event handlers
      this.setupEventHandlers()

      // Update state
      const address = account.address
      const hexPubKey = aptosPublicKeyToHex(account.publicKey)
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

    if (this.provider?.disconnect) {
      try {
        await this.provider.disconnect()
      } catch {
        // Ignore disconnect errors
      }
    }

    this.setDisconnected('User disconnected')
    this.provider = undefined
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
      const messageStr = new TextDecoder().decode(message)
      const nonce = Date.now().toString()

      const payload: AptosSignMessagePayload = {
        message: messageStr,
        nonce,
      }

      const response = await this.provider.signMessage(payload)

      return {
        signature: (response.signature.startsWith('0x')
          ? response.signature
          : `0x${response.signature}`) as HexString,
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
   * The transaction data should be an AptosTransaction
   */
  async signTransaction(tx: UnsignedTransaction): Promise<SignedTransaction> {
    this.requireConnected()

    if (!this.provider) {
      throw new WalletError('Provider not available', WalletErrorCode.NOT_CONNECTED)
    }

    try {
      const aptosTx = tx.data as AptosTransaction
      const signedBytes = await this.provider.signTransaction(aptosTx)

      return {
        unsigned: tx,
        signatures: [
          {
            signature: ('0x' + Buffer.from(signedBytes).toString('hex')) as HexString,
            publicKey: this._publicKey as HexString,
          },
        ],
        serialized: ('0x' + Buffer.from(signedBytes).toString('hex')) as HexString,
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
      const aptosTx = tx.data as AptosTransaction
      const response = await this.provider.signAndSubmitTransaction(aptosTx)

      return {
        txHash: (response.hash.startsWith('0x')
          ? response.hash
          : `0x${response.hash}`) as HexString,
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
   * Get native APT balance (in Octas - 1 APT = 100,000,000 Octas)
   */
  async getBalance(): Promise<bigint> {
    this.requireConnected()

    try {
      const response = await fetch(`${this.rpcEndpoint}/accounts/${this._address}/resource/0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>`)

      if (!response.ok) {
        throw new Error(`Failed to fetch balance: ${response.statusText}`)
      }

      const data = await response.json()
      const balance = data.data?.coin?.value ?? '0'

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

    if (asset.chain !== 'aptos') {
      throw new WalletError(
        `Asset chain ${asset.chain} not supported by Aptos adapter`,
        WalletErrorCode.UNSUPPORTED_CHAIN
      )
    }

    // Native APT
    if (!asset.address || asset.address === '0x1::aptos_coin::AptosCoin') {
      return this.getBalance()
    }

    try {
      const coinType = asset.address
      const response = await fetch(`${this.rpcEndpoint}/accounts/${this._address}/resource/0x1::coin::CoinStore<${coinType}>`)

      if (!response.ok) {
        // Resource might not exist (no balance)
        return 0n
      }

      const data = await response.json()
      const balance = data.data?.coin?.value ?? '0'

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
    if (!this.provider) return

    if (this.provider.onAccountChange) {
      this.accountChangeHandler = (account: AptosAccountInfo) => {
        const previousAddress = this._address
        const newAddress = account.address

        if (newAddress && newAddress !== previousAddress) {
          this._address = newAddress
          this._publicKey = aptosPublicKeyToHex(account.publicKey)
          this.emitAccountChanged(previousAddress, newAddress)
        }
      }
      this.provider.onAccountChange(this.accountChangeHandler)
    }

    if (this.provider.onNetworkChange) {
      this.networkChangeHandler = (network: { networkName: string }) => {
        const previousNetwork = this.network
        this.network = network.networkName
        // Update RPC endpoint if using default
        if (!this.rpcEndpoint.includes('example')) {
          this.rpcEndpoint = getDefaultAptosRpcEndpoint(this.network)
        }
      }
      this.provider.onNetworkChange(this.networkChangeHandler)
    }

    if (this.provider.onDisconnect) {
      this.disconnectHandler = () => {
        this.setDisconnected('Wallet disconnected')
      }
      this.provider.onDisconnect(this.disconnectHandler)
    }
  }

  /**
   * Clean up wallet event handlers
   */
  private cleanupEventHandlers(): void {
    // Note: Most Aptos wallets don't provide off() methods
    // Event handlers will be cleaned up when provider is set to undefined
    this.accountChangeHandler = undefined
    this.networkChangeHandler = undefined
    this.disconnectHandler = undefined
  }
}

/**
 * Create an Aptos wallet adapter with default configuration
 */
export function createAptosAdapter(
  config: AptosAdapterConfig = {}
): AptosWalletAdapter {
  return new AptosWalletAdapter(config)
}
