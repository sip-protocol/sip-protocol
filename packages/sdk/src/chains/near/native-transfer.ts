/**
 * NEAR Native Transfer with Stealth Addresses
 *
 * Privacy-preserving NEAR native token transfers using stealth addresses.
 * Extends basic transfer functionality with:
 * - Amount commitments for hidden transfer values
 * - Batch transfers to multiple stealth addresses
 * - Gas sponsorship for sender anonymity
 * - Minimum balance handling for account creation
 *
 * @example Private NEAR transfer with commitment
 * ```typescript
 * import { buildPrivateNativeTransferWithCommitment } from '@sip-protocol/sdk'
 *
 * const result = buildPrivateNativeTransferWithCommitment({
 *   recipientMetaAddress: 'sip:near:0x...:0x...',
 *   amount: ONE_NEAR,
 *   hideAmount: true,
 * })
 *
 * // result.commitment contains the hidden amount
 * // result.transfer contains the transaction actions
 * ```
 *
 * @example Batch NEAR transfers
 * ```typescript
 * import { buildBatchPrivateNativeTransfer } from '@sip-protocol/sdk'
 *
 * const result = buildBatchPrivateNativeTransfer({
 *   transfers: [
 *     { recipientMetaAddress: 'sip:near:0x...', amount: ONE_NEAR },
 *     { recipientMetaAddress: 'sip:near:0x...', amount: 2n * ONE_NEAR },
 *   ],
 *   hideAmounts: true,
 * })
 * ```
 *
 * @packageDocumentation
 */

import type { StealthAddress, StealthMetaAddress } from '@sip-protocol/types'
import { ValidationError } from '../../errors'
import { generateNEARStealthAddress, parseNEARStealthMetaAddress } from './stealth'
import { createAnnouncementMemo } from './types'
import { commitNEAR, verifyOpeningNEAR, type NEARPedersenCommitment } from './commitment'
import type {
  NEARAction,
  NEARTransferAction,
  NEARPrivateTransferBuild,
} from './implicit-account'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Parameters for a privacy-wrapped native NEAR transfer with commitment
 */
export interface PrivateNativeTransferWithCommitmentParams {
  /** Recipient's stealth meta-address */
  recipientMetaAddress: StealthMetaAddress | string
  /** Amount in yoctoNEAR */
  amount: bigint
  /** Whether to create a Pedersen commitment for the amount (default: true) */
  hideAmount?: boolean
  /** Optional pre-generated blinding factor */
  blinding?: Uint8Array
}

/**
 * Result of building a privacy-wrapped native NEAR transfer with commitment
 */
export interface PrivateNativeTransferWithCommitmentResult {
  /** The transfer build (actions, stealth address, etc.) */
  transfer: NEARPrivateTransferBuild
  /** Amount commitment (if hideAmount is true) */
  commitment?: NEARPedersenCommitment
  /** The stealth address */
  stealthAddress: StealthAddress
  /** NEAR implicit account ID */
  stealthAccountId: string
  /** Minimum balance for account creation */
  minimumBalance: bigint
  /** Whether transfer amount meets minimum balance */
  meetsMinimum: boolean
}

/**
 * Parameters for batch native NEAR transfer
 */
export interface BatchNativeTransferParams {
  /** List of transfers to execute */
  transfers: Array<{
    /** Recipient's stealth meta-address */
    recipientMetaAddress: StealthMetaAddress | string
    /** Amount in yoctoNEAR */
    amount: bigint
  }>
  /** Create commitments for amounts */
  hideAmounts?: boolean
}

/**
 * Result of building batch native NEAR transfers
 */
export interface BatchNativeTransferResult {
  /** Individual transfer results */
  transfers: Array<{
    stealthAddress: StealthAddress
    stealthAccountId: string
    announcementMemo: string
    amount: bigint
    commitment?: NEARPedersenCommitment
  }>
  /** Combined actions for all transfers (must be sent as separate txs) */
  transactions: Array<{
    receiverId: string
    actions: NEARAction[]
  }>
  /** Total amount being transferred */
  totalAmount: bigint
  /** Number of transfers that meet minimum balance */
  validTransferCount: number
}

/**
 * Parameters for gas-sponsored transfer
 */
