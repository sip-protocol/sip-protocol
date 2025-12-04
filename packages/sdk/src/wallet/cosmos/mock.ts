/**
 * Mock Cosmos Wallet Adapter
 *
 * Testing implementation of Cosmos wallet adapter.
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
  Keplr,
  Key,
  StdSignDoc,
  DirectSignDoc,
  AminoSignResponse,
  DirectSignResponse,
  CosmosAccountData,
  CosmosUnsignedTransaction,
  CosmosAlgo,
  StdSignature,
  PubKey,
  OfflineSigner,
  OfflineAminoSigner,
} from './types'
import {
  cosmosPublicKeyToHex,
  getDefaultRpcEndpoint,
  getDefaultRestEndpoint,
  CosmosChainId,
} from './types'

/**
 * Configuration for mock Cosmos adapter
 */
export interface MockCosmosAdapterConfig {
  /** Mock address (bech32) */
  address?: string
  /** Mock balance in base units */
  balance?: bigint
  /** Token balances by denomination */
  tokenBalances?: Record<string, bigint>
  /** Whether to simulate connection failure */
  shouldFailConnect?: boolean
  /** Whether to simulate signing failure */
  shouldFailSign?: boolean
  /** Whether to simulate transaction failure */
  shouldFailTransaction?: boolean
  /** Simulated chain ID */
  chainId?: string
  /** Simulated latency in ms */
  latency?: number
  /** Algorithm to use */
  algo?: CosmosAlgo
  /** Bech32 prefix */
  bech32Prefix?: string
}

/**
 * Mock Cosmos wallet adapter for testing
 *
 * Provides full Cosmos wallet functionality with mock data.
 * No browser environment or actual wallet required.
 *
 * @example
 * ```typescript
 * const wallet = new MockCosmosAdapter({
 *   address: 'cosmos1testaddress123',
 *   balance: 1_000_000n, // 1 ATOM
 * })
 *
 * await wallet.connect()
 * const balance = await wallet.getBalance() // 1_000_000n
 *
 * // Simulate failures
 * const failingWallet = new MockCosmosAdapter({
 *   shouldFailSign: true,
 * })
 * ```
 */
export class MockCosmosAdapter extends BaseWalletAdapter {
  readonly chain = 'cosmos' as const
  readonly name = 'mock-cosmos'

  private mockAddress: string
  private mockPubKey: Uint8Array
  private mockBalance: bigint
  private mockTokenBalances: Map<string, bigint>
  private shouldFailConnect: boolean
  private shouldFailSign: boolean
  private shouldFailTransaction: boolean
  private _chainId: string
  private latency: number
  private algo: CosmosAlgo
  private bech32Prefix: string

  // Track signed transactions for verification
  private signedAmino: StdSignDoc[] = []
  private signedDirect: DirectSignDoc[] = []
  private sentTransactions: string[] = []

  constructor(config: MockCosmosAdapterConfig = {}) {
    super()
    this.mockAddress = config.address ?? 'cosmos1mockaddress1234567890abcdef'
    this.mockBalance = config.balance ?? 1_000_000n // 1 ATOM default
    this.mockTokenBalances = new Map(Object.entries(config.tokenBalances ?? {}))
    this.shouldFailConnect = config.shouldFailConnect ?? false
    this.shouldFailSign = config.shouldFailSign ?? false
    this.shouldFailTransaction = config.shouldFailTransaction ?? false
    this._chainId = config.chainId ?? CosmosChainId.COSMOSHUB
    this.latency = config.latency ?? 10
    this.algo = config.algo ?? 'secp256k1'
    this.bech32Prefix = config.bech32Prefix ?? 'cosmos'

    // Create deterministic mock public key
    this.mockPubKey = new Uint8Array(33)
    for (let i = 0; i < 33; i++) {
      this.mockPubKey[i] = this.mockAddress.charCodeAt(i % this.mockAddress.length) ^ i
    }
  }

  /**
   * Get the current Cosmos chain ID
   */
  getChainId(): string {
    return this._chainId
  }

  /**
   * Get RPC endpoint
   */
  getRpcEndpoint(): string {
    return getDefaultRpcEndpoint(this._chainId)
  }

  /**
   * Get REST endpoint
   */
  getRestEndpoint(): string {
    return getDefaultRestEndpoint(this._chainId)
  }

