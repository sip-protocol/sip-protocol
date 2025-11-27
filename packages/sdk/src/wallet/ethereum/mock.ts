/**
 * Mock Ethereum Wallet Adapter
 *
 * Mock implementation for testing without browser environment.
 * Simulates EIP-1193 provider behavior.
 */

import type {
  Asset,
  HexString,
  ChainId,
  Signature,
  UnsignedTransaction,
  SignedTransaction,
  TransactionReceipt,
} from '@sip-protocol/types'
import { WalletErrorCode } from '@sip-protocol/types'
import { BaseWalletAdapter } from '../base-adapter'
import { WalletError } from '../errors'
import type {
  EIP1193Provider,
  EIP1193RequestArguments,
  EthereumTransactionRequest,
  EthereumTransactionReceipt,
  EIP712TypedData,
} from './types'
import { toHex, EthereumChainId } from './types'

/**
 * Mock Ethereum adapter configuration
 */
export interface MockEthereumAdapterConfig {
  /** Mock address */
  address?: string
  /** Mock chain ID */
  chainId?: number
  /** Initial ETH balance in wei */
  balance?: bigint
  /** Token balances by address */
  tokenBalances?: Record<string, bigint>
  /** Should connection fail */
  shouldFailConnect?: boolean
  /** Should signing fail */
  shouldFailSign?: boolean
  /** Should transaction fail */
  shouldFailTransaction?: boolean
}

/**
 * Mock Ethereum wallet adapter for testing
 *
 * @example
 * ```typescript
 * const adapter = new MockEthereumAdapter({
 *   address: '0x1234...',
 *   balance: 1_000_000_000_000_000_000n, // 1 ETH
 * })
 *
 * await adapter.connect()
 * const balance = await adapter.getBalance()
 * ```
 */
export class MockEthereumAdapter extends BaseWalletAdapter {
  readonly chain = 'ethereum' as const
  readonly name = 'mock-ethereum'

  private _chainId: number
  private _balance: bigint
  private _tokenBalances: Map<string, bigint>
  private _mockAddress: string
  private _shouldFailConnect: boolean
  private _shouldFailSign: boolean
  private _shouldFailTransaction: boolean
  private _signedTransactions: UnsignedTransaction[] = []
  private _sentTransactions: string[] = []
  private _signatureCounter = 0
  private _txCounter = 0

  constructor(config: MockEthereumAdapterConfig = {}) {
    super()
    this._mockAddress = config.address ?? '0x742d35Cc6634C0532925a3b844Bc9e7595f8fB1b'
    this._chainId = config.chainId ?? EthereumChainId.MAINNET
    this._balance = config.balance ?? 1_000_000_000_000_000_000n // 1 ETH
    this._tokenBalances = new Map(Object.entries(config.tokenBalances ?? {}))
    this._shouldFailConnect = config.shouldFailConnect ?? false
    this._shouldFailSign = config.shouldFailSign ?? false
    this._shouldFailTransaction = config.shouldFailTransaction ?? false
  }

  /**
   * Get current chain ID
   */
  getChainId(): number {
    return this._chainId
  }

  /**
   * Connect to mock wallet
   */
  async connect(): Promise<void> {
    try {
      this._connectionState = 'connecting'

      if (this._shouldFailConnect) {
        this._connectionState = 'error'
        throw new WalletError(
          'Mock connection rejected',
          WalletErrorCode.CONNECTION_REJECTED
        )
      }

      // Simulate connection delay
      await new Promise((resolve) => setTimeout(resolve, 10))

      // For Ethereum, public key is same as address
      this.setConnected(this._mockAddress, this._mockAddress as HexString)
    } catch (error) {
      if (error instanceof WalletError) {
        throw error
      }
      this._connectionState = 'error'
      throw new WalletError(
        `Mock connection failed: ${String(error)}`,
        WalletErrorCode.CONNECTION_FAILED
      )
    }
  }

  /**
   * Disconnect from mock wallet
   */
  async disconnect(): Promise<void> {
    this.setDisconnected()
  }

  /**
   * Sign a message
   */
  async signMessage(message: Uint8Array): Promise<Signature> {
    this.requireConnected()

    if (this._shouldFailSign) {
      throw new WalletError(
        'Mock signing rejected',
        WalletErrorCode.SIGNING_REJECTED
      )
    }

    // Create deterministic mock signature
    const msgHex = Buffer.from(message).toString('hex')
    const mockSig = `0x${msgHex.padEnd(130, '0').slice(0, 130)}` as HexString

    return {
      signature: mockSig,
      publicKey: this._publicKey as HexString,
    }
  }

