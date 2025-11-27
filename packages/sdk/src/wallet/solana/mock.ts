/**
 * Mock Solana Wallet Adapter
 *
 * Testing implementation of Solana wallet adapter.
 * Provides full mock functionality without requiring browser environment.
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
  SolanaPublicKey,
  SolanaTransaction,
  SolanaVersionedTransaction,
  SolanaCluster,
  SolanaConnection,
} from './types'

/**
 * Mock Solana public key
 */
class MockPublicKey implements SolanaPublicKey {
  private base58: string
  private bytes: Uint8Array

  constructor(base58OrBytes: string | Uint8Array) {
    if (typeof base58OrBytes === 'string') {
      this.base58 = base58OrBytes
      // Create deterministic bytes from base58
      this.bytes = new Uint8Array(32)
      for (let i = 0; i < 32; i++) {
        this.bytes[i] = base58OrBytes.charCodeAt(i % base58OrBytes.length) ^ i
      }
    } else {
      this.bytes = base58OrBytes
      // Create deterministic base58 from bytes
      this.base58 = 'Mock' + Buffer.from(base58OrBytes.slice(0, 8)).toString('hex')
    }
  }

  toBase58(): string {
    return this.base58
  }

  toBytes(): Uint8Array {
    return this.bytes
  }

  toString(): string {
    return this.base58
  }
}

/**
 * Mock Solana transaction
 */
class MockSolanaTransaction implements SolanaTransaction {
  signature?: Uint8Array
  private data: Uint8Array

  constructor(data?: unknown) {
    this.data = new TextEncoder().encode(JSON.stringify(data ?? { mock: true }))
  }

  serialize(): Uint8Array {
    return this.data
  }

  addSignature(_pubkey: SolanaPublicKey, signature: Uint8Array): void {
    this.signature = signature
  }
}

/**
 * Configuration for mock Solana adapter
 */
export interface MockSolanaAdapterConfig {
  /** Mock address (base58) */
  address?: string
  /** Mock balance in lamports */
  balance?: bigint
  /** Token balances by mint address */
  tokenBalances?: Record<string, bigint>
  /** Whether to simulate connection failure */
  shouldFailConnect?: boolean
  /** Whether to simulate signing failure */
  shouldFailSign?: boolean
  /** Whether to simulate transaction failure */
  shouldFailTransaction?: boolean
  /** Simulated cluster */
  cluster?: SolanaCluster
  /** Simulated latency in ms */
  latency?: number
}

/**
 * Mock Solana wallet adapter for testing
 *
 * Provides full Solana wallet functionality with mock data.
 * No browser environment or actual wallet required.
 *
 * @example
 * ```typescript
 * const wallet = new MockSolanaAdapter({
 *   address: 'TestWalletAddress123',
 *   balance: 5_000_000_000n, // 5 SOL
 * })
 *
 * await wallet.connect()
 * const balance = await wallet.getBalance() // 5_000_000_000n
 *
 * // Simulate failures
 * const failingWallet = new MockSolanaAdapter({
 *   shouldFailSign: true,
 * })
 * ```
 */
export class MockSolanaAdapter extends BaseWalletAdapter {
  readonly chain = 'solana' as const
  readonly name = 'mock-solana'

  private mockAddress: string
  private mockPublicKey: MockPublicKey
  private mockBalance: bigint
  private mockTokenBalances: Map<string, bigint>
  private shouldFailConnect: boolean
  private shouldFailSign: boolean
  private shouldFailTransaction: boolean
  private cluster: SolanaCluster
  private latency: number

  // Track signed transactions for verification
  private signedTransactions: Array<SolanaTransaction | SolanaVersionedTransaction> = []
  private sentTransactions: string[] = []

  constructor(config: MockSolanaAdapterConfig = {}) {
    super()
    this.mockAddress = config.address ?? 'MockSo1anaWa11etAddress123456789'
    this.mockPublicKey = new MockPublicKey(this.mockAddress)
    this.mockBalance = config.balance ?? 1_000_000_000n // 1 SOL default
    this.mockTokenBalances = new Map(Object.entries(config.tokenBalances ?? {}))
    this.shouldFailConnect = config.shouldFailConnect ?? false
    this.shouldFailSign = config.shouldFailSign ?? false
    this.shouldFailTransaction = config.shouldFailTransaction ?? false
    this.cluster = config.cluster ?? 'devnet'
    this.latency = config.latency ?? 10
  }

  /**
   * Get the current Solana cluster
   */
  getCluster(): SolanaCluster {
    return this.cluster
  }

