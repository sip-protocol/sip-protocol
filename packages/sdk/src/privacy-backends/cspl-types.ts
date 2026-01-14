/**
 * C-SPL (Confidential SPL) Token Standard Types
 *
 * Type definitions for the Confidential SPL token standard from Arcium.
 * C-SPL enables encrypted token balances and transfer amounts on Solana.
 *
 * ## Architecture
 *
 * C-SPL unifies four pieces of Solana infrastructure:
 * - SPL Token (classic fungible tokens)
 * - Token-2022 (flexible token extensions)
 * - Confidential Transfer Extension (private transfers)
 * - Arcium encrypted compute (MPC for DeFi logic)
 *
 * ## Key Properties
 *
 * - **Encrypted Balances**: Token balances are hidden on-chain
 * - **Encrypted Amounts**: Transfer amounts are encrypted
 * - **Public Addresses**: Sender and recipient remain visible
 * - **Wrappable**: Any SPL token can be wrapped to C-SPL
 *
 * ## Use Cases
 *
 * - Private DeFi (swaps, lending, borrowing)
 * - Institutional payroll
 * - Vendor payments
 * - Private stablecoins
 * - Confidential RWA trading
 *
 * @see https://docs.arcium.com
 * @see https://x.com/ArciumHQ/status/1963271375671668789
 */

// ─── Core C-SPL Types ─────────────────────────────────────────────────────────

/**
 * C-SPL token configuration
 *
 * Represents a token that has been wrapped for confidential transfers.
 */
export interface CSPLToken {
  /** Original SPL token mint address */
  mint: string
  /** C-SPL wrapped mint address */
  confidentialMint: string
  /** Token decimals */
  decimals: number
  /** Token symbol (e.g., 'SOL', 'USDC') */
  symbol?: string
  /** Token name */
  name?: string
  /** Whether this is a native wrap (SOL -> wSOL -> C-wSOL) */
  isNativeWrap?: boolean
}

/**
 * Confidential token account
 *
 * A C-SPL account holds encrypted balances for a specific token.
 */
export interface ConfidentialTokenAccount {
  /** Account address */
  address: string
  /** Owner public key */
  owner: string
  /** Associated C-SPL token */
  token: CSPLToken
  /** Encrypted available balance */
  encryptedBalance: Uint8Array
  /** Encrypted pending balance (incoming transfers not yet applied) */
  pendingBalance?: Uint8Array
  /** Number of pending incoming transfers */
  pendingCount?: number
  /** Account is initialized and ready */
  isInitialized: boolean
  /** Account is frozen (transfers blocked) */
  isFrozen: boolean
}

/**
 * Confidential balance representation
 *
 * Holds both encrypted and (optionally) decrypted balance info.
 */
export interface ConfidentialBalance {
  /** Associated token */
  token: CSPLToken
  /** Encrypted balance ciphertext */
  encryptedAmount: Uint8Array
  /** Decrypted amount (only available to account owner) */
  decryptedAmount?: bigint
  /** Pending incoming balance */
  pendingBalance?: Uint8Array
  /** Pending decrypted amount */
  pendingDecryptedAmount?: bigint
}

// ─── Transfer Types ───────────────────────────────────────────────────────────

/**
 * Parameters for a confidential transfer
 */
export interface ConfidentialTransferParams {
  /** Sender address */
  from: string
  /** Recipient address */
  to: string
  /** Token being transferred */
  token: CSPLToken
  /** Encrypted transfer amount */
  encryptedAmount: Uint8Array
  /** Zero-knowledge proof for valid transfer (proves sender has sufficient balance) */
  proof?: Uint8Array
  /** Optional memo (public, max CSPL_MAX_MEMO_BYTES bytes) */
  memo?: string
}

/**
 * Result of a confidential transfer
 */
export interface ConfidentialTransferResult {
  /** Whether transfer succeeded */
  success: boolean
  /** Transaction signature */
  signature?: string
  /** Error message if failed */
  error?: string
  /** Sender's new encrypted balance */
  newSenderBalance?: Uint8Array
  /** Recipient's pending balance updated */
  recipientPendingUpdated?: boolean
}

/**
 * Parameters for wrapping SPL tokens to C-SPL
 */
export interface WrapTokenParams {
  /** SPL token mint to wrap */
  mint: string
  /** Amount to wrap (plaintext, will be encrypted) */
  amount: bigint
  /** Owner address */
  owner: string
  /** Create C-SPL account if it doesn't exist */
  createAccount?: boolean
}

/**
 * Result of wrapping tokens
 */
export interface WrapTokenResult {
  /** Whether wrap succeeded */
  success: boolean
  /** Transaction signature */
  signature?: string
  /** C-SPL token info */
  token?: CSPLToken
  /** New encrypted balance */
  encryptedBalance?: Uint8Array
  /** Error message if failed */
  error?: string
}

/**
 * Parameters for unwrapping C-SPL back to SPL
 */