  /**
   * Sign typed data (EIP-712)
   */
  async signTypedData(typedData: EIP712TypedData): Promise<Signature> {
    this.requireConnected()

    if (this._shouldFailSign) {
      throw new WalletError(
        'Mock signing rejected',
        WalletErrorCode.SIGNING_REJECTED
      )
    }

    // Create mock signature from typed data
    const mockSig = `0x${'1'.repeat(130)}` as HexString

    return {
      signature: mockSig,
      publicKey: this._publicKey as HexString,
    }
  }

  /**
   * Sign a transaction
   */
  async signTransaction(tx: UnsignedTransaction): Promise<SignedTransaction> {
    this.requireConnected()

    if (this._shouldFailSign) {
      throw new WalletError(
        'Mock signing rejected',
        WalletErrorCode.SIGNING_REJECTED
      )
    }

    this._signedTransactions.push(tx)
    this._signatureCounter++

    const mockSig = `0x${this._signatureCounter.toString(16).padStart(130, '0')}` as HexString

    return {
      unsigned: tx,
      signatures: [
        {
          signature: mockSig,
          publicKey: this._publicKey as HexString,
        },
      ],
      serialized: mockSig,
    }
  }

  /**
   * Sign and send a transaction
   */
  async signAndSendTransaction(tx: UnsignedTransaction): Promise<TransactionReceipt> {
    this.requireConnected()

    if (this._shouldFailTransaction) {
      throw new WalletError(
        'Mock transaction failed',
        WalletErrorCode.TRANSACTION_FAILED
      )
    }

    this._signedTransactions.push(tx)
    this._txCounter++

    const txHash = `0x${this._txCounter.toString(16).padStart(64, '0')}` as HexString
    this._sentTransactions.push(txHash)

    return {
      txHash,
      status: 'confirmed',
      blockNumber: 12345678n,
      feeUsed: 21000n * 20_000_000_000n, // 21000 gas * 20 gwei
    }
  }

  /**
   * Get ETH balance
   */
  async getBalance(): Promise<bigint> {
    this.requireConnected()
    return this._balance
  }

  /**
   * Get ERC-20 token balance
   */
  async getTokenBalance(asset: Asset): Promise<bigint> {
    this.requireConnected()

    if (asset.chain !== 'ethereum') {
      throw new WalletError(
        `Asset chain ${asset.chain} not supported by Ethereum adapter`,
        WalletErrorCode.UNSUPPORTED_CHAIN
      )
    }

    // Native ETH
    if (!asset.address) {
      return this._balance
    }

    return this._tokenBalances.get(asset.address) ?? 0n
  }

  /**
   * Switch chain (mock)
   */
  async switchChain(chainId: number): Promise<void> {
    this.requireConnected()

    this._chainId = chainId

    this.emit({
      type: 'chainChanged',
      previousChain: 'ethereum' as ChainId,
      newChain: 'ethereum' as ChainId,
      timestamp: Date.now(),
    })
  }

  // ============================================================================
  // Mock Control Methods
  // ============================================================================

  /**
   * Set mock ETH balance
   */
  setMockBalance(balance: bigint): void {
    this._balance = balance
  }

  /**
   * Set mock token balance
   */
  setMockTokenBalance(tokenAddress: string, balance: bigint): void {
    this._tokenBalances.set(tokenAddress, balance)
  }

  /**
   * Get signed transactions history
   */
  getSignedTransactions(): UnsignedTransaction[] {
    return [...this._signedTransactions]
  }

  /**
   * Get sent transaction hashes
   */
  getSentTransactions(): string[] {
    return [...this._sentTransactions]
  }

  /**
   * Clear transaction history
   */
  clearTransactionHistory(): void {
    this._signedTransactions = []
    this._sentTransactions = []
  }

  /**
   * Simulate account change
   */
  simulateAccountChange(newAddress: string): void {
    if (!this.isConnected()) return

    const previousAddress = this._address
    this._address = newAddress
    this._publicKey = newAddress as HexString
    this._mockAddress = newAddress

    this.emit({
      type: 'accountChanged',
      previousAddress,
      newAddress,
      timestamp: Date.now(),
    })
  }

  /**
   * Simulate disconnect
   */
  simulateDisconnect(): void {
    this.setDisconnected('Mock disconnect triggered')
  }
}

/**
 * Factory function to create mock Ethereum adapter
 */
