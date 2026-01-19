/**
 * ShadowWire Privacy Backend
 *
 * Integrates ShadowWire by Radr Labs as a privacy backend for SIP Protocol.
 * ShadowWire uses Pedersen Commitments + Bulletproofs for amount hiding.
 *
 * SIP adds viewing keys to ShadowWire for compliance support.
 *
 * @see https://radrlabs.io
 * @see https://github.com/Radrdotfun/ShadowWire
 *
 * @example
 * ```typescript
 * import { ShadowWireBackend, PrivacyBackendRegistry } from '@sip-protocol/sdk'
 *
 * const backend = new ShadowWireBackend()
 * const registry = new PrivacyBackendRegistry()
 * registry.register(backend)
 *
 * // Execute private transfer
 * const result = await backend.execute({
 *   chain: 'solana',
 *   sender: 'sender-pubkey',
 *   recipient: 'recipient-pubkey',
 *   mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
 *   amount: 1000000n, // 1 USDC
 *   decimals: 6,
 * })
 * ```
 */

import {
  ShadowWireClient,
  type TransferType,
  type TokenSymbol,
  type WalletAdapter,
  InsufficientBalanceError,
  RecipientNotFoundError,
  InvalidAmountError,
  InvalidAddressError,
} from '@radr/shadowwire'
import type { ChainType, ViewingKey } from '@sip-protocol/types'
import type {
  PrivacyBackend,
  BackendType,
  BackendCapabilities,
  TransferParams,
  TransactionResult,
  AvailabilityResult,
  BackendParams,
} from './interface'
import { isTransferParams } from './interface'
import { generateViewingKey, encryptForViewing } from '../privacy'
import type { HexString } from '@sip-protocol/types'
import { bytesToHex } from '@noble/hashes/utils'

/**
 * ShadowWire supported token mint addresses
 * Note: ShadowWire supports a specific set of tokens. Check SUPPORTED_TOKENS in @radr/shadowwire
 */
export const SHADOWWIRE_TOKEN_MINTS: Record<TokenSymbol, string> = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  RADR: 'RADRi35VqLmMu4t7Gax1KVszxnQnbtqEwJQJVfzpump',
  ORE: 'oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhycK7fw73F', // ORE mining token
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  JIM: 'JIMa1xG7h7h7h7h7h7h7h7h7h7h7h7h7h7h7h7h7', // Placeholder
  GODL: 'GODL1111111111111111111111111111111111111', // Placeholder
  HUSTLE: 'HUSTLEexampleaddress1111111111111111111', // Placeholder
  ZEC: 'ZECexampleaddress1111111111111111111111111', // Placeholder
  CRT: 'CRTexampleaddress11111111111111111111111111', // Placeholder
  BLACKCOIN: 'BLACKexampleaddress111111111111111111111', // Placeholder
  GIL: 'GILexampleaddress11111111111111111111111111', // Placeholder
  ANON: 'ANONexampleaddress1111111111111111111111111', // Placeholder
  WLFI: 'WLFIexampleaddress1111111111111111111111111', // Placeholder - World Liberty Financial
  USD1: 'USD1exampleaddress1111111111111111111111111', // Placeholder - USD1 stablecoin
  AOL: 'AOLexampleaddress11111111111111111111111111', // Placeholder
  IQLABS: 'IQLABSexampleaddress111111111111111111111', // Placeholder - IQ Labs token
}

/**
 * Reverse lookup: mint address to symbol
 */
const MINT_TO_SYMBOL: Record<string, TokenSymbol> = Object.fromEntries(
  Object.entries(SHADOWWIRE_TOKEN_MINTS).map(([symbol, mint]) => [mint, symbol as TokenSymbol])
)

/**
 * ShadowWire backend configuration
 */
export interface ShadowWireBackendConfig {
  /** API base URL (optional, uses default if not provided) */
  apiBaseUrl?: string
  /** Enable debug logging */
  debug?: boolean
  /** Default transfer type */
  defaultTransferType?: TransferType
  /** Wallet adapter for signing */
  wallet?: WalletAdapter
  /** Enable client-side proof generation (WASM) */
  clientSideProofs?: boolean
}

/**
 * ShadowWire backend capabilities
 */
