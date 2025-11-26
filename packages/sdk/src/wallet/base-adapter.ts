/**
 * Base Wallet Adapter
 *
 * Abstract base class that provides common functionality for wallet adapters.
 * Chain-specific implementations extend this class.
 */

import type {
  ChainId,
  HexString,
  Asset,
  WalletAdapter,
  WalletConnectionState,
  Signature,
  UnsignedTransaction,
  SignedTransaction,
  TransactionReceipt,
  WalletEventType,
  WalletEventHandler,
  WalletEvent,
  WalletConnectEvent,
  WalletDisconnectEvent,
  WalletAccountChangedEvent,
  WalletChainChangedEvent,
  WalletErrorEvent,
} from '@sip-protocol/types'
import { WalletError, notConnectedError } from './errors'
import { WalletErrorCode } from '@sip-protocol/types'

/**
 * Event emitter for wallet events
 */
type EventHandlers = {
  [K in WalletEventType]: Set<WalletEventHandler<Extract<WalletEvent, { type: K }>>>
}

/**
 * Abstract base class for wallet adapters
 *
 * Provides:
 * - Event emitter infrastructure
 * - Connection state management
 * - Common validation logic
 *
 * Subclasses must implement:
 * - connect() / disconnect()
 * - signMessage() / signTransaction() / signAndSendTransaction()
 * - getBalance() / getTokenBalance()
 *
 * @example
 * ```typescript
 * class MyWalletAdapter extends BaseWalletAdapter {
 *   readonly chain = 'solana'
 *   readonly name = 'my-wallet'
 *
 *   async connect(): Promise<void> {
 *     // Implementation
 *   }
 *
 *   // ... other required methods
 * }
 * ```
 */
export abstract class BaseWalletAdapter implements WalletAdapter {
  // ── Identity ──────────────────────────────────────────────────────────────

  abstract readonly chain: ChainId
  abstract readonly name: string

  protected _address: string = ''
  protected _publicKey: HexString | '' = ''
  protected _connectionState: WalletConnectionState = 'disconnected'

  get address(): string {
    return this._address
  }

  get publicKey(): HexString | '' {
    return this._publicKey
  }

  get connectionState(): WalletConnectionState {
    return this._connectionState
  }

  // ── Event Handling ────────────────────────────────────────────────────────

  private eventHandlers: EventHandlers = {
    connect: new Set(),
    disconnect: new Set(),
    accountChanged: new Set(),
    chainChanged: new Set(),
    error: new Set(),
  }

  /**
   * Subscribe to wallet events
   */
  on<T extends WalletEventType>(
    event: T,
    handler: WalletEventHandler<Extract<WalletEvent, { type: T }>>
  ): void {
    const handlers = this.eventHandlers[event] as Set<typeof handler>
    handlers.add(handler)
  }

  /**
   * Unsubscribe from wallet events
   */
  off<T extends WalletEventType>(
    event: T,
    handler: WalletEventHandler<Extract<WalletEvent, { type: T }>>
  ): void {
    const handlers = this.eventHandlers[event] as Set<typeof handler>
    handlers.delete(handler)
  }

  /**
   * Emit a wallet event
   */
  protected emit<T extends WalletEvent>(event: T): void {
    const handlers = this.eventHandlers[event.type] as Set<WalletEventHandler<T>>
    handlers.forEach((handler) => handler(event))
  }

  /**
   * Emit a connect event
   */
  protected emitConnect(address: string, chain: ChainId): void {
    this.emit({
      type: 'connect',
      address,
      chain,
      timestamp: Date.now(),
    } satisfies WalletConnectEvent)
  }

  /**
   * Emit a disconnect event
   */
  protected emitDisconnect(reason?: string): void {
    this.emit({
      type: 'disconnect',
      reason,
      timestamp: Date.now(),
    } satisfies WalletDisconnectEvent)
  }

  /**
   * Emit an account changed event
   */
  protected emitAccountChanged(previousAddress: string, newAddress: string): void {
    this.emit({
      type: 'accountChanged',
      previousAddress,
      newAddress,
      timestamp: Date.now(),
    } satisfies WalletAccountChangedEvent)
  }

  /**
   * Emit a chain changed event
   */
  protected emitChainChanged(previousChain: ChainId, newChain: ChainId): void {
    this.emit({
      type: 'chainChanged',
      previousChain,
      newChain,
      timestamp: Date.now(),
    } satisfies WalletChainChangedEvent)
  }

  /**
   * Emit an error event
   */
  protected emitError(code: string, message: string, details?: unknown): void {
    this.emit({
      type: 'error',
      code,
      message,
      details,
      timestamp: Date.now(),
    } satisfies WalletErrorEvent)
  }

  // ── Connection ────────────────────────────────────────────────────────────

  /**
   * Check if wallet is connected
   */
  isConnected(): boolean {
    return this._connectionState === 'connected' && this._address !== ''
  }

  /**
   * Ensure wallet is connected, throw if not
   */
  protected requireConnected(): void {
    if (!this.isConnected()) {
      throw notConnectedError()
    }
  }

  /**
   * Set connection state and emit events
   */
  protected setConnected(address: string, publicKey: HexString): void {
    this._address = address
    this._publicKey = publicKey
    this._connectionState = 'connected'
    this.emitConnect(address, this.chain)
  }

  /**
   * Set disconnected state and emit events
   */
  protected setDisconnected(reason?: string): void {
    this._address = ''
    this._publicKey = ''
    this._connectionState = 'disconnected'
    this.emitDisconnect(reason)
  }

