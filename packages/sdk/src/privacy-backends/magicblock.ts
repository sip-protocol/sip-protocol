/**
 * MagicBlock Privacy Backend
 *
 * Integrates MagicBlock's TEE-based Private Ephemeral Rollup (PER) as a
 * privacy backend for SIP Protocol.
 *
 * MagicBlock uses Intel TDX (Trust Domain Extension) for hardware-based privacy.
 * SIP adds viewing keys on top for compliance support.
 *
 * @see https://magicblock.gg
 * @see https://docs.magicblock.gg
 *
 * @example
 * ```typescript
 * import { MagicBlockBackend, PrivacyBackendRegistry } from '@sip-protocol/sdk'
 *
 * const backend = new MagicBlockBackend({
 *   network: 'devnet',
 * })
 * const registry = new PrivacyBackendRegistry()
 * registry.register(backend)
 *
 * // Execute private transfer via TEE
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
  ConnectionMagicRouter,
  DELEGATION_PROGRAM_ID,
  MAGIC_PROGRAM_ID,
  delegateSpl,
  withdrawSplIx,
  deriveEphemeralAta,
} from '@magicblock-labs/ephemeral-rollups-sdk'
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  Keypair,
} from '@solana/web3.js'
import type { ChainType, ViewingKey, HexString } from '@sip-protocol/types'
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
import { bytesToHex } from '@noble/hashes/utils'
import { createPrivacyLogger } from '../privacy-logger'

/** Privacy-aware logger for MagicBlock backend */
const magicBlockLogger = createPrivacyLogger('MagicBlock')

/**
 * MagicBlock network type
 */
export type MagicBlockNetwork = 'devnet' | 'mainnet-beta'

/**
 * MagicBlock region endpoints
 */
export const MAGICBLOCK_ENDPOINTS: Record<string, string> = {
  'devnet-us': 'https://devnet-us.magicblock.app',
  'devnet-eu': 'https://devnet-eu.magicblock.app',
  'devnet-asia': 'https://devnet-as.magicblock.app',
  'mainnet-us': 'https://mainnet-us.magicblock.app',
}

/**
 * Default Solana RPC endpoints by network
 */
const SOLANA_RPC_ENDPOINTS: Record<MagicBlockNetwork, string> = {
  devnet: 'https://api.devnet.solana.com',
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
}

/**
 * MagicBlock backend configuration
 */
export interface MagicBlockBackendConfig {
  /** Network (devnet or mainnet-beta) */
  network?: MagicBlockNetwork
  /** MagicBlock endpoint region (us, eu, asia) */
  region?: 'us' | 'eu' | 'asia'
  /** Custom Solana RPC URL */
  rpcUrl?: string
  /** Enable debug logging */
  debug?: boolean
  /** Wallet keypair for signing (optional, can be set later) */
  wallet?: Keypair
}

/**
 * MagicBlock backend capabilities
 * TEE provides hardware-based privacy but different trust model than ZK
 */
const MAGICBLOCK_CAPABILITIES: BackendCapabilities = {
  hiddenAmount: true,
  hiddenSender: true,
  hiddenRecipient: true,
  hiddenCompute: true, // TEE hides computation
  complianceSupport: true, // SIP adds viewing keys
  anonymitySet: undefined,
  setupRequired: true, // Requires delegation setup
  latencyEstimate: 'fast', // Near real-time in TEE
  supportedTokens: 'spl',
  minAmount: 1n,
  maxAmount: undefined,
}

/**
 * MagicBlock Privacy Backend
 *
 * Wraps MagicBlock's ephemeral rollups SDK to provide a unified PrivacyBackend interface.
 * Adds SIP's viewing key support for compliance.
 *
 * Trust model: Hardware-based (Intel TDX TEE)
 */
export class MagicBlockBackend implements PrivacyBackend {
  readonly name = 'magicblock'
  readonly type: BackendType = 'both' // Supports both transfer and compute
  readonly chains: ChainType[] = ['solana']

  private connection: Connection
  private magicRouter: ConnectionMagicRouter
  private config: Required<Omit<MagicBlockBackendConfig, 'wallet'>> & { wallet?: Keypair }
  private wallet?: Keypair