  /**
   * Connect to the mock wallet
   */
  async connect(): Promise<void> {
    this._connectionState = 'connecting'

    // Simulate network latency
    await this.simulateLatency()

    if (this.shouldFailConnect) {
      this.setError(WalletErrorCode.CONNECTION_FAILED, 'Mock connection failure')
      throw new WalletError('Mock connection failure', WalletErrorCode.CONNECTION_FAILED)
    }

    const hexPubKey = ('0x' + Buffer.from(this.mockPublicKey.toBytes()).toString('hex')) as HexString
    this.setConnected(this.mockAddress, hexPubKey)
  }

  /**
   * Disconnect from the mock wallet
   */
  async disconnect(): Promise<void> {
    await this.simulateLatency()
    this.setDisconnected('User disconnected')
  }

  /**
   * Sign a message
   */
  async signMessage(message: Uint8Array): Promise<Signature> {
    this.requireConnected()
    await this.simulateLatency()

    if (this.shouldFailSign) {
      throw new WalletError('Mock signing failure', WalletErrorCode.SIGNING_REJECTED)
    }

    // Create deterministic mock signature
    const mockSig = new Uint8Array(64)
    for (let i = 0; i < 64; i++) {
      mockSig[i] = (message[i % message.length] ?? 0) ^ (i * 7) ^ this.mockAddress.charCodeAt(i % this.mockAddress.length)
    }

    return {
      signature: ('0x' + Buffer.from(mockSig).toString('hex')) as HexString,
      publicKey: this._publicKey as HexString,
    }
  }

  /**
   * Sign a transaction
   */
  async signTransaction(tx: UnsignedTransaction): Promise<SignedTransaction> {
    this.requireConnected()
    await this.simulateLatency()

    if (this.shouldFailSign) {
      throw new WalletError('Mock signing failure', WalletErrorCode.SIGNING_REJECTED)
    }

    const solTx = tx.data as SolanaTransaction | SolanaVersionedTransaction
    this.signedTransactions.push(solTx)

    const signature = await this.signMessage(
      new TextEncoder().encode(JSON.stringify(tx.data))
    )

    return {
      unsigned: tx,
      signatures: [signature],
      serialized: ('0x' + Buffer.from(JSON.stringify(tx.data)).toString('hex')) as HexString,
    }
  }

  /**
   * Sign and send a transaction
   */
  async signAndSendTransaction(tx: UnsignedTransaction): Promise<TransactionReceipt> {
    this.requireConnected()
    await this.simulateLatency()

    if (this.shouldFailSign) {
      throw new WalletError('Mock signing failure', WalletErrorCode.SIGNING_REJECTED)
    }

    if (this.shouldFailTransaction) {
      throw new WalletError('Mock transaction failure', WalletErrorCode.TRANSACTION_FAILED)
    }

    // Generate mock transaction signature
    const txSig = `mock_tx_${Date.now()}_${Math.random().toString(36).slice(2)}`
    this.sentTransactions.push(txSig)

    return {
      txHash: ('0x' + Buffer.from(txSig).toString('hex')) as HexString,
      status: 'confirmed',
      blockNumber: BigInt(Math.floor(Math.random() * 1000000)),
      feeUsed: 5000n, // 0.000005 SOL
      timestamp: Date.now(),
    }
  }

  /**
   * Sign multiple transactions
   */
  async signAllTransactions<T extends SolanaTransaction | SolanaVersionedTransaction>(
    transactions: T[]
  ): Promise<T[]> {
    this.requireConnected()
    await this.simulateLatency()

    if (this.shouldFailSign) {
      throw new WalletError('Mock signing failure', WalletErrorCode.SIGNING_REJECTED)
    }

    // Record all signed transactions
    this.signedTransactions.push(...transactions)

    // Return transactions with mock signatures
    return transactions.map((tx) => {
      if ('signature' in tx) {
        (tx as SolanaTransaction).signature = new Uint8Array(64).fill(1)
      }
      return tx
    })
  }

  /**
   * Get SOL balance
   */
  async getBalance(): Promise<bigint> {
    this.requireConnected()
    await this.simulateLatency()
    return this.mockBalance
  }

  /**
   * Get token balance
   */
  async getTokenBalance(asset: Asset): Promise<bigint> {
    this.requireConnected()
    await this.simulateLatency()

    if (asset.chain !== 'solana') {
      throw new WalletError(
        `Asset chain ${asset.chain} not supported by Solana adapter`,
        WalletErrorCode.UNSUPPORTED_CHAIN
      )
    }

    // Native SOL
    if (!asset.address) {
      return this.mockBalance
    }

    return this.mockTokenBalances.get(asset.address) ?? 0n
  }

  // ── Mock Control Methods ──────────────────────────────────────────────────

  /**
   * Set mock balance
   */
  setMockBalance(balance: bigint): void {
    this.mockBalance = balance
  }

  /**
   * Set mock token balance
   */
  setMockTokenBalance(mintAddress: string, balance: bigint): void {
    this.mockTokenBalances.set(mintAddress, balance)
  }

