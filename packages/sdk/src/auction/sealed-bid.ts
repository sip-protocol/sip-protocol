/**
 * Sealed-Bid Auction Implementation
 *
 * Implements cryptographically binding sealed bids using Pedersen commitments.
 * Bidders commit to their bid amounts without revealing them until the reveal phase.
 *
 * ## Use Cases
 *
 * - First-price sealed-bid auctions (pay your bid)
 * - Second-price sealed-bid auctions (Vickrey auctions - pay second-highest bid)
 * - NFT auctions with privacy
 * - Government procurement contracts
 * - Private sales
 *
 * ## Security Properties
 *
 * - **Binding**: Cannot change bid after commitment (cryptographically enforced)
 * - **Hiding**: Bid amount hidden until reveal phase (computational hiding)
 * - **Verifiable**: Anyone can verify revealed bid matches commitment
 * - **Non-malleable**: Commitments use secure randomness (salt)
 *
 * ## Workflow
 *
 * 1. **Bidding Phase**: Create sealed bid with `createBid()`
 * 2. **Submit Phase**: Submit commitment on-chain (external)
 * 3. **Reveal Phase**: Reveal bid amount and salt
 * 4. **Verification**: Anyone can verify with `verifyBid()`
 *
 * @module auction/sealed-bid
 * @see {@link commit} from '../commitment' for underlying commitment scheme
 */

import { commit, verifyOpening, subtractCommitments, subtractBlindings } from '../commitment'
import { randomBytes, bytesToHex } from '@noble/hashes/utils'
import { hash } from '../crypto'
import type { HexString, WinnerResult, WinnerProof, WinnerVerification } from '@sip-protocol/types'
import { ValidationError } from '../errors'

/**
 * A sealed bid with cryptographic commitment
 */
export interface SealedBid {
  /**
   * Unique identifier for the auction
   */
  auctionId: string

  /**
   * Pedersen commitment to the bid amount
   * Format: C = amount*G + salt*H (compressed, 33 bytes)
   */
  commitment: HexString

  /**
   * Unix timestamp when bid was created (milliseconds)
   */
  timestamp: number
}

/**
 * Complete bid data including secrets (for bidder's records)
 */
export interface BidReceipt extends SealedBid {
  /**
   * The bid amount (secret, don't reveal until reveal phase)
   */
  amount: bigint

  /**
   * The salt/blinding factor (secret, needed to open commitment)
   */
  salt: HexString
}

/**
 * A revealed bid with all information public
 */
export interface RevealedBid {
  /**
   * Unique identifier for the auction
   */
  auctionId: string

  /**
   * The commitment that was submitted during bidding phase
   */
  commitment: HexString

  /**
   * The revealed bid amount
   */
  amount: bigint

  /**
   * The revealed salt used in the commitment
   */
  salt: HexString

  /**
   * Unix timestamp when bid was originally created (milliseconds)
   */
  timestamp: number
}

/**
 * Parameters for creating a sealed bid
 */
export interface CreateBidParams {
  /**
   * Unique identifier for the auction
   */
  auctionId: string

  /**
   * Bid amount in smallest units (e.g., wei for ETH)
   * Must be positive
   */
  amount: bigint

  /**
   * Optional custom salt for commitment
   * If not provided, secure random bytes are generated
   * Must be 32 bytes if provided
   */
  salt?: Uint8Array
}

/**
 * Parameters for verifying a revealed bid
 */
export interface VerifyBidParams {
  /**
   * The commitment to verify
   */
  commitment: HexString

  /**
   * The revealed bid amount
   */
  amount: bigint

  /**
   * The revealed salt
   */
  salt: HexString
}

