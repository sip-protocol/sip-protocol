/**
 * Tests for the sealed-bid auction example
 *
 * Ensures the auction example runs correctly and demonstrates all key features
 */

import { describe, it, expect } from 'vitest'
import { SealedBidAuction } from '../../src/auction/sealed-bid'
import type { BidReceipt, SealedBid, RevealedBid } from '../../src/auction/sealed-bid'
import { hexToBytes } from '@noble/hashes/utils'

describe('Sealed-Bid Auction Example', () => {
  it('should complete a full auction lifecycle', () => {
    const auction = new SealedBidAuction()

    // Phase 1: Auction Setup
    const auctionMetadata = {
      itemId: 'rare-nft-001',
      itemName: 'Genesis CryptoPunk #7804',
      seller: '0xSELLER...abc',
      startTime: Date.now(),
      endTime: Date.now() + 24 * 60 * 60 * 1000,
      minimumBid: 50n,
    }

    const auctionId = auction.hashAuctionMetadata(auctionMetadata)
    expect(auctionId).toBeDefined()
    expect(auctionId).toMatch(/^0x[0-9a-f]+$/)

    // Phase 2: Bid Submission
    const aliceReceipt: BidReceipt = auction.createBid({
      auctionId,
      amount: 100n,
    })
    expect(aliceReceipt.amount).toBe(100n)
    expect(aliceReceipt.commitment).toBeDefined()

    const bobReceipt: BidReceipt = auction.createBid({
      auctionId,
      amount: 150n,
    })
    expect(bobReceipt.amount).toBe(150n)

    const carolReceipt: BidReceipt = auction.createBid({
      auctionId,
      amount: 120n,
    })
    expect(carolReceipt.amount).toBe(120n)

    const daveReceipt: BidReceipt = auction.createBid({
      auctionId,
      amount: 80n,
    })
    expect(daveReceipt.amount).toBe(80n)

    const sealedBids: SealedBid[] = [
      { auctionId: aliceReceipt.auctionId, commitment: aliceReceipt.commitment, timestamp: aliceReceipt.timestamp },
      { auctionId: bobReceipt.auctionId, commitment: bobReceipt.commitment, timestamp: bobReceipt.timestamp },
      { auctionId: carolReceipt.auctionId, commitment: carolReceipt.commitment, timestamp: carolReceipt.timestamp },
      { auctionId: daveReceipt.auctionId, commitment: daveReceipt.commitment, timestamp: daveReceipt.timestamp },
    ]

    // Phase 3: Bid Reveal
    const aliceRevealed: RevealedBid = auction.revealBid(
      sealedBids[0],
      aliceReceipt.amount,
      hexToBytes(aliceReceipt.salt.slice(2))
    )
    expect(auction.verifyReveal(sealedBids[0], aliceRevealed)).toBe(true)

    const bobRevealed: RevealedBid = auction.revealBid(
      sealedBids[1],
      bobReceipt.amount,
      hexToBytes(bobReceipt.salt.slice(2))
    )
    expect(auction.verifyReveal(sealedBids[1], bobRevealed)).toBe(true)

    const carolRevealed: RevealedBid = auction.revealBid(
      sealedBids[2],
      carolReceipt.amount,
      hexToBytes(carolReceipt.salt.slice(2))
    )
    expect(auction.verifyReveal(sealedBids[2], carolRevealed)).toBe(true)

    const daveRevealed: RevealedBid = auction.revealBid(
      sealedBids[3],
      daveReceipt.amount,
      hexToBytes(daveReceipt.salt.slice(2))
    )
    expect(auction.verifyReveal(sealedBids[3], daveRevealed)).toBe(true)

    const revealedBids: RevealedBid[] = [aliceRevealed, bobRevealed, carolRevealed, daveRevealed]

    // Phase 4: Winner Determination
    const winner = auction.determineWinner(revealedBids)
    expect(winner.amount).toBe(150n) // Bob's bid
    expect(winner.commitment).toBe(bobReceipt.commitment)

    const winnerVerified = auction.verifyWinner(winner, revealedBids)
    expect(winnerVerified).toBe(true)

    // Check second-price calculation
    const sortedBids = [...revealedBids].sort((a, b) => Number(b.amount - a.amount))
    const secondPrice = sortedBids[1].amount
    expect(secondPrice).toBe(120n) // Carol's bid

    // Phase 5: Privacy-Preserving Winner Proof
    const winnerProof = auction.createWinnerProof(winner, revealedBids)
    expect(winnerProof.totalBids).toBe(4)
    expect(winnerProof.winnerAmount).toBe(150n)
    expect(winnerProof.differentialCommitments.length).toBe(3) // 4 bids - 1 winner

    const publicCommitments = sealedBids.map(bid => bid.commitment)
    const verification = auction.verifyWinnerProof(winnerProof, publicCommitments)
    expect(verification.valid).toBe(true)
    expect(verification.details?.bidsChecked).toBe(4)
    expect(verification.details?.hashMatched).toBe(true)
    expect(verification.details?.comparisonsPassed).toBe(true)
  })

  it('should demonstrate privacy guarantees', () => {
    const auction = new SealedBidAuction()

    const auctionId = 'test-auction'

    // Create bids
    const aliceBid = auction.createBid({ auctionId, amount: 100n })
    const bobBid = auction.createBid({ auctionId, amount: 200n })

    // Observers only see commitments, not amounts
    expect(aliceBid.commitment).toBeDefined()
    expect(bobBid.commitment).toBeDefined()
    expect(aliceBid.commitment).not.toBe(bobBid.commitment)

    // Even with same amount, commitments differ (due to random salt)
    const carol1 = auction.createBid({ auctionId, amount: 100n })
    const carol2 = auction.createBid({ auctionId, amount: 100n })
    expect(carol1.commitment).not.toBe(carol2.commitment)
  })

  it('should handle Vickrey auction pricing', () => {
    const auction = new SealedBidAuction()
    const auctionId = 'vickrey-auction'

    // Multiple bidders
    const bids = [
      auction.createBid({ auctionId, amount: 100n }),
      auction.createBid({ auctionId, amount: 200n }), // Winner
      auction.createBid({ auctionId, amount: 150n }), // Second price
      auction.createBid({ auctionId, amount: 50n }),
    ]

    // Reveal all bids
    const revealedBids = bids.map((bid, i) =>
      auction.revealBid(
        { auctionId: bid.auctionId, commitment: bid.commitment, timestamp: bid.timestamp },
        bid.amount,
        hexToBytes(bid.salt.slice(2))
      )
    )

    // Determine winner
    const winner = auction.determineWinner(revealedBids)
    expect(winner.amount).toBe(200n)

    // Calculate second price (Vickrey auction)
    const sortedBids = [...revealedBids].sort((a, b) => Number(b.amount - a.amount))
    const secondPrice = sortedBids[1].amount
    expect(secondPrice).toBe(150n)

    // In Vickrey auction, winner pays second-highest bid
    expect(secondPrice).toBeLessThan(winner.amount)
  })

  it('should demonstrate use case scenarios', () => {
    const auction = new SealedBidAuction()

    // NFT Auction scenario
    const nftAuction = auction.hashAuctionMetadata({
      type: 'nft',
      tokenId: 'cryptopunk-7804',
      minimumBid: 50n,
    })
    expect(nftAuction).toBeDefined()

    // Government Procurement scenario
    const procurementAuction = auction.hashAuctionMetadata({
      type: 'procurement',
      projectId: 'highway-construction-2024',
      budget: 1000000n,
    })
    expect(procurementAuction).toBeDefined()

    // Different metadata = different auction IDs
    expect(nftAuction).not.toBe(procurementAuction)
  })

  it('should verify security properties', () => {
    const auction = new SealedBidAuction()
    const auctionId = 'security-test'

    // Create a bid
    const bid = auction.createBid({ auctionId, amount: 100n })

    // Property 1: Binding - Cannot change amount after commitment
    const invalidReveal = {
      auctionId: bid.auctionId,
      commitment: bid.commitment,
      amount: 200n, // Different amount!
      salt: bid.salt,
      timestamp: bid.timestamp,
    }
    const isValid = auction.verifyBid({
      commitment: bid.commitment,
      amount: 200n,
      salt: bid.salt,
    })
    expect(isValid).toBe(false) // Commitment doesn't match different amount

    // Property 2: Hiding - Commitment is a curve point, not a plaintext amount
    // Note: hex encoding may randomly contain digits like '100', this tests structure not string absence
    expect(bid.commitment).toMatch(/^0x[0-9a-f]{64,66}$/i)

    // Property 3: Verifiable - Valid reveals can be verified
    const validReveal = auction.verifyBid({
      commitment: bid.commitment,
      amount: bid.amount,
      salt: bid.salt,
    })
    expect(validReveal).toBe(true)

    // Property 4: Non-malleable - Random salts prevent tampering
    const bid2 = auction.createBid({ auctionId, amount: 100n })
    expect(bid.salt).not.toBe(bid2.salt) // Different random salts
  })
})