  /**
   * Set error state and emit events
   */
  protected setError(code: string, message: string, details?: unknown): void {
    this._connectionState = 'error'
    this.emitError(code, message, details)
  }

  // ── Abstract Methods ──────────────────────────────────────────────────────

  abstract connect(): Promise<void>
  abstract disconnect(): Promise<void>
  abstract signMessage(message: Uint8Array): Promise<Signature>
  abstract signTransaction(tx: UnsignedTransaction): Promise<SignedTransaction>
  abstract signAndSendTransaction(tx: UnsignedTransaction): Promise<TransactionReceipt>
  abstract getBalance(): Promise<bigint>
  abstract getTokenBalance(asset: Asset): Promise<bigint>
}

/**
 * Mock wallet adapter for testing
 *
 * Provides a complete wallet implementation with mock data.
 * Useful for testing and development without real wallet connections.
 *
 * @example
 * ```typescript
 * const mockWallet = new MockWalletAdapter({
 *   chain: 'solana',
 *   address: 'SoLaNaAddReSS...',
 *   balance: 1000000000n, // 1 SOL
 * })
 *
 * await mockWallet.connect()
 * const balance = await mockWallet.getBalance()
 * ```
 */
export class MockWalletAdapter extends BaseWalletAdapter {
  readonly chain: ChainId
  readonly name: string

  private mockAddress: string
  private mockPublicKey: HexString
  private mockBalance: bigint
  private mockTokenBalances: Map<string, bigint>
  private shouldFailConnect: boolean
  private shouldFailSign: boolean

  constructor(options: {
    chain: ChainId
    address?: string
    publicKey?: HexString
    balance?: bigint
    tokenBalances?: Record<string, bigint>
    name?: string
    shouldFailConnect?: boolean
    shouldFailSign?: boolean
  }) {
    super()
    this.chain = options.chain
    this.name = options.name ?? `mock-${options.chain}`
    this.mockAddress = options.address ?? `mock-address-${options.chain}`
    this.mockPublicKey = options.publicKey ?? '0x0000000000000000000000000000000000000000000000000000000000000001'
    this.mockBalance = options.balance ?? 0n
    this.mockTokenBalances = new Map(Object.entries(options.tokenBalances ?? {}))
    this.shouldFailConnect = options.shouldFailConnect ?? false
    this.shouldFailSign = options.shouldFailSign ?? false
  }

  async connect(): Promise<void> {
    this._connectionState = 'connecting'

    if (this.shouldFailConnect) {
      this.setError(
        WalletErrorCode.CONNECTION_FAILED,
        'Mock connection failure'
      )
      throw new WalletError(
        'Mock connection failure',
        WalletErrorCode.CONNECTION_FAILED
      )
    }

    // Simulate async connection
    await new Promise((resolve) => setTimeout(resolve, 10))

    this.setConnected(this.mockAddress, this.mockPublicKey)
  }

  async disconnect(): Promise<void> {
    this.setDisconnected('User disconnected')
  }

  async signMessage(message: Uint8Array): Promise<Signature> {
    this.requireConnected()

    if (this.shouldFailSign) {
      throw new WalletError('Mock signing failure', WalletErrorCode.SIGNING_FAILED)
    }

    // Create mock signature (64 bytes)
    const mockSig = new Uint8Array(64)
    for (let i = 0; i < 64; i++) {
      mockSig[i] = (message[i % message.length] ?? 0) ^ (i * 7)
    }

    return {
      signature: ('0x' + Buffer.from(mockSig).toString('hex')) as HexString,
      publicKey: this._publicKey as HexString,
      recoveryId: 0,
    }
  }

  async signTransaction(tx: UnsignedTransaction): Promise<SignedTransaction> {
    this.requireConnected()

    if (this.shouldFailSign) {
      throw new WalletError('Mock signing failure', WalletErrorCode.SIGNING_FAILED)
    }

    const signature = await this.signMessage(
      new TextEncoder().encode(JSON.stringify(tx.data))
    )

    return {
      unsigned: tx,
      signatures: [signature],
      serialized: ('0x' + Buffer.from(JSON.stringify(tx)).toString('hex')) as HexString,
    }
  }

  async signAndSendTransaction(tx: UnsignedTransaction): Promise<TransactionReceipt> {
    const signed = await this.signTransaction(tx)

    // Mock transaction hash
    const txHash = ('0x' + Buffer.from(signed.serialized.slice(2, 66)).toString('hex')) as HexString

    return {
      txHash,
      status: 'confirmed',
      blockNumber: 12345n,
      feeUsed: 5000n,
      timestamp: Date.now(),
    }
  }

  async getBalance(): Promise<bigint> {
    this.requireConnected()
    return this.mockBalance
  }

  async getTokenBalance(asset: Asset): Promise<bigint> {
    this.requireConnected()
    const key = `${asset.chain}:${asset.symbol}`
    return this.mockTokenBalances.get(key) ?? 0n
  }

  // ── Mock Control Methods ──────────────────────────────────────────────────

  /**
   * Set mock balance (for testing)
   */
  setMockBalance(balance: bigint): void {
    this.mockBalance = balance
  }

  /**
   * Set mock token balance (for testing)
   */
  setMockTokenBalance(asset: Asset, balance: bigint): void {
    const key = `${asset.chain}:${asset.symbol}`
    this.mockTokenBalances.set(key, balance)
  }

  /**
   * Simulate account change (for testing)
   */
  simulateAccountChange(newAddress: string): void {
    const previousAddress = this._address
    this._address = newAddress
    this.mockAddress = newAddress
    this.emitAccountChanged(previousAddress, newAddress)
  }
}
