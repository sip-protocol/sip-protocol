/**
 * NEAR NEP-141 Token Privacy Support
 *
 * Extends basic token transfer functionality with:
 * - Amount commitments for hidden transfer values
 * - ft_transfer_call support for DeFi interactions
 * - Batch token transfers with privacy
 * - Token metadata fetching for UI display
 *
 * @example Privacy-wrapped token transfer with commitment
 * ```typescript
 * import { buildPrivateTokenTransferWithCommitment } from '@sip-protocol/sdk'
 *
 * const result = buildPrivateTokenTransferWithCommitment({
 *   recipientMetaAddress: 'sip:near:0x...:0x...',
 *   tokenContract: 'usdc.near',
 *   amount: 100_000_000n, // 100 USDC
 *   decimals: 6,
 *   hideAmount: true,
 * })
 *
 * // result.commitment contains the hidden amount
 * // result.transfer contains the transaction actions
 * ```
 *
 * @example ft_transfer_call for DeFi
 * ```typescript
 * import { buildPrivateTokenTransferCall } from '@sip-protocol/sdk'
 *
 * const result = buildPrivateTokenTransferCall({
 *   recipientMetaAddress: 'sip:near:0x...:0x...',
 *   tokenContract: 'usdc.near',
 *   amount: 100_000_000n,
 *   msg: JSON.stringify({ action: 'deposit' }),
 * })
 * ```
 *
 * @packageDocumentation
 */

import type { HexString, StealthAddress, StealthMetaAddress } from '@sip-protocol/types'
import { ValidationError } from '../../errors'
import { isValidAccountId, DEFAULT_GAS, ONE_YOCTO, STORAGE_DEPOSIT_DEFAULT } from './constants'
import { generateNEARStealthAddress, parseNEARStealthMetaAddress } from './stealth'
import { createAnnouncementMemo } from './types'
import { commitNEP141Token, type NEP141TokenCommitment } from './commitment'
import type { NEARAction, NEARFunctionCallAction, NEARPrivateTransferBuild } from './implicit-account'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Parameters for a privacy-wrapped token transfer with commitment
 */
export interface PrivateTokenTransferWithCommitmentParams {
  /** Recipient's stealth meta-address */
  recipientMetaAddress: StealthMetaAddress | string
  /** NEP-141 token contract address */
  tokenContract: string
  /** Amount in token's smallest units */
  amount: bigint
  /** Token decimals (required for commitment) */
  decimals: number
  /** Whether to create a Pedersen commitment for the amount (default: true) */
  hideAmount?: boolean
  /** Optional memo for the transfer */
  memo?: string
  /** Optional pre-generated blinding factor */
  blinding?: Uint8Array
}

/**
 * Result of building a privacy-wrapped token transfer with commitment
 */
export interface PrivateTokenTransferWithCommitmentResult {
  /** The transfer build (actions, stealth address, etc.) */
  transfer: NEARPrivateTransferBuild
  /** Amount commitment (if hideAmount is true) */
  commitment?: NEP141TokenCommitment
  /** The stealth address */
  stealthAddress: StealthAddress
  /** NEAR implicit account ID */
  stealthAccountId: string
}

/**
 * Parameters for ft_transfer_call with privacy
 */
export interface PrivateTokenTransferCallParams {
  /** Recipient's stealth meta-address */
  recipientMetaAddress: StealthMetaAddress | string
  /** NEP-141 token contract address */
  tokenContract: string
  /** Amount in token's smallest units */
  amount: bigint
  /** Message to pass to the receiver contract */
  msg: string
  /** Optional memo for the transfer */
  memo?: string
  /** Gas for the receiver callback (default: 30 TGas) */
  receiverGas?: bigint
}

/**
 * Result of building a ft_transfer_call with privacy
 */
export interface PrivateTokenTransferCallResult {
  /** Transaction actions */
  actions: NEARAction[]
  /** Receiver ID (the token contract) */
  receiverId: string
  /** The stealth address */
  stealthAddress: StealthAddress
  /** NEAR implicit account ID */
  stealthAccountId: string
  /** Announcement memo */
  announcementMemo: string
}

/**
 * Parameters for batch token transfer
 */
export interface BatchTokenTransferParams {
  /** Token contract for all transfers */
  tokenContract: string
  /** List of transfers to execute */
  transfers: Array<{
    /** Recipient's stealth meta-address */
    recipientMetaAddress: StealthMetaAddress | string
    /** Amount in token's smallest units */
    amount: bigint
  }>
  /** Token decimals (for commitments) */
  decimals?: number
  /** Create commitments for amounts */
  hideAmounts?: boolean
}