const SHADOWWIRE_CAPABILITIES: BackendCapabilities = {
  hiddenAmount: true,
  hiddenSender: true,
  hiddenRecipient: true, // Internal transfers only
  hiddenCompute: false,
  complianceSupport: true, // SIP adds viewing keys
  anonymitySet: undefined, // Not pool-based
  setupRequired: false,
  latencyEstimate: 'medium', // ~500ms for proof generation
  supportedTokens: 'spl',
  minAmount: 1n, // Minimum 1 lamport
  maxAmount: undefined,
}

/**
 * ShadowWire Privacy Backend
 *
 * Wraps the ShadowWire SDK to provide a unified PrivacyBackend interface.
 * Adds SIP's viewing key support for compliance.
 */
export class ShadowWireBackend implements PrivacyBackend {
  readonly name = 'shadowwire'
  readonly type: BackendType = 'transaction'
  readonly chains: ChainType[] = ['solana']

  private client: ShadowWireClient
  private config: ShadowWireBackendConfig
  private wallet?: WalletAdapter

  constructor(config: ShadowWireBackendConfig = {}) {
    this.config = {
      defaultTransferType: 'internal',
      clientSideProofs: false,
      ...config,
    }

    this.client = new ShadowWireClient({
      debug: config.debug,
      apiBaseUrl: config.apiBaseUrl,
    })

    this.wallet = config.wallet
  }

  /**
   * Set wallet adapter for signing
   */
  setWallet(wallet: WalletAdapter): void {
    this.wallet = wallet
  }

  /**
   * Check if backend is available for given parameters
   */
  async checkAvailability(params: BackendParams): Promise<AvailabilityResult> {
    if (!isTransferParams(params)) {
      return {
        available: false,
        reason: 'ShadowWire only supports transfer operations, not compute',
      }
    }

    // Check chain support
    if (params.chain !== 'solana') {
      return {
        available: false,
        reason: `Chain '${params.chain}' not supported. ShadowWire only works on Solana`,
      }
    }

    // Check token support
    const tokenSymbol = this.getTokenSymbol(params.mint)
    if (!tokenSymbol) {
      return {
        available: false,
        reason: `Token mint '${params.mint}' not supported by ShadowWire`,
      }
    }

    // Check amount validity
    if (params.amount <= 0n) {
      return {
        available: false,
        reason: 'Amount must be greater than 0',
      }
    }

    // Check balance (if wallet is connected)
    if (this.wallet) {
      try {
        const balance = await this.client.getBalance(params.sender, tokenSymbol)
        if (BigInt(balance.available) < params.amount) {
          return {
            available: false,
            reason: `Insufficient ShadowWire balance. Have: ${balance.available}, Need: ${params.amount}`,
          }
        }
      } catch {
        // Balance check failed, but might still be available
      }
    }

    return {
      available: true,
      estimatedCost: this.estimateTransferCost(params),
      estimatedTime: 2000, // ~2s for proof generation + confirmation
    }
  }

  /**
   * Get backend capabilities
   */
  getCapabilities(): BackendCapabilities {
    return { ...SHADOWWIRE_CAPABILITIES }
  }