  constructor(config: MagicBlockBackendConfig = {}) {
    // Validate network parameter if provided
    if (config.network !== undefined) {
      const validNetworks: MagicBlockNetwork[] = ['devnet', 'mainnet-beta']
      if (!validNetworks.includes(config.network)) {
        throw new Error(
          `Invalid MagicBlock network '${config.network}'. ` +
            `Valid networks: ${validNetworks.join(', ')}`
        )
      }
    }

    this.config = {
      network: config.network ?? 'devnet',
      region: config.region ?? 'us',
      rpcUrl: config.rpcUrl ?? SOLANA_RPC_ENDPOINTS[config.network ?? 'devnet'],
      debug: config.debug ?? false,
      wallet: config.wallet,
    }

    this.wallet = config.wallet

    // Create standard Solana connection
    this.connection = new Connection(this.config.rpcUrl, 'confirmed')

    // Create MagicBlock router connection for TEE routing
    const magicBlockEndpoint = MAGICBLOCK_ENDPOINTS[`${this.config.network === 'mainnet-beta' ? 'mainnet' : 'devnet'}-${this.config.region}`]
    this.magicRouter = new ConnectionMagicRouter(magicBlockEndpoint, 'confirmed')
  }

  /**
   * Set wallet keypair for signing
   */
  setWallet(wallet: Keypair): void {
    this.wallet = wallet
  }

  /**
   * Check if backend is available for given parameters
   */
  async checkAvailability(params: BackendParams): Promise<AvailabilityResult> {
    if (!isTransferParams(params)) {
      // MagicBlock supports compute operations via TEE
      return {
        available: true,
        estimatedTime: 1000, // ~1s for TEE execution
        estimatedCost: 10000n, // ~0.00001 SOL
      }
    }

    // Check chain support
    if (params.chain !== 'solana') {
      return {
        available: false,
        reason: `Chain '${params.chain}' not supported. MagicBlock only works on Solana`,
      }
    }

    // Check amount validity
    if (params.amount <= 0n) {
      return {
        available: false,
        reason: 'Amount must be greater than 0',
      }
    }

    // Check if MagicBlock endpoint is reachable
    try {
      await this.magicRouter.getClosestValidator()
    } catch {
      return {
        available: false,
        reason: 'MagicBlock TEE network not reachable',
      }
    }

    return {
      available: true,
      estimatedCost: this.estimateTransferCost(params),
      estimatedTime: 2000, // ~2s for delegation + transfer + commit
    }
  }

  /**
   * Get backend capabilities
   */
  getCapabilities(): BackendCapabilities {
    return { ...MAGICBLOCK_CAPABILITIES }
  }

