/**
 * Winner Verification Tests
 *
 * Tests for privacy-preserving winner determination and verification
 * in sealed-bid auctions.
 */

import { describe, it, expect } from 'vitest'
import { SealedBidAuction, type RevealedBid } from '../../src/auction/sealed-bid'
import type { WinnerResult, WinnerProof, HexString } from '@sip-protocol/types'

describe('Winner Verification', () => {
  const auction = new SealedBidAuction()
  const AUCTION_ID = 'test-auction-1'

  // Helper to create test bids
  function createTestBids(amounts: bigint[], timestamps?: number[]): RevealedBid[] {
    return amounts.map((amount, i) => {
      const receipt = auction.createBid({
        auctionId: AUCTION_ID,
        amount,
      })
      return {
        auctionId: receipt.auctionId,
        commitment: receipt.commitment,
        amount: receipt.amount,
        salt: receipt.salt,
        timestamp: timestamps?.[i] ?? receipt.timestamp,
      }
    })
  }

  describe('determineWinner()', () => {
    it('should determine winner from multiple bids', () => {
      const bids = createTestBids([100n, 200n, 150n])

      const winner = auction.determineWinner(bids)

      expect(winner.amount).toBe(200n)
      expect(winner.auctionId).toBe(AUCTION_ID)
      expect(winner.commitment).toBe(bids[1].commitment)
      expect(winner.bidIndex).toBe(1)
    })

    it('should handle single bidder', () => {
      const bids = createTestBids([100n])

      const winner = auction.determineWinner(bids)

      expect(winner.amount).toBe(100n)
      expect(winner.bidIndex).toBe(0)
    })

    it('should break ties by earliest timestamp', () => {
      // All same amount, different timestamps
      const timestamps = [2000, 1000, 1500]
      const bids = createTestBids([100n, 100n, 100n], timestamps)

      const winner = auction.determineWinner(bids)

      expect(winner.amount).toBe(100n)
      expect(winner.timestamp).toBe(1000) // Earliest
      expect(winner.bidIndex).toBe(1)
    })

    it('should handle mix of tied and non-tied bids', () => {
      const timestamps = [1000, 2000, 1500, 3000]
      const bids = createTestBids([150n, 200n, 200n, 100n], timestamps)

      const winner = auction.determineWinner(bids)

      expect(winner.amount).toBe(200n)
      expect(winner.timestamp).toBe(1500) // Earlier of the two 200n bids (index 2)
      expect(winner.bidIndex).toBe(2)
    })

    it('should work with very large amounts', () => {
      const bids = createTestBids([
        1000000000000000000n, // 1 ETH
        5000000000000000000n, // 5 ETH (winner)
        3000000000000000000n, // 3 ETH
      ])

      const winner = auction.determineWinner(bids)

      expect(winner.amount).toBe(5000000000000000000n)
    })

    it('should throw if no bids provided', () => {
      expect(() => auction.determineWinner([])).toThrow('revealedBids must be a non-empty array')
    })

    it('should throw if bids are from different auctions', () => {
      const bids = createTestBids([100n, 200n])
      bids[1].auctionId = 'different-auction'

      expect(() => auction.determineWinner(bids)).toThrow('all bids must be for the same auction')
    })

    it('should handle all bids with same timestamp (edge case)', () => {
      const timestamp = Date.now()
      const bids = createTestBids([100n, 200n, 150n], [timestamp, timestamp, timestamp])

      const winner = auction.determineWinner(bids)

      expect(winner.amount).toBe(200n) // Highest amount still wins
    })
  })

  describe('verifyWinner()', () => {
    it('should verify valid winner', () => {
      const bids = createTestBids([100n, 200n, 150n])
      const winner = auction.determineWinner(bids)

      const isValid = auction.verifyWinner(winner, bids)

      expect(isValid).toBe(true)
    })

    it('should verify single bidder as winner', () => {
      const bids = createTestBids([100n])
      const winner = auction.determineWinner(bids)

      const isValid = auction.verifyWinner(winner, bids)

      expect(isValid).toBe(true)
    })

    it('should reject winner with lower amount than highest bid', () => {
      const bids = createTestBids([100n, 200n, 150n])

      // Create fake winner with lower amount
      const fakeWinner: WinnerResult = {
        auctionId: AUCTION_ID,
        commitment: bids[0].commitment,
        amount: 100n, // Not the highest!
        salt: bids[0].salt,
        timestamp: bids[0].timestamp,
      }

      const isValid = auction.verifyWinner(fakeWinner, bids)

      expect(isValid).toBe(false)
    })

    it('should reject winner not in bid list', () => {
      const bids = createTestBids([100n, 200n])
      const otherBid = auction.createBid({ auctionId: AUCTION_ID, amount: 300n })

      const fakeWinner: WinnerResult = {
        auctionId: AUCTION_ID,
        commitment: otherBid.commitment,
        amount: otherBid.amount,
        salt: otherBid.salt,
        timestamp: otherBid.timestamp,
      }

      const isValid = auction.verifyWinner(fakeWinner, bids)

      expect(isValid).toBe(false)
    })

    it('should reject winner with mismatched data', () => {
      const bids = createTestBids([100n, 200n, 150n])
      const realWinner = auction.determineWinner(bids)

      // Tamper with winner data
      const tamperedWinner: WinnerResult = {
        ...realWinner,
        amount: 999n, // Wrong amount
      }

      const isValid = auction.verifyWinner(tamperedWinner, bids)

      expect(isValid).toBe(false)
    })

    it('should handle tied bids correctly', () => {
      const timestamps = [2000, 1000, 1500]
      const bids = createTestBids([100n, 100n, 100n], timestamps)
      const winner = auction.determineWinner(bids)

      const isValid = auction.verifyWinner(winner, bids)

      expect(isValid).toBe(true)
      expect(winner.timestamp).toBe(1000) // Earliest wins
    })

    it('should reject tied bid with later timestamp claiming to be winner', () => {
      const timestamps = [2000, 1000, 1500]
      const bids = createTestBids([100n, 100n, 100n], timestamps)

      // Try to claim later bid is winner
      const fakeWinner: WinnerResult = {
        auctionId: AUCTION_ID,
        commitment: bids[0].commitment, // timestamp 2000 (later)
        amount: 100n,
        salt: bids[0].salt,
        timestamp: bids[0].timestamp,
      }

      const isValid = auction.verifyWinner(fakeWinner, bids)

      expect(isValid).toBe(false)
    })

    it('should return false for null/undefined inputs', () => {
      const bids = createTestBids([100n])

      expect(auction.verifyWinner(null as unknown as any, bids)).toBe(false)
      expect(auction.verifyWinner(bids[0] as any, null as unknown as any)).toBe(false)
      expect(auction.verifyWinner(bids[0] as any, [])).toBe(false)
    })

    it('should verify winner with different auction IDs returns false', () => {
      const bids = createTestBids([100n, 200n])
      const winner = auction.determineWinner(bids)

      // Change auction ID
      bids[0].auctionId = 'different-auction'

      const isValid = auction.verifyWinner(winner, bids)

      expect(isValid).toBe(false)
    })
  })

  describe('createWinnerProof()', () => {
    it('should create valid winner proof', () => {
      const bids = createTestBids([100n, 200n, 150n])
      const winner = auction.determineWinner(bids)

      const proof = auction.createWinnerProof(winner, bids)

      expect(proof.auctionId).toBe(AUCTION_ID)
      expect(proof.winnerCommitment).toBe(winner.commitment)
      expect(proof.winnerAmount).toBe(200n)
      expect(proof.totalBids).toBe(3)
      expect(proof.differentialCommitments).toHaveLength(2) // 3 bids - 1 winner = 2 diffs
      expect(proof.timestamp).toBe(winner.timestamp)
      expect(proof.commitmentsHash).toBeDefined()
    })

    it('should create proof for single bidder', () => {
      const bids = createTestBids([100n])
      const winner = auction.determineWinner(bids)

      const proof = auction.createWinnerProof(winner, bids)

      expect(proof.totalBids).toBe(1)
      expect(proof.differentialCommitments).toHaveLength(0) // No other bids
    })

    it('should include all differential commitments', () => {
      const bids = createTestBids([100n, 200n, 150n, 120n, 180n])
      const winner = auction.determineWinner(bids)

      const proof = auction.createWinnerProof(winner, bids)

      expect(proof.totalBids).toBe(5)
      expect(proof.differentialCommitments).toHaveLength(4) // All bids except winner
    })

    it('should generate deterministic commitments hash', () => {
      const bids = createTestBids([100n, 200n, 150n])
      const winner = auction.determineWinner(bids)

      const proof1 = auction.createWinnerProof(winner, bids)
      const proof2 = auction.createWinnerProof(winner, bids)

      expect(proof1.commitmentsHash).toBe(proof2.commitmentsHash)
    })

    it('should throw if winner is invalid', () => {
      const bids = createTestBids([100n, 200n, 150n])

      const fakeWinner: WinnerResult = {
        auctionId: AUCTION_ID,
        commitment: bids[0].commitment,
        amount: 50n, // Lower than all bids!
        salt: bids[0].salt,
        timestamp: bids[0].timestamp,
      }

      expect(() => auction.createWinnerProof(fakeWinner, bids)).toThrow(
        'winner is not valid'
      )
    })

    it('should throw if no bids provided', () => {
      const bids = createTestBids([100n])
      const winner = auction.determineWinner(bids)

      expect(() => auction.createWinnerProof(winner, [])).toThrow(
        'winner and revealedBids are required'
      )
    })

    it('should create valid differential commitments', () => {
      const bids = createTestBids([100n, 200n, 150n])
      const winner = auction.determineWinner(bids)

      const proof = auction.createWinnerProof(winner, bids)

      // Each differential commitment should be a valid hex string
      for (const diff of proof.differentialCommitments) {
        expect(diff).toMatch(/^0x[0-9a-f]+$/i)
        expect(diff.length).toBeGreaterThan(2)
      }
    })
  })

  describe('verifyWinnerProof()', () => {
    it('should verify valid winner proof', () => {
      const bids = createTestBids([100n, 200n, 150n])
      const winner = auction.determineWinner(bids)
      const proof = auction.createWinnerProof(winner, bids)

      // Extract just the commitments (as observers would have)
      const commitments = bids.map(bid => bid.commitment)

      const verification = auction.verifyWinnerProof(proof, commitments)

      expect(verification.valid).toBe(true)
      expect(verification.auctionId).toBe(AUCTION_ID)
      expect(verification.details?.bidsChecked).toBe(3)
      expect(verification.details?.comparisonsPassed).toBe(true)
      expect(verification.details?.hashMatched).toBe(true)
    })

    it('should verify proof for single bidder', () => {
      const bids = createTestBids([100n])
      const winner = auction.determineWinner(bids)
      const proof = auction.createWinnerProof(winner, bids)

      const commitments = bids.map(bid => bid.commitment)
      const verification = auction.verifyWinnerProof(proof, commitments)

      expect(verification.valid).toBe(true)
    })

    it('should detect tampered commitments hash', () => {
      const bids = createTestBids([100n, 200n, 150n])
      const winner = auction.determineWinner(bids)
      const proof = auction.createWinnerProof(winner, bids)

      // Tamper with commitments
      const tamperedCommitments = [...bids.map(bid => bid.commitment)]
      tamperedCommitments[0] = '0x0123456789abcdef' as HexString

      const verification = auction.verifyWinnerProof(proof, tamperedCommitments)

      expect(verification.valid).toBe(false)
      expect(verification.reason).toContain('hash mismatch')
      expect(verification.details?.hashMatched).toBe(false)
    })

    it('should detect winner not in commitment list', () => {
      const bids = createTestBids([100n, 200n, 150n])
      const winner = auction.determineWinner(bids)
      const proof = auction.createWinnerProof(winner, bids)

      // Remove winner commitment
      const commitments = bids
        .filter(bid => bid.commitment !== winner.commitment)
        .map(bid => bid.commitment)

      const verification = auction.verifyWinnerProof(proof, commitments)

      expect(verification.valid).toBe(false)
      expect(verification.reason).toContain('total bids mismatch')
    })

    it('should detect incorrect total bids', () => {
      const bids = createTestBids([100n, 200n, 150n])
      const winner = auction.determineWinner(bids)
      const proof = auction.createWinnerProof(winner, bids)

      // Add extra commitment
      const extraCommitments = [
        ...bids.map(bid => bid.commitment),
        '0xdeadbeef' as HexString,
      ]

      const verification = auction.verifyWinnerProof(proof, extraCommitments)

      expect(verification.valid).toBe(false)
      expect(verification.reason).toContain('total bids mismatch')
    })

    it('should detect incorrect differential commitments count', () => {
      const bids = createTestBids([100n, 200n, 150n])
      const winner = auction.determineWinner(bids)
      const proof = auction.createWinnerProof(winner, bids)

      // Tamper with proof by removing a differential commitment
      const tamperedProof: WinnerProof = {
        ...proof,
        differentialCommitments: proof.differentialCommitments.slice(0, 1),
      }

      const commitments = bids.map(bid => bid.commitment)
      const verification = auction.verifyWinnerProof(tamperedProof, commitments)

      expect(verification.valid).toBe(false)
      expect(verification.reason).toContain('incorrect number of differential commitments')
    })

    it('should handle null/undefined inputs gracefully', () => {
      const verification1 = auction.verifyWinnerProof(null as unknown as any, [])
      expect(verification1.valid).toBe(false)
      expect(verification1.reason).toContain('missing required inputs')

      const bids = createTestBids([100n])
      const winner = auction.determineWinner(bids)
      const proof = auction.createWinnerProof(winner, bids)

      const verification2 = auction.verifyWinnerProof(proof, null as unknown as any)
      expect(verification2.valid).toBe(false)
      expect(verification2.reason).toContain('missing required inputs')
    })

    it('should verify proof with many bids', () => {
      const amounts = Array.from({ length: 10 }, (_, i) => BigInt((i + 1) * 100))
      const bids = createTestBids(amounts)
      const winner = auction.determineWinner(bids)
      const proof = auction.createWinnerProof(winner, bids)

      const commitments = bids.map(bid => bid.commitment)
      const verification = auction.verifyWinnerProof(proof, commitments)

      expect(verification.valid).toBe(true)
      expect(verification.details?.bidsChecked).toBe(10)
      expect(proof.differentialCommitments).toHaveLength(9)
    })

    it('should maintain privacy - verification without bid amounts', () => {
      // This test demonstrates the privacy property
      const bids = createTestBids([100n, 200n, 150n])
      const winner = auction.determineWinner(bids)
      const proof = auction.createWinnerProof(winner, bids)

      // Observer only has commitments, NOT amounts
      const commitments = bids.map(bid => bid.commitment)

      // Observer can still verify the winner is valid!
      const verification = auction.verifyWinnerProof(proof, commitments)

      expect(verification.valid).toBe(true)

      // Proof reveals winner amount but NOT losing amounts
      expect(proof.winnerAmount).toBe(200n)
      // Losing amounts remain hidden in their commitments
    })
  })

  describe('Integration: Full Auction Flow', () => {
    it('should complete full auction with winner verification', () => {
      // PHASE 1: Bidding (sealed bids)
      const alice = auction.createBid({ auctionId: AUCTION_ID, amount: 100n })
      const bob = auction.createBid({ auctionId: AUCTION_ID, amount: 200n })
      const carol = auction.createBid({ auctionId: AUCTION_ID, amount: 150n })

      // Commitments are public, amounts are secret
      const publicCommitments = [alice.commitment, bob.commitment, carol.commitment]

      // PHASE 2: Reveal
      const revealedBids: RevealedBid[] = [
        {
          auctionId: alice.auctionId,
          commitment: alice.commitment,
          amount: alice.amount,
          salt: alice.salt,
          timestamp: alice.timestamp,
        },
        {
          auctionId: bob.auctionId,
          commitment: bob.commitment,
          amount: bob.amount,
          salt: bob.salt,
          timestamp: bob.timestamp,
        },
        {
          auctionId: carol.auctionId,
          commitment: carol.commitment,
          amount: carol.amount,
          salt: carol.salt,
          timestamp: carol.timestamp,
        },
      ]

      // Verify all reveals are valid
      for (const bid of revealedBids) {
        expect(auction.verifyBid({
          commitment: bid.commitment,
          amount: bid.amount,
          salt: bid.salt,
        })).toBe(true)
      }

      // PHASE 3: Winner determination
      const winner = auction.determineWinner(revealedBids)
      expect(winner.amount).toBe(200n) // Bob wins
      expect(auction.verifyWinner(winner, revealedBids)).toBe(true)

      // PHASE 4: Create privacy-preserving proof
      const proof = auction.createWinnerProof(winner, revealedBids)

      // PHASE 5: External observer verification (without knowing losing amounts)
      const verification = auction.verifyWinnerProof(proof, publicCommitments)
      expect(verification.valid).toBe(true)
    })

    it('should handle tie-breaking in full flow', () => {
      const timestamp1 = 1000
      const timestamp2 = 2000

      // Alice bids first
      const alice = auction.createBid({ auctionId: AUCTION_ID, amount: 100n })
      const aliceBid: RevealedBid = {
        ...alice,
        timestamp: timestamp1,
      }

      // Bob bids same amount later
      const bob = auction.createBid({ auctionId: AUCTION_ID, amount: 100n })
      const bobBid: RevealedBid = {
        ...bob,
        timestamp: timestamp2,
      }

      const revealedBids = [aliceBid, bobBid]

      // Alice should win (earlier timestamp)
      const winner = auction.determineWinner(revealedBids)
      expect(winner.timestamp).toBe(timestamp1)
      expect(winner.commitment).toBe(alice.commitment)

      // Verification should pass
      expect(auction.verifyWinner(winner, revealedBids)).toBe(true)

      const proof = auction.createWinnerProof(winner, revealedBids)
      const commitments = [alice.commitment, bob.commitment]
      const verification = auction.verifyWinnerProof(proof, commitments)
      expect(verification.valid).toBe(true)
    })

    it('should detect cheating attempt', () => {
      const bids = createTestBids([100n, 200n, 150n])

      // Auctioneer tries to claim wrong winner
      const cheatingWinner: WinnerResult = {
        auctionId: AUCTION_ID,
        commitment: bids[0].commitment,
        amount: 100n, // Not the highest!
        salt: bids[0].salt,
        timestamp: bids[0].timestamp,
      }

      // Verification catches the cheating
      expect(auction.verifyWinner(cheatingWinner, bids)).toBe(false)

      // Cannot create proof for invalid winner
      expect(() => auction.createWinnerProof(cheatingWinner, bids)).toThrow()
    })
  })

  describe('Edge Cases', () => {
    it('should handle maximum safe integer amounts', () => {
      const maxSafe = BigInt(Number.MAX_SAFE_INTEGER)
      const bids = createTestBids([maxSafe - 2n, maxSafe, maxSafe - 1n])

      const winner = auction.determineWinner(bids)
      expect(winner.amount).toBe(maxSafe)

      const proof = auction.createWinnerProof(winner, bids)
      const commitments = bids.map(b => b.commitment)
      const verification = auction.verifyWinnerProof(proof, commitments)
      expect(verification.valid).toBe(true)
    })

    it('should handle all equal minimum bids', () => {
      // Use minimum valid bid amount (1)
      const bids = createTestBids([1n, 1n, 1n], [1000, 500, 2000])

      const winner = auction.determineWinner(bids)
      expect(winner.amount).toBe(1n)
      expect(winner.timestamp).toBe(500) // Earliest
    })

    it('should handle single very large bid', () => {
      const largeAmount = 10n ** 18n // 1 ETH in wei
      const bids = createTestBids([largeAmount])

      const winner = auction.determineWinner(bids)
      const proof = auction.createWinnerProof(winner, bids)

      expect(proof.winnerAmount).toBe(largeAmount)
      expect(proof.differentialCommitments).toHaveLength(0)
    })

    it('should maintain commitment order independence', () => {
      const bids = createTestBids([100n, 200n, 150n])
      const winner = auction.determineWinner(bids)

      // Create proof with original order
      const proof1 = auction.createWinnerProof(winner, bids)

      // Shuffle bids
      const shuffledBids = [bids[2], bids[0], bids[1]]
      const proof2 = auction.createWinnerProof(winner, shuffledBids)

      // Commitments hash should be the same (it's sorted)
      expect(proof1.commitmentsHash).toBe(proof2.commitmentsHash)
    })
  })
})
