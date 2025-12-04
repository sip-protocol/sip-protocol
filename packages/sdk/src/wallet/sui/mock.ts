/**
 * Mock Sui Wallet Adapter
 *
 * Testing implementation of Sui wallet adapter.
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
  SuiWalletProvider,
  SuiAccountInfo,
  SuiTransactionBlock,
  SuiSignMessageInput,
  SuiSignMessageResponse,
  SignedSuiTransaction,
} from './types'
import { suiPublicKeyToHex, getDefaultSuiRpcEndpoint } from './types'

/**
 * Configuration for mock Sui adapter
 */
export interface MockSuiAdapterConfig {
  /** Mock address (0x-prefixed hex) */
  address?: string
  /** Mock public key (0x-prefixed hex) */
  publicKey?: string
  /** Mock balance in MIST */
  balance?: bigint
  /** Token balances by coin type */
  tokenBalances?: Record<string, bigint>
  /** Whether to simulate connection failure */
  shouldFailConnect?: boolean
  /** Whether to simulate signing failure */
  shouldFailSign?: boolean
  /** Whether to simulate transaction failure */
  shouldFailTransaction?: boolean
  /** Simulated network */
  network?: string
  /** Simulated latency in ms */
  latency?: number
}

/**
 * Mock Sui wallet adapter for testing
 *
 * Provides full Sui wallet functionality with mock data.
 * No browser environment or actual wallet required.
 *
 * @example
 * ```typescript
 * const wallet = new MockSuiAdapter({
 *   address: '0x1234...abcd',
 *   balance: 1_000_000_000n, // 1 SUI
 * })
 *
 * await wallet.connect()
 * const balance = await wallet.getBalance() // 1_000_000_000n
 *
 * // Simulate failures
 * const failingWallet = new MockSuiAdapter({
 *   shouldFailSign: true,
 * })
 * ```
 */
export class MockSuiAdapter extends BaseWalletAdapter {
  readonly chain = 'sui' as const
  readonly name = 'mock-sui'

  private mockAddress: HexString
  private mockPublicKey: HexString
  private mockBalance: bigint
  private mockTokenBalances: Map<string, bigint>
  private shouldFailConnect: boolean
  private shouldFailSign: boolean
  private shouldFailTransaction: boolean
  private network: string
  private latency: number
  private accounts: SuiAccountInfo[]

  // Track signed transactions for verification
  private signedTransactions: SuiTransactionBlock[] = []
  private sentTransactions: string[] = []

  constructor(config: MockSuiAdapterConfig = {}) {
    super()
    this.mockAddress = (config.address ?? '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef') as HexString
    this.mockPublicKey = (config.publicKey ?? '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd') as HexString
    this.mockBalance = config.balance ?? 1_000_000_000n // 1 SUI default
    this.mockTokenBalances = new Map(Object.entries(config.tokenBalances ?? {}))
    this.shouldFailConnect = config.shouldFailConnect ?? false
    this.shouldFailSign = config.shouldFailSign ?? false
    this.shouldFailTransaction = config.shouldFailTransaction ?? false
    this.network = config.network ?? 'mainnet'
    this.latency = config.latency ?? 10

    this.accounts = [
      {
        address: this.mockAddress,
        publicKey: this.mockPublicKey,
      },
    ]
  }

  /**
   * Get the current Sui network
   */
  getNetwork(): string {
    return this.network
  }

  /**
   * Get RPC endpoint
   */
  getRpcEndpoint(): string {
    return getDefaultSuiRpcEndpoint(this.network)
  }