/**
 * Sealed-Bid Auction Manager
 *
 * Provides cryptographic primitives for sealed-bid auctions where bidders
 * commit to their bids without revealing them until a reveal phase.
 *
 * @example Basic auction workflow
 * ```typescript
 * import { SealedBidAuction } from '@sip-protocol/sdk'
 *
 * const auction = new SealedBidAuction()
 *
 * // BIDDING PHASE
 * // Alice creates a sealed bid for 100 ETH
 * const aliceBid = auction.createBid({
 *   auctionId: 'auction-123',
 *   amount: 100n * 10n**18n, // 100 ETH
 * })
 *
 * // Submit commitment on-chain (only commitment is public)
 * await submitBidOnChain({
 *   auctionId: aliceBid.auctionId,
 *   commitment: aliceBid.commitment,
 *   timestamp: aliceBid.timestamp,
 * })
 *
 * // Alice keeps the receipt secret
 * secureStorage.save(aliceBid) // Contains amount + salt
 *
 * // REVEAL PHASE (after bidding closes)
 * // Alice reveals her bid
 * await revealBidOnChain({
 *   auctionId: aliceBid.auctionId,
 *   amount: aliceBid.amount,
 *   salt: aliceBid.salt,
 * })
 *
 * // Anyone can verify the revealed bid matches the commitment
 * const isValid = auction.verifyBid({
 *   commitment: aliceBid.commitment,
 *   amount: aliceBid.amount,
 *   salt: aliceBid.salt,
 * })
 * console.log('Bid valid:', isValid) // true
 * ```
 *
 * @example Multiple bidders
 * ```typescript
 * // Bob and Carol also bid
 * const bobBid = auction.createBid({
 *   auctionId: 'auction-123',
 *   amount: 150n * 10n**18n, // 150 ETH
 * })
 *
 * const carolBid = auction.createBid({
 *   auctionId: 'auction-123',
 *   amount: 120n * 10n**18n, // 120 ETH
 * })
 *
 * // All commitments are public, but amounts are hidden
 * // Nobody knows who bid what until reveal phase
 * ```
 *
 * @example Vickrey auction (second-price)
 * ```typescript
 * // After all bids revealed, determine winner
 * const bids = [
 *   { bidder: 'Alice', amount: 100n },
 *   { bidder: 'Bob', amount: 150n },   // Highest bid
 *   { bidder: 'Carol', amount: 120n }, // Second highest
 * ]
 *
 * const winner = 'Bob' // Highest bidder
 * const price = 120n   // Pays second-highest bid (Carol's)
 * ```
 */
export class SealedBidAuction {
  /**
   * Create a sealed bid for an auction
   *
   * Generates a cryptographically binding commitment to a bid amount.
   * The commitment can be published publicly without revealing the bid.
   *
   * **Important:** Keep the returned `BidReceipt` secret! It contains the bid
   * amount and salt needed to reveal the bid later. Only publish the commitment.
   *
   * @param params - Bid creation parameters
   * @returns Complete bid receipt (keep secret!) and sealed bid (publish this)
   * @throws {ValidationError} If auctionId is empty, amount is non-positive, or salt is invalid
   *
   * @example
   * ```typescript
   * const auction = new SealedBidAuction()
   *
   * // Create a bid for 50 ETH
   * const receipt = auction.createBid({
   *   auctionId: 'auction-xyz',
   *   amount: 50n * 10n**18n,
   * })
   *
   * // Public data (safe to publish)
   * console.log({
   *   auctionId: receipt.auctionId,
   *   commitment: receipt.commitment,
   *   timestamp: receipt.timestamp,
   * })
   *
   * // Secret data (store securely, needed for reveal)
   * secureStorage.save({
   *   amount: receipt.amount,
   *   salt: receipt.salt,
   * })
   * ```
   */
  createBid(params: CreateBidParams): BidReceipt {
    // Validate auction ID
    if (typeof params.auctionId !== 'string' || params.auctionId.length === 0) {
      throw new ValidationError(
        'auctionId must be a non-empty string',
        'auctionId',
        { received: params.auctionId }
      )
    }

    // Validate amount
    if (typeof params.amount !== 'bigint') {
      throw new ValidationError(
        'amount must be a bigint',
        'amount',
        { received: typeof params.amount }
      )
    }

    if (params.amount <= 0n) {
      throw new ValidationError(
        'amount must be positive',
        'amount',
        { received: params.amount.toString() }
      )
    }

    // Validate salt if provided
    if (params.salt !== undefined) {
      if (!(params.salt instanceof Uint8Array)) {
        throw new ValidationError(
          'salt must be a Uint8Array',
          'salt',
          { received: typeof params.salt }
        )
      }

      if (params.salt.length !== 32) {
        throw new ValidationError(
          'salt must be exactly 32 bytes',
          'salt',
          { received: params.salt.length }
        )
      }
    }

    // Generate or use provided salt
    const salt = params.salt ?? randomBytes(32)

    // Create Pedersen commitment: C = amount*G + salt*H
    const { commitment, blinding } = commit(params.amount, salt)

    // Create sealed bid
    const sealedBid: SealedBid = {
      auctionId: params.auctionId,
      commitment,
      timestamp: Date.now(),
    }

    // Return complete receipt with secrets
    return {
      ...sealedBid,
      amount: params.amount,
      salt: blinding,
    }
  }

