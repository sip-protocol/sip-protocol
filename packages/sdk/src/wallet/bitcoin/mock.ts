/**
 * Mock Bitcoin Wallet Adapter
 *
 * Testing implementation of Bitcoin wallet adapter.
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
  UnisatAPI,
  BitcoinNetwork,
  BitcoinAddress,
  BitcoinBalance,
  SignPsbtOptions,
} from './types'
import { bitcoinPublicKeyToHex } from './types'

/**
 * Configuration for mock Bitcoin adapter
 */
export interface MockBitcoinAdapterConfig {
  /** Mock address (Taproot address) */
  address?: string
  /** Mock public key (32-byte x-only hex) */
  publicKey?: string
  /** Mock balance in satoshis */
  balance?: bigint
  /** Token balances by inscription ID */
  tokenBalances?: Record<string, bigint>
  /** Whether to simulate connection failure */
  shouldFailConnect?: boolean
  /** Whether to simulate signing failure */
  shouldFailSign?: boolean
  /** Whether to simulate transaction failure */
  shouldFailTransaction?: boolean
  /** Simulated network */
  network?: BitcoinNetwork
  /** Simulated latency in ms */
  latency?: number
}

/**
 * Mock Bitcoin wallet adapter for testing
 *
 * Provides full Bitcoin wallet functionality with mock data.
 * No browser environment or actual wallet required.
 *
 * @example
 * ```typescript
 * const wallet = new MockBitcoinAdapter({
 *   address: 'bc1p...',
 *   balance: 100_000_000n, // 1 BTC
 * })
 *
 * await wallet.connect()
 * const balance = await wallet.getBalance() // 100_000_000n
 *
 * // Simulate failures
 * const failingWallet = new MockBitcoinAdapter({
 *   shouldFailSign: true,
 * })
 * ```
 */
export class MockBitcoinAdapter extends BaseWalletAdapter {
  readonly chain = 'bitcoin' as const
  readonly name = 'mock-bitcoin'

  private mockAddress: string
  private mockPubKey: string
  private mockBalance: bigint
  private mockTokenBalances: Map<string, bigint>
  private shouldFailConnect: boolean
  private shouldFailSign: boolean
  private shouldFailTransaction: boolean
  private network: BitcoinNetwork
  private latency: number

  // Track signed transactions for verification
  private signedPsbts: string[] = []
  private signedMessages: string[] = []
  private broadcastTxs: string[] = []

  constructor(config: MockBitcoinAdapterConfig = {}) {
    super()
    // Use realistic Taproot address format
    this.mockAddress = config.address ?? 'bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297'
    // X-only public key (32 bytes for Taproot)
    this.mockPubKey = config.publicKey ?? 'a3c89044f0057b4e6f0abf99a35b4df9c2e8dbfe0c9db9e5d1f8d08e8e09a9c1'
    this.mockBalance = config.balance ?? 100_000_000n // 1 BTC default
    this.mockTokenBalances = new Map(Object.entries(config.tokenBalances ?? {}))
    this.shouldFailConnect = config.shouldFailConnect ?? false
    this.shouldFailSign = config.shouldFailSign ?? false
    this.shouldFailTransaction = config.shouldFailTransaction ?? false
    this.network = config.network ?? 'livenet'
    this.latency = config.latency ?? 10
  }

  /**
   * Get the current Bitcoin network
   */
  getNetwork(): BitcoinNetwork {
    return this.network
  }