  /**
   * Get Bech32 prefix
   */
  getBech32Prefix(): string {
    return this.bech32Prefix
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

    const hexPubKey = cosmosPublicKeyToHex(this.mockPubKey)
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

    const cosmosTx = tx.data as CosmosUnsignedTransaction

    if (cosmosTx.aminoSignDoc) {
      this.signedAmino.push(cosmosTx.aminoSignDoc)
    } else if (cosmosTx.directSignDoc) {
      this.signedDirect.push(cosmosTx.directSignDoc)
    }

    // Serialize transaction data, handling BigInt
    const txDataStr = JSON.stringify(tx.data, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
    const signature = await this.signMessage(
      new TextEncoder().encode(txDataStr)
    )

    // Serialize transaction data, handling BigInt
    const serializedData = JSON.stringify(tx.data, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )

    return {
      unsigned: tx,
      signatures: [signature],
      serialized: ('0x' + Buffer.from(serializedData).toString('hex')) as HexString,
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

    // Generate mock transaction hash
    const txHash = `cosmos_tx_${Date.now()}_${Math.random().toString(36).slice(2)}`
    this.sentTransactions.push(txHash)

    return {
      txHash: ('0x' + Buffer.from(txHash).toString('hex')) as HexString,
      status: 'confirmed',
      blockNumber: BigInt(Math.floor(Math.random() * 1000000)),
      timestamp: Date.now(),
    }
  }

  /**
   * Get native balance
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

    if (asset.chain !== 'cosmos') {
      throw new WalletError(
        `Asset chain ${asset.chain} not supported by Cosmos adapter`,
        WalletErrorCode.UNSUPPORTED_CHAIN
      )
    }

    const denom = asset.address ?? asset.symbol.toLowerCase()
    return this.mockTokenBalances.get(denom) ?? 0n
  }

  /**
   * Sign using Amino
   */
  async signAmino(
    signerAddress: string,
    signDoc: StdSignDoc
  ): Promise<AminoSignResponse> {
    this.requireConnected()
    await this.simulateLatency()

    if (this.shouldFailSign) {
      throw new WalletError('Mock signing failure', WalletErrorCode.SIGNING_REJECTED)
    }

    this.signedAmino.push(signDoc)

    const signature = await this.signMessage(
      new TextEncoder().encode(JSON.stringify(signDoc))
    )

    const stdSig: StdSignature = {
      pub_key: {
        type: 'tendermint/PubKeySecp256k1',
        value: Buffer.from(this.mockPubKey).toString('base64'),
      },
      signature: Buffer.from(signature.signature.slice(2), 'hex').toString('base64'),
    }

    return {
      signed: signDoc,
      signature: stdSig,
    }
  }

  /**
   * Sign using Direct
   */
  async signDirect(
    signerAddress: string,
    signDoc: DirectSignDoc
  ): Promise<DirectSignResponse> {
    this.requireConnected()
    await this.simulateLatency()

    if (this.shouldFailSign) {
      throw new WalletError('Mock signing failure', WalletErrorCode.SIGNING_REJECTED)
    }

    this.signedDirect.push(signDoc)

    const signature = await this.signMessage(
      new Uint8Array([...signDoc.bodyBytes, ...signDoc.authInfoBytes])
    )

    const stdSig: StdSignature = {
      pub_key: {
        type: 'tendermint/PubKeySecp256k1',
        value: Buffer.from(this.mockPubKey).toString('base64'),
      },
      signature: Buffer.from(signature.signature.slice(2), 'hex').toString('base64'),
    }

    return {
      signed: signDoc,
      signature: stdSig,
    }
  }

  /**
   * Get key info
   */
  getKeyInfo(): Key {
    return {
      name: 'Mock Cosmos Account',
      algo: this.algo,
      pubKey: this.mockPubKey,
      address: this.mockAddress,
      bech32Address: this.mockAddress,
    }
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
  setMockTokenBalance(denom: string, balance: bigint): void {
    this.mockTokenBalances.set(denom, balance)
  }

  /**
   * Get all signed Amino transactions (for verification)
   */
  getSignedAminoTransactions(): StdSignDoc[] {
    return [...this.signedAmino]
  }

  /**
   * Get all signed Direct transactions (for verification)
   */
  getSignedDirectTransactions(): DirectSignDoc[] {
    return [...this.signedDirect]
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
    this.signedAmino = []
    this.signedDirect = []
    this.sentTransactions = []
  }

  /**
   * Simulate an account change event
   */
  simulateAccountChange(newAddress: string): void {
    const previousAddress = this._address
    this.mockAddress = newAddress
    this._address = newAddress

    // Update public key
    this.mockPubKey = new Uint8Array(33)
    for (let i = 0; i < 33; i++) {
      this.mockPubKey[i] = newAddress.charCodeAt(i % newAddress.length) ^ i
    }
    this._publicKey = cosmosPublicKeyToHex(this.mockPubKey)

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
 * Create a mock Cosmos wallet provider for testing real adapter
 */
export function createMockCosmosProvider(
  config: MockCosmosAdapterConfig = {}
): Keplr {
  const address = config.address ?? 'cosmos1mockaddress1234567890abcdef'
  const chainId = config.chainId ?? CosmosChainId.COSMOSHUB
  const algo = config.algo ?? 'secp256k1'

  const mockPubKey = new Uint8Array(33)
  for (let i = 0; i < 33; i++) {
    mockPubKey[i] = address.charCodeAt(i % address.length) ^ i
  }

  const key: Key = {
    name: 'Mock Cosmos Account',
    algo,
    pubKey: mockPubKey,
    address,
    bech32Address: address,
  }

  const mockKeplr: Keplr = {
    async enable() {
      if (config.shouldFailConnect) {
        throw new Error('Request rejected by user')
      }
    },

    async getKey() {
      return key
    },

    async signAmino(chainId: string, signer: string, signDoc: StdSignDoc): Promise<AminoSignResponse> {
      if (config.shouldFailSign) {
        throw new Error('Request rejected by user')
      }

      const mockSig: StdSignature = {
        pub_key: {
          type: 'tendermint/PubKeySecp256k1',
          value: Buffer.from(mockPubKey).toString('base64'),
        },
        signature: Buffer.from(new Uint8Array(64).fill(1)).toString('base64'),
      }

      return {
        signed: signDoc,
        signature: mockSig,
      }
    },

    async signDirect(chainId: string, signer: string, signDoc: {
      bodyBytes?: Uint8Array | null
      authInfoBytes?: Uint8Array | null
      chainId?: string | null
      accountNumber?: bigint | null
    }): Promise<DirectSignResponse> {
      if (config.shouldFailSign) {
        throw new Error('Request rejected by user')
      }

      const mockSig: StdSignature = {
        pub_key: {
          type: 'tendermint/PubKeySecp256k1',
          value: Buffer.from(mockPubKey).toString('base64'),
        },
        signature: Buffer.from(new Uint8Array(64).fill(1)).toString('base64'),
      }

      return {
        signed: {
          bodyBytes: signDoc.bodyBytes ?? new Uint8Array(),
          authInfoBytes: signDoc.authInfoBytes ?? new Uint8Array(),
          chainId: signDoc.chainId ?? chainId,
          accountNumber: signDoc.accountNumber ?? 0n,
        },
        signature: mockSig,
      }
    },

    async signArbitrary(_chainId: string, _signer: string, data: string | Uint8Array): Promise<StdSignature> {
      if (config.shouldFailSign) {
        throw new Error('Request rejected by user')
      }

      return {
        pub_key: {
          type: 'tendermint/PubKeySecp256k1',
          value: Buffer.from(mockPubKey).toString('base64'),
        },
        signature: Buffer.from(new Uint8Array(64).fill(1)).toString('base64'),
      }
    },

    async verifyArbitrary(): Promise<boolean> {
      return true
    },

    async getOfflineSignerAuto(_chainId: string): Promise<OfflineSigner> {
      return {
        getAccounts: async (): Promise<readonly CosmosAccountData[]> => {
          return [{ address, algo, pubkey: mockPubKey }]
        },
        signDirect: async (signerAddress: string, signDoc: DirectSignDoc): Promise<DirectSignResponse> => {
          return mockKeplr.signDirect(chainId, signerAddress, signDoc)
        },
      }
    },

    async getOfflineSignerOnlyAmino(_chainId: string): Promise<OfflineAminoSigner> {
      return {
        getAccounts: async (): Promise<readonly CosmosAccountData[]> => {
          return [{ address, algo, pubkey: mockPubKey }]
        },
        signAmino: async (signerAddress: string, signDoc: StdSignDoc): Promise<AminoSignResponse> => {
          return mockKeplr.signAmino(chainId, signerAddress, signDoc)
        },
      }
    },

    async getOfflineSigner(chainId: string) {
      return this.getOfflineSignerAuto(chainId)
    },

    async experimentalSuggestChain() {
      // No-op for mock
    },
  }

  return mockKeplr
}

/**
 * Create a mock Cosmos adapter
 */
export function createMockCosmosAdapter(
  config: MockCosmosAdapterConfig = {}
): MockCosmosAdapter {
  return new MockCosmosAdapter(config)
}