export interface GasSponsoredTransferParams {
  /** Recipient's stealth meta-address */
  recipientMetaAddress: StealthMetaAddress | string
  /** Amount in yoctoNEAR to transfer */
  amount: bigint
  /** Relayer account that will pay for gas */
  relayerAccountId: string
  /** Maximum gas fee the relayer will cover */
  maxRelayerFee?: bigint
  /** Hide amount with commitment */
  hideAmount?: boolean
}

/**
 * Result of building a gas-sponsored transfer
 */
export interface GasSponsoredTransferResult {
  /** Actions for the relayer to execute */
  relayerActions: NEARAction[]
  /** The stealth address */
  stealthAddress: StealthAddress
  /** NEAR implicit account ID */
  stealthAccountId: string
  /** Announcement memo */
  announcementMemo: string
  /** Amount commitment (if hideAmount is true) */
  commitment?: NEARPedersenCommitment
  /** Estimated relayer fee */
  estimatedFee: bigint
}

/**
 * Account creation cost estimate
 */
export interface AccountCreationCost {
  /** Minimum balance for account existence */
  minimumBalance: bigint
  /** Storage cost per byte */
  storagePerByte: bigint
  /** Recommended transfer amount */
  recommendedMinimum: bigint
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Minimum balance for implicit account creation (0.00182 NEAR)
 */
export const IMPLICIT_ACCOUNT_CREATION_COST = 1_820_000_000_000_000_000_000n

/**
 * Storage cost per byte on NEAR (0.00001 NEAR = 10^19 yoctoNEAR)
 */
export const STORAGE_COST_PER_BYTE = 10_000_000_000_000_000_000n

/**
 * Recommended minimum for stealth transfers (0.01 NEAR to cover creation + storage)
 */
export const RECOMMENDED_STEALTH_MINIMUM = 10_000_000_000_000_000_000_000n

/**
 * Default gas for relayer operations (100 TGas)
 */
export const RELAYER_GAS = 100_000_000_000_000n

// ─── Privacy-Wrapped Native Transfers ─────────────────────────────────────────

/**
 * Build a privacy-wrapped native NEAR transfer with optional amount commitment
 *
 * @param params - Transfer parameters
 * @returns Transfer build with optional commitment
 *
 * @example
 * ```typescript
 * const result = buildPrivateNativeTransferWithCommitment({
 *   recipientMetaAddress: 'sip:near:0x...:0x...',
 *   amount: ONE_NEAR,
 *   hideAmount: true,
 * })
 *
 * // Verify the transfer meets minimum balance
 * if (!result.meetsMinimum) {
 *   console.warn('Transfer may fail - below minimum balance')
 * }
 * ```
 */
export function buildPrivateNativeTransferWithCommitment(
  params: PrivateNativeTransferWithCommitmentParams
): PrivateNativeTransferWithCommitmentResult {
  const {
    recipientMetaAddress,
    amount,
    hideAmount = true,
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
  let commitment: NEARPedersenCommitment | undefined
  if (hideAmount) {
    commitment = commitNEAR(amount, blinding)
  }

  // Build transfer action
  const actions: NEARAction[] = [
    {
      type: 'Transfer',
      params: {
        deposit: amount,
      } as NEARTransferAction,
    },
  ]

  const transfer: NEARPrivateTransferBuild = {
    stealthAddress,
    stealthAccountId: implicitAccountId,
    announcementMemo,
    actions,
    receiverId: implicitAccountId,
  }

  return {
    transfer,
    commitment,
    stealthAddress,
    stealthAccountId: implicitAccountId,
    minimumBalance: IMPLICIT_ACCOUNT_CREATION_COST,
    meetsMinimum: amount >= IMPLICIT_ACCOUNT_CREATION_COST,
  }
}

/**
 * Build batch privacy-wrapped native NEAR transfers
 *
 * Note: Unlike token batch transfers, native NEAR transfers to different
 * accounts cannot be batched in a single transaction. This returns
 * separate transactions for each transfer.
 *
 * @param params - Batch transfer parameters
 * @returns Batch transfer build with individual transactions
 *
 * @example
 * ```typescript
 * const result = buildBatchPrivateNativeTransfer({
 *   transfers: [
 *     { recipientMetaAddress: meta1, amount: ONE_NEAR },
 *     { recipientMetaAddress: meta2, amount: 2n * ONE_NEAR },
 *   ],
 *   hideAmounts: true,
 * })
 *
 * // Send each transaction
 * for (const tx of result.transactions) {
 *   await sendTransaction(tx.receiverId, tx.actions)
 * }
 * ```
 */
export function buildBatchPrivateNativeTransfer(
  params: BatchNativeTransferParams
): BatchNativeTransferResult {
  const {
    transfers,
    hideAmounts = false,
  } = params

  // Validate transfers
  if (!transfers || transfers.length === 0) {
    throw new ValidationError('At least one transfer is required', 'transfers')
  }

  if (transfers.length > 100) {
    throw new ValidationError(
      'Maximum 100 transfers per batch',
      'transfers'
    )
  }

  const results: BatchNativeTransferResult['transfers'] = []
  const transactions: BatchNativeTransferResult['transactions'] = []
  let totalAmount = 0n
  let validTransferCount = 0

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
    let commitment: NEARPedersenCommitment | undefined
    if (hideAmounts) {
      commitment = commitNEAR(amount)
    }

    // Build transfer action
    const actions: NEARAction[] = [
      {
        type: 'Transfer',
        params: {
          deposit: amount,
        } as NEARTransferAction,
      },
    ]

    transactions.push({
      receiverId: implicitAccountId,
      actions,
    })

    results.push({
      stealthAddress,
      stealthAccountId: implicitAccountId,
      announcementMemo,
      amount,
      commitment,
    })

    totalAmount += amount

    if (amount >= IMPLICIT_ACCOUNT_CREATION_COST) {
      validTransferCount++
    }
  }

  return {
    transfers: results,
    transactions,
    totalAmount,
    validTransferCount,
  }
}

// ─── Gas Sponsorship ──────────────────────────────────────────────────────────

/**
 * Build a gas-sponsored transfer for sender anonymity
 *
 * In a gas-sponsored transfer, a relayer pays for gas on behalf of the sender,
 * helping preserve sender anonymity as the sender's account doesn't need NEAR
 * for gas.
 *
 * @param params - Gas-sponsored transfer parameters
 * @returns Transfer build for relayer execution
 *
 * @example
 * ```typescript
 * // User builds sponsored transfer
 * const result = buildGasSponsoredTransfer({
 *   recipientMetaAddress: 'sip:near:0x...',
 *   amount: ONE_NEAR,
 *   relayerAccountId: 'relayer.near',
 *   hideAmount: true,
 * })
 *
 * // User sends signed actions to relayer
 * // Relayer executes on behalf of user
 * ```
 */
export function buildGasSponsoredTransfer(
  params: GasSponsoredTransferParams
): GasSponsoredTransferResult {
  const {
    recipientMetaAddress,
    amount,
    relayerAccountId,
    maxRelayerFee = 100_000_000_000_000_000_000_000n, // 0.1 NEAR default max
    hideAmount = false,
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

  // Validate amount
  if (amount <= 0n) {
    throw new ValidationError('amount must be greater than 0', 'amount')
  }

  // Validate relayer account ID (must be a valid named account)
  if (!relayerAccountId || relayerAccountId.length < 2) {
    throw new ValidationError('Invalid relayerAccountId', 'relayerAccountId')
  }

  // Generate stealth address
  const { stealthAddress, implicitAccountId } = generateNEARStealthAddress(metaAddr)

  // Create announcement memo
  const announcementMemo = createAnnouncementMemo(
    stealthAddress.ephemeralPublicKey,
    stealthAddress.viewTag
  )

  // Create commitment if hiding amounts
  let commitment: NEARPedersenCommitment | undefined
  if (hideAmount) {
    commitment = commitNEAR(amount)
  }

  // Estimated gas fee (conservative estimate)
  const estimatedFee = RELAYER_GAS / 1_000_000n // ~0.0001 NEAR gas cost

  // Validate fee doesn't exceed max
  if (estimatedFee > maxRelayerFee) {
    throw new ValidationError(
      `Estimated fee ${estimatedFee} exceeds maxRelayerFee ${maxRelayerFee}`,
      'maxRelayerFee'
    )
  }

  // Build relayer actions
  // The relayer will execute a function call to a relay contract
  // that handles the transfer
  const relayerActions: NEARAction[] = [
    {
      type: 'Transfer',
      params: {
        deposit: amount,
      } as NEARTransferAction,
    },
  ]

  return {
    relayerActions,
    stealthAddress,
    stealthAccountId: implicitAccountId,
    announcementMemo,
    commitment,
    estimatedFee,
  }
}

// ─── Account Creation Helpers ─────────────────────────────────────────────────

/**
 * Get account creation cost estimate
 *
 * @returns Cost estimate for creating an implicit account
 */
export function getAccountCreationCost(): AccountCreationCost {
  return {
    minimumBalance: IMPLICIT_ACCOUNT_CREATION_COST,
    storagePerByte: STORAGE_COST_PER_BYTE,
    recommendedMinimum: RECOMMENDED_STEALTH_MINIMUM,
  }
}

/**
 * Check if an amount meets the minimum balance for account creation
 *
 * @param amount - Amount in yoctoNEAR
 * @returns True if amount meets minimum balance
 */
export function meetsMinimumBalance(amount: bigint): boolean {
  return amount >= IMPLICIT_ACCOUNT_CREATION_COST
}

/**
 * Calculate the recommended transfer amount
 *
 * Ensures the transfer amount is sufficient for account creation
 * and includes a buffer for storage costs.
 *
 * @param desiredAmount - The desired transfer amount
 * @returns Recommended amount (at least the minimum)
 */
export function calculateRecommendedAmount(desiredAmount: bigint): bigint {
  return desiredAmount >= RECOMMENDED_STEALTH_MINIMUM
    ? desiredAmount
    : RECOMMENDED_STEALTH_MINIMUM
}

/**
 * Adjust transfer amount to ensure it meets minimum requirements
 *
 * @param amount - Original amount
 * @param ensureMinimum - Whether to adjust to minimum if below
 * @returns Adjusted amount
 */
export function adjustTransferAmount(
  amount: bigint,
  ensureMinimum: boolean = true
): { amount: bigint; adjusted: boolean; originalAmount: bigint } {
  if (ensureMinimum && amount < IMPLICIT_ACCOUNT_CREATION_COST) {
    return {
      amount: IMPLICIT_ACCOUNT_CREATION_COST,
      adjusted: true,
      originalAmount: amount,
    }
  }

  return {
    amount,
    adjusted: false,
    originalAmount: amount,
  }
}

// ─── Transfer Amount Formatting ───────────────────────────────────────────────

/**
 * Format NEAR amount for display
 *
 * @param amount - Amount in yoctoNEAR
 * @returns Formatted string (e.g., "1.5 NEAR")
 */
export function formatNEARAmount(amount: bigint): string {
  const str = amount.toString().padStart(25, '0')
  const whole = str.slice(0, -24) || '0'
  const fraction = str.slice(-24).replace(/0+$/, '')

  const formatted = fraction ? `${whole}.${fraction}` : whole
  return `${formatted} NEAR`
}

/**
 * Parse NEAR amount from display string
 *
 * @param displayAmount - Human-readable amount (e.g., "1.5" or "1.5 NEAR")
 * @returns Amount in yoctoNEAR
 */
export function parseNEARAmount(displayAmount: string): bigint {
  // Remove NEAR suffix and any whitespace
  const cleaned = displayAmount.replace(/\s*NEAR\s*/i, '').trim()

  const [whole, fraction = ''] = cleaned.split('.')
  const paddedFraction = fraction.padEnd(24, '0').slice(0, 24)

  return BigInt(whole + paddedFraction)
}

// ─── Transfer Commitment Verification ─────────────────────────────────────────

/**
 * Verify a native NEAR transfer commitment
 *
 * @param commitment - The commitment to verify
 * @param expectedAmount - The expected amount in yoctoNEAR
 * @returns True if commitment opens to expected amount
 */
export function verifyNativeTransferCommitment(
  commitment: NEARPedersenCommitment,
  expectedAmount: bigint
): boolean {
  return verifyOpeningNEAR(commitment.commitment, expectedAmount, commitment.blinding)
}

/**
 * Create a commitment proof for a native NEAR transfer
 *
 * This can be shared off-chain with the recipient to prove
 * the transfer amount without revealing it on-chain.
 *
 * @param amount - The transfer amount
 * @param blinding - Optional blinding factor
 * @returns Commitment proof
 */
export function createTransferCommitmentProof(
  amount: bigint,
  blinding?: Uint8Array
): {
  commitment: NEARPedersenCommitment
  amount: bigint
  amountFormatted: string
} {
  const commitment = commitNEAR(amount, blinding)

  return {
    commitment,
    amount,
    amountFormatted: formatNEARAmount(amount),
  }
}