export interface UnwrapTokenParams {
  /** C-SPL token to unwrap */
  token: CSPLToken
  /** Encrypted amount to unwrap */
  encryptedAmount: Uint8Array
  /** Owner address */
  owner: string
  /** Proof of ownership/balance */
  proof?: Uint8Array
}

/**
 * Result of unwrapping tokens
 */
export interface UnwrapTokenResult {
  /** Whether unwrap succeeded */
  success: boolean
  /** Transaction signature */
  signature?: string
  /** Decrypted amount received */
  amount?: bigint
  /** Error message if failed */
  error?: string
}

// ─── Swap Types ───────────────────────────────────────────────────────────────

/**
 * Parameters for a confidential swap
 *
 * Combines C-SPL tokens with Arcium MPC for fully private swaps.
 */
export interface ConfidentialSwapParams {
  /** Input token (being sold) */
  inputToken: CSPLToken
  /** Output token (being bought) */
  outputToken: CSPLToken
  /** Encrypted input amount */
  encryptedInputAmount: Uint8Array
  /** Encrypted minimum output amount (slippage protection) */
  encryptedMinOutput?: Uint8Array
  /** Slippage tolerance in basis points (e.g., 50 = 0.5%) */
  slippageBps?: number
  /** Swap deadline (Unix timestamp) */
  deadline?: number
  /** User's address */
  user: string
  /** Preferred DEX/AMM for swap execution */
  preferredDex?: string
}

/**
 * Result of a confidential swap
 */
export interface ConfidentialSwapResult {
  /** Whether swap succeeded */
  success: boolean
  /** Transaction signature */
  signature?: string
  /** Arcium computation ID */
  computationId?: string
  /** Encrypted output amount received */
  encryptedOutputAmount?: Uint8Array
  /** Decrypted output amount (if available) */
  decryptedOutputAmount?: bigint
  /** Effective price (encrypted or decrypted) */
  effectivePrice?: bigint
  /** Error message if failed */
  error?: string
  /** Swap metadata */
  metadata?: {
    dex: string
    route: string[]
    gasUsed?: bigint
  }
}

/**
 * Confidential liquidity pool information
 */
export interface ConfidentialPool {
  /** Pool address */
  address: string
  /** Token A in the pool */
  tokenA: CSPLToken
  /** Token B in the pool */
  tokenB: CSPLToken
  /** Encrypted reserve of token A */
  encryptedReserveA?: Uint8Array
  /** Encrypted reserve of token B */
  encryptedReserveB?: Uint8Array
  /** Fee in basis points */
  feeBps: number
  /** Pool protocol (e.g., 'arcium-amm', 'orca-confidential') */
  protocol: string
}

// ─── Encryption Types ─────────────────────────────────────────────────────────

/**
 * Encryption parameters for C-SPL amounts
 */
export interface CSPLEncryptionParams {
  /** Plaintext amount to encrypt */
  amount: bigint
  /** Recipient's public key (for transfer encryption) */
  recipientPubkey?: string
  /** Auditor keys (for compliance) */
  auditorKeys?: string[]
}

/**
 * Encrypted amount with metadata
 */
export interface EncryptedAmount {
  /** Ciphertext */
  ciphertext: Uint8Array
  /** Encryption type used */
  encryptionType: CSPLEncryptionType
  /** Nonce/IV */
  nonce?: Uint8Array
  /** Auditor ciphertexts (if compliance enabled) */
  auditorCiphertexts?: Map<string, Uint8Array>
}

/**
 * Supported encryption types for C-SPL
 */
export type CSPLEncryptionType =
  | 'twisted-elgamal' // Default for Solana Confidential Transfers
  | 'aes-gcm' // For Arcium MPC inputs
  | 'pedersen' // For commitments

/**
 * Decryption request parameters
 */
export interface CSPLDecryptionParams {
  /** Encrypted amount to decrypt */
  encryptedAmount: Uint8Array
  /** Decryption key (account owner's key) */
  decryptionKey: Uint8Array
  /** Expected encryption type */
  encryptionType?: CSPLEncryptionType
}

// ─── Compliance Types ─────────────────────────────────────────────────────────

/**
 * Auditor configuration for compliant C-SPL
 *
 * Allows designated auditors to decrypt transaction amounts.
 */
export interface CSPLAuditorConfig {
  /** Auditor public key */
  auditorPubkey: string
  /** Auditor name/identifier */
  name?: string
  /** What the auditor can see */
  permissions: CSPLAuditorPermission[]
  /** Expiration timestamp */
  expiresAt?: number
}

/**
 * Auditor permission levels
 */
export type CSPLAuditorPermission =
  | 'view_balances' // Can decrypt balances
  | 'view_transfers' // Can decrypt transfer amounts
  | 'view_swaps' // Can decrypt swap details
  | 'full_access' // All of the above

/**
 * Compliance-enabled transfer parameters
 */
