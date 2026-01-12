/**
 * Arcium Privacy Backend Types
 *
 * Type definitions for Arcium MPC (Multi-Party Computation) privacy backend
 * and C-SPL (Confidential SPL) token standard integration.
 *
 * ## Overview
 *
 * Arcium provides **compute privacy** for Solana:
 * - Encrypted computation via MPC (Multi-Party Computation)
 * - C-SPL token standard for confidential balances/transfers
 * - Confidential Auditor Adapter for compliance
 *
 * ## C-SPL Token Standard
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────┐
 * │  C-SPL vs SPL Token                                        │
 * │                                                             │
 * │  Feature          │ SPL Token    │ C-SPL Token             │
 * │  ─────────────────┼──────────────┼─────────────────────────│
 * │  Balances         │ Public       │ Encrypted               │
 * │  Transfer Amounts │ Public       │ Encrypted               │
 * │  Sender/Recipient │ Public       │ Public                  │
 * │  DeFi Compatible  │ ✅           │ ✅                      │
 * │  Compliance       │ Manual       │ Auditor Adapter         │
 * └─────────────────────────────────────────────────────────────┘
 * ```
 *
 * @module privacy-backends/arcium-types
 */

// ─── Network Configuration ───────────────────────────────────────────────────

/**
 * Arcium network environment
 */
export type ArciumNetwork = 'devnet' | 'testnet' | 'mainnet'

/**
 * Arcium RPC endpoints by network
 */
export const ARCIUM_RPC_ENDPOINTS: Record<ArciumNetwork, string> = {
  devnet: 'https://devnet.arcium.network',
  testnet: 'https://testnet.arcium.network',
  mainnet: 'https://mainnet.arcium.network',
}

/**
 * Arcium program IDs
 *
 * Note: These are placeholder IDs until official deployment
 */
export const ARCIUM_PROGRAM_IDS = {
  /** Main Arcium program */
  ARCIUM_PROGRAM: 'ArciumProgram11111111111111111111111111111',
  /** C-SPL Token program */
  CSPL_TOKEN_PROGRAM: 'CSPLToken111111111111111111111111111111111',
  /** Confidential Auditor program */
  AUDITOR_PROGRAM: 'ArciumAuditor1111111111111111111111111111',
} as const

// ─── C-SPL Token Types ───────────────────────────────────────────────────────

/**
 * C-SPL Token definition
 *
 * Represents a confidential version of an SPL token
 */
export interface CSPLToken {
  /** Original SPL token mint address */
  splMint: string
  /** C-SPL wrapped mint address (derived from SPL mint) */
  csplMint: string
  /** Token symbol (e.g., 'USDC', 'SOL') */
  symbol: string
  /** Token decimals */
  decimals: number
  /** Whether wrapping/unwrapping is enabled */
  wrapEnabled: boolean
}

/**
 * Known C-SPL token registry
 *
 * Maps SPL token mints to their C-SPL counterparts
 */
export const CSPL_TOKEN_REGISTRY: Record<string, CSPLToken> = {
  // Native SOL (wrapped)
  So11111111111111111111111111111111111111112: {
    splMint: 'So11111111111111111111111111111111111111112',
    csplMint: 'cSOL1111111111111111111111111111111111111111',
    symbol: 'cSOL',
    decimals: 9,
    wrapEnabled: true,
  },
  // USDC
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: {
    splMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    csplMint: 'cUSDC111111111111111111111111111111111111111',
    symbol: 'cUSDC',
    decimals: 6,
    wrapEnabled: true,
  },
  // USDT
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: {
    splMint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    csplMint: 'cUSDT111111111111111111111111111111111111111',
    symbol: 'cUSDT',
    decimals: 6,
    wrapEnabled: true,
  },
}

/**
 * Check if an SPL token has C-SPL support
 */
export function hasCSPLSupport(splMint: string): boolean {
  return splMint in CSPL_TOKEN_REGISTRY
}

/**
 * Get C-SPL token info for an SPL mint
 */
export function getCSPLToken(splMint: string): CSPLToken | null {
  return CSPL_TOKEN_REGISTRY[splMint] ?? null
}