/**
 * Result of building batch token transfers
 */
export interface BatchTokenTransferResult {
  /** Individual transfer results */
  transfers: Array<{
    stealthAddress: StealthAddress
    stealthAccountId: string
    announcementMemo: string
    amount: bigint
    commitment?: NEP141TokenCommitment
  }>
  /** Combined actions for all transfers */
  actions: NEARAction[]
  /** Receiver ID (the token contract) */
  receiverId: string
  /** Total amount being transferred */
  totalAmount: bigint
}

/**
 * NEP-141 token metadata
 */
export interface NEP141TokenMetadata {
  /** Token specification (e.g., "ft-1.0.0") */
  spec: string
  /** Token name */
  name: string
  /** Token symbol */
  symbol: string
  /** Token icon (data URI or URL) */
  icon?: string
  /** Reference URL for additional info */
  reference?: string
  /** SHA256 hash of reference content */
  referenceHash?: string
  /** Number of decimals */
  decimals: number
}

/**
 * Token balance with metadata
 */
export interface TokenBalanceInfo {
  /** Balance in smallest units */
  balance: bigint
  /** Token metadata */
  metadata?: NEP141TokenMetadata
  /** Storage deposit status */
  hasStorageDeposit: boolean
}

/**
 * Storage deposit info
 */