  /**
   * Execute a privacy-preserving transfer via ShadowWire
   */
  async execute(params: TransferParams): Promise<TransactionResult> {
    // Validate parameters
    const validation = await this.checkAvailability(params)
    if (!validation.available) {
      return {
        success: false,
        error: validation.reason,
        backend: this.name,
      }
    }

    // Get token symbol
    const tokenSymbol = this.getTokenSymbol(params.mint)
    if (!tokenSymbol) {
      return {
        success: false,
        error: `Unsupported token: ${params.mint}`,
        backend: this.name,
      }
    }

    // Determine wallet
    const wallet = this.wallet || (params.options?.wallet as WalletAdapter | undefined)
    if (!wallet) {
      return {
        success: false,
        error: 'Wallet adapter required for ShadowWire transfers. Set via setWallet() or options.wallet',
        backend: this.name,
      }
    }

    try {
      // Determine transfer type
      const transferType: TransferType =
        (params.options?.transferType as TransferType) ||
        this.config.defaultTransferType ||
        'internal'

      // Convert amount to decimal (ShadowWire uses decimal amounts)
      const decimalAmount = Number(params.amount) / Math.pow(10, params.decimals)

      // Execute ShadowWire transfer
      const response = await this.client.transfer({
        sender: params.sender,
        recipient: params.recipient,
        amount: decimalAmount,
        token: tokenSymbol,
        type: transferType,
        wallet,
      })

      // Generate SIP viewing key for compliance
      let viewingKey: ViewingKey | undefined
      let encryptedData: HexString | undefined

      if (params.viewingKey || params.options?.generateViewingKey) {
        viewingKey = params.viewingKey || generateViewingKey()

        // Encrypt transaction details for viewing key holder
        const txDetails = {
          sender: params.sender,
          recipient: params.recipient,
          amount: params.amount.toString(),
          token: tokenSymbol,
          timestamp: Date.now(),
          shadowwireTxId: response.tx_signature,
        }

        // encryptForViewing returns EncryptedTransaction object
        const encrypted = encryptForViewing(txDetails, viewingKey)
        // Convert to hex string for storage
        const jsonBytes = new TextEncoder().encode(JSON.stringify(encrypted))
        encryptedData = `0x${bytesToHex(jsonBytes)}` as HexString
      }

      return {
        success: true,
        signature: response.tx_signature,
        backend: this.name,
        encryptedData,
        metadata: {
          transferType,
          token: tokenSymbol,
          viewingKeyGenerated: !!viewingKey,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: this.formatError(error),
        backend: this.name,
      }
    }
  }

  /**
   * Estimate cost for a transfer
   */
  async estimateCost(params: BackendParams): Promise<bigint> {
    if (!isTransferParams(params)) {
      return 0n
    }
    return this.estimateTransferCost(params)
  }

  /**
   * Get ShadowWire balance for a token
   */
  async getBalance(walletAddress: string, token: TokenSymbol): Promise<bigint> {
    const balance = await this.client.getBalance(walletAddress, token)
    return BigInt(balance.available)
  }

  /**
   * Deposit funds into ShadowWire pool
   * Returns an unsigned transaction that must be signed and sent by the caller
   */
  async deposit(
    walletAddress: string,
    amount: number,
    tokenMint?: string
  ): Promise<{ unsignedTx: string; poolAddress: string }> {
    const response = await this.client.deposit({
      wallet: walletAddress,
      amount,
      token_mint: tokenMint,
    })
    return {
      unsignedTx: response.unsigned_tx_base64,
      poolAddress: response.pool_address,
    }
  }

  /**
   * Withdraw funds from ShadowWire pool
   * Returns an unsigned transaction that must be signed and sent by the caller
   */
  async withdraw(
    walletAddress: string,
    amount: number,
    tokenMint?: string
  ): Promise<{ unsignedTx: string; amountWithdrawn: number; fee: number }> {
    const response = await this.client.withdraw({
      wallet: walletAddress,
      amount,
      token_mint: tokenMint,
    })
    return {
      unsignedTx: response.unsigned_tx_base64,
      amountWithdrawn: response.amount_withdrawn,
      fee: response.fee,
    }
  }

  /**
   * Get underlying ShadowWire client
   */
  getClient(): ShadowWireClient {
    return this.client
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  /**
   * Get token symbol from mint address
   */
  private getTokenSymbol(mint: string | null): TokenSymbol | undefined {
    if (!mint) {
      return 'SOL'
    }
    return MINT_TO_SYMBOL[mint]
  }

  /**
   * Estimate transfer cost in lamports
   */
  private estimateTransferCost(params: TransferParams): bigint {
    // Base transaction fee
    let cost = 5000n // ~0.000005 SOL

    // Add proof generation cost estimate
    const transferType =
      (params.options?.transferType as TransferType) ||
      this.config.defaultTransferType ||
      'internal'

    if (transferType === 'internal') {
      cost += 10000n // Additional cost for ZK proof verification
    }

    return cost
  }

  /**
   * Format error for user-friendly message
   */
  private formatError(error: unknown): string {
    if (error instanceof InsufficientBalanceError) {
      return 'Insufficient balance in ShadowWire pool. Deposit funds first.'
    }
    if (error instanceof RecipientNotFoundError) {
      return 'Recipient must be a ShadowWire user for internal transfers. Use external transfer type for non-users.'
    }
    if (error instanceof InvalidAmountError) {
      return 'Invalid transfer amount'
    }
    if (error instanceof InvalidAddressError) {
      return 'Invalid Solana address'
    }
    if (error instanceof Error) {
      return error.message
    }
    return 'Unknown ShadowWire error'
  }
}

/**
 * Create a ShadowWire backend with default configuration
 */
export function createShadowWireBackend(
  config?: ShadowWireBackendConfig
): ShadowWireBackend {
  return new ShadowWireBackend(config)
}