// ─── MPC Computation Types ───────────────────────────────────────────────────

/**
 * MPC computation status
 */
export type ComputationStatus =
  | 'pending'      // Submitted, waiting for execution
  | 'executing'    // Currently being computed by MXE nodes
  | 'finalized'    // Successfully completed
  | 'failed'       // Computation failed

/**
 * MPC computation reference
 *
 * Unique identifier for tracking a computation
 */
export interface ComputationReference {
  /** Computation ID (on-chain) */
  id: string
  /** Cluster that executed the computation */
  clusterId: string
  /** Slot when computation was submitted */
  submitSlot: number
}

/**
 * MPC computation result
 */
export interface ComputationResult {
  /** Computation reference */
  reference: ComputationReference
  /** Computation status */
  status: ComputationStatus
  /** Encrypted output (if finalized) */
  encryptedOutput?: Uint8Array
  /** Decrypted output (if decryption key provided) */
  decryptedOutput?: unknown
  /** Transaction signature (if on-chain) */
  signature?: string
  /** Error message (if failed) */
  error?: string
  /** Computation duration in ms */
  durationMs?: number
}

// ─── Confidential Transfer Types ─────────────────────────────────────────────

/**
 * Parameters for C-SPL confidential transfer
 */
export interface CSPLTransferParams {
  /** C-SPL token to transfer */
  token: CSPLToken
  /** Transfer amount (will be encrypted) */
  amount: bigint
  /** Sender address (public) */
  sender: string
  /** Recipient address (public) */
  recipient: string
  /** Auditor public key (for compliance) */
  auditorKey?: string
  /** Memo (optional, public) */
  memo?: string
}

/**
 * Result of C-SPL confidential transfer
 */
export interface CSPLTransferResult {
  /** Whether transfer succeeded */
  success: boolean
  /** Transaction signature */
  signature?: string
  /** Computation reference (for MPC tracking) */
  computation?: ComputationReference
  /** Error message if failed */
  error?: string
  /** Transfer metadata */
  metadata?: {
    /** Amount transferred (encrypted on-chain) */
    amount: bigint
    /** Token transferred */
    token: CSPLToken
    /** Timestamp */
    timestamp: number
  }
}

// ─── Wrap/Unwrap Types ───────────────────────────────────────────────────────

/**
 * Parameters for wrapping SPL to C-SPL
 */
export interface WrapToCSPLParams {
  /** SPL token mint */
  splMint: string
  /** Amount to wrap */
  amount: bigint
  /** Owner address */
  owner: string
}

/**
 * Parameters for unwrapping C-SPL to SPL
 */
export interface UnwrapFromCSPLParams {
  /** C-SPL token mint */
  csplMint: string
  /** Amount to unwrap */
  amount: bigint
  /** Owner address */
  owner: string
  /** Recipient address (can be different from owner) */
  recipient?: string
}

/**
 * Result of wrap/unwrap operation
 */
export interface WrapResult {
  /** Whether operation succeeded */
  success: boolean
  /** Transaction signature */
  signature?: string
  /** Resulting token account */
  tokenAccount?: string
  /** Error message if failed */
  error?: string
}

// ─── Confidential Swap Types ─────────────────────────────────────────────────

/**
 * Parameters for confidential swap via Arcium MPC
 */
export interface ConfidentialSwapParams {
  /** Input C-SPL token */
  inputToken: CSPLToken
  /** Output C-SPL token */
  outputToken: CSPLToken
  /** Input amount (will be encrypted) */
  inputAmount: bigint
  /** Minimum output amount (slippage protection) */
  minOutputAmount: bigint
  /** Trader address */
  trader: string
  /** DEX to route through (e.g., 'jupiter', 'raydium') */
  dex?: string
  /** Deadline (Unix timestamp) */
  deadline?: number
}

/**
 * Result of confidential swap
 */
export interface ConfidentialSwapResult {
  /** Whether swap succeeded */
  success: boolean
  /** Transaction signature */
  signature?: string
  /** Computation reference */
  computation?: ComputationReference
  /** Output amount received (decrypted for user) */
  outputAmount?: bigint
  /** Effective price */
  effectivePrice?: number
  /** Error message if failed */
  error?: string
}