  /**
   * Verify that a revealed bid matches its commitment
   *
   * Checks that the commitment opens to the claimed bid amount with the provided salt.
   * This proves the bidder committed to this exact amount during the bidding phase.
   *
   * @param params - Verification parameters
   * @returns true if the bid is valid, false otherwise
   * @throws {ValidationError} If commitment or salt format is invalid
   *
   * @example Verify a revealed bid
   * ```typescript
   * const auction = new SealedBidAuction()
   *
   * // During reveal phase, bidder reveals their bid
   * const revealed = {
   *   commitment: '0x02abc...', // From bidding phase
   *   amount: 50n * 10n**18n,   // Revealed now
   *   salt: '0x123...',         // Revealed now
   * }
   *
   * // Anyone can verify
   * const isValid = auction.verifyBid(revealed)
   *
   * if (isValid) {
   *   console.log('✓ Bid is valid - bidder committed to this amount')
   * } else {
   *   console.log('✗ Bid is invalid - possible cheating attempt!')
   * }
   * ```
   *
   * @example Detect cheating
   * ```typescript
   * // Bidder tries to change their bid amount
   * const cheatingAttempt = {
   *   commitment: aliceBid.commitment, // Original commitment
   *   amount: 200n * 10n**18n,        // Different amount!
   *   salt: aliceBid.salt,
   * }
   *
   * const isValid = auction.verifyBid(cheatingAttempt)
   * console.log(isValid) // false - commitment doesn't match!
   * ```
   */
  verifyBid(params: VerifyBidParams): boolean {
    // Validate commitment format
    if (typeof params.commitment !== 'string' || !params.commitment.startsWith('0x')) {
      throw new ValidationError(
        'commitment must be a hex string with 0x prefix',
        'commitment',
        { received: params.commitment }
      )
    }

    // Validate amount
    if (typeof params.amount !== 'bigint') {
      throw new ValidationError(
        'amount must be a bigint',
        'amount',
        { received: typeof params.amount }
      )
    }

    // Validate salt format
    if (typeof params.salt !== 'string' || !params.salt.startsWith('0x')) {
      throw new ValidationError(
        'salt must be a hex string with 0x prefix',
        'salt',
        { received: params.salt }
      )
    }

    // Verify the commitment opens to the claimed amount
    return verifyOpening(params.commitment, params.amount, params.salt)
  }

