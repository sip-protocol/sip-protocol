/**
 * Private NFT Ownership Tests
 *
 * Comprehensive tests for privacy-preserving NFT ownership using
 * stealth addresses and zero-knowledge proofs.
 */

import { describe, it, expect } from 'vitest'
import { hexToBytes } from '@noble/hashes/utils'
import {
  PrivateNFT,
  createPrivateOwnership,
  proveOwnership,
  verifyOwnership,
  generateStealthMetaAddress,
  encodeStealthMetaAddress,
  deriveStealthPrivateKey,
  generateEd25519StealthMetaAddress,
  deriveEd25519StealthPrivateKey,
} from '../../src'
import type {
  PrivateNFTOwnership,
  OwnershipProof,
  ChainId,
} from '@sip-protocol/types'

describe('PrivateNFT', () => {
  describe('createPrivateOwnership()', () => {
    it('should create private ownership record for secp256k1 chain', () => {
      const nft = new PrivateNFT()

      // Generate recipient meta-address
      const { metaAddress } = generateStealthMetaAddress('ethereum')
      const encoded = encodeStealthMetaAddress(metaAddress)

      // Create ownership
      const ownership = nft.createPrivateOwnership({
        nftContract: '0x1234567890abcdef1234567890abcdef12345678',
        tokenId: '42',
        ownerMetaAddress: encoded,
        chain: 'ethereum',
      })

      // Validate structure
      expect(ownership.nftContract).toBe('0x1234567890abcdef1234567890abcdef12345678')
      expect(ownership.tokenId).toBe('42')
      expect(ownership.chain).toBe('ethereum')
      expect(ownership.ownerStealth).toBeDefined()
      expect(ownership.ownerStealth.address).toMatch(/^0x[0-9a-f]{66}$/) // 33 bytes compressed key
      expect(ownership.ownerStealth.ephemeralPublicKey).toMatch(/^0x[0-9a-f]{66}$/)
      expect(ownership.ownerStealth.viewTag).toBeGreaterThanOrEqual(0)
      expect(ownership.ownerStealth.viewTag).toBeLessThanOrEqual(255)
      expect(ownership.ownershipHash).toMatch(/^0x[0-9a-f]{64}$/) // SHA-256 hash
      expect(ownership.timestamp).toBeGreaterThan(0)
    })

    it('should create private ownership record for ed25519 chain', () => {
      const nft = new PrivateNFT()

      // Generate recipient meta-address for Solana
      const { metaAddress } = generateEd25519StealthMetaAddress('solana')
      const encoded = encodeStealthMetaAddress(metaAddress)

      // Create ownership
      const ownership = nft.createPrivateOwnership({
        nftContract: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        tokenId: '123',
        ownerMetaAddress: encoded,
        chain: 'solana',
      })

      // Validate structure
      expect(ownership.nftContract).toBe('tokenkegqfezyinwajbnbgkpfxcwubvf9ss623vq5da')
      expect(ownership.tokenId).toBe('123')
      expect(ownership.chain).toBe('solana')
      expect(ownership.ownerStealth.address).toMatch(/^0x[0-9a-f]{64}$/) // 32 bytes ed25519 key
    })

    it('should generate unique stealth address for each ownership', () => {
      const nft = new PrivateNFT()
      const { metaAddress } = generateStealthMetaAddress('ethereum')
      const encoded = encodeStealthMetaAddress(metaAddress)

      const ownership1 = nft.createPrivateOwnership({
        nftContract: '0x1234567890abcdef1234567890abcdef12345678',
        tokenId: '1',
        ownerMetaAddress: encoded,
        chain: 'ethereum',
      })

      const ownership2 = nft.createPrivateOwnership({
        nftContract: '0x1234567890abcdef1234567890abcdef12345678',
        tokenId: '2',
        ownerMetaAddress: encoded,
        chain: 'ethereum',
      })

      // Different stealth addresses (unlinkable)
      expect(ownership1.ownerStealth.address).not.toBe(ownership2.ownerStealth.address)
      expect(ownership1.ownershipHash).not.toBe(ownership2.ownershipHash)
    })

    it('should normalize NFT contract address to lowercase', () => {
      const nft = new PrivateNFT()
      const { metaAddress } = generateStealthMetaAddress('ethereum')
      const encoded = encodeStealthMetaAddress(metaAddress)

      const ownership = nft.createPrivateOwnership({
        nftContract: '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
        tokenId: '1',
        ownerMetaAddress: encoded,
        chain: 'ethereum',
      })

      expect(ownership.nftContract).toBe('0xabcdef1234567890abcdef1234567890abcdef12')
    })

    it('should throw error for invalid NFT contract', () => {
      const nft = new PrivateNFT()
      const { metaAddress } = generateStealthMetaAddress('ethereum')
      const encoded = encodeStealthMetaAddress(metaAddress)

      expect(() => {
        nft.createPrivateOwnership({
          nftContract: '',
          tokenId: '1',
          ownerMetaAddress: encoded,
          chain: 'ethereum',
        })
      }).toThrow('nftContract must be a non-empty string')
    })

    it('should throw error for invalid token ID', () => {
      const nft = new PrivateNFT()
      const { metaAddress } = generateStealthMetaAddress('ethereum')
      const encoded = encodeStealthMetaAddress(metaAddress)

      expect(() => {
        nft.createPrivateOwnership({
          nftContract: '0x1234567890abcdef1234567890abcdef12345678',
          tokenId: '',
          ownerMetaAddress: encoded,
          chain: 'ethereum',
        })
      }).toThrow('tokenId must be a non-empty string')
    })

    it('should throw error for invalid chain', () => {
      const nft = new PrivateNFT()
      const { metaAddress } = generateStealthMetaAddress('ethereum')
      const encoded = encodeStealthMetaAddress(metaAddress)

      expect(() => {
        nft.createPrivateOwnership({
          nftContract: '0x1234567890abcdef1234567890abcdef12345678',
          tokenId: '1',
          ownerMetaAddress: encoded,
          chain: 'invalidchain' as ChainId,
        })
      }).toThrow("invalid chain 'invalidchain'")
    })

    it('should throw error for chain mismatch', () => {
      const nft = new PrivateNFT()
      // Generate meta-address for Ethereum
      const { metaAddress } = generateStealthMetaAddress('ethereum')
      const encoded = encodeStealthMetaAddress(metaAddress)

      // Try to use it for Solana (mismatch)
      expect(() => {
        nft.createPrivateOwnership({
          nftContract: '0x1234567890abcdef1234567890abcdef12345678',
          tokenId: '1',
          ownerMetaAddress: encoded,
          chain: 'solana',
        })
      }).toThrow("chain mismatch: meta-address is for 'ethereum' but NFT is on 'solana'")
    })

    it('should throw error for invalid meta-address format', () => {
      const nft = new PrivateNFT()

      expect(() => {
        nft.createPrivateOwnership({
          nftContract: '0x1234567890abcdef1234567890abcdef12345678',
          tokenId: '1',
          ownerMetaAddress: 'not-a-valid-meta-address',
          chain: 'ethereum',
        })
      }).toThrow('ownerMetaAddress must be an encoded stealth meta-address')
    })
  })

  describe('proveOwnership()', () => {
    it('should generate valid ownership proof for secp256k1 chain', () => {
      const nft = new PrivateNFT()

      // Create ownership
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
        generateStealthMetaAddress('ethereum')
      const encoded = encodeStealthMetaAddress(metaAddress)

      const ownership = nft.createPrivateOwnership({
        nftContract: '0x1234567890abcdef1234567890abcdef12345678',
        tokenId: '42',
        ownerMetaAddress: encoded,
        chain: 'ethereum',
      })

      // Derive stealth private key
      const recovery = deriveStealthPrivateKey(
        ownership.ownerStealth,
        spendingPrivateKey,
        viewingPrivateKey
      )

      // Generate proof
      const challenge = 'prove-ownership-2024-12-03'
      const proof = nft.proveOwnership({
        ownership,
        challenge,
        stealthPrivateKey: recovery.privateKey,
      })

      // Validate proof structure
      expect(proof.nftContract).toBe(ownership.nftContract)
      expect(proof.tokenId).toBe(ownership.tokenId)
      expect(proof.challenge).toBe(challenge)
      expect(proof.proof).toBeDefined()
      expect(proof.proof.proof).toMatch(/^0x[0-9a-f]+$/) // Signature
      expect(proof.proof.publicInputs).toHaveLength(1)
      expect(proof.proof.publicInputs[0]).toMatch(/^0x[0-9a-f]{64}$/) // Message hash
      expect(proof.stealthHash).toMatch(/^0x[0-9a-f]{64}$/) // Hash of stealth address
      expect(proof.timestamp).toBeGreaterThan(0)
    })

    it('should generate valid ownership proof for ed25519 chain', () => {
      const nft = new PrivateNFT()

      // Create ownership for Solana
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
        generateEd25519StealthMetaAddress('solana')
      const encoded = encodeStealthMetaAddress(metaAddress)

      const ownership = nft.createPrivateOwnership({
        nftContract: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        tokenId: '123',
        ownerMetaAddress: encoded,
        chain: 'solana',
      })

      // Derive stealth private key
      const recovery = deriveEd25519StealthPrivateKey(
        ownership.ownerStealth,
        spendingPrivateKey,
        viewingPrivateKey
      )

      // Generate proof
      const challenge = 'solana-nft-proof'
      const proof = nft.proveOwnership({
        ownership,
        challenge,
        stealthPrivateKey: recovery.privateKey,
      })

      expect(proof.nftContract).toBe('tokenkegqfezyinwajbnbgkpfxcwubvf9ss623vq5da')
      expect(proof.tokenId).toBe('123')
      expect(proof.challenge).toBe(challenge)
      expect(proof.proof).toBeDefined()
    })

    it('should generate different proofs for different challenges', () => {
      const nft = new PrivateNFT()

      const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
        generateStealthMetaAddress('ethereum')
      const encoded = encodeStealthMetaAddress(metaAddress)

      const ownership = nft.createPrivateOwnership({
        nftContract: '0x1234567890abcdef1234567890abcdef12345678',
        tokenId: '42',
        ownerMetaAddress: encoded,
        chain: 'ethereum',
      })

      const recovery = deriveStealthPrivateKey(
        ownership.ownerStealth,
        spendingPrivateKey,
        viewingPrivateKey
      )

      const proof1 = nft.proveOwnership({
        ownership,
        challenge: 'challenge-1',
        stealthPrivateKey: recovery.privateKey,
      })

      const proof2 = nft.proveOwnership({
        ownership,
        challenge: 'challenge-2',
        stealthPrivateKey: recovery.privateKey,
      })

      // Different challenges produce different proofs
      expect(proof1.challenge).not.toBe(proof2.challenge)
      expect(proof1.proof.proof).not.toBe(proof2.proof.proof)
      expect(proof1.proof.publicInputs[0]).not.toBe(proof2.proof.publicInputs[0])
    })

    it('should throw error for invalid private key', () => {
      const nft = new PrivateNFT()

      const { metaAddress } = generateStealthMetaAddress('ethereum')
      const encoded = encodeStealthMetaAddress(metaAddress)

      const ownership = nft.createPrivateOwnership({
        nftContract: '0x1234567890abcdef1234567890abcdef12345678',
        tokenId: '42',
        ownerMetaAddress: encoded,
        chain: 'ethereum',
      })

      expect(() => {
        nft.proveOwnership({
          ownership,
          challenge: 'test',
          stealthPrivateKey: '0xinvalid',
        })
      }).toThrow('stealthPrivateKey must be a valid 32-byte hex string')
    })

    it('should throw error for empty challenge', () => {
      const nft = new PrivateNFT()

      const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
        generateStealthMetaAddress('ethereum')
      const encoded = encodeStealthMetaAddress(metaAddress)

      const ownership = nft.createPrivateOwnership({
        nftContract: '0x1234567890abcdef1234567890abcdef12345678',
        tokenId: '42',
        ownerMetaAddress: encoded,
        chain: 'ethereum',
      })

      const recovery = deriveStealthPrivateKey(
        ownership.ownerStealth,
        spendingPrivateKey,
        viewingPrivateKey
      )

      expect(() => {
        nft.proveOwnership({
          ownership,
          challenge: '',
          stealthPrivateKey: recovery.privateKey,
        })
      }).toThrow('challenge must be a non-empty string')
    })
  })

  describe('verifyOwnership()', () => {
    it('should verify valid ownership proof', () => {
      const nft = new PrivateNFT()

      // Create ownership and proof
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
        generateStealthMetaAddress('ethereum')
      const encoded = encodeStealthMetaAddress(metaAddress)

      const ownership = nft.createPrivateOwnership({
        nftContract: '0x1234567890abcdef1234567890abcdef12345678',
        tokenId: '42',
        ownerMetaAddress: encoded,
        chain: 'ethereum',
      })

      const recovery = deriveStealthPrivateKey(
        ownership.ownerStealth,
        spendingPrivateKey,
        viewingPrivateKey
      )

      const proof = nft.proveOwnership({
        ownership,
        challenge: 'verify-test',
        stealthPrivateKey: recovery.privateKey,
      })

      // Verify proof
      const result = nft.verifyOwnership(proof)

      expect(result.valid).toBe(true)
      expect(result.nftContract).toBe(ownership.nftContract)
      expect(result.tokenId).toBe(ownership.tokenId)
      expect(result.challenge).toBe('verify-test')
      expect(result.timestamp).toBeGreaterThan(0)
      expect(result.error).toBeUndefined()
    })

    it('should reject proof with invalid signature format', () => {
      const nft = new PrivateNFT()

      const invalidProof: OwnershipProof = {
        nftContract: '0x1234567890abcdef1234567890abcdef12345678',
        tokenId: '42',
        challenge: 'test',
        proof: {
          proof: '0x1234', // Too short
          publicInputs: ['0x' + '0'.repeat(64)],
        },
        stealthHash: '0x' + '0'.repeat(64),
        timestamp: Date.now(),
      }

      const result = nft.verifyOwnership(invalidProof)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('signature')
    })

    it('should reject proof with zero signature', () => {
      const nft = new PrivateNFT()

      const invalidProof: OwnershipProof = {
        nftContract: '0x1234567890abcdef1234567890abcdef12345678',
        tokenId: '42',
        challenge: 'test',
        proof: {
          proof: '0x' + '0'.repeat(128), // 64 bytes of zeros
          publicInputs: ['0x' + '0'.repeat(64)],
        },
        stealthHash: '0x' + '0'.repeat(64),
        timestamp: Date.now(),
      }

      const result = nft.verifyOwnership(invalidProof)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('signature')
    })

    it('should handle malformed proof gracefully', () => {
      const nft = new PrivateNFT()

      const malformedProof = {
        nftContract: '0x1234567890abcdef1234567890abcdef12345678',
        tokenId: '42',
        challenge: 'test',
        // Missing required fields
      } as OwnershipProof

      const result = nft.verifyOwnership(malformedProof)

      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('Convenience functions', () => {
    it('createPrivateOwnership() should work', () => {
      const { metaAddress } = generateStealthMetaAddress('ethereum')
      const encoded = encodeStealthMetaAddress(metaAddress)

      const ownership = createPrivateOwnership({
        nftContract: '0x1234567890abcdef1234567890abcdef12345678',
        tokenId: '42',
        ownerMetaAddress: encoded,
        chain: 'ethereum',
      })

      expect(ownership.nftContract).toBe('0x1234567890abcdef1234567890abcdef12345678')
      expect(ownership.tokenId).toBe('42')
    })

    it('proveOwnership() should work', () => {
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
        generateStealthMetaAddress('ethereum')
      const encoded = encodeStealthMetaAddress(metaAddress)

      const ownership = createPrivateOwnership({
        nftContract: '0x1234567890abcdef1234567890abcdef12345678',
        tokenId: '42',
        ownerMetaAddress: encoded,
        chain: 'ethereum',
      })

      const recovery = deriveStealthPrivateKey(
        ownership.ownerStealth,
        spendingPrivateKey,
        viewingPrivateKey
      )

      const proof = proveOwnership({
        ownership,
        challenge: 'test',
        stealthPrivateKey: recovery.privateKey,
      })

      expect(proof.challenge).toBe('test')
    })

    it('verifyOwnership() should work', () => {
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
        generateStealthMetaAddress('ethereum')
      const encoded = encodeStealthMetaAddress(metaAddress)

      const ownership = createPrivateOwnership({
        nftContract: '0x1234567890abcdef1234567890abcdef12345678',
        tokenId: '42',
        ownerMetaAddress: encoded,
        chain: 'ethereum',
      })

      const recovery = deriveStealthPrivateKey(
        ownership.ownerStealth,
        spendingPrivateKey,
        viewingPrivateKey
      )

      const proof = proveOwnership({
        ownership,
        challenge: 'test',
        stealthPrivateKey: recovery.privateKey,
      })

      const result = verifyOwnership(proof)

      expect(result.valid).toBe(true)
    })
  })

  describe('transferPrivately()', () => {
    it('should transfer NFT privately to new owner (secp256k1)', () => {
      const nft = new PrivateNFT()

      // Original owner
      const alice = generateStealthMetaAddress('ethereum', 'Alice')
      const aliceEncoded = encodeStealthMetaAddress(alice.metaAddress)

      // Create initial ownership
      const ownership = nft.createPrivateOwnership({
        nftContract: '0x1234567890abcdef1234567890abcdef12345678',
        tokenId: '42',
        ownerMetaAddress: aliceEncoded,
        chain: 'ethereum',
      })

      // New owner
      const bob = generateStealthMetaAddress('ethereum', 'Bob')
      const bobEncoded = encodeStealthMetaAddress(bob.metaAddress)

      // Transfer to Bob
      const result = nft.transferPrivately({
        nft: ownership,
        recipientMetaAddress: bobEncoded,
      })

      // Validate transfer result
      expect(result.newOwnership).toBeDefined()
      expect(result.transfer).toBeDefined()

      // New ownership should have different stealth address (unlinkable)
      expect(result.newOwnership.ownerStealth.address).not.toBe(ownership.ownerStealth.address)

      // Same NFT
      expect(result.newOwnership.nftContract).toBe(ownership.nftContract)
      expect(result.newOwnership.tokenId).toBe(ownership.tokenId)
      expect(result.newOwnership.chain).toBe(ownership.chain)

      // Transfer record matches
      expect(result.transfer.nftContract).toBe(ownership.nftContract)
      expect(result.transfer.tokenId).toBe(ownership.tokenId)
      expect(result.transfer.chain).toBe(ownership.chain)
      expect(result.transfer.newOwnerStealth).toEqual(result.newOwnership.ownerStealth)
      expect(result.transfer.previousOwnerHash).toMatch(/^0x[0-9a-f]{64}$/)
    })

    it('should transfer NFT privately to new owner (ed25519)', () => {
      const nft = new PrivateNFT()

      // Original owner (Solana)
      const alice = generateEd25519StealthMetaAddress('solana')
      const aliceEncoded = encodeStealthMetaAddress(alice.metaAddress)

      const ownership = nft.createPrivateOwnership({
        nftContract: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        tokenId: '123',
        ownerMetaAddress: aliceEncoded,
        chain: 'solana',
      })

      // New owner
      const bob = generateEd25519StealthMetaAddress('solana')
      const bobEncoded = encodeStealthMetaAddress(bob.metaAddress)

      // Transfer to Bob
      const result = nft.transferPrivately({
        nft: ownership,
        recipientMetaAddress: bobEncoded,
      })

      // Different stealth addresses (unlinkable)
      expect(result.newOwnership.ownerStealth.address).not.toBe(ownership.ownerStealth.address)
      expect(result.newOwnership.nftContract).toBe('tokenkegqfezyinwajbnbgkpfxcwubvf9ss623vq5da')
    })

    it('should generate unique stealth addresses for multiple transfers', () => {
      const nft = new PrivateNFT()

      const alice = generateStealthMetaAddress('ethereum')
      const aliceEncoded = encodeStealthMetaAddress(alice.metaAddress)

      const ownership = nft.createPrivateOwnership({
        nftContract: '0x1234567890abcdef1234567890abcdef12345678',
        tokenId: '42',
        ownerMetaAddress: aliceEncoded,
        chain: 'ethereum',
      })

      const bob = generateStealthMetaAddress('ethereum')
      const bobEncoded = encodeStealthMetaAddress(bob.metaAddress)

      // Transfer twice to same recipient
      const transfer1 = nft.transferPrivately({
        nft: ownership,
        recipientMetaAddress: bobEncoded,
      })

      const transfer2 = nft.transferPrivately({
        nft: ownership,
        recipientMetaAddress: bobEncoded,
      })

      // Each transfer creates unique stealth address (unlinkable)
      expect(transfer1.newOwnership.ownerStealth.address).not.toBe(
        transfer2.newOwnership.ownerStealth.address
      )
    })

    it('should throw error for chain mismatch', () => {
      const nft = new PrivateNFT()

      const alice = generateStealthMetaAddress('ethereum')
      const aliceEncoded = encodeStealthMetaAddress(alice.metaAddress)

      const ownership = nft.createPrivateOwnership({
        nftContract: '0x1234567890abcdef1234567890abcdef12345678',
        tokenId: '42',
        ownerMetaAddress: aliceEncoded,
        chain: 'ethereum',
      })

      // Try to transfer to Solana recipient (mismatch)
      const bob = generateEd25519StealthMetaAddress('solana')
      const bobEncoded = encodeStealthMetaAddress(bob.metaAddress)

      expect(() => {
        nft.transferPrivately({
          nft: ownership,
          recipientMetaAddress: bobEncoded,
        })
      }).toThrow("chain mismatch: meta-address is for 'solana' but NFT is on 'ethereum'")
    })

    it('should throw error for invalid recipient meta-address', () => {
      const nft = new PrivateNFT()

      const alice = generateStealthMetaAddress('ethereum')
      const aliceEncoded = encodeStealthMetaAddress(alice.metaAddress)

      const ownership = nft.createPrivateOwnership({
        nftContract: '0x1234567890abcdef1234567890abcdef12345678',
        tokenId: '42',
        ownerMetaAddress: aliceEncoded,
        chain: 'ethereum',
      })

      expect(() => {
        nft.transferPrivately({
          nft: ownership,
          recipientMetaAddress: 'not-a-valid-address',
        })
      }).toThrow('recipientMetaAddress must be an encoded stealth meta-address')
    })
  })

  describe('scanForNFTs()', () => {
    it('should scan and find owned NFTs (secp256k1)', () => {
      const nft = new PrivateNFT()

      // Recipient's keys
      const recipient = generateStealthMetaAddress('ethereum', 'Bob')
      const recipientEncoded = encodeStealthMetaAddress(recipient.metaAddress)

      // Create some NFT transfers to the recipient
      const alice = generateStealthMetaAddress('ethereum', 'Alice')
      const aliceEncoded = encodeStealthMetaAddress(alice.metaAddress)

      const nft1 = nft.createPrivateOwnership({
        nftContract: '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d',
        tokenId: '1234',
        ownerMetaAddress: aliceEncoded,
        chain: 'ethereum',
      })

      const nft2 = nft.createPrivateOwnership({
        nftContract: '0x60e4d786628fea6478f785a6d7e704777c86a7c6',
        tokenId: '5678',
        ownerMetaAddress: aliceEncoded,
        chain: 'ethereum',
      })

      // Transfer both to recipient
      const transfer1 = nft.transferPrivately({
        nft: nft1,
        recipientMetaAddress: recipientEncoded,
      })

      const transfer2 = nft.transferPrivately({
        nft: nft2,
        recipientMetaAddress: recipientEncoded,
      })

      // Create a transfer to someone else (noise)
      const charlie = generateStealthMetaAddress('ethereum', 'Charlie')
      const charlieEncoded = encodeStealthMetaAddress(charlie.metaAddress)

      const nft3 = nft.createPrivateOwnership({
        nftContract: '0x1234567890abcdef1234567890abcdef12345678',
        tokenId: '9999',
        ownerMetaAddress: aliceEncoded,
        chain: 'ethereum',
      })

      const transfer3 = nft.transferPrivately({
        nft: nft3,
        recipientMetaAddress: charlieEncoded,
      })

      // Recipient scans all transfers
      const transfers = [transfer1.transfer, transfer2.transfer, transfer3.transfer]

      const scanKeyBytes = hexToBytes(recipient.spendingPrivateKey.slice(2))
      const viewingKeyBytes = hexToBytes(recipient.viewingPrivateKey.slice(2))

      const owned = nft.scanForNFTs(scanKeyBytes, viewingKeyBytes, transfers)

      // Should find 2 NFTs (not the one sent to Charlie)
      expect(owned).toHaveLength(2)

      // Check NFT details
      const nftContracts = owned.map((n) => n.nftContract).sort()
      expect(nftContracts).toEqual([
        '0x60e4d786628fea6478f785a6d7e704777c86a7c6',
        '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d',
      ])

      // Each owned NFT has correct structure
      for (const ownedNFT of owned) {
        expect(ownedNFT.nftContract).toBeDefined()
        expect(ownedNFT.tokenId).toBeDefined()
        expect(ownedNFT.ownerStealth).toBeDefined()
        expect(ownedNFT.ownership).toBeDefined()
        expect(ownedNFT.chain).toBe('ethereum')
      }
    })

    it('should scan and find owned NFTs (ed25519)', () => {
      const nft = new PrivateNFT()

      // Recipient's keys (Solana)
      const recipient = generateEd25519StealthMetaAddress('solana')
      const recipientEncoded = encodeStealthMetaAddress(recipient.metaAddress)

      // Create and transfer NFTs
      const alice = generateEd25519StealthMetaAddress('solana')
      const aliceEncoded = encodeStealthMetaAddress(alice.metaAddress)

      const nft1 = nft.createPrivateOwnership({
        nftContract: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        tokenId: '1',
        ownerMetaAddress: aliceEncoded,
        chain: 'solana',
      })

      const transfer1 = nft.transferPrivately({
        nft: nft1,
        recipientMetaAddress: recipientEncoded,
      })

      // Scan
      const scanKeyBytes = hexToBytes(recipient.spendingPrivateKey.slice(2))
      const viewingKeyBytes = hexToBytes(recipient.viewingPrivateKey.slice(2))

      const owned = nft.scanForNFTs(scanKeyBytes, viewingKeyBytes, [transfer1.transfer])

      expect(owned).toHaveLength(1)
      expect(owned[0].chain).toBe('solana')
      expect(owned[0].tokenId).toBe('1')
    })

    it('should return empty array when no NFTs match', () => {
      const nft = new PrivateNFT()

      // Recipient who owns nothing
      const bob = generateStealthMetaAddress('ethereum')

      // Create transfers to someone else
      const alice = generateStealthMetaAddress('ethereum')
      const aliceEncoded = encodeStealthMetaAddress(alice.metaAddress)

      const charlie = generateStealthMetaAddress('ethereum')
      const charlieEncoded = encodeStealthMetaAddress(charlie.metaAddress)

      const nft1 = nft.createPrivateOwnership({
        nftContract: '0x1234567890abcdef1234567890abcdef12345678',
        tokenId: '1',
        ownerMetaAddress: aliceEncoded,
        chain: 'ethereum',
      })

      const transfer1 = nft.transferPrivately({
        nft: nft1,
        recipientMetaAddress: charlieEncoded,
      })

      // Bob scans
      const scanKeyBytes = hexToBytes(bob.spendingPrivateKey.slice(2))
      const viewingKeyBytes = hexToBytes(bob.viewingPrivateKey.slice(2))

      const owned = nft.scanForNFTs(scanKeyBytes, viewingKeyBytes, [transfer1.transfer])

      expect(owned).toHaveLength(0)
    })

    it('should handle empty transfer list', () => {
      const nft = new PrivateNFT()

      const bob = generateStealthMetaAddress('ethereum')

      const scanKeyBytes = hexToBytes(bob.spendingPrivateKey.slice(2))
      const viewingKeyBytes = hexToBytes(bob.viewingPrivateKey.slice(2))

      const owned = nft.scanForNFTs(scanKeyBytes, viewingKeyBytes, [])

      expect(owned).toHaveLength(0)
    })

    it('should skip invalid transfers gracefully', () => {
      const nft = new PrivateNFT()

      const bob = generateStealthMetaAddress('ethereum')
      const bobEncoded = encodeStealthMetaAddress(bob.metaAddress)

      const alice = generateStealthMetaAddress('ethereum')
      const aliceEncoded = encodeStealthMetaAddress(alice.metaAddress)

      const nft1 = nft.createPrivateOwnership({
        nftContract: '0x1234567890abcdef1234567890abcdef12345678',
        tokenId: '1',
        ownerMetaAddress: aliceEncoded,
        chain: 'ethereum',
      })

      const validTransfer = nft.transferPrivately({
        nft: nft1,
        recipientMetaAddress: bobEncoded,
      })

      // Mix valid and invalid transfers
      const transfers = [
        validTransfer.transfer,
        null as unknown as any,
        { invalid: 'transfer' } as any as unknown as object,
        { nftContract: '0xabc', newOwnerStealth: null } as any as unknown as object,
      ]

      const scanKeyBytes = hexToBytes(bob.spendingPrivateKey.slice(2))
      const viewingKeyBytes = hexToBytes(bob.viewingPrivateKey.slice(2))

      const owned = nft.scanForNFTs(scanKeyBytes, viewingKeyBytes, transfers)

      // Should find only the valid one
      expect(owned).toHaveLength(1)
    })

    it('should throw error for invalid scan key', () => {
      const nft = new PrivateNFT()

      expect(() => {
        nft.scanForNFTs(new Uint8Array(16), new Uint8Array(32), [])
      }).toThrow('scanKey must be 32 bytes')
    })

    it('should throw error for invalid viewing key', () => {
      const nft = new PrivateNFT()

      expect(() => {
        nft.scanForNFTs(new Uint8Array(32), new Uint8Array(16), [])
      }).toThrow('viewingKey must be 32 bytes')
    })

    it('should throw error for non-array transfers', () => {
      const nft = new PrivateNFT()

      expect(() => {
        nft.scanForNFTs(new Uint8Array(32), new Uint8Array(32), 'not-an-array' as unknown as string)
      }).toThrow('transfers must be an array')
    })
  })

  describe('End-to-end scenarios', () => {
    it('should support anonymous NFT gallery proof', () => {
      const nft = new PrivateNFT()

      // Alice creates stealth meta-address
      const alice = generateStealthMetaAddress('ethereum', 'Alice NFT Wallet')
      const aliceEncoded = encodeStealthMetaAddress(alice.metaAddress)

      // Create private ownership records for Alice's NFTs
      const nft1 = nft.createPrivateOwnership({
        nftContract: '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d', // BAYC
        tokenId: '1234',
        ownerMetaAddress: aliceEncoded,
        chain: 'ethereum',
      })

      const nft2 = nft.createPrivateOwnership({
        nftContract: '0x60e4d786628fea6478f785a6d7e704777c86a7c6', // MAYC
        tokenId: '5678',
        ownerMetaAddress: aliceEncoded,
        chain: 'ethereum',
      })

      // Different stealth addresses (unlinkable)
      expect(nft1.ownerStealth.address).not.toBe(nft2.ownerStealth.address)

      // Alice proves ownership of BAYC to access gated content
      const recovery1 = deriveStealthPrivateKey(
        nft1.ownerStealth,
        alice.spendingPrivateKey,
        alice.viewingPrivateKey
      )

      const proof1 = nft.proveOwnership({
        ownership: nft1,
        challenge: 'access-exclusive-content-' + Date.now(),
        stealthPrivateKey: recovery1.privateKey,
      })

      // Verifier checks proof
      const result1 = nft.verifyOwnership(proof1)
      expect(result1.valid).toBe(true)
      expect(result1.nftContract).toBe('0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d')
      expect(result1.tokenId).toBe('1234')

      // Alice can also prove MAYC ownership separately
      const recovery2 = deriveStealthPrivateKey(
        nft2.ownerStealth,
        alice.spendingPrivateKey,
        alice.viewingPrivateKey
      )

      const proof2 = nft.proveOwnership({
        ownership: nft2,
        challenge: 'vote-in-dao-' + Date.now(),
        stealthPrivateKey: recovery2.privateKey,
      })

      const result2 = nft.verifyOwnership(proof2)
      expect(result2.valid).toBe(true)
      expect(result2.nftContract).toBe('0x60e4d786628fea6478f785a6d7e704777c86a7c6')

      // Proofs cannot be linked to each other
      expect(proof1.stealthHash).not.toBe(proof2.stealthHash)
    })

    it('should support multi-chain NFT ownership', () => {
      const nft = new PrivateNFT()

      // Ethereum NFT
      const ethKeys = generateStealthMetaAddress('ethereum')
      const ethEncoded = encodeStealthMetaAddress(ethKeys.metaAddress)

      const ethOwnership = nft.createPrivateOwnership({
        nftContract: '0x1234567890abcdef1234567890abcdef12345678',
        tokenId: '1',
        ownerMetaAddress: ethEncoded,
        chain: 'ethereum',
      })

      // Solana NFT
      const solKeys = generateEd25519StealthMetaAddress('solana')
      const solEncoded = encodeStealthMetaAddress(solKeys.metaAddress)

      const solOwnership = nft.createPrivateOwnership({
        nftContract: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        tokenId: '2',
        ownerMetaAddress: solEncoded,
        chain: 'solana',
      })

      expect(ethOwnership.chain).toBe('ethereum')
      expect(solOwnership.chain).toBe('solana')
      expect(ethOwnership.ownerStealth.address.length).toBe(68) // 33 bytes compressed
      expect(solOwnership.ownerStealth.address.length).toBe(66) // 32 bytes ed25519
    })

    it('should prevent replay attacks with different challenges', () => {
      const nft = new PrivateNFT()

      const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
        generateStealthMetaAddress('ethereum')
      const encoded = encodeStealthMetaAddress(metaAddress)

      const ownership = nft.createPrivateOwnership({
        nftContract: '0x1234567890abcdef1234567890abcdef12345678',
        tokenId: '42',
        ownerMetaAddress: encoded,
        chain: 'ethereum',
      })

      const recovery = deriveStealthPrivateKey(
        ownership.ownerStealth,
        spendingPrivateKey,
        viewingPrivateKey
      )

      // Generate proof for challenge 1
      const proof1 = nft.proveOwnership({
        ownership,
        challenge: 'session-1-' + Date.now(),
        stealthPrivateKey: recovery.privateKey,
      })

      // Verify with correct challenge
      const result1 = nft.verifyOwnership(proof1)
      expect(result1.valid).toBe(true)
      expect(result1.challenge).toBe(proof1.challenge)

      // Generate proof for different challenge
      const proof2 = nft.proveOwnership({
        ownership,
        challenge: 'session-2-' + Date.now(),
        stealthPrivateKey: recovery.privateKey,
      })

      // Different challenges produce different proofs
      expect(proof1.proof.proof).not.toBe(proof2.proof.proof)
      expect(proof1.proof.publicInputs[0]).not.toBe(proof2.proof.publicInputs[0])
    })

    it('should support full transfer and scan workflow', () => {
      const nft = new PrivateNFT()

      // Alice owns an NFT initially
      const alice = generateStealthMetaAddress('ethereum', 'Alice')
      const aliceEncoded = encodeStealthMetaAddress(alice.metaAddress)

      const ownership = nft.createPrivateOwnership({
        nftContract: '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d',
        tokenId: '1234',
        ownerMetaAddress: aliceEncoded,
        chain: 'ethereum',
      })

      // Bob's keys
      const bob = generateStealthMetaAddress('ethereum', 'Bob')
      const bobEncoded = encodeStealthMetaAddress(bob.metaAddress)

      // Alice transfers NFT to Bob
      const transfer1 = nft.transferPrivately({
        nft: ownership,
        recipientMetaAddress: bobEncoded,
      })

      // Carol's keys
      const carol = generateStealthMetaAddress('ethereum', 'Carol')
      const carolEncoded = encodeStealthMetaAddress(carol.metaAddress)

      // Alice also transfers another NFT to Carol (noise)
      const ownership2 = nft.createPrivateOwnership({
        nftContract: '0x60e4d786628fea6478f785a6d7e704777c86a7c6',
        tokenId: '5678',
        ownerMetaAddress: aliceEncoded,
        chain: 'ethereum',
      })

      const transfer2 = nft.transferPrivately({
        nft: ownership2,
        recipientMetaAddress: carolEncoded,
      })

      // Publish transfers (simulated)
      const publishedTransfers = [transfer1.transfer, transfer2.transfer]

      // Bob scans for his NFTs
      const bobScanKey = hexToBytes(bob.spendingPrivateKey.slice(2))
      const bobViewingKey = hexToBytes(bob.viewingPrivateKey.slice(2))

      const bobNFTs = nft.scanForNFTs(bobScanKey, bobViewingKey, publishedTransfers)

      // Bob should find 1 NFT
      expect(bobNFTs).toHaveLength(1)
      expect(bobNFTs[0].nftContract).toBe('0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d')
      expect(bobNFTs[0].tokenId).toBe('1234')

      // Carol scans for her NFTs
      const carolScanKey = hexToBytes(carol.spendingPrivateKey.slice(2))
      const carolViewingKey = hexToBytes(carol.viewingPrivateKey.slice(2))

      const carolNFTs = nft.scanForNFTs(carolScanKey, carolViewingKey, publishedTransfers)

      // Carol should find 1 NFT
      expect(carolNFTs).toHaveLength(1)
      expect(carolNFTs[0].nftContract).toBe('0x60e4d786628fea6478f785a6d7e704777c86a7c6')
      expect(carolNFTs[0].tokenId).toBe('5678')

      // Bob can now prove ownership of his NFT
      const bobOwnership = bobNFTs[0].ownership

      const bobRecovery = deriveStealthPrivateKey(
        bobOwnership.ownerStealth,
        bob.spendingPrivateKey,
        bob.viewingPrivateKey
      )

      const bobProof = nft.proveOwnership({
        ownership: bobOwnership,
        challenge: 'prove-bob-owns-nft',
        stealthPrivateKey: bobRecovery.privateKey,
      })

      const bobVerification = nft.verifyOwnership(bobProof)

      expect(bobVerification.valid).toBe(true)
      expect(bobVerification.nftContract).toBe('0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d')

      // Unlinkability: Bob's stealth address is different from Alice's
      expect(bobOwnership.ownerStealth.address).not.toBe(ownership.ownerStealth.address)
    })
  })
})