// ─── Backend Configuration ───────────────────────────────────────────────────

/**
 * Arcium backend configuration
 */
export interface ArciumBackendConfig {
  /**
   * Arcium network to connect to
   * @default 'devnet'
   */
  network?: ArciumNetwork

  /**
   * Custom RPC endpoint (overrides network default)
   */
  rpcUrl?: string

  /**
   * Solana RPC endpoint for transaction submission
   */
  solanaRpcUrl?: string

  /**
   * Enable verbose logging
   * @default false
   */
  verbose?: boolean

  /**
   * Timeout for MPC computations in ms
   * @default 60000
   */
  computationTimeout?: number

  /**
   * Maximum retries for failed operations
   * @default 3
   */
  maxRetries?: number

  /**
   * Default auditor public key for compliance
   */
  defaultAuditorKey?: string
}

// ─── Error Types ─────────────────────────────────────────────────────────────

/**
 * Arcium error codes
 */
export enum ArciumErrorCode {
  /** Network connection failed */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** Token not supported for C-SPL */
  UNSUPPORTED_TOKEN = 'UNSUPPORTED_TOKEN',
  /** Insufficient balance */
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  /** MPC computation failed */
  COMPUTATION_FAILED = 'COMPUTATION_FAILED',
  /** Computation timed out */
  COMPUTATION_TIMEOUT = 'COMPUTATION_TIMEOUT',
  /** Invalid parameters */
  INVALID_PARAMS = 'INVALID_PARAMS',
  /** Wrap/unwrap failed */
  WRAP_FAILED = 'WRAP_FAILED',
  /** Swap execution failed */
  SWAP_FAILED = 'SWAP_FAILED',
  /** Auditor verification failed */
  AUDITOR_ERROR = 'AUDITOR_ERROR',
}

/**
 * Arcium backend error
 */
export class ArciumError extends Error {
  constructor(
    message: string,
    public readonly code: ArciumErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ArciumError'
  }
}

// ─── Utility Functions ───────────────────────────────────────────────────────

/**
 * Derive C-SPL mint address from SPL mint
 *
 * In production, this would use a PDA derivation
 */
export function deriveCSPLMint(splMint: string): string {
  // Check registry first
  const registered = getCSPLToken(splMint)
  if (registered) {
    return registered.csplMint
  }

  // For unknown tokens, derive a deterministic address
  // In production, this would be a proper PDA derivation
  return `cSPL_${splMint.slice(0, 32)}`
}

/**
 * Validate C-SPL transfer parameters
 */
export function validateCSPLTransferParams(params: CSPLTransferParams): void {
  if (!params.token) {
    throw new ArciumError('Token is required', ArciumErrorCode.INVALID_PARAMS)
  }
  if (params.amount <= 0n) {
    throw new ArciumError('Amount must be positive', ArciumErrorCode.INVALID_PARAMS)
  }
  if (!params.sender) {
    throw new ArciumError('Sender is required', ArciumErrorCode.INVALID_PARAMS)
  }
  if (!params.recipient) {
    throw new ArciumError('Recipient is required', ArciumErrorCode.INVALID_PARAMS)
  }
}

/**
 * Estimate MPC computation cost
 *
 * @param operationType - Type of operation
 * @returns Estimated cost in lamports
 */
export function estimateArciumCost(
  operationType: 'transfer' | 'swap' | 'wrap' | 'unwrap'
): bigint {
  // Base costs for different operations (in lamports)
  const baseCosts: Record<string, bigint> = {
    transfer: BigInt(10_000_000),  // ~0.01 SOL for MPC transfer
    swap: BigInt(50_000_000),      // ~0.05 SOL for MPC swap (more compute)
    wrap: BigInt(5_000_000),       // ~0.005 SOL for wrapping
    unwrap: BigInt(5_000_000),     // ~0.005 SOL for unwrapping
  }

  return baseCosts[operationType] ?? BigInt(10_000_000)
}