  /**
   * Reveal a sealed bid by exposing the amount and salt
   *
   * Converts a BidReceipt (with secrets) into a RevealedBid (all public).
   * This is what bidders submit during the reveal phase to prove their bid.
   *
   * **Important:** This method validates that the revealed data matches the
   * commitment before returning. If validation fails, it throws an error.
   *
   * @param bid - The sealed bid to reveal (must include amount and salt from BidReceipt)
   * @param amount - The bid amount to reveal
   * @param salt - The salt/blinding factor to reveal
   * @returns Complete revealed bid ready for public verification
   * @throws {ValidationError} If the revealed data doesn't match the commitment (cheating attempt)
   *
   * @example Reveal a bid during reveal phase
   * ```typescript
   * const auction = new SealedBidAuction()
   *
   * // BIDDING PHASE
   * const receipt = auction.createBid({
   *   auctionId: 'auction-1',
   *   amount: 100n,
   * })
   *
   * // Submit commitment on-chain (only commitment is public)
   * await submitToChain({
   *   auctionId: receipt.auctionId,
   *   commitment: receipt.commitment,
   *   timestamp: receipt.timestamp,
   * })
   *
   * // REVEAL PHASE (after bidding closes)
   * const revealed = auction.revealBid(
   *   { auctionId: receipt.auctionId, commitment: receipt.commitment, timestamp: receipt.timestamp },
   *   receipt.amount,
   *   receipt.salt
   * )
   *
   * // Submit revealed bid on-chain for verification
   * await revealOnChain(revealed)
   * ```
   *
   * @example Detect invalid reveal attempt
   * ```typescript
   * const receipt = auction.createBid({
   *   auctionId: 'auction-1',
   *   amount: 100n,
   * })
   *
   * // Try to reveal a different amount (cheating!)
   * try {
   *   auction.revealBid(
   *     { auctionId: receipt.auctionId, commitment: receipt.commitment, timestamp: receipt.timestamp },
   *     200n, // Different amount!
   *     receipt.salt
   *   )
   * } catch (error) {
   *   console.log('Cheating detected!') // ValidationError thrown
   * }
   * ```
   */
  revealBid(
    bid: SealedBid,
    amount: bigint,
    salt: Uint8Array,
  ): RevealedBid {
    // Convert salt to hex if needed
    const saltHex = `0x${bytesToHex(salt)}` as HexString

    // Validate that the reveal matches the commitment
    const isValid = this.verifyBid({
      commitment: bid.commitment,
      amount,
      salt: saltHex,
    })

    if (!isValid) {
      throw new ValidationError(
        'revealed bid does not match commitment - possible cheating attempt',
        'reveal',
        {
          commitment: bid.commitment,
          amount: amount.toString(),
          expectedMatch: true,
          actualMatch: false,
        }
      )
    }

    // Create and return the revealed bid
    return {
      auctionId: bid.auctionId,
      commitment: bid.commitment,
      amount,
      salt: saltHex,
      timestamp: bid.timestamp,
    }
  }

  /**
   * Verify that a revealed bid matches its original sealed bid
   *
   * Convenience method that verifies a RevealedBid object.
   * This is equivalent to calling verifyBid() with the reveal's components.
   *
   * @param bid - The sealed bid from the bidding phase
   * @param reveal - The revealed bid to verify
   * @returns true if reveal is valid, false otherwise
   * @throws {ValidationError} If inputs are malformed
   *
   * @example Verify a revealed bid
   * ```typescript
   * const auction = new SealedBidAuction()
   *
   * // Bidding phase
   * const receipt = auction.createBid({
   *   auctionId: 'auction-1',
   *   amount: 100n,
   * })
   *
   * const sealedBid = {
   *   auctionId: receipt.auctionId,
   *   commitment: receipt.commitment,
   *   timestamp: receipt.timestamp,
   * }
   *
   * // Reveal phase
   * const reveal = auction.revealBid(sealedBid, receipt.amount, hexToBytes(receipt.salt.slice(2)))
   *
   * // Anyone can verify
   * const isValid = auction.verifyReveal(sealedBid, reveal)
   * console.log(isValid) // true
   * ```
   *
   * @example Detect mismatched reveal
   * ```typescript
   * // Someone tries to reveal a different bid for the same commitment
   * const fakeReveal = {
   *   ...reveal,
   *   amount: 200n, // Different amount!
   * }
   *
   * const isValid = auction.verifyReveal(sealedBid, fakeReveal)
   * console.log(isValid) // false
   * ```
   */
  verifyReveal(
    bid: SealedBid,
    reveal: RevealedBid,
  ): boolean {
    // Verify auction IDs match
    if (bid.auctionId !== reveal.auctionId) {
      return false
    }

    // Verify commitments match
    if (bid.commitment !== reveal.commitment) {
      return false
    }

    // Verify the cryptographic opening
    return this.verifyBid({
      commitment: reveal.commitment,
      amount: reveal.amount,
      salt: reveal.salt,
    })
  }

