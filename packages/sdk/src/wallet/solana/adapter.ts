/**
 * Solana Wallet Adapter
 *
 * Implementation of WalletAdapter for Solana chain.
 * Supports Phantom, Solflare, Backpack, and generic Solana wallets.
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
  SolanaWalletProvider,
  SolanaAdapterConfig,
  SolanaWalletName,
  SolanaCluster,
  SolanaTransaction,
  SolanaVersionedTransaction,
  SolanaConnection,
  SolanaSendOptions,
} from './types'
import {
  getSolanaProvider,
  solanaPublicKeyToHex,
} from './types'

/**
 * Default RPC endpoints for Solana clusters
 */
const DEFAULT_RPC_ENDPOINTS: Record<SolanaCluster, string> = {
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
  'testnet': 'https://api.testnet.solana.com',
  'devnet': 'https://api.devnet.solana.com',
  'localnet': 'http://localhost:8899',
}

/**
 * Solana wallet adapter
 *
 * Provides SIP-compatible wallet interface for Solana.
 * Works with Phantom, Solflare, Backpack, and other Solana wallets.
 *
 * @example Browser usage with Phantom
 * ```typescript
 * const wallet = new SolanaWalletAdapter({ wallet: 'phantom' })
 * await wallet.connect()
 *
 * const balance = await wallet.getBalance()
 * console.log(`Balance: ${balance} lamports`)
 *
 * // Sign a message
 * const sig = await wallet.signMessage(new TextEncoder().encode('Hello'))
 * ```
 *
 * @example With custom RPC endpoint
 * ```typescript
 * const wallet = new SolanaWalletAdapter({
 *   wallet: 'phantom',
 *   cluster: 'devnet',
 *   rpcEndpoint: 'https://my-rpc.example.com',
 * })
 * ```
 */
export class SolanaWalletAdapter extends BaseWalletAdapter {
  readonly chain = 'solana' as const
  readonly name: string

  private provider: SolanaWalletProvider | undefined
  private connection: SolanaConnection | undefined
  private walletName: SolanaWalletName
  private cluster: SolanaCluster
  private rpcEndpoint: string

  // Event handler references for cleanup
  private connectHandler?: () => void
  private disconnectHandler?: () => void
  private accountChangedHandler?: (pubkey: unknown) => void

  constructor(config: SolanaAdapterConfig = {}) {
    super()
    this.walletName = config.wallet ?? 'phantom'
    this.name = `solana-${this.walletName}`
    this.cluster = config.cluster ?? 'mainnet-beta'
    this.rpcEndpoint = config.rpcEndpoint ?? DEFAULT_RPC_ENDPOINTS[this.cluster]

    // Allow injecting provider/connection for testing
    if (config.provider) {
      this.provider = config.provider
    }
    if (config.connection) {
      this.connection = config.connection
    }
  }

  /**
   * Get the current Solana cluster
   */
  getCluster(): SolanaCluster {
    return this.cluster
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
    // Clear connection so it's recreated with new endpoint
    this.connection = undefined
  }

  /**
   * Get or create a connection for RPC calls
   */
  private async getConnection(): Promise<SolanaConnection> {
    if (this.connection) return this.connection

    // Create a minimal fetch-based connection
    this.connection = createMinimalConnection(this.rpcEndpoint)
    return this.connection
  }