export interface StorageDepositInfo {
  /** Total storage balance */
  total: bigint
  /** Available storage balance */
  available: bigint
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Default gas for ft_transfer_call receiver callback
 */
export const FT_TRANSFER_CALL_GAS = 30_000_000_000_000n // 30 TGas

/**
 * Gas for ft_transfer_call itself
 */
export const FT_TRANSFER_CALL_TOTAL_GAS = 100_000_000_000_000n // 100 TGas

// ─── Privacy-Wrapped Token Transfers ──────────────────────────────────────────

/**
 * Build a privacy-wrapped NEP-141 token transfer with optional amount commitment
 *
 * Creates a Pedersen commitment to the amount, allowing the recipient to
 * verify the amount while keeping it hidden from observers.
 *
 * @param params - Transfer parameters
 * @returns Transfer build with optional commitment
 *
 * @example
 * ```typescript
 * const result = buildPrivateTokenTransferWithCommitment({
 *   recipientMetaAddress: 'sip:near:0x...:0x...',
 *   tokenContract: 'usdc.near',
 *   amount: 100_000_000n, // 100 USDC
 *   decimals: 6,
 *   hideAmount: true,
 * })
 *
 * // Share commitment with recipient off-chain
 * // They can verify with the blinding factor
 * ```
 */
export function buildPrivateTokenTransferWithCommitment(
  params: PrivateTokenTransferWithCommitmentParams
): PrivateTokenTransferWithCommitmentResult {
  const {
    recipientMetaAddress,
    tokenContract,
    amount,
    decimals,
    hideAmount = true,
    memo,
    blinding,
  } = params

  // Parse meta-address if string
  const metaAddr = typeof recipientMetaAddress === 'string'
    ? parseNEARStealthMetaAddress(recipientMetaAddress)
    : recipientMetaAddress

  // Validate chain
  if (metaAddr.chain !== 'near') {
    throw new ValidationError(
      `Expected NEAR meta-address, got chain '${metaAddr.chain}'`,
      'recipientMetaAddress'
    )
  }

  // Validate token contract
  if (!isValidAccountId(tokenContract)) {
    throw new ValidationError('Invalid token contract account ID', 'tokenContract')
  }

  // Validate amount
  if (amount <= 0n) {
    throw new ValidationError('amount must be greater than 0', 'amount')
  }

  // Generate stealth address
  const { stealthAddress, implicitAccountId } = generateNEARStealthAddress(metaAddr)

  // Create announcement memo
  const announcementMemo = createAnnouncementMemo(
    stealthAddress.ephemeralPublicKey,
    stealthAddress.viewTag
  )

  // Create amount commitment if requested
  let commitment: NEP141TokenCommitment | undefined
  if (hideAmount) {
    commitment = commitNEP141Token(amount, tokenContract, decimals, blinding)
  }

  // Build ft_transfer args with commitment hash in memo
  const transferMemo = commitment
    ? `${announcementMemo}|c:${commitment.commitment.slice(2, 18)}` // Include commitment prefix
    : announcementMemo

  const fullMemo = memo ? `${transferMemo}|${memo}` : transferMemo
  const args = JSON.stringify({
    receiver_id: implicitAccountId,
    amount: amount.toString(),
    memo: fullMemo,
  })

  // Build function call action
  const actions: NEARAction[] = [
    {
      type: 'FunctionCall',
      params: {
        methodName: 'ft_transfer',
        args,
        gas: DEFAULT_GAS,
        deposit: ONE_YOCTO,
      } as NEARFunctionCallAction,
    },
  ]

  const transfer: NEARPrivateTransferBuild = {
    stealthAddress,
    stealthAccountId: implicitAccountId,
    announcementMemo,
    actions,
    receiverId: tokenContract,
  }

  return {
    transfer,
    commitment,
    stealthAddress,
    stealthAccountId: implicitAccountId,
  }
}

/**
 * Build a privacy-wrapped ft_transfer_call for DeFi interactions
 *
 * ft_transfer_call sends tokens and triggers a callback on the receiver,
 * enabling composable DeFi operations with privacy.
 *
 * @param params - Transfer call parameters
 * @returns Transfer call build
 *
 * @example Deposit to a DEX with privacy
 * ```typescript
 * const result = buildPrivateTokenTransferCall({
 *   recipientMetaAddress: 'sip:near:0x...:0x...',
 *   tokenContract: 'usdc.near',
 *   amount: 100_000_000n,
 *   msg: JSON.stringify({
 *     action: 'swap',
 *     output_token: 'wrap.near',
 *     min_output: '1000000000000000000000000',
 *   }),
 * })
 * ```
 */
export function buildPrivateTokenTransferCall(
  params: PrivateTokenTransferCallParams
): PrivateTokenTransferCallResult {
  const {
    recipientMetaAddress,
    tokenContract,
    amount,
    msg,
    memo,
    receiverGas = FT_TRANSFER_CALL_GAS,
  } = params

  // Parse meta-address if string
  const metaAddr = typeof recipientMetaAddress === 'string'
    ? parseNEARStealthMetaAddress(recipientMetaAddress)
    : recipientMetaAddress

  // Validate chain
  if (metaAddr.chain !== 'near') {
    throw new ValidationError(
      `Expected NEAR meta-address, got chain '${metaAddr.chain}'`,
      'recipientMetaAddress'
    )
  }

  // Validate token contract
  if (!isValidAccountId(tokenContract)) {
    throw new ValidationError('Invalid token contract account ID', 'tokenContract')
  }

  // Validate amount
  if (amount <= 0n) {
    throw new ValidationError('amount must be greater than 0', 'amount')
  }

  // Validate msg is valid JSON
  try {
    JSON.parse(msg)
  } catch {
    throw new ValidationError('msg must be valid JSON', 'msg')
  }

  // Generate stealth address
  const { stealthAddress, implicitAccountId } = generateNEARStealthAddress(metaAddr)

  // Create announcement memo
  const announcementMemo = createAnnouncementMemo(
    stealthAddress.ephemeralPublicKey,
    stealthAddress.viewTag
  )

  // Build ft_transfer_call args
  const transferMemo = memo ? `${announcementMemo}|${memo}` : announcementMemo
  const args = JSON.stringify({
    receiver_id: implicitAccountId,
    amount: amount.toString(),
    memo: transferMemo,
    msg,
  })

  // Build function call action with extra gas for callback
  const totalGas = FT_TRANSFER_CALL_TOTAL_GAS > receiverGas
    ? FT_TRANSFER_CALL_TOTAL_GAS
    : receiverGas + 50_000_000_000_000n

  const actions: NEARAction[] = [
    {
      type: 'FunctionCall',
      params: {
        methodName: 'ft_transfer_call',
        args,
        gas: totalGas,
        deposit: ONE_YOCTO,
      } as NEARFunctionCallAction,
    },
  ]

  return {
    actions,
    receiverId: tokenContract,
    stealthAddress,
    stealthAccountId: implicitAccountId,
    announcementMemo,
  }
}

// ─── Batch Token Transfers ────────────────────────────────────────────────────

/**
 * Build batch privacy-wrapped token transfers
 *
 * Sends tokens to multiple stealth addresses in a single transaction,
 * improving efficiency and reducing transaction costs.
 *
 * Note: NEAR doesn't support batch ft_transfer in a single action,
 * so this creates multiple function call actions.
 *
 * @param params - Batch transfer parameters
 * @returns Batch transfer build
 *
 * @example
 * ```typescript
 * const result = buildBatchPrivateTokenTransfer({
 *   tokenContract: 'usdc.near',
 *   transfers: [
 *     { recipientMetaAddress: 'sip:near:0x...', amount: 100_000_000n },
 *     { recipientMetaAddress: 'sip:near:0x...', amount: 50_000_000n },
 *   ],
 *   decimals: 6,
 *   hideAmounts: true,
 * })
 *
 * // Execute all transfers in one transaction
 * ```
 */
export function buildBatchPrivateTokenTransfer(
  params: BatchTokenTransferParams
): BatchTokenTransferResult {
  const {
    tokenContract,
    transfers,
    decimals,
    hideAmounts = false,
  } = params

  // Validate token contract
  if (!isValidAccountId(tokenContract)) {
    throw new ValidationError('Invalid token contract account ID', 'tokenContract')
  }

  // Validate transfers
  if (!transfers || transfers.length === 0) {
    throw new ValidationError('At least one transfer is required', 'transfers')
  }

  if (transfers.length > 10) {
    throw new ValidationError(
      'Maximum 10 transfers per batch (gas limit)',
      'transfers'
    )
  }

  // Validate decimals if hiding amounts
  if (hideAmounts && decimals === undefined) {
    throw new ValidationError(
      'decimals is required when hideAmounts is true',
      'decimals'
    )
  }

  const results: BatchTokenTransferResult['transfers'] = []
  const actions: NEARAction[] = []
  let totalAmount = 0n

  for (const transfer of transfers) {
    const { recipientMetaAddress, amount } = transfer

    // Parse meta-address if string
    const metaAddr = typeof recipientMetaAddress === 'string'
      ? parseNEARStealthMetaAddress(recipientMetaAddress)
      : recipientMetaAddress

    // Validate chain
    if (metaAddr.chain !== 'near') {
      throw new ValidationError(
        `Expected NEAR meta-address, got chain '${metaAddr.chain}'`,
        'recipientMetaAddress'
      )
    }

    // Validate amount
    if (amount <= 0n) {
      throw new ValidationError('amount must be greater than 0', 'amount')
    }

    // Generate stealth address
    const { stealthAddress, implicitAccountId } = generateNEARStealthAddress(metaAddr)

    // Create announcement memo
    const announcementMemo = createAnnouncementMemo(
      stealthAddress.ephemeralPublicKey,
      stealthAddress.viewTag
    )

    // Create commitment if hiding amounts
    let commitment: NEP141TokenCommitment | undefined
    if (hideAmounts && decimals !== undefined) {
      commitment = commitNEP141Token(amount, tokenContract, decimals)
    }

    // Build transfer memo
    const transferMemo = commitment
      ? `${announcementMemo}|c:${commitment.commitment.slice(2, 18)}`
      : announcementMemo

    // Build ft_transfer args
    const args = JSON.stringify({
      receiver_id: implicitAccountId,
      amount: amount.toString(),
      memo: transferMemo,
    })

    // Add action
    actions.push({
      type: 'FunctionCall',
      params: {
        methodName: 'ft_transfer',
        args,
        gas: DEFAULT_GAS,
        deposit: ONE_YOCTO,
      } as NEARFunctionCallAction,
    })

    results.push({
      stealthAddress,
      stealthAccountId: implicitAccountId,
      announcementMemo,
      amount,
      commitment,
    })

    totalAmount += amount
  }

  return {
    transfers: results,
    actions,
    receiverId: tokenContract,
    totalAmount,
  }
}

// ─── Storage Deposit Helpers ──────────────────────────────────────────────────

/**
 * Build batch storage deposit for multiple stealth accounts
 *
 * Pre-registers storage for multiple stealth accounts before sending tokens.
 *
 * @param stealthAccountIds - List of stealth implicit account IDs
 * @param tokenContract - Token contract address
 * @param amountPerAccount - Storage deposit per account (default: 0.00125 NEAR)
 * @returns Storage deposit actions
 */
export function buildBatchStorageDeposit(
  stealthAccountIds: string[],
  tokenContract: string,
  amountPerAccount: bigint = STORAGE_DEPOSIT_DEFAULT
): NEARAction[] {
  if (!isValidAccountId(tokenContract)) {
    throw new ValidationError('Invalid token contract account ID', 'tokenContract')
  }

  if (!stealthAccountIds || stealthAccountIds.length === 0) {
    throw new ValidationError('At least one account ID is required', 'stealthAccountIds')
  }

  if (stealthAccountIds.length > 20) {
    throw new ValidationError(
      'Maximum 20 storage deposits per batch (gas limit)',
      'stealthAccountIds'
    )
  }

  return stealthAccountIds.map(accountId => {
    const args = JSON.stringify({
      account_id: accountId,
    })

    return {
      type: 'FunctionCall' as const,
      params: {
        methodName: 'storage_deposit',
        args,
        gas: DEFAULT_GAS,
        deposit: amountPerAccount,
      } as NEARFunctionCallAction,
    }
  })
}

/**
 * Build storage withdraw action
 *
 * Withdraw excess storage deposit from a token contract.
 *
 * @param amount - Amount to withdraw (null for all available)
 * @returns Storage withdraw action
 */
export function buildStorageWithdraw(amount?: bigint): NEARAction {
  const args = amount !== undefined
    ? JSON.stringify({ amount: amount.toString() })
    : '{}'

  return {
    type: 'FunctionCall',
    params: {
      methodName: 'storage_withdraw',
      args,
      gas: DEFAULT_GAS,
      deposit: ONE_YOCTO,
    } as NEARFunctionCallAction,
  }
}

/**
 * Build storage unregister action
 *
 * Unregister from a token contract and reclaim storage deposit.
 * Only works if token balance is zero.
 *
 * @param force - Force unregister even if balance > 0 (burns tokens)
 * @returns Storage unregister action
 */
export function buildStorageUnregister(force: boolean = false): NEARAction {
  const args = JSON.stringify({ force })

  return {
    type: 'FunctionCall',
    params: {
      methodName: 'storage_unregister',
      args,
      gas: DEFAULT_GAS,
      deposit: ONE_YOCTO,
    } as NEARFunctionCallAction,
  }
}

// ─── Token Metadata ───────────────────────────────────────────────────────────

/**
 * Parse ft_metadata response
 *
 * @param response - Raw metadata response from RPC
 * @returns Parsed token metadata
 */
export function parseTokenMetadata(response: unknown): NEP141TokenMetadata {
  if (!response || typeof response !== 'object') {
    throw new ValidationError('Invalid metadata response', 'response')
  }

  const data = response as Record<string, unknown>

  return {
    spec: String(data.spec || 'ft-1.0.0'),
    name: String(data.name || 'Unknown Token'),
    symbol: String(data.symbol || '???'),
    icon: data.icon ? String(data.icon) : undefined,
    reference: data.reference ? String(data.reference) : undefined,
    referenceHash: data.reference_hash ? String(data.reference_hash) : undefined,
    decimals: Number(data.decimals || 0),
  }
}

/**
 * Format token amount for display
 *
 * @param amount - Amount in smallest units
 * @param decimals - Token decimals
 * @param symbol - Token symbol
 * @returns Formatted amount string (e.g., "100.50 USDC")
 */
export function formatTokenAmount(
  amount: bigint,
  decimals: number,
  symbol?: string
): string {
  const str = amount.toString().padStart(decimals + 1, '0')
  const whole = str.slice(0, -decimals) || '0'
  const fraction = str.slice(-decimals).replace(/0+$/, '')

  const formatted = fraction ? `${whole}.${fraction}` : whole

  return symbol ? `${formatted} ${symbol}` : formatted
}

/**
 * Parse token amount from display string
 *
 * @param displayAmount - Human-readable amount (e.g., "100.50")
 * @param decimals - Token decimals
 * @returns Amount in smallest units
 */
export function parseTokenAmount(displayAmount: string, decimals: number): bigint {
  // Remove any symbol suffix
  const cleaned = displayAmount.replace(/[^0-9.]/g, '').trim()

  const [whole, fraction = ''] = cleaned.split('.')
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals)

  return BigInt(whole + paddedFraction)
}

// ─── Commitment Verification ──────────────────────────────────────────────────

/**
 * Extract commitment hash from transfer memo
 *
 * @param memo - Transfer memo string
 * @returns Commitment hash prefix if present
 */
export function extractCommitmentFromMemo(memo: string): string | null {
  const match = memo.match(/\|c:([a-f0-9]{16})/)
  return match ? match[1] : null
}

/**
 * Verify that a commitment matches the expected prefix in memo
 *
 * @param commitment - The full commitment
 * @param memo - Transfer memo
 * @returns True if commitment matches memo prefix
 */
export function verifyCommitmentInMemo(
  commitment: HexString,
  memo: string
): boolean {
  const extracted = extractCommitmentFromMemo(memo)
  if (!extracted) return false

  // Compare prefix (first 16 hex chars after 0x)
  const commitmentPrefix = commitment.slice(2, 18)
  return commitmentPrefix === extracted
}
