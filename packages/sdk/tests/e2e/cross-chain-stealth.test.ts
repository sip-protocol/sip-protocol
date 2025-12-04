/**
 * E2E Cross-Chain Stealth Address Tests
 *
 * Comprehensive integration tests for multi-curve stealth addresses across different chains.
 * Issue #97: Cross-chain stealth integration tests
 *
 * Test Scenarios:
 * - secp256k1 → secp256k1 (EVM → EVM, e.g., ETH → Polygon)
 * - secp256k1 → ed25519 (EVM → Solana/NEAR)
 * - ed25519 → ed25519 (Solana → NEAR)
 * - ed25519 → secp256k1 (Solana → EVM)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { secp256k1 } from '@noble/curves/secp256k1'
import { ed25519 } from '@noble/curves/ed25519'
import { hexToBytes, bytesToHex } from '@noble/hashes/utils'
import { PrivacyLevel, type ChainId, type HexString } from '@sip-protocol/types'

// Helper to convert bytes to bigint (little-endian, for ed25519 scalars)
function bytesToBigIntLE(bytes: Uint8Array): bigint {
  let result = 0n
  for (let i = bytes.length - 1; i >= 0; i--) {
    result = (result << 8n) | BigInt(bytes[i])
  }
  return result
}

// Helper to derive public key from ed25519 scalar (not seed)
function scalarToPublicKey(scalarHex: HexString): Uint8Array {
  const scalarBytes = hexToBytes(scalarHex.slice(2))
  const scalar = bytesToBigIntLE(scalarBytes)
  const point = ed25519.ExtendedPoint.BASE.multiply(scalar)
  return point.toRawBytes()
}
import {
  generateStealthMetaAddress,
  generateStealthAddress,
  deriveStealthPrivateKey,
  checkStealthAddress,
  encodeStealthMetaAddress,
  decodeStealthMetaAddress,
  generateEd25519StealthMetaAddress,
  generateEd25519StealthAddress,
  deriveEd25519StealthPrivateKey,
  checkEd25519StealthAddress,
  isEd25519Chain,
  getCurveForChain,
  ed25519PublicKeyToSolanaAddress,
  ed25519PublicKeyToNearAddress,
  publicKeyToEthAddress,
  type StealthCurve,
} from '../../src/stealth'
import { NEARIntentsAdapter, type SwapRequest } from '../../src/adapters/near-intents'
import { NATIVE_TOKENS } from './helpers'

// ─── Test Configuration ───────────────────────────────────────────────────────

interface ChainPair {
  source: ChainId
  destination: ChainId
  sourceCurve: StealthCurve
  destCurve: StealthCurve
  description: string
}

const CROSS_CHAIN_PAIRS: ChainPair[] = [
  // secp256k1 → secp256k1
  { source: 'ethereum', destination: 'polygon', sourceCurve: 'secp256k1', destCurve: 'secp256k1', description: 'ETH → Polygon' },
  { source: 'ethereum', destination: 'arbitrum', sourceCurve: 'secp256k1', destCurve: 'secp256k1', description: 'ETH → Arbitrum' },
  { source: 'polygon', destination: 'base', sourceCurve: 'secp256k1', destCurve: 'secp256k1', description: 'Polygon → Base' },
  { source: 'ethereum', destination: 'zcash', sourceCurve: 'secp256k1', destCurve: 'secp256k1', description: 'ETH → ZEC' },

  // secp256k1 → ed25519
  { source: 'ethereum', destination: 'solana', sourceCurve: 'secp256k1', destCurve: 'ed25519', description: 'ETH → SOL' },
  { source: 'ethereum', destination: 'near', sourceCurve: 'secp256k1', destCurve: 'ed25519', description: 'ETH → NEAR' },
  { source: 'polygon', destination: 'solana', sourceCurve: 'secp256k1', destCurve: 'ed25519', description: 'Polygon → SOL' },

  // ed25519 → ed25519
  { source: 'solana', destination: 'near', sourceCurve: 'ed25519', destCurve: 'ed25519', description: 'SOL → NEAR' },
  { source: 'near', destination: 'solana', sourceCurve: 'ed25519', destCurve: 'ed25519', description: 'NEAR → SOL' },

  // ed25519 → secp256k1
  { source: 'solana', destination: 'ethereum', sourceCurve: 'ed25519', destCurve: 'secp256k1', description: 'SOL → ETH' },
  { source: 'near', destination: 'ethereum', sourceCurve: 'ed25519', destCurve: 'secp256k1', description: 'NEAR → ETH' },
  { source: 'solana', destination: 'polygon', sourceCurve: 'ed25519', destCurve: 'secp256k1', description: 'SOL → Polygon' },
]

// ─── Test Suites ──────────────────────────────────────────────────────────────

describe('E2E: Cross-Chain Stealth Addresses', () => {
  // ─── Curve Detection Tests ────────────────────────────────────────────────────

  describe('Curve Detection', () => {
    it('should correctly identify secp256k1 chains', () => {
      const secp256k1Chains: ChainId[] = ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'zcash']

      for (const chain of secp256k1Chains) {
        expect(getCurveForChain(chain)).toBe('secp256k1')
        expect(isEd25519Chain(chain)).toBe(false)
      }
    })

    it('should correctly identify ed25519 chains', () => {
      const ed25519Chains: ChainId[] = ['solana', 'near']

      for (const chain of ed25519Chains) {
        expect(getCurveForChain(chain)).toBe('ed25519')
        expect(isEd25519Chain(chain)).toBe(true)
      }
    })
  })

  // ─── secp256k1 → secp256k1 Tests ──────────────────────────────────────────────

  describe('secp256k1 → secp256k1 (EVM → EVM)', () => {
    const evmPairs = CROSS_CHAIN_PAIRS.filter(p => p.sourceCurve === 'secp256k1' && p.destCurve === 'secp256k1')

    it.each(evmPairs)('should complete full stealth flow for $description', ({ source, destination }) => {
      // 1. Recipient generates meta-address for destination chain
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } = generateStealthMetaAddress(destination)

      expect(getCurveForChain(destination)).toBe('secp256k1')
      expect(metaAddress.spendingKey.length).toBe(68) // 0x + 66 hex (33 bytes compressed)
      expect(metaAddress.viewingKey.length).toBe(68)

      // 2. Sender generates stealth address
      const { stealthAddress, sharedSecret } = generateStealthAddress(metaAddress)

      expect(stealthAddress.address.length).toBe(68)
      expect(stealthAddress.ephemeralPublicKey.length).toBe(68)
      expect(sharedSecret.length).toBe(66) // 0x + 64 hex (32 bytes)

      // 3. Recipient can detect the stealth address
      const isOurs = checkStealthAddress(stealthAddress, spendingPrivateKey, viewingPrivateKey)
      expect(isOurs).toBe(true)

      // 4. Recipient can derive the private key
      const recovery = deriveStealthPrivateKey(stealthAddress, spendingPrivateKey, viewingPrivateKey)

      // Verify derived key matches stealth address
      const derivedPubKey = secp256k1.getPublicKey(hexToBytes(recovery.privateKey.slice(2)), true)
      expect('0x' + bytesToHex(derivedPubKey)).toBe(stealthAddress.address)

      // 5. Verify ETH address derivation
      const ethAddress = publicKeyToEthAddress(stealthAddress.address)
      expect(ethAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
    })

    it('should generate unique stealth addresses for same recipient', () => {
      const { metaAddress } = generateStealthMetaAddress('ethereum')

      const addresses = Array.from({ length: 10 }, () =>
        generateStealthAddress(metaAddress).stealthAddress.address
      )

      const unique = new Set(addresses)
      expect(unique.size).toBe(10)
    })

    it('should support all EVM chains with same meta-address format', () => {
      const evmChains: ChainId[] = ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base']

      for (const chain of evmChains) {
        const { metaAddress } = generateStealthMetaAddress(chain)
        const encoded = encodeStealthMetaAddress(metaAddress)

        expect(encoded.startsWith('sip:')).toBe(true)
        expect(encoded).toContain(`:${chain}:`)

        const decoded = decodeStealthMetaAddress(encoded)
        expect(decoded.chain).toBe(chain)
        expect(decoded.spendingKey).toBe(metaAddress.spendingKey)
      }
    })
  })

  // ─── ed25519 → ed25519 Tests ──────────────────────────────────────────────────

  describe('ed25519 → ed25519 (Solana/NEAR)', () => {
    const ed25519Pairs = CROSS_CHAIN_PAIRS.filter(p => p.sourceCurve === 'ed25519' && p.destCurve === 'ed25519')

    it.each(ed25519Pairs)('should complete full stealth flow for $description', ({ source, destination }) => {
      // 1. Recipient generates ed25519 meta-address for destination chain
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } = generateEd25519StealthMetaAddress(destination)

      expect(getCurveForChain(destination)).toBe('ed25519')
      expect(metaAddress.spendingKey.length).toBe(66) // 0x + 64 hex (32 bytes)
      expect(metaAddress.viewingKey.length).toBe(66)

      // 2. Sender generates stealth address
      const { stealthAddress, sharedSecret } = generateEd25519StealthAddress(metaAddress)

      expect(stealthAddress.address.length).toBe(66) // 32-byte ed25519 public key
      expect(stealthAddress.ephemeralPublicKey.length).toBe(66)
      expect(sharedSecret.length).toBe(66)

      // 3. Recipient can detect the stealth address
      const isOurs = checkEd25519StealthAddress(stealthAddress, spendingPrivateKey, viewingPrivateKey)
      expect(isOurs).toBe(true)

      // 4. Recipient can derive the private key
      const recovery = deriveEd25519StealthPrivateKey(stealthAddress, spendingPrivateKey, viewingPrivateKey)

      // Verify derived key matches stealth address (using scalar multiplication, not getPublicKey)
      const derivedPubKey = scalarToPublicKey(recovery.privateKey)
      expect('0x' + bytesToHex(derivedPubKey)).toBe(stealthAddress.address)
    })

    it('should derive valid Solana addresses from ed25519 stealth keys', () => {
      const { metaAddress } = generateEd25519StealthMetaAddress('solana')
      const { stealthAddress } = generateEd25519StealthAddress(metaAddress)

      const solanaAddress = ed25519PublicKeyToSolanaAddress(stealthAddress.address)

      // Solana addresses are base58 encoded, 32-44 chars
      expect(solanaAddress.length).toBeGreaterThanOrEqual(32)
      expect(solanaAddress.length).toBeLessThanOrEqual(44)
      expect(solanaAddress).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/)
    })

    it('should derive valid NEAR addresses from ed25519 stealth keys', () => {
      const { metaAddress } = generateEd25519StealthMetaAddress('near')
      const { stealthAddress } = generateEd25519StealthAddress(metaAddress)

      const nearAddress = ed25519PublicKeyToNearAddress(stealthAddress.address)

      // NEAR implicit addresses are hex-encoded 32-byte public keys (64 chars)
      expect(nearAddress.length).toBe(64)
      expect(nearAddress).toMatch(/^[0-9a-f]{64}$/)
    })

    it('should generate unique ed25519 stealth addresses for same recipient', () => {
      const { metaAddress } = generateEd25519StealthMetaAddress('solana')

      const addresses = Array.from({ length: 10 }, () =>
        generateEd25519StealthAddress(metaAddress).stealthAddress.address
      )

      const unique = new Set(addresses)
      expect(unique.size).toBe(10)
    })
  })

  // ─── Cross-Curve Tests ────────────────────────────────────────────────────────

  describe('Cross-Curve Scenarios', () => {
    describe('secp256k1 sender → ed25519 recipient', () => {
      it('should reject secp256k1 meta-address for Solana output', () => {
        // User has secp256k1 meta-address (EVM) but wants to receive on Solana
        const { metaAddress: secp256k1Meta } = generateStealthMetaAddress('ethereum')

        // Trying to decode as Solana should fail
        const encoded = `sip:solana:${secp256k1Meta.spendingKey}:${secp256k1Meta.viewingKey}`
        expect(() => decodeStealthMetaAddress(encoded)).toThrow('ed25519')
      })

      it('should require ed25519 meta-address for Solana recipient', () => {
        const { metaAddress } = generateEd25519StealthMetaAddress('solana')
        const encoded = encodeStealthMetaAddress(metaAddress)
        const decoded = decodeStealthMetaAddress(encoded)

        expect(decoded.chain).toBe('solana')
        expect(decoded.spendingKey.length).toBe(66) // ed25519 key size
      })
    })

    describe('ed25519 sender → secp256k1 recipient', () => {
      it('should reject ed25519 meta-address for Ethereum output', () => {
        // User has ed25519 meta-address (Solana) but wants to receive on Ethereum
        const { metaAddress: ed25519Meta } = generateEd25519StealthMetaAddress('solana')

        // Trying to decode as Ethereum should fail
        const encoded = `sip:ethereum:${ed25519Meta.spendingKey}:${ed25519Meta.viewingKey}`
        expect(() => decodeStealthMetaAddress(encoded)).toThrow('secp256k1')
      })

      it('should require secp256k1 meta-address for Ethereum recipient', () => {
        const { metaAddress } = generateStealthMetaAddress('ethereum')
        const encoded = encodeStealthMetaAddress(metaAddress)
        const decoded = decodeStealthMetaAddress(encoded)

        expect(decoded.chain).toBe('ethereum')
        expect(decoded.spendingKey.length).toBe(68) // secp256k1 key size
      })
    })
  })

  // ─── Meta-Address Format Tests ────────────────────────────────────────────────

  describe('Meta-Address Format', () => {
    it('should roundtrip secp256k1 meta-addresses', () => {
      const chains: ChainId[] = ['ethereum', 'polygon', 'arbitrum', 'zcash']

      for (const chain of chains) {
        const { metaAddress } = generateStealthMetaAddress(chain)
        const encoded = encodeStealthMetaAddress(metaAddress)
        const decoded = decodeStealthMetaAddress(encoded)

        expect(decoded.chain).toBe(chain)
        expect(decoded.spendingKey).toBe(metaAddress.spendingKey)
        expect(decoded.viewingKey).toBe(metaAddress.viewingKey)
      }
    })

    it('should roundtrip ed25519 meta-addresses', () => {
      const chains: ChainId[] = ['solana', 'near']

      for (const chain of chains) {
        const { metaAddress } = generateEd25519StealthMetaAddress(chain)
        const encoded = encodeStealthMetaAddress(metaAddress)
        const decoded = decodeStealthMetaAddress(encoded)

        expect(decoded.chain).toBe(chain)
        expect(decoded.spendingKey).toBe(metaAddress.spendingKey)
        expect(decoded.viewingKey).toBe(metaAddress.viewingKey)
      }
    })

    it('should produce different format lengths for different curves', () => {
      const secp256k1Meta = generateStealthMetaAddress('ethereum').metaAddress
      const ed25519Meta = generateEd25519StealthMetaAddress('solana').metaAddress

      const secp256k1Encoded = encodeStealthMetaAddress(secp256k1Meta)
      const ed25519Encoded = encodeStealthMetaAddress(ed25519Meta)

      // secp256k1 keys are longer (33 bytes compressed vs 32 bytes)
      expect(secp256k1Encoded.length).toBeGreaterThan(ed25519Encoded.length)
    })
  })

  // ─── Privacy Level Tests ──────────────────────────────────────────────────────

  describe('Privacy Levels', () => {
    const privacyLevels = [PrivacyLevel.SHIELDED, PrivacyLevel.COMPLIANT]

    describe.each(privacyLevels)('with %s mode', (privacyLevel) => {
      it('should work with secp256k1 stealth addresses', () => {
        const { metaAddress, spendingPrivateKey, viewingPrivateKey } = generateStealthMetaAddress('ethereum')
        const { stealthAddress } = generateStealthAddress(metaAddress)

        // Both modes should still generate valid stealth addresses
        expect(checkStealthAddress(stealthAddress, spendingPrivateKey, viewingPrivateKey)).toBe(true)
      })

      it('should work with ed25519 stealth addresses', () => {
        const { metaAddress, spendingPrivateKey, viewingPrivateKey } = generateEd25519StealthMetaAddress('solana')
        const { stealthAddress } = generateEd25519StealthAddress(metaAddress)

        expect(checkEd25519StealthAddress(stealthAddress, spendingPrivateKey, viewingPrivateKey)).toBe(true)
      })
    })
  })

  // ─── Error Handling Tests ─────────────────────────────────────────────────────

  describe('Error Handling', () => {
    it('should reject invalid meta-address format', () => {
      expect(() => decodeStealthMetaAddress('invalid')).toThrow()
      expect(() => decodeStealthMetaAddress('sip:ethereum:0x123')).toThrow()
      expect(() => decodeStealthMetaAddress('')).toThrow()
    })

    it('should reject unknown chain identifier', () => {
      const key = '0x' + 'ab'.repeat(33) as HexString
      expect(() => decodeStealthMetaAddress(`sip:polkadot:${key}:${key}`)).toThrow('chain')
    })

    it('should reject key size mismatch for chain', () => {
      // 32-byte ed25519 key for secp256k1 chain
      const ed25519Key = '0x' + 'ab'.repeat(32) as HexString
      expect(() => decodeStealthMetaAddress(`sip:ethereum:${ed25519Key}:${ed25519Key}`)).toThrow()

      // 33-byte secp256k1 key for ed25519 chain
      const secp256k1Key = '0x02' + 'ab'.repeat(32) as HexString
      expect(() => decodeStealthMetaAddress(`sip:solana:${secp256k1Key}:${secp256k1Key}`)).toThrow()
    })
  })

  // ─── Performance Benchmarks ───────────────────────────────────────────────────

  describe('Performance Benchmarks', () => {
    const iterations = 50

    it('should generate secp256k1 stealth addresses efficiently', () => {
      const { metaAddress } = generateStealthMetaAddress('ethereum')

      const start = performance.now()
      for (let i = 0; i < iterations; i++) {
        generateStealthAddress(metaAddress)
      }
      const duration = performance.now() - start

      const avgTime = duration / iterations
      expect(avgTime).toBeLessThan(50) // < 50ms per operation
    })

    it('should generate ed25519 stealth addresses efficiently', () => {
      const { metaAddress } = generateEd25519StealthMetaAddress('solana')

      const start = performance.now()
      for (let i = 0; i < iterations; i++) {
        generateEd25519StealthAddress(metaAddress)
      }
      const duration = performance.now() - start

      const avgTime = duration / iterations
      expect(avgTime).toBeLessThan(50) // < 50ms per operation
    })

    it('should scan secp256k1 addresses efficiently', () => {
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } = generateStealthMetaAddress('ethereum')
      const addresses = Array.from({ length: iterations }, () =>
        generateStealthAddress(metaAddress).stealthAddress
      )

      const start = performance.now()
      for (const addr of addresses) {
        checkStealthAddress(addr, spendingPrivateKey, viewingPrivateKey)
      }
      const duration = performance.now() - start

      const avgTime = duration / iterations
      expect(avgTime).toBeLessThan(20) // < 20ms per scan
    })

    it('should scan ed25519 addresses efficiently', () => {
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } = generateEd25519StealthMetaAddress('solana')
      const addresses = Array.from({ length: iterations }, () =>
        generateEd25519StealthAddress(metaAddress).stealthAddress
      )

      const start = performance.now()
      for (const addr of addresses) {
        checkEd25519StealthAddress(addr, spendingPrivateKey, viewingPrivateKey)
      }
      const duration = performance.now() - start

      const avgTime = duration / iterations
      expect(avgTime).toBeLessThan(20) // < 20ms per scan
    })

    it('should derive private keys efficiently', () => {
      const { metaAddress, spendingPrivateKey, viewingPrivateKey } = generateStealthMetaAddress('ethereum')
      const addresses = Array.from({ length: iterations }, () =>
        generateStealthAddress(metaAddress).stealthAddress
      )

      const start = performance.now()
      for (const addr of addresses) {
        deriveStealthPrivateKey(addr, spendingPrivateKey, viewingPrivateKey)
      }
      const duration = performance.now() - start

      const avgTime = duration / iterations
      expect(avgTime).toBeLessThan(20) // < 20ms per derivation
    })
  })

  // ─── NEAR Intents Adapter Integration ─────────────────────────────────────────

  describe('NEAR Intents Adapter Integration', () => {
    let adapter: NEARIntentsAdapter

    beforeEach(() => {
      adapter = new NEARIntentsAdapter()
    })

    describe('EVM output (secp256k1)', () => {
      it('should prepare swap with secp256k1 stealth for ETH output', async () => {
        const { metaAddress } = generateStealthMetaAddress('ethereum')

        const request: SwapRequest = {
          requestId: `test_${Date.now()}`,
          privacyLevel: PrivacyLevel.SHIELDED,
          inputAsset: NATIVE_TOKENS.near,
          inputAmount: 1000000000000000000000000n, // 1 NEAR
          outputAsset: NATIVE_TOKENS.ethereum,
        }

        const prepared = await adapter.prepareSwap(request, metaAddress, 'user.near')

        expect(prepared.curve).toBe('secp256k1')
        expect(prepared.stealthAddress).toBeDefined()
        expect(prepared.stealthAddress!.address.length).toBe(68) // secp256k1 compressed

        // Recipient should be ETH address
        expect(prepared.quoteRequest.recipient).toMatch(/^0x[a-fA-F0-9]{40}$/)
      })
    })

    describe('Solana output (ed25519)', () => {
      it('should prepare swap with ed25519 stealth for SOL output', async () => {
        const { metaAddress } = generateEd25519StealthMetaAddress('solana')

        const request: SwapRequest = {
          requestId: `test_${Date.now()}`,
          privacyLevel: PrivacyLevel.SHIELDED,
          inputAsset: NATIVE_TOKENS.near,
          inputAmount: 1000000000000000000000000n,
          outputAsset: NATIVE_TOKENS.solana,
        }

        const prepared = await adapter.prepareSwap(request, metaAddress, 'user.near')

        expect(prepared.curve).toBe('ed25519')
        expect(prepared.stealthAddress).toBeDefined()
        expect(prepared.stealthAddress!.address.length).toBe(66) // ed25519

        // Recipient should be Solana base58 address
        expect(prepared.nativeRecipientAddress).toBeDefined()
        expect(prepared.nativeRecipientAddress!.length).toBeGreaterThanOrEqual(32)
      })
    })

    describe('NEAR output (ed25519)', () => {
      it('should prepare swap with ed25519 stealth for NEAR output', async () => {
        const { metaAddress } = generateEd25519StealthMetaAddress('near')

        const request: SwapRequest = {
          requestId: `test_${Date.now()}`,
          privacyLevel: PrivacyLevel.SHIELDED,
          inputAsset: NATIVE_TOKENS.ethereum,
          inputAmount: 1000000000000000000n, // 1 ETH
          outputAsset: NATIVE_TOKENS.near,
        }

        const prepared = await adapter.prepareSwap(request, metaAddress, '0x1234567890123456789012345678901234567890')

        expect(prepared.curve).toBe('ed25519')
        expect(prepared.stealthAddress).toBeDefined()
        expect(prepared.stealthAddress!.address.length).toBe(66) // ed25519

        // Recipient should be NEAR implicit address (64 hex chars)
        expect(prepared.nativeRecipientAddress).toBeDefined()
        expect(prepared.nativeRecipientAddress!.length).toBe(64)
      })
    })

    describe('Cross-curve refunds', () => {
      it('should handle cross-curve refund with explicit sender address', async () => {
        // ed25519 meta-address, secp256k1 input chain
        const { metaAddress } = generateEd25519StealthMetaAddress('solana')

        const request: SwapRequest = {
          requestId: `test_${Date.now()}`,
          privacyLevel: PrivacyLevel.SHIELDED,
          inputAsset: NATIVE_TOKENS.ethereum, // secp256k1
          inputAmount: 1000000000000000000n,
          outputAsset: NATIVE_TOKENS.solana, // ed25519
        }

        // Must provide sender address for cross-curve refunds
        const senderAddress = '0x1234567890123456789012345678901234567890'
        const prepared = await adapter.prepareSwap(request, metaAddress, senderAddress)

        expect(prepared.curve).toBe('ed25519')
        expect(prepared.quoteRequest.refundTo).toBe(senderAddress)
      })

      it('should reject cross-curve without sender address', async () => {
        const { metaAddress } = generateStealthMetaAddress('ethereum') // secp256k1

        const request: SwapRequest = {
          requestId: `test_${Date.now()}`,
          privacyLevel: PrivacyLevel.SHIELDED,
          inputAsset: NATIVE_TOKENS.solana, // ed25519 input
          inputAmount: 1000000000n,
          outputAsset: NATIVE_TOKENS.ethereum, // secp256k1 output
        }

        // No sender address for cross-curve refund
        await expect(adapter.prepareSwap(request, metaAddress))
          .rejects.toThrow('Cross-curve refunds not supported')
      })
    })
  })

  // ─── Security Properties ──────────────────────────────────────────────────────

  describe('Security Properties', () => {
    it('secp256k1 addresses should be unlinkable', () => {
      const { metaAddress } = generateStealthMetaAddress('ethereum')

      const addresses = Array.from({ length: 100 }, () =>
        generateStealthAddress(metaAddress).stealthAddress.address
      )

      const unique = new Set(addresses)
      expect(unique.size).toBe(100)
    })

    it('ed25519 addresses should be unlinkable', () => {
      const { metaAddress } = generateEd25519StealthMetaAddress('solana')

      const addresses = Array.from({ length: 100 }, () =>
        generateEd25519StealthAddress(metaAddress).stealthAddress.address
      )

      const unique = new Set(addresses)
      expect(unique.size).toBe(100)
    })

    it('wrong spending key should not derive matching address', () => {
      const recipient = generateStealthMetaAddress('ethereum')
      const { stealthAddress } = generateStealthAddress(recipient.metaAddress)

      // Try with wrong spending key
      const wrongSpendingKey = generateStealthMetaAddress('ethereum').spendingPrivateKey

      const recovery = deriveStealthPrivateKey(
        stealthAddress,
        wrongSpendingKey,
        recipient.viewingPrivateKey
      )

      const derivedPubKey = secp256k1.getPublicKey(hexToBytes(recovery.privateKey.slice(2)), true)
      expect('0x' + bytesToHex(derivedPubKey)).not.toBe(stealthAddress.address)
    })

    it('wrong viewing key should not match address', () => {
      const recipient = generateStealthMetaAddress('ethereum')
      const { stealthAddress } = generateStealthAddress(recipient.metaAddress)

      const wrongViewingKey = generateStealthMetaAddress('ethereum').viewingPrivateKey

      const isOurs = checkStealthAddress(
        stealthAddress,
        recipient.spendingPrivateKey,
        wrongViewingKey
      )

      expect(isOurs).toBe(false)
    })
  })
})