export function createMockEthereumAdapter(
  config?: MockEthereumAdapterConfig
): MockEthereumAdapter {
  return new MockEthereumAdapter(config)
}

/**
 * Create a mock EIP-1193 provider for testing
 */
export function createMockEthereumProvider(
  config: MockEthereumAdapterConfig = {}
): EIP1193Provider {
  const address = config.address ?? '0x742d35Cc6634C0532925a3b844Bc9e7595f8fB1b'
  const chainId = config.chainId ?? EthereumChainId.MAINNET
  const balance = config.balance ?? 1_000_000_000_000_000_000n
  const tokenBalances = new Map(Object.entries(config.tokenBalances ?? {}))
  const shouldFailConnect = config.shouldFailConnect ?? false
  const shouldFailSign = config.shouldFailSign ?? false
  const shouldFailTransaction = config.shouldFailTransaction ?? false

  let isConnected = false
  let txCounter = 0
  const eventHandlers: Map<string, Set<(...args: unknown[]) => void>> = new Map()

  const provider: EIP1193Provider = {
    isMetaMask: true,
    selectedAddress: null,
    chainId: toHex(chainId),

    isConnected(): boolean {
      return isConnected
    },

    async request<T = unknown>(args: EIP1193RequestArguments): Promise<T> {
      const { method, params } = args

      switch (method) {
        case 'eth_requestAccounts':
        case 'eth_accounts': {
          if (shouldFailConnect && method === 'eth_requestAccounts') {
            const error = new Error('User rejected') as Error & { code: number }
            error.code = 4001
            throw error
          }
          isConnected = true
          provider.selectedAddress = address
          return [address] as T
        }

        case 'eth_chainId':
          return toHex(chainId) as T

        case 'eth_getBalance':
          return toHex(balance) as T

        case 'eth_call': {
          const callParams = (params as unknown[])?.[0] as { to?: string; data?: string }
          if (callParams?.data?.startsWith('0x70a08231')) {
            // balanceOf call
            const tokenBalance = tokenBalances.get(callParams.to ?? '') ?? 0n
            return toHex(tokenBalance) as T
          }
          return '0x0' as T
        }

        case 'personal_sign': {
          if (shouldFailSign) {
            const error = new Error('User rejected') as Error & { code: number }
            error.code = 4001
            throw error
          }
          const message = (params as string[])?.[0] ?? ''
          return `0x${message.slice(2).padEnd(130, '0').slice(0, 130)}` as T
        }

        case 'eth_signTypedData_v4': {
          if (shouldFailSign) {
            const error = new Error('User rejected') as Error & { code: number }
            error.code = 4001
            throw error
          }
          return `0x${'1'.repeat(130)}` as T
        }

        case 'eth_signTransaction': {
          if (shouldFailSign) {
            const error = new Error('User rejected') as Error & { code: number }
            error.code = 4001
            throw error
          }
          return `0x${'2'.repeat(130)}` as T
        }

        case 'eth_sendTransaction': {
          if (shouldFailTransaction) {
            const error = new Error('Transaction failed') as Error & { code: number }
            error.code = -32000
            throw error
          }
          txCounter++
          return `0x${txCounter.toString(16).padStart(64, '0')}` as T
        }

        case 'eth_getTransactionReceipt': {
          const txHash = (params as string[])?.[0]
          if (txHash) {
            return {
              transactionHash: txHash,
              blockNumber: '0xbc614e',
              blockHash: '0x' + '0'.repeat(64),
              from: address,
              to: '0x' + '0'.repeat(40),
              gasUsed: '0x5208',
              effectiveGasPrice: '0x4a817c800',
              status: '0x1',
              contractAddress: null,
            } as T
          }
          return null as T
        }

        case 'eth_blockNumber':
          return '0xbc614e' as T

        case 'wallet_switchEthereumChain': {
          const switchParams = (params as unknown[])?.[0] as { chainId: string }
          const newChainId = parseInt(switchParams?.chainId ?? '0x1', 16)
          provider.chainId = switchParams?.chainId
          eventHandlers.get('chainChanged')?.forEach((handler) => {
            handler(switchParams?.chainId)
          })
          return undefined as T
        }

        default:
          throw new Error(`Method ${method} not implemented in mock`)
      }
    },

    on(event: string, handler: (...args: unknown[]) => void): void {
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, new Set())
      }
      eventHandlers.get(event)!.add(handler)
    },

    removeListener(event: string, handler: (...args: unknown[]) => void): void {
      eventHandlers.get(event)?.delete(handler)
    },
  }

  return provider
}