  /**
   * Connect to the wallet
   */
  async connect(): Promise<void> {
    this._connectionState = 'connecting'

    try {
      // Get provider if not already set
      if (!this.provider) {
        this.provider = getSolanaProvider(this.walletName)
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
      const { publicKey } = await this.provider.connect()

      if (!publicKey) {
        throw new WalletError(
          'No public key returned from wallet',
          WalletErrorCode.CONNECTION_FAILED
        )
      }

      // Set up event handlers
      this.setupEventHandlers()

      // Update state
      const address = publicKey.toBase58()
      const hexPubKey = solanaPublicKeyToHex(publicKey)
      this.setConnected(address, hexPubKey)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed'

      // Check if user rejected
      if (message.includes('User rejected') || message.includes('rejected')) {
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
      const { signature } = await this.provider.signMessage(message)

      return {
        signature: ('0x' + Buffer.from(signature).toString('hex')) as HexString,
        publicKey: this._publicKey as HexString,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Signing failed'

      if (message.includes('User rejected') || message.includes('rejected')) {
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
   * The transaction data should be a SolanaTransaction or SolanaVersionedTransaction
   */
  async signTransaction(tx: UnsignedTransaction): Promise<SignedTransaction> {
    this.requireConnected()

    if (!this.provider) {
      throw new WalletError('Provider not available', WalletErrorCode.NOT_CONNECTED)
    }

    try {
      const solTx = tx.data as SolanaTransaction | SolanaVersionedTransaction
      const signed = await this.provider.signTransaction(solTx)
      const serialized = signed.serialize()

      return {
        unsigned: tx,
        signatures: [
          {
            signature: ('0x' + Buffer.from(serialized).toString('hex')) as HexString,
            publicKey: this._publicKey as HexString,
          },
        ],
        serialized: ('0x' + Buffer.from(serialized).toString('hex')) as HexString,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Signing failed'

      if (message.includes('User rejected') || message.includes('rejected')) {
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
      const solTx = tx.data as SolanaTransaction | SolanaVersionedTransaction
      const sendOptions = tx.metadata?.sendOptions as SolanaSendOptions | undefined

      const { signature } = await this.provider.signAndSendTransaction(solTx, sendOptions)

      return {
        txHash: ('0x' + Buffer.from(signature).toString('hex')) as HexString,
        status: 'pending', // Transaction is sent but not confirmed yet
        timestamp: Date.now(),
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Transaction failed'

      if (message.includes('User rejected') || message.includes('rejected')) {
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
   * Sign multiple transactions at once
   *
   * Solana-specific method for batch signing
   */
  async signAllTransactions<T extends SolanaTransaction | SolanaVersionedTransaction>(
    transactions: T[]
  ): Promise<T[]> {
    this.requireConnected()

    if (!this.provider) {
      throw new WalletError('Provider not available', WalletErrorCode.NOT_CONNECTED)
    }

    try {
      return await this.provider.signAllTransactions(transactions)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Signing failed'

      if (message.includes('User rejected') || message.includes('rejected')) {
        throw new WalletError(message, WalletErrorCode.SIGNING_REJECTED)
      }

      throw new WalletError(message, WalletErrorCode.SIGNING_FAILED, {
        cause: error as Error,
      })
    }
  }

  /**
   * Get native SOL balance
   */
  async getBalance(): Promise<bigint> {
    this.requireConnected()

    try {
      const connection = await this.getConnection()
      const balance = await connection.getBalance({
        toBase58: () => this._address,
        toBytes: () => new Uint8Array(32),
        toString: () => this._address,
      })

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
   * Get SPL token balance
   */
  async getTokenBalance(asset: Asset): Promise<bigint> {
    this.requireConnected()

    if (asset.chain !== 'solana') {
      throw new WalletError(
        `Asset chain ${asset.chain} not supported by Solana adapter`,
        WalletErrorCode.UNSUPPORTED_CHAIN
      )
    }

    // Native SOL
    if (!asset.address) {
      return this.getBalance()
    }

    try {
      const connection = await this.getConnection()
      // For SPL tokens, we need to find the associated token account
      // This is a simplified implementation - real implementation would use
      // getAssociatedTokenAddress and handle missing accounts
      const result = await connection.getTokenAccountBalance({
        toBase58: () => asset.address as string,
        toBytes: () => new Uint8Array(32),
        toString: () => asset.address as string,
      })

      return BigInt(result.value.amount)
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

    this.connectHandler = () => {
      // Wallet reconnected
    }

    this.disconnectHandler = () => {
      this.setDisconnected('Wallet disconnected')
    }

    this.accountChangedHandler = (pubkey: unknown) => {
      if (pubkey && typeof (pubkey as { toBase58?: () => string }).toBase58 === 'function') {
        const newAddress = (pubkey as { toBase58: () => string }).toBase58()
        const previousAddress = this._address
        this._address = newAddress
        this._publicKey = solanaPublicKeyToHex(pubkey as { toBase58: () => string; toBytes: () => Uint8Array; toString: () => string })
        this.emitAccountChanged(previousAddress, newAddress)
      } else {
        // Account changed to null = disconnected
        this.setDisconnected('Account changed')
      }
    }

    this.provider.on('connect', this.connectHandler)
    this.provider.on('disconnect', this.disconnectHandler)
    this.provider.on('accountChanged', this.accountChangedHandler)
  }

  /**
   * Clean up wallet event handlers
   */
  private cleanupEventHandlers(): void {
    if (!this.provider) return

    if (this.connectHandler) {
      this.provider.off('connect', this.connectHandler)
    }
    if (this.disconnectHandler) {
      this.provider.off('disconnect', this.disconnectHandler)
    }
    if (this.accountChangedHandler) {
      this.provider.off('accountChanged', this.accountChangedHandler)
    }

    this.connectHandler = undefined
    this.disconnectHandler = undefined
    this.accountChangedHandler = undefined
  }
}

/**
 * Create a minimal Solana RPC connection using fetch
 *
 * This allows basic RPC calls without requiring @solana/web3.js
 */
function createMinimalConnection(endpoint: string): SolanaConnection {
  const rpc = async (method: string, params: unknown[]): Promise<unknown> => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params,
      }),
    })

    const data = await response.json()

    if (data.error) {
      throw new Error(data.error.message || 'RPC error')
    }

    return data.result
  }

  return {
    async getBalance(publicKey) {
      const result = await rpc('getBalance', [publicKey.toBase58()])
      return (result as { value: number }).value
    },

    async getTokenAccountBalance(publicKey) {
      const result = await rpc('getTokenAccountBalance', [publicKey.toBase58()])
      return result as { value: { amount: string; decimals: number } }
    },

    async getLatestBlockhash() {
      const result = await rpc('getLatestBlockhash', [])
      return result as { blockhash: string; lastValidBlockHeight: number }
    },

    async sendRawTransaction(rawTransaction, options) {
      const base64Tx = Buffer.from(rawTransaction).toString('base64')
      const result = await rpc('sendTransaction', [
        base64Tx,
        {
          encoding: 'base64',
          skipPreflight: options?.skipPreflight ?? false,
          preflightCommitment: options?.preflightCommitment ?? 'confirmed',
          maxRetries: options?.maxRetries,
        },
      ])
      return result as string
    },

    async confirmTransaction(signature, commitment = 'confirmed') {
      const result = await rpc('getSignatureStatuses', [[signature]])
      const statuses = result as { value: Array<{ err: unknown } | null> }
      return { value: { err: statuses.value[0]?.err ?? null } }
    },
  }
}

/**
 * Create a Solana wallet adapter with default configuration
 */
export function createSolanaAdapter(
  config: SolanaAdapterConfig = {}
): SolanaWalletAdapter {
  return new SolanaWalletAdapter(config)
}