export interface CompliantTransferParams extends ConfidentialTransferParams {
  /** Auditor configurations for this transfer */
  auditors?: CSPLAuditorConfig[]
  /** Include auditor-decryptable ciphertexts */
  enableAudit: boolean
}

// ─── SDK Interface ────────────────────────────────────────────────────────────

/**
 * C-SPL Client SDK interface
 *
 * The actual implementation wraps Solana's Confidential Transfer
 * extension and Arcium's MPC for swap operations.
 */
export interface ICSPLClient {
  /**
   * Initialize connection
   */
  connect(rpcUrl: string): Promise<void>

  /**
   * Disconnect
   */
  disconnect(): Promise<void>

  /**
   * Get or create a confidential token account
   */
  getOrCreateAccount(
    owner: string,
    token: CSPLToken
  ): Promise<ConfidentialTokenAccount>

  /**
   * Get confidential balance
   */
  getBalance(owner: string, token: CSPLToken): Promise<ConfidentialBalance>

  /**
   * Wrap SPL tokens to C-SPL
   */
  wrapToken(params: WrapTokenParams): Promise<WrapTokenResult>

  /**
   * Unwrap C-SPL back to SPL
   */
  unwrapToken(params: UnwrapTokenParams): Promise<UnwrapTokenResult>

  /**
   * Execute a confidential transfer
   */
  transfer(params: ConfidentialTransferParams): Promise<ConfidentialTransferResult>

  /**
   * Encrypt an amount for transfer
   */
  encryptAmount(params: CSPLEncryptionParams): Promise<EncryptedAmount>

  /**
   * Decrypt an encrypted amount
   */
  decryptAmount(params: CSPLDecryptionParams): Promise<bigint>

  /**
   * Apply pending balance to available balance
   */
  applyPendingBalance(
    owner: string,
    token: CSPLToken
  ): Promise<ConfidentialTransferResult>
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Well-known C-SPL token configurations
 */
export const CSPL_TOKENS: Record<string, Partial<CSPLToken>> = {
  // Native SOL wrapped
  'C-wSOL': {
    mint: 'So11111111111111111111111111111111111111112',
    symbol: 'C-wSOL',
    name: 'Confidential Wrapped SOL',
    decimals: 9,
    isNativeWrap: true,
  },
  // USDC
  'C-USDC': {
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'C-USDC',
    name: 'Confidential USDC',
    decimals: 6,
  },
  // USDT
  'C-USDT': {
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    symbol: 'C-USDT',
    name: 'Confidential USDT',
    decimals: 6,
  },
}

/**
 * C-SPL program IDs
 *
 * NOTE: TOKEN_PROGRAM and ATA_PROGRAM are PLACEHOLDER addresses.
 * Real values TBD when C-SPL launches on Solana.
 * The PLACEHOLDR prefix makes them obviously invalid to prevent
 * accidental use in production.
 *
 * CONFIDENTIAL_TRANSFER is the real Solana Token-2022 program ID.
 */
export const CSPL_PROGRAM_IDS = {
  /** C-SPL token program (PLACEHOLDER - TBD) */
  TOKEN_PROGRAM: 'PLACEHLDRCSPLTokenProgram111111111111111111',
  /** C-SPL associated token account program (PLACEHOLDER - TBD) */
  ATA_PROGRAM: 'PLACEHLDRCSPLAtaProgram1111111111111111111',
  /** Confidential transfer extension (REAL Solana Token-2022 program) */
  CONFIDENTIAL_TRANSFER: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
} as const

/**
 * Default slippage for confidential swaps (0.5%)
 */
export const DEFAULT_SWAP_SLIPPAGE_BPS = 50

/**
 * Maximum pending transfers before apply is required
 */
export const MAX_PENDING_TRANSFERS = 65536

/**
 * Maximum memo length in bytes
 *
 * Solana memo program limit is 566 bytes, but we use 256 for:
 * - Better UX (reasonable user-facing memo length)
 * - Compatibility with other privacy backends
 * - Room for protocol metadata in the transaction
 */
export const CSPL_MAX_MEMO_BYTES = 256

/**
 * Cost estimate for C-SPL operations (in lamports)
 */
export const CSPL_OPERATION_COSTS = {
  /** Create confidential account */
  createAccount: BigInt(2_039_280),
  /** Wrap tokens */
  wrap: BigInt(5_000),
  /** Unwrap tokens */
  unwrap: BigInt(5_000),
  /** Confidential transfer */
  transfer: BigInt(10_000),
  /** Apply pending balance */
  applyPending: BigInt(5_000),
} as const

/**
 * Estimated time for C-SPL operations (in milliseconds)
 */
export const CSPL_OPERATION_TIMES = {
  /** Wrap tokens */
  wrap: 2_000,
  /** Unwrap tokens */
  unwrap: 2_000,
  /** Confidential transfer */
  transfer: 3_000,
  /** Confidential swap (via Arcium) */
  swap: 30_000,
} as const