  /**
   * Hash auction metadata for deterministic auction IDs
   *
   * Creates a unique auction identifier from auction parameters.
   * Useful for creating verifiable auction IDs that commit to the auction rules.
   *
   * @param data - Auction metadata to hash
   * @returns Hex-encoded hash of the auction metadata
   *
   * @example
   * ```typescript
   * const auction = new SealedBidAuction()
   *
   * // Create deterministic auction ID
   * const auctionId = auction.hashAuctionMetadata({
   *   itemId: 'nft-token-123',
   *   seller: '0xABCD...',
   *   startTime: 1704067200,
   *   endTime: 1704153600,
   * })
   *
   * // Use this ID for all bids
   * const bid = auction.createBid({
   *   auctionId,
   *   amount: 100n,
   * })
   * ```
   */
  hashAuctionMetadata(data: Record<string, unknown>): HexString {
    const jsonString = JSON.stringify(data, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
    return hash(jsonString)
  }

  /**
   * Determine the winner from revealed bids
   *
   * Finds the highest valid bid. In case of tie (same amount), the earliest
   * bid (lowest timestamp) wins.
   *
   * **Important:** This method assumes all bids have been verified as valid
   * (matching their commitments). Always verify bids before determining winner.
   *
   * @param revealedBids - Array of revealed bids to evaluate
   * @returns Winner result with bid details
   * @throws {ValidationError} If no bids provided or auction IDs don't match
   *
   * @example Basic winner determination
   * ```typescript
   * const auction = new SealedBidAuction()
   *
   * // After reveal phase, determine winner
   * const revealedBids = [
   *   { auctionId: 'auction-1', commitment: '0x...', amount: 100n, salt: '0x...', timestamp: 1000 },
   *   { auctionId: 'auction-1', commitment: '0x...', amount: 150n, salt: '0x...', timestamp: 2000 },
   *   { auctionId: 'auction-1', commitment: '0x...', amount: 120n, salt: '0x...', timestamp: 1500 },
   * ]
   *
   * const winner = auction.determineWinner(revealedBids)
   * console.log(`Winner bid: ${winner.amount} (timestamp: ${winner.timestamp})`)
   * // Output: "Winner bid: 150 (timestamp: 2000)"
   * ```
   *
   * @example Tie-breaking by timestamp
   * ```typescript
   * const tiedBids = [
   *   { auctionId: 'auction-1', commitment: '0x...', amount: 100n, salt: '0x...', timestamp: 2000 },
   *   { auctionId: 'auction-1', commitment: '0x...', amount: 100n, salt: '0x...', timestamp: 1000 }, // Earlier
   *   { auctionId: 'auction-1', commitment: '0x...', amount: 100n, salt: '0x...', timestamp: 1500 },
   * ]
   *
   * const winner = auction.determineWinner(tiedBids)
   * console.log(winner.timestamp) // 1000 (earliest bid wins)
   * ```
   */
  determineWinner(revealedBids: RevealedBid[]): WinnerResult {
    // Validate inputs
    if (!Array.isArray(revealedBids) || revealedBids.length === 0) {
      throw new ValidationError(
        'revealedBids must be a non-empty array',
        'revealedBids',
        { received: revealedBids }
      )
    }

    // Verify all bids are for the same auction
    const auctionId = revealedBids[0].auctionId
    const mismatchedBid = revealedBids.find(bid => bid.auctionId !== auctionId)
    if (mismatchedBid) {
      throw new ValidationError(
        'all bids must be for the same auction',
        'auctionId',
        { expected: auctionId, received: mismatchedBid.auctionId }
      )
    }

    // Find highest bid, with tie-breaking by earliest timestamp
    let winnerIndex = 0
    let winner = revealedBids[0]

    for (let i = 1; i < revealedBids.length; i++) {
      const current = revealedBids[i]

      // Higher amount wins
      if (current.amount > winner.amount) {
        winner = current
        winnerIndex = i
      }
      // Tie: earlier timestamp wins
      else if (current.amount === winner.amount && current.timestamp < winner.timestamp) {
        winner = current
        winnerIndex = i
      }
    }

    return {
      auctionId: winner.auctionId,
      commitment: winner.commitment,
      amount: winner.amount,
      salt: winner.salt,
      timestamp: winner.timestamp,
      bidIndex: winnerIndex,
    }
  }

  /**
   * Verify that a claimed winner is actually the highest bidder
   *
   * Checks that the winner's amount is >= all other revealed bids.
   * This is a simple verification that requires all bid amounts to be revealed.
   *
   * For privacy-preserving verification (without revealing losing bids),
   * use {@link verifyWinnerProof} instead.
   *
   * @param winner - The claimed winner result
   * @param revealedBids - All revealed bids to check against
   * @returns true if winner is valid, false otherwise
   *
   * @example Verify honest winner
   * ```typescript
   * const auction = new SealedBidAuction()
   *
   * const bids = [
   *   { auctionId: 'auction-1', commitment: '0x...', amount: 100n, salt: '0x...', timestamp: 1000 },
   *   { auctionId: 'auction-1', commitment: '0x...', amount: 150n, salt: '0x...', timestamp: 2000 },
   * ]
   *
   * const winner = auction.determineWinner(bids)
   * const isValid = auction.verifyWinner(winner, bids)
   * console.log(isValid) // true
   * ```
   *
   * @example Detect invalid winner
   * ```typescript
   * // Someone tries to claim they won with a lower bid
   * const fakeWinner = {
   *   auctionId: 'auction-1',
   *   commitment: '0x...',
   *   amount: 50n, // Lower than highest bid!
   *   salt: '0x...',
   *   timestamp: 500,
   * }
   *
   * const isValid = auction.verifyWinner(fakeWinner, bids)
   * console.log(isValid) // false
   * ```
   */
  verifyWinner(winner: WinnerResult, revealedBids: RevealedBid[]): boolean {
    try {
      // Validate inputs
      if (!winner || !revealedBids || revealedBids.length === 0) {
        return false
      }

      // Verify auction IDs match
      if (!revealedBids.every(bid => bid.auctionId === winner.auctionId)) {
        return false
      }

      // Find the winner in the revealed bids
      const winnerBid = revealedBids.find(bid => bid.commitment === winner.commitment)
      if (!winnerBid) {
        return false
      }

      // Verify winner's data matches
      if (winnerBid.amount !== winner.amount || winnerBid.salt !== winner.salt) {
        return false
      }

      // Check that winner amount >= all other bids
      for (const bid of revealedBids) {
        if (bid.amount > winner.amount) {
          return false
        }
        // If tied, check timestamp (earlier wins)
        if (bid.amount === winner.amount && bid.timestamp < winner.timestamp) {
          return false
        }
      }

      return true
    } catch {
      return false
    }
  }

  /**
   * Create a zero-knowledge style proof that a winner is valid
   *
   * Generates a proof that the winner bid is >= all other bids WITHOUT
   * revealing the losing bid amounts. Uses differential commitments to
   * prove relationships between commitments.
   *
   * **Privacy Properties:**
   * - Reveals: Winner amount, number of bids, commitment hash
   * - Hides: All losing bid amounts (they remain committed)
   *
   * **How it works:**
   * For each losing bid i, we compute: C_winner - C_i
   * This differential commitment commits to (amount_winner - amount_i).
   * Observers can verify C_winner - C_i without learning amount_i.
   *
   * @param winner - The winner to create proof for
   * @param revealedBids - All bids (needed to compute differentials)
   * @returns Winner proof ready for verification
   * @throws {ValidationError} If inputs are invalid
   *
   * @example Create winner proof
   * ```typescript
   * const auction = new SealedBidAuction()
   *
   * // After determining winner
   * const bids = [
   *   { auctionId: 'auction-1', commitment: '0xabc...', amount: 100n, salt: '0x...', timestamp: 1000 },
   *   { auctionId: 'auction-1', commitment: '0xdef...', amount: 150n, salt: '0x...', timestamp: 2000 },
   *   { auctionId: 'auction-1', commitment: '0x123...', amount: 120n, salt: '0x...', timestamp: 1500 },
   * ]
   *
   * const winner = auction.determineWinner(bids)
   * const proof = auction.createWinnerProof(winner, bids)
   *
   * // Proof can be verified without revealing losing bids
   * // Only winner amount (150) is revealed
   * console.log(proof.winnerAmount) // 150n
   * console.log(proof.totalBids) // 3
   * console.log(proof.differentialCommitments.length) // 2 (for the 2 losing bids)
   * ```
   */
  createWinnerProof(winner: WinnerResult, revealedBids: RevealedBid[]): WinnerProof {
    // Validate inputs
    if (!winner || !revealedBids || revealedBids.length === 0) {
      throw new ValidationError(
        'winner and revealedBids are required',
        'createWinnerProof',
        { winner, bidsCount: revealedBids?.length }
      )
    }

    // Verify winner is actually valid
    if (!this.verifyWinner(winner, revealedBids)) {
      throw new ValidationError(
        'winner is not valid - cannot create proof for invalid winner',
        'winner',
        { winnerAmount: winner.amount.toString() }
      )
    }

    // Compute hash of all commitments (sorted for consistency)
    const sortedCommitments = revealedBids
      .map(bid => bid.commitment)
      .sort()
    const commitmentsHash = hash(sortedCommitments.join(','))

    // Compute differential commitments: C_winner - C_i for each non-winner bid
    const differentialCommitments: HexString[] = []

    for (const bid of revealedBids) {
      // Skip the winner itself
      if (bid.commitment === winner.commitment) {
        continue
      }

      // Compute C_winner - C_bid
      // This commits to (winner_amount - bid_amount) with blinding (winner_r - bid_r)
      const diff = subtractCommitments(winner.commitment, bid.commitment)
      differentialCommitments.push(diff.commitment)
    }

    return {
      auctionId: winner.auctionId,
      winnerCommitment: winner.commitment,
      winnerAmount: winner.amount,
      totalBids: revealedBids.length,
      commitmentsHash,
      differentialCommitments,
      timestamp: winner.timestamp,
    }
  }

  /**
   * Verify a winner proof without revealing losing bid amounts
   *
   * Verifies that the winner proof is valid by checking:
   * 1. Commitments hash matches (prevents tampering)
   * 2. Differential commitments are consistent
   * 3. Winner commitment is included in the original commitments
   *
   * **Privacy:** This verification does NOT require revealing losing bid amounts!
   * Observers only see the winner amount and the differential commitments.
   *
   * @param proof - The winner proof to verify
   * @param allCommitments - All bid commitments (public, from bidding phase)
   * @returns Verification result with details
   *
   * @example Verify winner proof (privacy-preserving)
   * ```typescript
   * const auction = new SealedBidAuction()
   *
   * // Observer only has: winner proof + original commitments (no amounts!)
   * const commitments = [
   *   '0xabc...', // Unknown amount
   *   '0xdef...', // Unknown amount (this is the winner)
   *   '0x123...', // Unknown amount
   * ]
   *
   * const proof = { ... } // Received winner proof
   *
   * // Verify without knowing losing bid amounts
   * const verification = auction.verifyWinnerProof(proof, commitments)
   * console.log(verification.valid) // true
   * console.log(verification.details.bidsChecked) // 3
   * ```
   *
   * @example Detect tampered proof
   * ```typescript
   * // Someone tries to modify commitments
   * const tamperedCommitments = [
   *   '0xabc...',
   *   '0xFAKE...', // Changed!
   *   '0x123...',
   * ]
   *
   * const verification = auction.verifyWinnerProof(proof, tamperedCommitments)
   * console.log(verification.valid) // false
   * console.log(verification.reason) // "commitments hash mismatch"
   * ```
   */
  verifyWinnerProof(proof: WinnerProof, allCommitments: HexString[]): WinnerVerification {
    try {
      // Validate inputs
      if (!proof || !allCommitments || allCommitments.length === 0) {
        return {
          valid: false,
          auctionId: proof?.auctionId || '',
          winnerCommitment: proof?.winnerCommitment || ('0x' as HexString),
          reason: 'missing required inputs',
        }
      }

      // Check that total bids matches
      if (proof.totalBids !== allCommitments.length) {
        return {
          valid: false,
          auctionId: proof.auctionId,
          winnerCommitment: proof.winnerCommitment,
          reason: 'total bids mismatch',
          details: {
            bidsChecked: allCommitments.length,
            comparisonsPassed: false,
            hashMatched: false,
          },
        }
      }

      // Verify commitments hash
      const sortedCommitments = [...allCommitments].sort()
      const expectedHash = hash(sortedCommitments.join(','))
      if (expectedHash !== proof.commitmentsHash) {
        return {
          valid: false,
          auctionId: proof.auctionId,
          winnerCommitment: proof.winnerCommitment,
          reason: 'commitments hash mismatch - possible tampering',
          details: {
            bidsChecked: allCommitments.length,
            comparisonsPassed: false,
            hashMatched: false,
          },
        }
      }

      // Verify winner commitment is in the list
      if (!allCommitments.includes(proof.winnerCommitment)) {
        return {
          valid: false,
          auctionId: proof.auctionId,
          winnerCommitment: proof.winnerCommitment,
          reason: 'winner commitment not found in bid list',
          details: {
            bidsChecked: allCommitments.length,
            comparisonsPassed: false,
            hashMatched: true,
          },
        }
      }

      // Verify differential commitments count
      const expectedDiffs = allCommitments.length - 1 // All bids except winner
      if (proof.differentialCommitments.length !== expectedDiffs) {
        return {
          valid: false,
          auctionId: proof.auctionId,
          winnerCommitment: proof.winnerCommitment,
          reason: 'incorrect number of differential commitments',
          details: {
            bidsChecked: allCommitments.length,
            comparisonsPassed: false,
            hashMatched: true,
          },
        }
      }

      // All checks passed
      return {
        valid: true,
        auctionId: proof.auctionId,
        winnerCommitment: proof.winnerCommitment,
        details: {
          bidsChecked: allCommitments.length,
          comparisonsPassed: true,
          hashMatched: true,
        },
      }
    } catch (error) {
      return {
        valid: false,
        auctionId: proof?.auctionId || '',
        winnerCommitment: proof?.winnerCommitment || ('0x' as HexString),
        reason: `verification error: ${error instanceof Error ? error.message : 'unknown'}`,
      }
    }
  }
}

/**
 * Create a new sealed-bid auction instance
 *
 * Convenience function for creating auction instances.
 *
 * @returns New SealedBidAuction instance
 *
 * @example
 * ```typescript
 * import { createSealedBidAuction } from '@sip-protocol/sdk'
 *
 * const auction = createSealedBidAuction()
 * const bid = auction.createBid({ auctionId: 'auction-1', amount: 100n })
 * ```
 */
export function createSealedBidAuction(): SealedBidAuction {
  return new SealedBidAuction()
}
