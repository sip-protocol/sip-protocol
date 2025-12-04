/**
 * Auction Types
 *
 * Type definitions for sealed-bid auctions with privacy-preserving winner verification.
 *
 * @module types/auction
 */

import type { HexString } from './crypto'

/**
 * Result of winner determination
 *
 * Contains the winning bid information and verification data.
 */
export interface WinnerResult {
  /**
   * The auction ID this result belongs to
   */
  auctionId: string

  /**
   * The winning commitment
   */
  commitment: HexString

  /**
   * The winning bid amount (revealed)
   */
  amount: bigint

  /**
   * The salt used in the winning commitment
   */
  salt: HexString

  /**
   * Unix timestamp of the winning bid (for tie-breaking)
   */
  timestamp: number

  /**
   * Index of the winning bid in the original array (optional, for reference)
   */
  bidIndex?: number
}

/**
 * Zero-knowledge style proof that a winner is valid
 *
 * This proof demonstrates that the winner bid is >= all other bids
 * WITHOUT revealing the losing bid amounts to observers.
 */
export interface WinnerProof {
  /**
   * The auction ID this proof belongs to
   */
  auctionId: string

  /**
   * The winning commitment being proven
   */
  winnerCommitment: HexString

  /**
   * The revealed winning amount
   */
  winnerAmount: bigint

  /**
   * Total number of bids in the auction
   */
  totalBids: number

  /**
   * Hash of all bid commitments (for integrity)
   * Hash of sorted array of commitments to prevent reordering attacks
   */
  commitmentsHash: HexString

  /**
   * Comparison proofs showing winner >= each other bid
   * Array of differential commitments: C_winner - C_i for each bid i
   * These prove the winner is >= other bids without revealing their amounts
   */
  differentialCommitments: HexString[]

  /**
   * Unix timestamp of the winning bid
   */
  timestamp: number
}

/**
 * Full verification result with details
 */
export interface WinnerVerification {
  /**
   * Whether the winner is valid
   */
  valid: boolean

  /**
   * The auction ID being verified
   */
  auctionId: string

  /**
   * The winning commitment
   */
  winnerCommitment: HexString

  /**
   * Reason for failure (if invalid)
   */
  reason?: string

  /**
   * Details about the verification process
   */
  details?: {
    /**
     * Number of bids verified
     */
    bidsChecked: number

    /**
     * Whether all comparison proofs passed
     */
    comparisonsPassed: boolean

    /**
     * Whether commitments hash matched
     */
    hashMatched: boolean
  }
}
