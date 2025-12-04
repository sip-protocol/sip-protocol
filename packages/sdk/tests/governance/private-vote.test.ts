/**
 * Tests for Private Voting
 */

import { describe, it, expect } from 'vitest'
import {
  PrivateVoting,
  createPrivateVoting,
  type EncryptedVote,
  type RevealedVote,
  type EncryptedTally,
  type TallyResult,
  type DecryptionShare,
  ValidationError,
  CryptoError,
  ErrorCode,
  generateRandomBytes,
} from '../../packages/sdk/src'

describe('PrivateVoting', () => {
  describe('createPrivateVoting', () => {
    it('should create a PrivateVoting instance', () => {
      const voting = createPrivateVoting()
      expect(voting).toBeInstanceOf(PrivateVoting)
    })
  })

  describe('castVote', () => {
    it('should encrypt a vote with valid parameters', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      const encryptedVote = voting.castVote({
        proposalId: 'proposal-001',
        choice: 1,
        weight: 1000n,
        encryptionKey,
      })

      expect(encryptedVote).toBeDefined()
      expect(encryptedVote.ciphertext).toMatch(/^0x[0-9a-f]+$/)
      expect(encryptedVote.nonce).toMatch(/^0x[0-9a-f]+$/)
      expect(encryptedVote.encryptionKeyHash).toMatch(/^0x[0-9a-f]+$/)
      expect(encryptedVote.proposalId).toBe('proposal-001')
      expect(encryptedVote.voter).toBe('anonymous')
      expect(encryptedVote.timestamp).toBeGreaterThan(0)
    })

    it('should encrypt vote with custom voter', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      const encryptedVote = voting.castVote({
        proposalId: 'proposal-001',
        choice: 1,
        weight: 1000n,
        encryptionKey,
        voter: '0xabc123',
      })

      expect(encryptedVote.voter).toBe('0xabc123')
    })

    it('should accept zero weight', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      const encryptedVote = voting.castVote({
        proposalId: 'proposal-001',
        choice: 1,
        weight: 0n,
        encryptionKey,
      })

      expect(encryptedVote).toBeDefined()
    })

    it('should accept large weight values', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      const encryptedVote = voting.castVote({
        proposalId: 'proposal-001',
        choice: 1,
        weight: 999999999999999999999999n,
        encryptionKey,
      })

      expect(encryptedVote).toBeDefined()
    })

    it('should throw error for empty proposal ID', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      expect(() => {
        voting.castVote({
          proposalId: '',
          choice: 1,
          weight: 1000n,
          encryptionKey,
        })
      }).toThrow(ValidationError)
    })

    it('should throw error for negative choice', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      expect(() => {
        voting.castVote({
          proposalId: 'proposal-001',
          choice: -1,
          weight: 1000n,
          encryptionKey,
        })
      }).toThrow(ValidationError)
    })

    it('should throw error for non-integer choice', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      expect(() => {
        voting.castVote({
          proposalId: 'proposal-001',
          choice: 1.5,
          weight: 1000n,
          encryptionKey,
        })
      }).toThrow(ValidationError)
    })

    it('should throw error for negative weight', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      expect(() => {
        voting.castVote({
          proposalId: 'proposal-001',
          choice: 1,
          weight: -100n,
          encryptionKey,
        })
      }).toThrow(ValidationError)
    })

    it('should throw error for invalid encryption key', () => {
      const voting = new PrivateVoting()

      expect(() => {
        voting.castVote({
          proposalId: 'proposal-001',
          choice: 1,
          weight: 1000n,
          encryptionKey: 'invalid-key',
        })
      }).toThrow(ValidationError)
    })

    it('should throw error for missing 0x prefix in encryption key', () => {
      const voting = new PrivateVoting()

      expect(() => {
        voting.castVote({
          proposalId: 'proposal-001',
          choice: 1,
          weight: 1000n,
          encryptionKey: 'abc123',
        })
      }).toThrow(ValidationError)
    })

    it('should produce different ciphertexts for same vote (due to random nonce)', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      const vote1 = voting.castVote({
        proposalId: 'proposal-001',
        choice: 1,
        weight: 1000n,
        encryptionKey,
      })

      const vote2 = voting.castVote({
        proposalId: 'proposal-001',
        choice: 1,
        weight: 1000n,
        encryptionKey,
      })

      expect(vote1.ciphertext).not.toBe(vote2.ciphertext)
      expect(vote1.nonce).not.toBe(vote2.nonce)
    })

    it('should produce different ciphertexts for different proposals', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      const vote1 = voting.castVote({
        proposalId: 'proposal-001',
        choice: 1,
        weight: 1000n,
        encryptionKey,
      })

      const vote2 = voting.castVote({
        proposalId: 'proposal-002',
        choice: 1,
        weight: 1000n,
        encryptionKey,
      })

      expect(vote1.ciphertext).not.toBe(vote2.ciphertext)
      expect(vote1.proposalId).not.toBe(vote2.proposalId)
    })
  })

  describe('revealVote', () => {
    it('should decrypt vote with correct key', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      const encryptedVote = voting.castVote({
        proposalId: 'proposal-001',
        choice: 1,
        weight: 1000n,
        encryptionKey,
        voter: '0xabc123',
      })

      const revealed = voting.revealVote(encryptedVote, encryptionKey)

      expect(revealed.proposalId).toBe('proposal-001')
      expect(revealed.choice).toBe(1)
      expect(revealed.weight).toBe(1000n)
      expect(revealed.voter).toBe('0xabc123')
      expect(revealed.timestamp).toBe(encryptedVote.timestamp)
      expect(revealed.encryptedVote).toBe(encryptedVote)
    })

    it('should decrypt vote with zero weight', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      const encryptedVote = voting.castVote({
        proposalId: 'proposal-001',
        choice: 2,
        weight: 0n,
        encryptionKey,
      })

      const revealed = voting.revealVote(encryptedVote, encryptionKey)

      expect(revealed.weight).toBe(0n)
    })

    it('should decrypt vote with large weight', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)
      const largeWeight = 999999999999999999999999n

      const encryptedVote = voting.castVote({
        proposalId: 'proposal-001',
        choice: 1,
        weight: largeWeight,
        encryptionKey,
      })

      const revealed = voting.revealVote(encryptedVote, encryptionKey)

      expect(revealed.weight).toBe(largeWeight)
    })

    it('should decrypt multiple choices correctly', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      const choices = [0, 1, 2, 3, 4, 5, 10, 100]

      for (const choice of choices) {
        const encryptedVote = voting.castVote({
          proposalId: 'proposal-001',
          choice,
          weight: 1000n,
          encryptionKey,
        })

        const revealed = voting.revealVote(encryptedVote, encryptionKey)

        expect(revealed.choice).toBe(choice)
      }
    })

    it('should throw error with wrong decryption key', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)
      const wrongKey = generateRandomBytes(32)

      const encryptedVote = voting.castVote({
        proposalId: 'proposal-001',
        choice: 1,
        weight: 1000n,
        encryptionKey,
      })

      expect(() => {
        voting.revealVote(encryptedVote, wrongKey)
      }).toThrow(CryptoError)
    })

    it('should throw error with invalid decryption key format', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      const encryptedVote = voting.castVote({
        proposalId: 'proposal-001',
        choice: 1,
        weight: 1000n,
        encryptionKey,
      })

      expect(() => {
        voting.revealVote(encryptedVote, 'invalid-key')
      }).toThrow(ValidationError)
    })

    it('should throw error if ciphertext is tampered', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      const encryptedVote = voting.castVote({
        proposalId: 'proposal-001',
        choice: 1,
        weight: 1000n,
        encryptionKey,
      })

      // Tamper with ciphertext
      const tamperedVote: EncryptedVote = {
        ...encryptedVote,
        ciphertext: `0x${encryptedVote.ciphertext.slice(2).replace(/a/g, 'b')}` as `0x${string}`,
      }

      expect(() => {
        voting.revealVote(tamperedVote, encryptionKey)
      }).toThrow(CryptoError)
    })

    it('should throw error if nonce is tampered', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      const encryptedVote = voting.castVote({
        proposalId: 'proposal-001',
        choice: 1,
        weight: 1000n,
        encryptionKey,
      })

      // Tamper with nonce
      const tamperedVote: EncryptedVote = {
        ...encryptedVote,
        nonce: generateRandomBytes(24),
      }

      expect(() => {
        voting.revealVote(tamperedVote, encryptionKey)
      }).toThrow(CryptoError)
    })

    it('should throw error for invalid encrypted vote structure', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      expect(() => {
        voting.revealVote(null as unknown as EncryptedVote, encryptionKey)
      }).toThrow(ValidationError)
    })

    it('should throw error for missing ciphertext', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      const invalidVote = {
        nonce: generateRandomBytes(24),
        encryptionKeyHash: generateRandomBytes(32),
        proposalId: 'proposal-001',
        voter: 'anonymous',
        timestamp: Date.now(),
      } as unknown as EncryptedVote

      expect(() => {
        voting.revealVote(invalidVote, encryptionKey)
      }).toThrow(ValidationError)
    })

    it('should throw error for invalid ciphertext format', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      const invalidVote: EncryptedVote = {
        ciphertext: 'not-hex' as unknown as `0x${string}`,
        nonce: generateRandomBytes(24),
        encryptionKeyHash: generateRandomBytes(32),
        proposalId: 'proposal-001',
        voter: 'anonymous',
        timestamp: Date.now(),
      }

      expect(() => {
        voting.revealVote(invalidVote, encryptionKey)
      }).toThrow(ValidationError)
    })
  })

  describe('end-to-end encryption/decryption', () => {
    it('should handle complete vote lifecycle', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      // Cast vote
      const encryptedVote = voting.castVote({
        proposalId: 'proposal-xyz',
        choice: 2,
        weight: 5000n,
        encryptionKey,
        voter: '0xvoter123',
      })

      // Verify encrypted vote has no readable information
      expect(encryptedVote.ciphertext).not.toContain('proposal-xyz')
      expect(encryptedVote.ciphertext).not.toContain('5000')
      expect(encryptedVote.ciphertext).not.toContain('0xvoter123')

      // Reveal vote
      const revealed = voting.revealVote(encryptedVote, encryptionKey)

      // Verify all data matches
      expect(revealed.proposalId).toBe('proposal-xyz')
      expect(revealed.choice).toBe(2)
      expect(revealed.weight).toBe(5000n)
      expect(revealed.voter).toBe('0xvoter123')
      expect(revealed.timestamp).toBe(encryptedVote.timestamp)
    })

    it('should handle multiple votes for same proposal', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      const votes = [
        { voter: '0xvoter1', choice: 0, weight: 100n },
        { voter: '0xvoter2', choice: 1, weight: 200n },
        { voter: '0xvoter3', choice: 2, weight: 300n },
      ]

      const encrypted = votes.map(v =>
        voting.castVote({
          proposalId: 'proposal-001',
          ...v,
          encryptionKey,
        })
      )

      const revealed = encrypted.map(e =>
        voting.revealVote(e, encryptionKey)
      )

      expect(revealed).toHaveLength(3)
      expect(revealed[0].choice).toBe(0)
      expect(revealed[0].weight).toBe(100n)
      expect(revealed[1].choice).toBe(1)
      expect(revealed[1].weight).toBe(200n)
      expect(revealed[2].choice).toBe(2)
      expect(revealed[2].weight).toBe(300n)
    })

    it('should handle votes for different proposals', () => {
      const voting = new PrivateVoting()
      const key1 = generateRandomBytes(32)
      const key2 = generateRandomBytes(32)

      const vote1 = voting.castVote({
        proposalId: 'proposal-001',
        choice: 1,
        weight: 1000n,
        encryptionKey: key1,
      })

      const vote2 = voting.castVote({
        proposalId: 'proposal-002',
        choice: 0,
        weight: 2000n,
        encryptionKey: key2,
      })

      const revealed1 = voting.revealVote(vote1, key1)
      const revealed2 = voting.revealVote(vote2, key2)

      expect(revealed1.proposalId).toBe('proposal-001')
      expect(revealed1.choice).toBe(1)
      expect(revealed1.weight).toBe(1000n)

      expect(revealed2.proposalId).toBe('proposal-002')
      expect(revealed2.choice).toBe(0)
      expect(revealed2.weight).toBe(2000n)
    })

    it('should fail to reveal vote from different proposal with same key', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      const vote1 = voting.castVote({
        proposalId: 'proposal-001',
        choice: 1,
        weight: 1000n,
        encryptionKey,
      })

      const vote2 = voting.castVote({
        proposalId: 'proposal-002',
        choice: 1,
        weight: 1000n,
        encryptionKey,
      })

      // Cannot reveal vote1 with vote2's context
      const tamperedVote: EncryptedVote = {
        ...vote1,
        proposalId: vote2.proposalId,
      }

      expect(() => {
        voting.revealVote(tamperedVote, encryptionKey)
      }).toThrow()
    })
  })

  describe('key derivation properties', () => {
    it('should derive different keys for different proposals', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      const vote1 = voting.castVote({
        proposalId: 'proposal-001',
        choice: 1,
        weight: 1000n,
        encryptionKey,
      })

      const vote2 = voting.castVote({
        proposalId: 'proposal-002',
        choice: 1,
        weight: 1000n,
        encryptionKey,
      })

      // Even with same base key, different proposal IDs produce different ciphertexts
      // (not just due to random nonce, but also key derivation)
      expect(vote1.ciphertext).not.toBe(vote2.ciphertext)
    })

    it('should bind encryption to proposal ID', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      const vote = voting.castVote({
        proposalId: 'proposal-001',
        choice: 1,
        weight: 1000n,
        encryptionKey,
      })

      // Try to decrypt with different proposal ID (should fail)
      const modifiedVote: EncryptedVote = {
        ...vote,
        proposalId: 'proposal-002',
      }

      expect(() => {
        voting.revealVote(modifiedVote, encryptionKey)
      }).toThrow(CryptoError)
    })
  })

  describe('error codes', () => {
    it('should throw ValidationError with MISSING_REQUIRED for empty proposal ID', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      try {
        voting.castVote({
          proposalId: '',
          choice: 1,
          weight: 1000n,
          encryptionKey,
        })
        expect.fail('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(ValidationError)
        expect((e as ValidationError).code).toBe(ErrorCode.MISSING_REQUIRED)
      }
    })

    it('should throw ValidationError with INVALID_KEY for bad encryption key', () => {
      const voting = new PrivateVoting()

      try {
        voting.castVote({
          proposalId: 'proposal-001',
          choice: 1,
          weight: 1000n,
          encryptionKey: 'not-hex',
        })
        expect.fail('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(ValidationError)
        expect((e as ValidationError).code).toBe(ErrorCode.INVALID_KEY)
      }
    })

    it('should throw CryptoError with DECRYPTION_FAILED for wrong key', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)
      const wrongKey = generateRandomBytes(32)

      const vote = voting.castVote({
        proposalId: 'proposal-001',
        choice: 1,
        weight: 1000n,
        encryptionKey,
      })

      try {
        voting.revealVote(vote, wrongKey)
        expect.fail('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(CryptoError)
        expect((e as CryptoError).code).toBe(ErrorCode.DECRYPTION_FAILED)
      }
    })
  })

  describe('edge cases', () => {
    it('should handle very long proposal IDs', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)
      const longId = 'a'.repeat(1000)

      const vote = voting.castVote({
        proposalId: longId,
        choice: 1,
        weight: 1000n,
        encryptionKey,
      })

      const revealed = voting.revealVote(vote, encryptionKey)

      expect(revealed.proposalId).toBe(longId)
    })

    it('should handle special characters in proposal ID', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)
      const specialId = 'proposal-#123_@test.com/vote'

      const vote = voting.castVote({
        proposalId: specialId,
        choice: 1,
        weight: 1000n,
        encryptionKey,
      })

      const revealed = voting.revealVote(vote, encryptionKey)

      expect(revealed.proposalId).toBe(specialId)
    })

    it('should handle unicode in proposal ID', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)
      const unicodeId = 'proposal-投票-🗳️'

      const vote = voting.castVote({
        proposalId: unicodeId,
        choice: 1,
        weight: 1000n,
        encryptionKey,
      })

      const revealed = voting.revealVote(vote, encryptionKey)

      expect(revealed.proposalId).toBe(unicodeId)
    })

    it('should handle very large choice numbers', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)
      const largeChoice = 999999

      const vote = voting.castVote({
        proposalId: 'proposal-001',
        choice: largeChoice,
        weight: 1000n,
        encryptionKey,
      })

      const revealed = voting.revealVote(vote, encryptionKey)

      expect(revealed.choice).toBe(largeChoice)
    })
  })

  describe('tallyVotes', () => {
    it('should tally votes homomorphically', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      // Cast multiple votes
      const votes = [
        voting.castVote({ proposalId: 'p1', choice: 0, weight: 100n, encryptionKey }),
        voting.castVote({ proposalId: 'p1', choice: 1, weight: 200n, encryptionKey }),
        voting.castVote({ proposalId: 'p1', choice: 0, weight: 150n, encryptionKey }),
        voting.castVote({ proposalId: 'p1', choice: 1, weight: 300n, encryptionKey }),
      ]

      const tally = voting.tallyVotes(votes, encryptionKey)

      expect(tally.proposalId).toBe('p1')
      expect(tally.voteCount).toBe(4)
      expect(Object.keys(tally.tallies)).toHaveLength(2)
      expect(tally.tallies['0']).toBeDefined()
      expect(tally.tallies['1']).toBeDefined()
      expect(tally.tallies['0']).toMatch(/^0x[0-9a-f]+$/)
      expect(tally.tallies['1']).toMatch(/^0x[0-9a-f]+$/)
      expect(tally.encryptedBlindings['0']).toBeDefined()
      expect(tally.encryptedBlindings['1']).toBeDefined()
    })

    it('should tally single vote', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      const votes = [
        voting.castVote({ proposalId: 'p1', choice: 0, weight: 100n, encryptionKey }),
      ]

      const tally = voting.tallyVotes(votes, encryptionKey)

      expect(tally.proposalId).toBe('p1')
      expect(tally.voteCount).toBe(1)
      expect(Object.keys(tally.tallies)).toHaveLength(1)
      expect(tally.tallies['0']).toBeDefined()
    })

    it('should handle votes with different choices', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      const votes = [
        voting.castVote({ proposalId: 'p1', choice: 0, weight: 100n, encryptionKey }),
        voting.castVote({ proposalId: 'p1', choice: 1, weight: 200n, encryptionKey }),
        voting.castVote({ proposalId: 'p1', choice: 2, weight: 300n, encryptionKey }),
      ]

      const tally = voting.tallyVotes(votes, encryptionKey)

      expect(tally.voteCount).toBe(3)
      expect(Object.keys(tally.tallies)).toHaveLength(3)
      expect(tally.tallies['0']).toBeDefined()
      expect(tally.tallies['1']).toBeDefined()
      expect(tally.tallies['2']).toBeDefined()
    })

    it('should handle large vote weights', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      const votes = [
        voting.castVote({ proposalId: 'p1', choice: 0, weight: 999999n, encryptionKey }),
        voting.castVote({ proposalId: 'p1', choice: 0, weight: 888888n, encryptionKey }),
      ]

      const tally = voting.tallyVotes(votes, encryptionKey)

      expect(tally.voteCount).toBe(2)
      expect(tally.tallies['0']).toBeDefined()
    })

    it('should throw error for empty votes array', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      expect(() => {
        voting.tallyVotes([], encryptionKey)
      }).toThrow(ValidationError)
    })

    it('should throw error for mixed proposal IDs', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      const votes = [
        voting.castVote({ proposalId: 'p1', choice: 0, weight: 100n, encryptionKey }),
        voting.castVote({ proposalId: 'p2', choice: 1, weight: 200n, encryptionKey }),
      ]

      expect(() => {
        voting.tallyVotes(votes, encryptionKey)
      }).toThrow(ValidationError)
    })

    it('should throw error for invalid decryption key', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      const votes = [
        voting.castVote({ proposalId: 'p1', choice: 0, weight: 100n, encryptionKey }),
      ]

      expect(() => {
        voting.tallyVotes(votes, 'invalid-key')
      }).toThrow(ValidationError)
    })

    it('should throw error for wrong decryption key', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)
      const wrongKey = generateRandomBytes(32)

      const votes = [
        voting.castVote({ proposalId: 'p1', choice: 0, weight: 100n, encryptionKey }),
      ]

      expect(() => {
        voting.tallyVotes(votes, wrongKey)
      }).toThrow(CryptoError)
    })
  })

  describe('revealTally', () => {
    it('should reveal tally with single share', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      // Cast votes
      const votes = [
        voting.castVote({ proposalId: 'p1', choice: 0, weight: 100n, encryptionKey }),
        voting.castVote({ proposalId: 'p1', choice: 1, weight: 200n, encryptionKey }),
        voting.castVote({ proposalId: 'p1', choice: 0, weight: 150n, encryptionKey }),
      ]

      // Tally
      const tally = voting.tallyVotes(votes, encryptionKey)

      // Reveal with single share (simplified threshold)
      const shares: DecryptionShare[] = [
        { memberId: 'member1', share: encryptionKey },
      ]

      const results = voting.revealTally(tally, shares)

      expect(results.proposalId).toBe('p1')
      expect(results.voteCount).toBe(3)
      expect(results.results['0']).toBe(250n) // 100 + 150
      expect(results.results['1']).toBe(200n)
      expect(results.encryptedTally).toBe(tally)
    })

    it('should reveal tally with multiple shares using XOR', () => {
      const voting = new PrivateVoting()

      // Create XOR shares (toy threshold scheme)
      const share1 = generateRandomBytes(32)
      const share2 = generateRandomBytes(32)

      // XOR them together to get the key
      const share1Bytes = Buffer.from(share1.slice(2), 'hex')
      const share2Bytes = Buffer.from(share2.slice(2), 'hex')
      const keyBytes = new Uint8Array(32)

      for (let i = 0; i < 32; i++) {
        keyBytes[i] = share1Bytes[i] ^ share2Bytes[i]
      }

      const encryptionKey = `0x${Buffer.from(keyBytes).toString('hex')}` as any

      // Cast votes
      const votes = [
        voting.castVote({ proposalId: 'p1', choice: 0, weight: 50n, encryptionKey }),
        voting.castVote({ proposalId: 'p1', choice: 1, weight: 75n, encryptionKey }),
      ]

      // Tally
      const tally = voting.tallyVotes(votes, encryptionKey)

      // Reveal with multiple shares
      const shares: DecryptionShare[] = [
        { memberId: 'member1', share: share1 },
        { memberId: 'member2', share: share2 },
      ]

      const results = voting.revealTally(tally, shares)

      expect(results.proposalId).toBe('p1')
      expect(results.voteCount).toBe(2)
      expect(results.results['0']).toBe(50n)
      expect(results.results['1']).toBe(75n)
    })

    it('should handle single choice tally', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      const votes = [
        voting.castVote({ proposalId: 'p1', choice: 0, weight: 100n, encryptionKey }),
        voting.castVote({ proposalId: 'p1', choice: 0, weight: 200n, encryptionKey }),
      ]

      const tally = voting.tallyVotes(votes, encryptionKey)

      const shares: DecryptionShare[] = [
        { memberId: 'member1', share: encryptionKey },
      ]

      const results = voting.revealTally(tally, shares)

      expect(results.results['0']).toBe(300n)
      expect(Object.keys(results.results)).toHaveLength(1)
    })

    it('should handle zero weight votes', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      const votes = [
        voting.castVote({ proposalId: 'p1', choice: 0, weight: 0n, encryptionKey }),
        voting.castVote({ proposalId: 'p1', choice: 1, weight: 100n, encryptionKey }),
      ]

      const tally = voting.tallyVotes(votes, encryptionKey)

      const shares: DecryptionShare[] = [
        { memberId: 'member1', share: encryptionKey },
      ]

      const results = voting.revealTally(tally, shares)

      expect(results.results['0']).toBe(0n)
      expect(results.results['1']).toBe(100n)
    })

    it('should throw error for empty shares array', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      const votes = [
        voting.castVote({ proposalId: 'p1', choice: 0, weight: 100n, encryptionKey }),
      ]

      const tally = voting.tallyVotes(votes, encryptionKey)

      expect(() => {
        voting.revealTally(tally, [])
      }).toThrow(ValidationError)
    })

    it('should throw error for invalid share format', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      const votes = [
        voting.castVote({ proposalId: 'p1', choice: 0, weight: 100n, encryptionKey }),
      ]

      const tally = voting.tallyVotes(votes, encryptionKey)

      expect(() => {
        voting.revealTally(tally, [
          { memberId: 'member1', share: 'invalid-share' } as any as unknown as object,
        ])
      }).toThrow(ValidationError)
    })

    it('should throw error for invalid tally structure', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      const invalidTally = {
        proposalId: 'p1',
        tallies: {},
        voteCount: 0,
        timestamp: Date.now(),
      } as any

      expect(() => {
        voting.revealTally(invalidTally, [
          { memberId: 'member1', share: encryptionKey },
        ])
      }).toThrow(ValidationError)
    })

    it('should throw error for mismatched share lengths', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      const votes = [
        voting.castVote({ proposalId: 'p1', choice: 0, weight: 100n, encryptionKey }),
      ]

      const tally = voting.tallyVotes(votes, encryptionKey)

      const shares: DecryptionShare[] = [
        { memberId: 'member1', share: generateRandomBytes(32) },
        { memberId: 'member2', share: generateRandomBytes(16) }, // Different length
      ]

      expect(() => {
        voting.revealTally(tally, shares)
      }).toThrow(ValidationError)
    })

    it('should throw error for wrong decryption shares', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      const votes = [
        voting.castVote({ proposalId: 'p1', choice: 0, weight: 100n, encryptionKey }),
      ]

      const tally = voting.tallyVotes(votes, encryptionKey)

      const wrongShares: DecryptionShare[] = [
        { memberId: 'member1', share: generateRandomBytes(32) },
      ]

      expect(() => {
        voting.revealTally(tally, wrongShares)
      }).toThrow(CryptoError)
    })
  })

  describe('end-to-end tallying', () => {
    it('should handle complete tallying lifecycle', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      // Multiple voters cast votes
      const votes = [
        voting.castVote({ proposalId: 'treasury-001', choice: 0, weight: 1000n, encryptionKey, voter: '0xvoter1' }),
        voting.castVote({ proposalId: 'treasury-001', choice: 1, weight: 2000n, encryptionKey, voter: '0xvoter2' }),
        voting.castVote({ proposalId: 'treasury-001', choice: 0, weight: 1500n, encryptionKey, voter: '0xvoter3' }),
        voting.castVote({ proposalId: 'treasury-001', choice: 2, weight: 500n, encryptionKey, voter: '0xvoter4' }),
        voting.castVote({ proposalId: 'treasury-001', choice: 1, weight: 3000n, encryptionKey, voter: '0xvoter5' }),
      ]

      // Committee tallies votes (individual votes still encrypted)
      const tally = voting.tallyVotes(votes, encryptionKey)

      expect(tally.proposalId).toBe('treasury-001')
      expect(tally.voteCount).toBe(5)

      // Verify commitments exist for each choice
      expect(tally.tallies['0']).toBeDefined()
      expect(tally.tallies['1']).toBeDefined()
      expect(tally.tallies['2']).toBeDefined()

      // Committee reveals final tally
      const shares: DecryptionShare[] = [
        { memberId: 'committee-member-1', share: encryptionKey },
      ]

      const results = voting.revealTally(tally, shares)

      // Verify final results
      expect(results.proposalId).toBe('treasury-001')
      expect(results.voteCount).toBe(5)
      expect(results.results['0']).toBe(2500n) // 1000 + 1500
      expect(results.results['1']).toBe(5000n) // 2000 + 3000
      expect(results.results['2']).toBe(500n)
    })

    it('should handle tie scenario', () => {
      const voting = new PrivateVoting()
      const encryptionKey = generateRandomBytes(32)

      const votes = [
        voting.castVote({ proposalId: 'p1', choice: 0, weight: 100n, encryptionKey }),
        voting.castVote({ proposalId: 'p1', choice: 1, weight: 100n, encryptionKey }),
      ]

      const tally = voting.tallyVotes(votes, encryptionKey)
      const shares: DecryptionShare[] = [
        { memberId: 'member1', share: encryptionKey },
      ]
      const results = voting.revealTally(tally, shares)

      expect(results.results['0']).toBe(100n)
      expect(results.results['1']).toBe(100n)
    })
  })
})