  /**
   * Get all signed transactions (for verification)
   */
  getSignedTransactions(): Array<SolanaTransaction | SolanaVersionedTransaction> {
    return [...this.signedTransactions]
  }

  /**
   * Get all sent transaction signatures (for verification)
   */
  getSentTransactions(): string[] {
    return [...this.sentTransactions]
  }

  /**
   * Clear transaction history
   */
  clearTransactionHistory(): void {
    this.signedTransactions = []
    this.sentTransactions = []
  }

  /**
   * Simulate an account change event
   */
  simulateAccountChange(newAddress: string): void {
    const previousAddress = this._address
    this.mockAddress = newAddress
    this.mockPublicKey = new MockPublicKey(newAddress)
    this._address = newAddress
    this._publicKey = ('0x' + Buffer.from(this.mockPublicKey.toBytes()).toString('hex')) as HexString
    this.emitAccountChanged(previousAddress, newAddress)
  }

  /**
   * Simulate a disconnect event
   */
  simulateDisconnect(): void {
    this.setDisconnected('Simulated disconnect')
  }

  private async simulateLatency(): Promise<void> {
    if (this.latency > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latency))
    }
  }
}

/**
 * Create a mock Solana wallet provider for testing real adapter
 */
export function createMockSolanaProvider(
  config: MockSolanaAdapterConfig = {}
): SolanaWalletProvider {
  const address = config.address ?? 'MockSo1anaWa11etAddress123456789'
  const pubkey = new MockPublicKey(address)
  let isConnected = false

  const eventHandlers: Record<string, Set<(...args: unknown[]) => void>> = {
    connect: new Set(),
    disconnect: new Set(),
    accountChanged: new Set(),
  }

  return {
    isPhantom: true,
    publicKey: null,
    isConnected: false,

    async connect() {
      if (config.shouldFailConnect) {
        throw new Error('User rejected the request')
      }
      isConnected = true
      ;(this as SolanaWalletProvider).isConnected = true
      ;(this as SolanaWalletProvider).publicKey = pubkey
      eventHandlers.connect.forEach((h) => h(pubkey))
      return { publicKey: pubkey }
    },

    async disconnect() {
      isConnected = false
      ;(this as SolanaWalletProvider).isConnected = false
      ;(this as SolanaWalletProvider).publicKey = null
      eventHandlers.disconnect.forEach((h) => h())
    },

    async signMessage(message: Uint8Array) {
      if (config.shouldFailSign) {
        throw new Error('User rejected the request')
      }
      const signature = new Uint8Array(64)
      for (let i = 0; i < 64; i++) {
        signature[i] = message[i % message.length] ^ i
      }
      return { signature }
    },

    async signTransaction<T extends SolanaTransaction | SolanaVersionedTransaction>(tx: T): Promise<T> {
      if (config.shouldFailSign) {
        throw new Error('User rejected the request')
      }
      return tx
    },

    async signAllTransactions<T extends SolanaTransaction | SolanaVersionedTransaction>(txs: T[]): Promise<T[]> {
      if (config.shouldFailSign) {
        throw new Error('User rejected the request')
      }
      return txs
    },

    async signAndSendTransaction<T extends SolanaTransaction | SolanaVersionedTransaction>(_tx: T) {
      if (config.shouldFailSign) {
        throw new Error('User rejected the request')
      }
      if (config.shouldFailTransaction) {
        throw new Error('Transaction failed')
      }
      return { signature: 'mock_signature_' + Date.now() }
    },

    on(event, handler) {
      eventHandlers[event]?.add(handler)
    },

    off(event, handler) {
      eventHandlers[event]?.delete(handler)
    },
  }
}

/**
 * Create a mock Solana connection for testing
 */
export function createMockSolanaConnection(
  config: MockSolanaAdapterConfig = {}
): SolanaConnection {
  const balance = config.balance ?? 1_000_000_000n

  return {
    async getBalance() {
      return Number(balance)
    },

    async getTokenAccountBalance(publicKey) {
      const mint = publicKey.toBase58()
      const tokenBalance = config.tokenBalances?.[mint] ?? 0n
      return {
        value: {
          amount: tokenBalance.toString(),
          decimals: 9,
        },
      }
    },

    async getLatestBlockhash() {
      return {
        blockhash: 'mock_blockhash_' + Date.now(),
        lastValidBlockHeight: 12345678,
      }
    },

    async sendRawTransaction() {
      if (config.shouldFailTransaction) {
        throw new Error('Transaction failed')
      }
      return 'mock_signature_' + Date.now()
    },

    async confirmTransaction() {
      return { value: { err: null } }
    },
  }
}

/**
 * Create a mock Solana adapter
 */
export function createMockSolanaAdapter(
  config: MockSolanaAdapterConfig = {}
): MockSolanaAdapter {
  return new MockSolanaAdapter(config)
}
