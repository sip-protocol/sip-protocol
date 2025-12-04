/**
 * Tests for Sealed-Bid Auction
 */

import { describe, it, expect } from 'vitest'
import {
  SealedBidAuction,
  createSealedBidAuction,
  type SealedBid,
  type BidReceipt,
  type RevealedBid,
  type CreateBidParams,
  type VerifyBidParams,
} from '../../src/auction'
import { ValidationError } from '../../src/errors'
import { randomBytes, hexToBytes } from '@noble/hashes/utils'

describe('SealedBidAuction', () => {
  describe('createBid', () => {
    it('should create a valid sealed bid', () => {
      const auction = new SealedBidAuction()

      const receipt = auction.createBid({
        auctionId: 'auction-1',
        amount: 100n,
      })

      // Check structure
      expect(receipt).toHaveProperty('auctionId', 'auction-1')
      expect(receipt).toHaveProperty('commitment')
      expect(receipt).toHaveProperty('timestamp')
      expect(receipt).toHaveProperty('amount', 100n)
      expect(receipt).toHaveProperty('salt')

      // Check types
      expect(typeof receipt.commitment).toBe('string')
      expect(receipt.commitment.startsWith('0x')).toBe(true)
      expect(typeof receipt.timestamp).toBe('number')
      expect(typeof receipt.amount).toBe('bigint')
      expect(typeof receipt.salt).toBe('string')
      expect(receipt.salt.startsWith('0x')).toBe(true)
    })

    it('should create different commitments for same amount (randomized salt)', () => {
      const auction = new SealedBidAuction()

      const bid1 = auction.createBid({
        auctionId: 'auction-1',
        amount: 100n,
      })

      const bid2 = auction.createBid({
        auctionId: 'auction-1',
        amount: 100n,
      })

      // Same amount but different commitments (different salts)
      expect(bid1.commitment).not.toBe(bid2.commitment)
      expect(bid1.salt).not.toBe(bid2.salt)
    })

    it('should create same commitment with same amount and salt', () => {
      const auction = new SealedBidAuction()
      const salt = randomBytes(32)

      const bid1 = auction.createBid({
        auctionId: 'auction-1',
        amount: 100n,
        salt,
      })

      const bid2 = auction.createBid({
        auctionId: 'auction-1',
        amount: 100n,
        salt,
      })

      // Same amount and salt -> same commitment
      expect(bid1.commitment).toBe(bid2.commitment)
      expect(bid1.salt).toBe(bid2.salt)
    })

    it('should handle large bid amounts', () => {
      const auction = new SealedBidAuction()

      const largeAmount = 1000000000000000000000n // 1000 ETH in wei

      const receipt = auction.createBid({
        auctionId: 'auction-1',
        amount: largeAmount,
      })

      expect(receipt.amount).toBe(largeAmount)
      expect(receipt.commitment).toBeTruthy()
    })

    it('should handle very small bid amounts', () => {
      const auction = new SealedBidAuction()

      const receipt = auction.createBid({
        auctionId: 'auction-1',
        amount: 1n,
      })

      expect(receipt.amount).toBe(1n)
      expect(receipt.commitment).toBeTruthy()
    })

    it('should include timestamp', () => {
      const auction = new SealedBidAuction()
      const before = Date.now()

      const receipt = auction.createBid({
        auctionId: 'auction-1',
        amount: 100n,
      })

      const after = Date.now()

      expect(receipt.timestamp).toBeGreaterThanOrEqual(before)
      expect(receipt.timestamp).toBeLessThanOrEqual(after)
    })

    it('should accept custom salt', () => {
      const auction = new SealedBidAuction()
      const customSalt = randomBytes(32)

      const receipt = auction.createBid({
        auctionId: 'auction-1',
        amount: 100n,
        salt: customSalt,
      })

      expect(receipt.salt.startsWith('0x')).toBe(true)
      expect(receipt.salt.length).toBe(66) // 0x + 64 hex chars
    })

    // Validation tests
    it('should throw on empty auction ID', () => {
      const auction = new SealedBidAuction()

      expect(() => {
        auction.createBid({
          auctionId: '',
          amount: 100n,
        })
      }).toThrow(ValidationError)
    })

    it('should throw on non-string auction ID', () => {
      const auction = new SealedBidAuction()

      expect(() => {
        auction.createBid({
          auctionId: 123 as unknown as number,
          amount: 100n,
        })
      }).toThrow(ValidationError)
    })

    it('should throw on non-bigint amount', () => {
      const auction = new SealedBidAuction()

      expect(() => {
        auction.createBid({
          auctionId: 'auction-1',
          amount: 100 as unknown as bigint,
        })
      }).toThrow(ValidationError)
    })

    it('should throw on zero amount', () => {
      const auction = new SealedBidAuction()

      expect(() => {
        auction.createBid({
          auctionId: 'auction-1',
          amount: 0n,
        })
      }).toThrow(ValidationError)
    })

    it('should throw on negative amount', () => {
      const auction = new SealedBidAuction()

      expect(() => {
        auction.createBid({
          auctionId: 'auction-1',
          amount: -100n,
        })
      }).toThrow(ValidationError)
    })

    it('should throw on invalid salt type', () => {
      const auction = new SealedBidAuction()

      expect(() => {
        auction.createBid({
          auctionId: 'auction-1',
          amount: 100n,
          salt: 'not-a-uint8array' as unknown as string,
        })
      }).toThrow(ValidationError)
    })

    it('should throw on wrong salt length', () => {
      const auction = new SealedBidAuction()

      expect(() => {
        auction.createBid({
          auctionId: 'auction-1',
          amount: 100n,
          salt: randomBytes(16), // Wrong size
        })
      }).toThrow(ValidationError)
    })
  })

  describe('verifyBid', () => {
    it('should verify a valid bid', () => {
      const auction = new SealedBidAuction()

      const receipt = auction.createBid({
        auctionId: 'auction-1',
        amount: 100n,
      })

      const isValid = auction.verifyBid({
        commitment: receipt.commitment,
        amount: receipt.amount,
        salt: receipt.salt,
      })

      expect(isValid).toBe(true)
    })

    it('should reject bid with wrong amount', () => {
      const auction = new SealedBidAuction()

      const receipt = auction.createBid({
        auctionId: 'auction-1',
        amount: 100n,
      })

      // Try to verify with different amount
      const isValid = auction.verifyBid({
        commitment: receipt.commitment,
        amount: 200n, // Wrong amount!
        salt: receipt.salt,
      })

      expect(isValid).toBe(false)
    })

    it('should reject bid with wrong salt', () => {
      const auction = new SealedBidAuction()

      const receipt = auction.createBid({
        auctionId: 'auction-1',
        amount: 100n,
      })

      // Try to verify with different salt
      const wrongSalt = '0x' + '00'.repeat(32)
      const isValid = auction.verifyBid({
        commitment: receipt.commitment,
        amount: receipt.amount,
        salt: wrongSalt,
      })

      expect(isValid).toBe(false)
    })

    it('should reject completely invalid commitment', () => {
      const auction = new SealedBidAuction()

      const isValid = auction.verifyBid({
        commitment: '0x1234567890abcdef',
        amount: 100n,
        salt: '0x' + '00'.repeat(32),
      })

      expect(isValid).toBe(false)
    })

    // Validation tests
    it('should throw on invalid commitment format', () => {
      const auction = new SealedBidAuction()

      expect(() => {
        auction.verifyBid({
          commitment: 'not-hex',
          amount: 100n,
          salt: '0x' + '00'.repeat(32),
        })
      }).toThrow(ValidationError)
    })

    it('should throw on non-bigint amount', () => {
      const auction = new SealedBidAuction()

      expect(() => {
        auction.verifyBid({
          commitment: '0x02' + '00'.repeat(32),
          amount: 100 as unknown as bigint,
          salt: '0x' + '00'.repeat(32),
        })
      }).toThrow(ValidationError)
    })

    it('should throw on invalid salt format', () => {
      const auction = new SealedBidAuction()

      expect(() => {
        auction.verifyBid({
          commitment: '0x02' + '00'.repeat(32),
          amount: 100n,
          salt: 'not-hex',
        })
      }).toThrow(ValidationError)
    })
  })

  describe('hashAuctionMetadata', () => {
    it('should hash auction metadata', () => {
      const auction = new SealedBidAuction()

      const hash1 = auction.hashAuctionMetadata({
        itemId: 'nft-1',
        seller: '0xABCD',
        startTime: 1000,
      })

      expect(typeof hash1).toBe('string')
      expect(hash1.startsWith('0x')).toBe(true)
      expect(hash1.length).toBe(66) // 0x + 64 hex chars
    })

    it('should produce same hash for same metadata', () => {
      const auction = new SealedBidAuction()

      const metadata = {
        itemId: 'nft-1',
        seller: '0xABCD',
        startTime: 1000,
      }

      const hash1 = auction.hashAuctionMetadata(metadata)
      const hash2 = auction.hashAuctionMetadata(metadata)

      expect(hash1).toBe(hash2)
    })

    it('should produce different hash for different metadata', () => {
      const auction = new SealedBidAuction()

      const hash1 = auction.hashAuctionMetadata({
        itemId: 'nft-1',
      })

      const hash2 = auction.hashAuctionMetadata({
        itemId: 'nft-2',
      })

      expect(hash1).not.toBe(hash2)
    })

    it('should handle bigint values', () => {
      const auction = new SealedBidAuction()

      const hash = auction.hashAuctionMetadata({
        itemId: 'nft-1',
        minBid: 1000000000000000000n,
      })

      expect(typeof hash).toBe('string')
      expect(hash.startsWith('0x')).toBe(true)
    })
  })

  describe('createSealedBidAuction', () => {
    it('should create auction instance', () => {
      const auction = createSealedBidAuction()

      expect(auction).toBeInstanceOf(SealedBidAuction)
    })

    it('should work like constructor', () => {
      const auction = createSealedBidAuction()

      const receipt = auction.createBid({
        auctionId: 'auction-1',
        amount: 100n,
      })

      expect(receipt.amount).toBe(100n)
    })
  })

  describe('Integration: Full auction workflow', () => {
    it('should support complete auction lifecycle', () => {
      const auction = new SealedBidAuction()

      // Phase 1: Create auction ID
      const auctionId = auction.hashAuctionMetadata({
        itemId: 'rare-nft-123',
        seller: '0xSeller',
        startTime: Date.now(),
        endTime: Date.now() + 86400000, // 24 hours
      })

      // Phase 2: Bidders create sealed bids
      const aliceBid = auction.createBid({
        auctionId,
        amount: 100n * 10n ** 18n, // 100 ETH
      })

      const bobBid = auction.createBid({
        auctionId,
        amount: 150n * 10n ** 18n, // 150 ETH
      })

      const carolBid = auction.createBid({
        auctionId,
        amount: 120n * 10n ** 18n, // 120 ETH
      })

      // Phase 3: Commitments are public, amounts are hidden
      expect(aliceBid.commitment).not.toBe(bobBid.commitment)
      expect(bobBid.commitment).not.toBe(carolBid.commitment)

      // Phase 4: Reveal phase - verify all bids
      expect(
        auction.verifyBid({
          commitment: aliceBid.commitment,
          amount: aliceBid.amount,
          salt: aliceBid.salt,
        })
      ).toBe(true)

      expect(
        auction.verifyBid({
          commitment: bobBid.commitment,
          amount: bobBid.amount,
          salt: bobBid.salt,
        })
      ).toBe(true)

      expect(
        auction.verifyBid({
          commitment: carolBid.commitment,
          amount: carolBid.amount,
          salt: carolBid.salt,
        })
      ).toBe(true)

      // Phase 5: Determine winner (Bob has highest bid)
      const bids = [aliceBid, bobBid, carolBid]
      const winner = bids.reduce((max, bid) =>
        bid.amount > max.amount ? bid : max
      )

      expect(winner).toBe(bobBid)
    })

    it('should detect cheating attempts', () => {
      const auction = new SealedBidAuction()

      // Alice creates a bid
      const aliceBid = auction.createBid({
        auctionId: 'auction-1',
        amount: 100n,
      })

      // Later, Alice tries to claim she bid 200 (cheating!)
      const cheated = auction.verifyBid({
        commitment: aliceBid.commitment,
        amount: 200n, // Different amount!
        salt: aliceBid.salt,
      })

      expect(cheated).toBe(false)
    })

    it('should support Vickrey (second-price) auction', () => {
      const auction = new SealedBidAuction()
      const auctionId = 'vickrey-1'

      // Create bids
      const bids = [
        auction.createBid({ auctionId, amount: 100n }),
        auction.createBid({ auctionId, amount: 150n }), // Highest
        auction.createBid({ auctionId, amount: 120n }), // Second highest
      ]

      // Sort by amount descending
      const sorted = bids.sort((a, b) =>
        a.amount > b.amount ? -1 : 1
      )

      const winner = sorted[0]
      const price = sorted[1].amount // Winner pays second-highest bid

      expect(winner.amount).toBe(150n)
      expect(price).toBe(120n)
    })
  })

  describe('Edge cases', () => {
    it('should handle auction with single bidder', () => {
      const auction = new SealedBidAuction()

      const bid = auction.createBid({
        auctionId: 'auction-1',
        amount: 100n,
      })

      expect(
        auction.verifyBid({
          commitment: bid.commitment,
          amount: bid.amount,
          salt: bid.salt,
        })
      ).toBe(true)
    })

    it('should handle identical bids from different bidders', () => {
      const auction = new SealedBidAuction()

      const bid1 = auction.createBid({
        auctionId: 'auction-1',
        amount: 100n,
      })

      const bid2 = auction.createBid({
        auctionId: 'auction-1',
        amount: 100n,
      })

      // Same amount but different commitments (different salts)
      expect(bid1.commitment).not.toBe(bid2.commitment)

      // Both verify correctly
      expect(
        auction.verifyBid({
          commitment: bid1.commitment,
          amount: bid1.amount,
          salt: bid1.salt,
        })
      ).toBe(true)

      expect(
        auction.verifyBid({
          commitment: bid2.commitment,
          amount: bid2.amount,
          salt: bid2.salt,
        })
      ).toBe(true)
    })

    it('should handle very large number of bids', () => {
      const auction = new SealedBidAuction()
      const auctionId = 'large-auction'

      // Create 1000 bids
      const bids = Array.from({ length: 1000 }, (_, i) =>
        auction.createBid({
          auctionId,
          amount: BigInt(i + 1),
        })
      )

      expect(bids.length).toBe(1000)

      // All should have unique commitments
      const commitments = new Set(bids.map(b => b.commitment))
      expect(commitments.size).toBe(1000)

      // Verify a few random bids
      const randomBids = [bids[0], bids[500], bids[999]]
      for (const bid of randomBids) {
        expect(
          auction.verifyBid({
            commitment: bid.commitment,
            amount: bid.amount,
            salt: bid.salt,
          })
        ).toBe(true)
      }
    })
  })

  describe('Type safety', () => {
    it('should export correct types', () => {
      // Type-only test - will fail at compile time if types are wrong
      const auction = new SealedBidAuction()

      const params: CreateBidParams = {
        auctionId: 'auction-1',
        amount: 100n,
      }

      const receipt: BidReceipt = auction.createBid(params)

      const sealedBid: SealedBid = {
        auctionId: receipt.auctionId,
        commitment: receipt.commitment,
        timestamp: receipt.timestamp,
      }

      const verifyParams: VerifyBidParams = {
        commitment: receipt.commitment,
        amount: receipt.amount,
        salt: receipt.salt,
      }

      expect(sealedBid).toBeDefined()
      expect(verifyParams).toBeDefined()
    })
  })

  describe('revealBid', () => {
    it('should reveal a valid bid', () => {
      const auction = new SealedBidAuction()

      // Create a bid
      const receipt = auction.createBid({
        auctionId: 'auction-1',
        amount: 100n,
      })

      const sealedBid: SealedBid = {
        auctionId: receipt.auctionId,
        commitment: receipt.commitment,
        timestamp: receipt.timestamp,
      }

      // Reveal the bid
      const revealed = auction.revealBid(
        sealedBid,
        receipt.amount,
        hexToBytes(receipt.salt.slice(2))
      )

      // Check structure
      expect(revealed).toHaveProperty('auctionId', 'auction-1')
      expect(revealed).toHaveProperty('commitment', receipt.commitment)
      expect(revealed).toHaveProperty('amount', 100n)
      expect(revealed).toHaveProperty('salt', receipt.salt)
      expect(revealed).toHaveProperty('timestamp', receipt.timestamp)

      // Check types
      expect(typeof revealed.auctionId).toBe('string')
      expect(typeof revealed.commitment).toBe('string')
      expect(typeof revealed.amount).toBe('bigint')
      expect(typeof revealed.salt).toBe('string')
      expect(typeof revealed.timestamp).toBe('number')
    })

    it('should throw when revealing with wrong amount', () => {
      const auction = new SealedBidAuction()

      const receipt = auction.createBid({
        auctionId: 'auction-1',
        amount: 100n,
      })

      const sealedBid: SealedBid = {
        auctionId: receipt.auctionId,
        commitment: receipt.commitment,
        timestamp: receipt.timestamp,
      }

      // Try to reveal with different amount (cheating!)
      expect(() => {
        auction.revealBid(
          sealedBid,
          200n, // Wrong amount
          hexToBytes(receipt.salt.slice(2))
        )
      }).toThrow(ValidationError)
    })

    it('should throw when revealing with wrong salt', () => {
      const auction = new SealedBidAuction()

      const receipt = auction.createBid({
        auctionId: 'auction-1',
        amount: 100n,
      })

      const sealedBid: SealedBid = {
        auctionId: receipt.auctionId,
        commitment: receipt.commitment,
        timestamp: receipt.timestamp,
      }

      // Try to reveal with different salt (cheating!)
      const wrongSalt = randomBytes(32)
      expect(() => {
        auction.revealBid(sealedBid, receipt.amount, wrongSalt)
      }).toThrow(ValidationError)
    })

    it('should handle large bid amounts in reveal', () => {
      const auction = new SealedBidAuction()

      const largeAmount = 1000n * 10n ** 18n // 1000 ETH

      const receipt = auction.createBid({
        auctionId: 'auction-1',
        amount: largeAmount,
      })

      const sealedBid: SealedBid = {
        auctionId: receipt.auctionId,
        commitment: receipt.commitment,
        timestamp: receipt.timestamp,
      }

      const revealed = auction.revealBid(
        sealedBid,
        receipt.amount,
        hexToBytes(receipt.salt.slice(2))
      )

      expect(revealed.amount).toBe(largeAmount)
    })
  })

  describe('verifyReveal', () => {
    it('should verify a valid revealed bid', () => {
      const auction = new SealedBidAuction()

      // Create and reveal a bid
      const receipt = auction.createBid({
        auctionId: 'auction-1',
        amount: 100n,
      })

      const sealedBid: SealedBid = {
        auctionId: receipt.auctionId,
        commitment: receipt.commitment,
        timestamp: receipt.timestamp,
      }

      const revealed = auction.revealBid(
        sealedBid,
        receipt.amount,
        hexToBytes(receipt.salt.slice(2))
      )

      // Verify the reveal
      const isValid = auction.verifyReveal(sealedBid, revealed)
      expect(isValid).toBe(true)
    })

    it('should reject reveal with wrong amount', () => {
      const auction = new SealedBidAuction()

      const receipt = auction.createBid({
        auctionId: 'auction-1',
        amount: 100n,
      })

      const sealedBid: SealedBid = {
        auctionId: receipt.auctionId,
        commitment: receipt.commitment,
        timestamp: receipt.timestamp,
      }

      const revealed = auction.revealBid(
        sealedBid,
        receipt.amount,
        hexToBytes(receipt.salt.slice(2))
      )

      // Create fake reveal with different amount
      const fakeReveal: RevealedBid = {
        ...revealed,
        amount: 200n, // Different amount!
      }

      const isValid = auction.verifyReveal(sealedBid, fakeReveal)
      expect(isValid).toBe(false)
    })

    it('should reject reveal with wrong salt', () => {
      const auction = new SealedBidAuction()

      const receipt = auction.createBid({
        auctionId: 'auction-1',
        amount: 100n,
      })

      const sealedBid: SealedBid = {
        auctionId: receipt.auctionId,
        commitment: receipt.commitment,
        timestamp: receipt.timestamp,
      }

      const revealed = auction.revealBid(
        sealedBid,
        receipt.amount,
        hexToBytes(receipt.salt.slice(2))
      )

      // Create fake reveal with different salt
      const wrongSalt = '0x' + '00'.repeat(32)
      const fakeReveal: RevealedBid = {
        ...revealed,
        salt: wrongSalt,
      }

      const isValid = auction.verifyReveal(sealedBid, fakeReveal)
      expect(isValid).toBe(false)
    })

    it('should reject reveal with wrong auction ID', () => {
      const auction = new SealedBidAuction()

      const receipt = auction.createBid({
        auctionId: 'auction-1',
        amount: 100n,
      })

      const sealedBid: SealedBid = {
        auctionId: receipt.auctionId,
        commitment: receipt.commitment,
        timestamp: receipt.timestamp,
      }

      const revealed = auction.revealBid(
        sealedBid,
        receipt.amount,
        hexToBytes(receipt.salt.slice(2))
      )

      // Create fake reveal with different auction ID
      const fakeReveal: RevealedBid = {
        ...revealed,
        auctionId: 'auction-999',
      }

      const isValid = auction.verifyReveal(sealedBid, fakeReveal)
      expect(isValid).toBe(false)
    })

    it('should reject reveal with wrong commitment', () => {
      const auction = new SealedBidAuction()

      const receipt = auction.createBid({
        auctionId: 'auction-1',
        amount: 100n,
      })

      const sealedBid: SealedBid = {
        auctionId: receipt.auctionId,
        commitment: receipt.commitment,
        timestamp: receipt.timestamp,
      }

      const revealed = auction.revealBid(
        sealedBid,
        receipt.amount,
        hexToBytes(receipt.salt.slice(2))
      )

      // Create fake reveal with different commitment
      const fakeReveal: RevealedBid = {
        ...revealed,
        commitment: '0x02' + '00'.repeat(32),
      }

      const isValid = auction.verifyReveal(sealedBid, fakeReveal)
      expect(isValid).toBe(false)
    })
  })

  describe('Integration: Reveal workflow', () => {
    it('should support complete bid reveal lifecycle', () => {
      const auction = new SealedBidAuction()

      // PHASE 1: Bidding - Create sealed bids
      const aliceReceipt = auction.createBid({
        auctionId: 'auction-1',
        amount: 100n,
      })

      const bobReceipt = auction.createBid({
        auctionId: 'auction-1',
        amount: 150n,
      })

      const carolReceipt = auction.createBid({
        auctionId: 'auction-1',
        amount: 120n,
      })

      // PHASE 2: Submit commitments (only commitments are public)
      const aliceBid: SealedBid = {
        auctionId: aliceReceipt.auctionId,
        commitment: aliceReceipt.commitment,
        timestamp: aliceReceipt.timestamp,
      }

      const bobBid: SealedBid = {
        auctionId: bobReceipt.auctionId,
        commitment: bobReceipt.commitment,
        timestamp: bobReceipt.timestamp,
      }

      const carolBid: SealedBid = {
        auctionId: carolReceipt.auctionId,
        commitment: carolReceipt.commitment,
        timestamp: carolReceipt.timestamp,
      }

      // PHASE 3: Reveal phase - Bidders reveal their bids
      const aliceReveal = auction.revealBid(
        aliceBid,
        aliceReceipt.amount,
        hexToBytes(aliceReceipt.salt.slice(2))
      )

      const bobReveal = auction.revealBid(
        bobBid,
        bobReceipt.amount,
        hexToBytes(bobReceipt.salt.slice(2))
      )

      const carolReveal = auction.revealBid(
        carolBid,
        carolReceipt.amount,
        hexToBytes(carolReceipt.salt.slice(2))
      )

      // PHASE 4: Verification - Anyone can verify all reveals
      expect(auction.verifyReveal(aliceBid, aliceReveal)).toBe(true)
      expect(auction.verifyReveal(bobBid, bobReveal)).toBe(true)
      expect(auction.verifyReveal(carolBid, carolReveal)).toBe(true)

      // PHASE 5: Determine winner
      const reveals = [aliceReveal, bobReveal, carolReveal]
      const winner = reveals.reduce((max, reveal) =>
        reveal.amount > max.amount ? reveal : max
      )

      expect(winner).toBe(bobReveal)
      expect(winner.amount).toBe(150n)
    })

    it('should detect and reject cheating during reveal', () => {
      const auction = new SealedBidAuction()

      // Alice creates a bid for 100
      const aliceReceipt = auction.createBid({
        auctionId: 'auction-1',
        amount: 100n,
      })

      const aliceBid: SealedBid = {
        auctionId: aliceReceipt.auctionId,
        commitment: aliceReceipt.commitment,
        timestamp: aliceReceipt.timestamp,
      }

      // Alice tries to cheat by revealing 200 instead
      expect(() => {
        auction.revealBid(
          aliceBid,
          200n, // Cheating!
          hexToBytes(aliceReceipt.salt.slice(2))
        )
      }).toThrow(ValidationError)

      // Honest reveal works
      const honestReveal = auction.revealBid(
        aliceBid,
        aliceReceipt.amount,
        hexToBytes(aliceReceipt.salt.slice(2))
      )

      expect(auction.verifyReveal(aliceBid, honestReveal)).toBe(true)
    })

    it('should prevent revealing bid from different auction', () => {
      const auction = new SealedBidAuction()

      // Alice bids in auction-1
      const receipt = auction.createBid({
        auctionId: 'auction-1',
        amount: 100n,
      })

      const sealedBid: SealedBid = {
        auctionId: receipt.auctionId,
        commitment: receipt.commitment,
        timestamp: receipt.timestamp,
      }

      // Create reveal for auction-1
      const reveal = auction.revealBid(
        sealedBid,
        receipt.amount,
        hexToBytes(receipt.salt.slice(2))
      )

      // Try to use it for auction-2 (different sealed bid)
      const differentBid: SealedBid = {
        auctionId: 'auction-2',
        commitment: receipt.commitment,
        timestamp: receipt.timestamp,
      }

      const isValid = auction.verifyReveal(differentBid, reveal)
      expect(isValid).toBe(false)
    })
  })
})