  /**
   * Set the Bitcoin network
   */
  async setNetwork(network: BitcoinNetwork): Promise<void> {
    await this.simulateLatency()
    this.network = network
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

    const hexPubKey = bitcoinPublicKeyToHex(this.mockPubKey)
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

    // Track signed message
    const messageStr = new TextDecoder().decode(message)
    this.signedMessages.push(messageStr)

    // Create deterministic mock signature (64 bytes for Schnorr)
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
   * Sign a PSBT
   */
  async signTransaction(tx: UnsignedTransaction): Promise<SignedTransaction> {
    this.requireConnected()
    await this.simulateLatency()

    if (this.shouldFailSign) {
      throw new WalletError('Mock signing failure', WalletErrorCode.SIGNING_REJECTED)
    }

    // Extract PSBT from transaction data
    const psbtHex = tx.data as string
    this.signedPsbts.push(psbtHex)

    // Create mock signed PSBT (just add some mock signatures)
    const mockSignedPsbt = psbtHex + '0'.repeat(128) // Add mock signature data

    return {
      unsigned: tx,
      signatures: [
        {
          signature: ('0x' + mockSignedPsbt) as HexString,
          publicKey: this._publicKey as HexString,
        },
      ],
      serialized: ('0x' + mockSignedPsbt) as HexString,
    }
  }

  /**
   * Sign and send a PSBT
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

    // Generate mock transaction ID
    const txid = Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('')

    this.broadcastTxs.push(txid)

    return {
      txHash: ('0x' + txid) as HexString,
      status: 'pending',
      timestamp: Date.now(),
    }
  }

  /**
   * Get native BTC balance
   */
  async getBalance(): Promise<bigint> {
    this.requireConnected()
    await this.simulateLatency()
    return this.mockBalance
  }

  /**
   * Get token balance (BRC-20, etc.)
   */
  async getTokenBalance(asset: Asset): Promise<bigint> {
    this.requireConnected()
    await this.simulateLatency()

    if (asset.chain !== 'bitcoin') {
      throw new WalletError(
        `Asset chain ${asset.chain} not supported by Bitcoin adapter`,
        WalletErrorCode.UNSUPPORTED_CHAIN
      )
    }

    const key = asset.address ?? asset.symbol
    return this.mockTokenBalances.get(key) ?? 0n
  }

  /**
   * Get Bitcoin addresses
   */
  async getAddresses(): Promise<BitcoinAddress[]> {
    this.requireConnected()
    await this.simulateLatency()

    return [
      {
        address: this.mockAddress,
        publicKey: this.mockPubKey,
        type: 'p2tr',
      },
    ]
  }

  /**
   * Get detailed balance information
   */
  async getBalanceDetails(): Promise<BitcoinBalance> {
    this.requireConnected()
    await this.simulateLatency()

    // Split balance into confirmed/unconfirmed for realism
    const confirmed = (this.mockBalance * 9n) / 10n
    const unconfirmed = this.mockBalance - confirmed

    return {
      confirmed,
      unconfirmed,
      total: this.mockBalance,
    }
  }

  /**
   * Sign a PSBT directly
   */
  async signPsbt(psbtHex: string, options?: SignPsbtOptions): Promise<string> {
    this.requireConnected()
    await this.simulateLatency()

    if (this.shouldFailSign) {
      throw new WalletError('Mock signing failure', WalletErrorCode.SIGNING_REJECTED)
    }

    this.signedPsbts.push(psbtHex)

    // Create mock signed PSBT
    const mockSignedPsbt = psbtHex + '0'.repeat(128)
    return mockSignedPsbt
  }

  /**
   * Push a raw transaction to the network
   */
  async pushTx(rawTx: string): Promise<string> {
    this.requireConnected()
    await this.simulateLatency()

    if (this.shouldFailTransaction) {
      throw new WalletError('Mock transaction failure', WalletErrorCode.TRANSACTION_FAILED)
    }

    // Generate mock transaction ID
    const txid = Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('')

    this.broadcastTxs.push(txid)
    return txid
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
  setMockTokenBalance(inscriptionId: string, balance: bigint): void {
    this.mockTokenBalances.set(inscriptionId, balance)
  }

  /**
   * Get all signed PSBTs (for verification)
   */
  getSignedPsbts(): string[] {
    return [...this.signedPsbts]
  }

  /**
   * Get all signed messages (for verification)
   */
  getSignedMessages(): string[] {
    return [...this.signedMessages]
  }

  /**
   * Get all broadcast transactions (for verification)
   */
  getBroadcastTransactions(): string[] {
    return [...this.broadcastTxs]
  }

  /**
   * Clear transaction history
   */
  clearTransactionHistory(): void {
    this.signedPsbts = []
    this.signedMessages = []
    this.broadcastTxs = []
  }

  /**
   * Simulate an account change event
   */
  simulateAccountChange(newAddress: string, newPubKey?: string): void {
    const previousAddress = this._address
    this.mockAddress = newAddress
    this._address = newAddress

    // Update public key
    if (newPubKey) {
      this.mockPubKey = newPubKey
      this._publicKey = bitcoinPublicKeyToHex(newPubKey)
    }

    this.emitAccountChanged(previousAddress, newAddress)
  }

  /**
   * Simulate a disconnect event
   */
  simulateDisconnect(): void {
    this.setDisconnected('Simulated disconnect')
  }

  /**
   * Simulate network change
   */
  simulateNetworkChange(newNetwork: BitcoinNetwork): void {
    this.network = newNetwork
    // Bitcoin wallets typically disconnect on network change
    this.simulateDisconnect()
  }

  private async simulateLatency(): Promise<void> {
    if (this.latency > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latency))
    }
  }
}