  /**
   * Get all connected accounts
   */
  getAccounts(): SuiAccountInfo[] {
    return [...this.accounts]
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

    this.setConnected(this.mockAddress, this.mockPublicKey)
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

    // Create deterministic mock signature (64 bytes)
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

    const suiTx = tx.data as SuiTransactionBlock
    this.signedTransactions.push(suiTx)

    // Create mock signed bytes
    const txDataStr = JSON.stringify(tx.data)
    const signature = await this.signMessage(new TextEncoder().encode(txDataStr))

    return {
      unsigned: tx,
      signatures: [signature],
      serialized: signature.signature,
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

    // Generate mock transaction hash (digest)
    const txHash = `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`
    this.sentTransactions.push(txHash)

    return {
      txHash: txHash as HexString,
      status: 'confirmed',
      blockNumber: BigInt(Math.floor(Math.random() * 1000000)),
      timestamp: Date.now(),
    }
  }

  /**
   * Get native SUI balance
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

    if (asset.chain !== 'sui') {
      throw new WalletError(
        `Asset chain ${asset.chain} not supported by Sui adapter`,
        WalletErrorCode.UNSUPPORTED_CHAIN
      )
    }

    // Native SUI
    if (!asset.address || asset.address === '0x2::sui::SUI') {
      return this.mockBalance
    }

    const coinType = asset.address
    return this.mockTokenBalances.get(coinType) ?? 0n
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
  setMockTokenBalance(coinType: string, balance: bigint): void {
    this.mockTokenBalances.set(coinType, balance)
  }

  /**
   * Get all signed transactions (for verification)
   */
  getSignedTransactions(): SuiTransactionBlock[] {
    return [...this.signedTransactions]
  }

  /**
   * Get all sent transaction hashes (for verification)
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
  simulateAccountChange(newAddress: HexString, newPublicKey?: HexString): void {
    const previousAddress = this._address
    this.mockAddress = newAddress
    this._address = newAddress as string

    if (newPublicKey) {
      this.mockPublicKey = newPublicKey
      this._publicKey = newPublicKey
    }

    this.accounts = [
      {
        address: newAddress,
        publicKey: this.mockPublicKey,
      },
    ]

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
 * Create a mock Sui wallet provider for testing real adapter
 */
export function createMockSuiProvider(
  config: MockSuiAdapterConfig = {}
): SuiWalletProvider {
  const address = config.address ?? '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
  const publicKey = config.publicKey ?? '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd'

  const account: SuiAccountInfo = {
    address,
    publicKey,
  }

  return {
    async hasPermissions(): Promise<boolean> {
      return !config.shouldFailConnect
    },

    async requestPermissions(): Promise<boolean> {
      if (config.shouldFailConnect) {
        throw new Error('User rejected the request')
      }
      return true
    },

    async getAccounts(): Promise<SuiAccountInfo[]> {
      if (config.shouldFailConnect) {
        throw new Error('User rejected the request')
      }
      return [account]
    },

    async signTransactionBlock(input: {
      transactionBlock: SuiTransactionBlock | any
      account?: SuiAccountInfo
      chain?: string
    }): Promise<SignedSuiTransaction> {
      if (config.shouldFailSign) {
        throw new Error('User rejected the request')
      }

      // Return mock signed transaction
      const mockSig = new Uint8Array(64)
      for (let i = 0; i < 64; i++) {
        mockSig[i] = i
      }

      return {
        signature: Buffer.from(mockSig).toString('base64'),
        transactionBlockBytes: Buffer.from(new Uint8Array(128).fill(1)).toString('base64'),
      }
    },

    async signAndExecuteTransactionBlock(input: {
      transactionBlock: SuiTransactionBlock | any
      account?: SuiAccountInfo
      chain?: string
      options?: any
    }): Promise<{ digest: string }> {
      if (config.shouldFailSign) {
        throw new Error('User rejected the request')
      }

      if (config.shouldFailTransaction) {
        throw new Error('Transaction failed')
      }

      const digest = `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`
      return { digest }
    },

    async signMessage(input: SuiSignMessageInput): Promise<SuiSignMessageResponse> {
      if (config.shouldFailSign) {
        throw new Error('User rejected the request')
      }

      const mockSig = new Uint8Array(64)
      for (let i = 0; i < 64; i++) {
        mockSig[i] = (input.message[i % input.message.length] ?? 0) ^ i
      }

      return {
        signature: Buffer.from(mockSig).toString('base64'),
        messageBytes: Buffer.from(input.message).toString('base64'),
      }
    },
  }
}

/**
 * Create a mock Sui adapter
 */
export function createMockSuiAdapter(
  config: MockSuiAdapterConfig = {}
): MockSuiAdapter {
  return new MockSuiAdapter(config)
}