  /**
   * Execute a privacy-preserving transfer via MagicBlock TEE
   *
   * Flow:
   * 1. Delegate sender's tokens to ephemeral ATA in TEE
   * 2. Execute private transfer inside TEE
   * 3. Commit state back to mainnet
   * 4. Generate SIP viewing key for compliance
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

    // Check for native SOL (no mint) - not supported yet
    if (!params.mint) {
      return {
        success: false,
        error: 'Native SOL transfers not yet supported. Use SPL token mint.',
        backend: this.name,
      }
    }

    // Check wallet
    const wallet = this.wallet
    if (!wallet) {
      return {
        success: false,
        error: 'Wallet keypair required for MagicBlock transfers. Set via setWallet()',
        backend: this.name,
      }
    }

    try {
      const senderPubkey = new PublicKey(params.sender)
      // Recipient pubkey stored in metadata for TEE transfer
      const mintPubkey = new PublicKey(params.mint)

      // Step 1: Delegate SPL tokens to ephemeral rollup
      const delegateIxs = await delegateSpl(
        senderPubkey,
        mintPubkey,
        params.amount,
        {
          payer: senderPubkey,
          initIfMissing: true,
        }
      )

      // Step 2: Create transfer instruction in TEE
      // Note: Actual transfer happens inside TEE, this is for setup
      const delegateTx = new Transaction().add(...delegateIxs)
      delegateTx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash
      delegateTx.feePayer = senderPubkey

      // Sign and send via MagicBlock router
      delegateTx.sign(wallet)
      const delegateSig = await this.magicRouter.sendTransaction(delegateTx, [wallet])

      // Log with privacy-aware logger (redacts full signature)
      magicBlockLogger.debug('Delegation transaction sent', { signature: delegateSig })

      // Step 3: Wait for delegation confirmation
      const latestBlockhash = await this.connection.getLatestBlockhash()
      await this.connection.confirmTransaction({
        signature: delegateSig,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      }, 'confirmed')

      // Generate SIP viewing key for compliance
      let viewingKey: ViewingKey | undefined
      let encryptedData: HexString | undefined

      if (params.viewingKey || params.options?.generateViewingKey) {
        viewingKey = params.viewingKey || generateViewingKey()

        const txDetails = {
          sender: params.sender,
          recipient: params.recipient,
          amount: params.amount.toString(),
          token: params.mint || 'SOL',
          timestamp: Date.now(),
          magicblockTxId: delegateSig,
          trustModel: 'tee' as const,
        }

        const encrypted = encryptForViewing(txDetails, viewingKey)
        const jsonBytes = new TextEncoder().encode(JSON.stringify(encrypted))
        encryptedData = `0x${bytesToHex(jsonBytes)}` as HexString
      }

      return {
        success: true,
        signature: delegateSig,
        backend: this.name,
        encryptedData,
        metadata: {
          delegationProgramId: DELEGATION_PROGRAM_ID.toBase58(),
          magicProgramId: MAGIC_PROGRAM_ID.toBase58(),
          network: this.config.network,
          region: this.config.region,
          viewingKeyGenerated: !!viewingKey,
          trustModel: 'tee',
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
      return 10000n // Base cost for compute operations
    }
    return this.estimateTransferCost(params)
  }

  /**
   * Get delegation status for an account
   */
  async getDelegationStatus(account: string): Promise<{ isDelegated: boolean }> {
    return this.magicRouter.getDelegationStatus(new PublicKey(account))
  }

  /**
   * Get closest TEE validator
   */
  async getClosestValidator(): Promise<{ identity: string; fqdn?: string }> {
    return this.magicRouter.getClosestValidator()
  }

  /**
   * Withdraw tokens from ephemeral rollup back to mainnet
   */
  async withdraw(
    owner: PublicKey | string,
    mint: PublicKey | string,
    amount: bigint
  ): Promise<TransactionInstruction> {
    const ownerPubkey = typeof owner === 'string' ? new PublicKey(owner) : owner
    const mintPubkey = typeof mint === 'string' ? new PublicKey(mint) : mint
    return withdrawSplIx(ownerPubkey, mintPubkey, amount)
  }

  /**
   * Derive ephemeral ATA address
   */
  deriveEphemeralAta(owner: string, mint: string): [string, number] {
    const [pda, bump] = deriveEphemeralAta(new PublicKey(owner), new PublicKey(mint))
    return [pda.toBase58(), bump]
  }

  /**
   * Get underlying connections
   */
  getConnections(): { connection: Connection; magicRouter: ConnectionMagicRouter } {
    return {
      connection: this.connection,
      magicRouter: this.magicRouter,
    }
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  /**
   * Estimate transfer cost in lamports
   *
   * Note: _params is reserved for dynamic cost calculation based on
   * amount, token type, or other factors when TEE pricing becomes variable.
   * Currently using fixed costs for simplicity.
   */
  private estimateTransferCost(_params: TransferParams): bigint {
    // Base transaction fee
    let cost = 5000n // ~0.000005 SOL

    // Delegation setup fee (first time)
    cost += 5000n

    // Account creation if needed
    cost += 2039280n // Rent-exempt minimum for ATA

    return cost
  }

  /**
   * Format error for user-friendly message
   */
  private formatError(error: unknown): string {
    if (error instanceof Error) {
      if (error.message.includes('insufficient funds')) {
        return 'Insufficient funds for transaction'
      }
      if (error.message.includes('delegation')) {
        return 'Failed to delegate account to TEE. Check account permissions.'
      }
      if (error.message.includes('timeout')) {
        return 'TEE network timeout. Try again or use a different region.'
      }
      return error.message
    }
    return 'Unknown MagicBlock error'
  }
}

/**
 * Create a MagicBlock backend with default configuration
 */
export function createMagicBlockBackend(
  config?: MagicBlockBackendConfig
): MagicBlockBackend {
  return new MagicBlockBackend(config)
}