/**
 * Create a mock Bitcoin wallet provider for testing real adapter
 */
export function createMockBitcoinProvider(
  config: MockBitcoinAdapterConfig = {}
): UnisatAPI {
  const address = config.address ?? 'bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297'
  const publicKey = config.publicKey ?? 'a3c89044f0057b4e6f0abf99a35b4df9c2e8dbfe0c9db9e5d1f8d08e8e09a9c1'
  const balance = config.balance ?? 100_000_000n
  const network = config.network ?? 'livenet'

  return {
    async requestAccounts(): Promise<string[]> {
      if (config.shouldFailConnect) {
        throw new Error('User cancelled the request')
      }
      return [address]
    },

    async getAccounts(): Promise<string[]> {
      return [address]
    },

    async getPublicKey(): Promise<string> {
      return publicKey
    },

    async getBalance(): Promise<{ confirmed: number; unconfirmed: number; total: number }> {
      const total = Number(balance)
      const confirmed = Math.floor(total * 0.9)
      const unconfirmed = total - confirmed

      return {
        confirmed,
        unconfirmed,
        total,
      }
    },

    async signPsbt(psbtHex: string, options?: SignPsbtOptions): Promise<string> {
      if (config.shouldFailSign) {
        throw new Error('User rejected the request')
      }

      // Return mock signed PSBT
      return psbtHex + '0'.repeat(128)
    },

    async signMessage(message: string, type: 'ecdsa' | 'bip322-simple' = 'ecdsa'): Promise<string> {
      if (config.shouldFailSign) {
        throw new Error('User rejected the request')
      }

      // Return mock base64 signature
      const mockSig = new Uint8Array(64)
      for (let i = 0; i < 64; i++) {
        mockSig[i] = message.charCodeAt(i % message.length) ^ i
      }
      return Buffer.from(mockSig).toString('base64')
    },

    async pushTx(rawTx: string): Promise<string> {
      if (config.shouldFailTransaction) {
        throw new Error('Transaction failed: insufficient funds')
      }

      // Return mock transaction ID
      return Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('')
    },

    async getNetwork(): Promise<BitcoinNetwork> {
      return network
    },

    async switchNetwork(newNetwork: BitcoinNetwork): Promise<void> {
      // Mock network switch
    },

    async getChain(): Promise<{ enum: string; name: string }> {
      return {
        enum: network === 'livenet' ? 'BITCOIN_MAINNET' : 'BITCOIN_TESTNET',
        name: network === 'livenet' ? 'Bitcoin Mainnet' : 'Bitcoin Testnet',
      }
    },
  }
}

/**
 * Create a mock Bitcoin adapter
 */
export function createMockBitcoinAdapter(
  config: MockBitcoinAdapterConfig = {}
): MockBitcoinAdapter {
  return new MockBitcoinAdapter(config)
}
