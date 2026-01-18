/**
 * NEAR Privacy Operations Benchmarks
 *
 * Performance benchmarks for NEAR privacy operations.
 * Targets from #368:
 * - Stealth address generation < 10ms
 * - Commitment creation < 5ms
 *
 * Run with: pnpm test -- --run tests/benchmarks/near-privacy.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest'
import {
  generateEd25519StealthMetaAddress,
  generateEd25519StealthAddress,
  deriveEd25519StealthPrivateKey,
  checkEd25519StealthAddress,
  ed25519PublicKeyToNearAddress,
  nearAddressToEd25519PublicKey,
} from '../../src/stealth'
import { commit, verifyOpening, generateBlinding } from '../../src/commitment'
import { encryptForViewing, decryptWithViewing, generateViewingKey } from '../../src/privacy'
import type { StealthMetaAddress, StealthAddress, HexString, ViewingKey } from '@sip-protocol/types'

// ─── Test Setup ───────────────────────────────────────────────────────────────

let testMetaAddress: StealthMetaAddress
let testSpendingPrivateKey: HexString
let testViewingPrivateKey: HexString
let testViewingKey: ViewingKey

beforeAll(() => {
  const result = generateEd25519StealthMetaAddress('near')
  testMetaAddress = result.metaAddress
  testSpendingPrivateKey = result.spendingPrivateKey
  testViewingPrivateKey = result.viewingPrivateKey
  testViewingKey = generateViewingKey()
})

// ─── Stealth Address Benchmarks ───────────────────────────────────────────────

describe('NEAR Stealth Address Benchmarks', () => {
  describe('generateEd25519StealthMetaAddress', () => {
    it('performance (target: < 10ms)', () => {
      const iterations = 100
      const start = performance.now()

      for (let i = 0; i < iterations; i++) {
        generateEd25519StealthMetaAddress('near')
      }

      const elapsed = performance.now() - start
      const avgTime = elapsed / iterations

      console.log(`  generateEd25519StealthMetaAddress(): ${avgTime.toFixed(3)}ms avg`)

      // Target: < 10ms per generation
      expect(avgTime).toBeLessThan(10)
    })
  })

  describe('generateEd25519StealthAddress', () => {
    it('performance (target: < 10ms)', () => {
      const iterations = 100
      const start = performance.now()

      for (let i = 0; i < iterations; i++) {
        generateEd25519StealthAddress(testMetaAddress)
      }

      const elapsed = performance.now() - start
      const avgTime = elapsed / iterations

      console.log(`  generateEd25519StealthAddress(): ${avgTime.toFixed(3)}ms avg`)

      // Target: < 10ms per generation
      expect(avgTime).toBeLessThan(10)
    })
  })

  describe('checkEd25519StealthAddress', () => {
    it('performance (target: < 5ms)', () => {
      // Generate a stealth address to check
      const { stealthAddress } = generateEd25519StealthAddress(testMetaAddress)

      const iterations = 100
      const start = performance.now()

      for (let i = 0; i < iterations; i++) {
        checkEd25519StealthAddress(
          stealthAddress,
          testSpendingPrivateKey,
          testViewingPrivateKey
        )
      }

      const elapsed = performance.now() - start
      const avgTime = elapsed / iterations

      console.log(`  checkEd25519StealthAddress(): ${avgTime.toFixed(3)}ms avg`)

      // Target: < 5ms per check
      expect(avgTime).toBeLessThan(5)
    })
  })

  describe('deriveEd25519StealthPrivateKey', () => {
    it('performance (target: < 5ms)', () => {
      const { stealthAddress } = generateEd25519StealthAddress(testMetaAddress)

      const iterations = 100
      const start = performance.now()

      for (let i = 0; i < iterations; i++) {
        deriveEd25519StealthPrivateKey(
          stealthAddress,
          testSpendingPrivateKey,
          testViewingPrivateKey
        )
      }

      const elapsed = performance.now() - start
      const avgTime = elapsed / iterations

      console.log(`  deriveEd25519StealthPrivateKey(): ${avgTime.toFixed(3)}ms avg`)

      // Target: < 5ms per derivation
      expect(avgTime).toBeLessThan(5)
    })
  })

  describe('NEAR address conversion', () => {
    it('ed25519PublicKeyToNearAddress performance', () => {
      const { stealthAddress } = generateEd25519StealthAddress(testMetaAddress)

      const iterations = 1000
      const start = performance.now()

      for (let i = 0; i < iterations; i++) {
        ed25519PublicKeyToNearAddress(stealthAddress.address)
      }

      const elapsed = performance.now() - start
      const avgTime = elapsed / iterations

      console.log(`  ed25519PublicKeyToNearAddress(): ${avgTime.toFixed(4)}ms avg`)

      // Should be very fast (< 0.1ms)
      expect(avgTime).toBeLessThan(0.1)
    })

    it('nearAddressToEd25519PublicKey performance', () => {
      const { stealthAddress } = generateEd25519StealthAddress(testMetaAddress)
      const nearAddress = ed25519PublicKeyToNearAddress(stealthAddress.address)

      const iterations = 1000
      const start = performance.now()

      for (let i = 0; i < iterations; i++) {
        nearAddressToEd25519PublicKey(nearAddress)
      }

      const elapsed = performance.now() - start
      const avgTime = elapsed / iterations

      console.log(`  nearAddressToEd25519PublicKey(): ${avgTime.toFixed(4)}ms avg`)

      // Should be very fast (< 0.1ms)
      expect(avgTime).toBeLessThan(0.1)
    })
  })
})

// ─── Pedersen Commitment Benchmarks ───────────────────────────────────────────

describe('NEAR Pedersen Commitment Benchmarks', () => {
  describe('commit', () => {
    it('performance (target: < 5ms, first run may be slower)', () => {
      // Warm up (first run generates H point)
      commit(1000n)

      const iterations = 100
      const start = performance.now()

      for (let i = 0; i < iterations; i++) {
        commit(BigInt(i * 1000))
      }

      const elapsed = performance.now() - start
      const avgTime = elapsed / iterations

      console.log(`  commit(): ${avgTime.toFixed(3)}ms avg`)

      // Target: < 5ms per commitment (warmed up)
      expect(avgTime).toBeLessThan(10) // Allow 10ms for CI variance
    })
  })

  describe('verifyOpening', () => {
    it('performance', () => {
      const { commitment, blinding } = commit(1000000n)

      const iterations = 100
      const start = performance.now()

      for (let i = 0; i < iterations; i++) {
        verifyOpening(commitment, 1000000n, blinding)
      }

      const elapsed = performance.now() - start
      const avgTime = elapsed / iterations

      console.log(`  verifyOpening(): ${avgTime.toFixed(3)}ms avg`)

      // Target: < 10ms per verification
      expect(avgTime).toBeLessThan(10)
    })
  })

  describe('generateBlinding', () => {
    it('performance', () => {
      const iterations = 1000
      const start = performance.now()

      for (let i = 0; i < iterations; i++) {
        generateBlinding()
      }

      const elapsed = performance.now() - start
      const avgTime = elapsed / iterations

      console.log(`  generateBlinding(): ${avgTime.toFixed(4)}ms avg`)

      // Should be very fast (< 0.5ms)
      expect(avgTime).toBeLessThan(0.5)
    })
  })
})

// ─── Viewing Key Benchmarks ───────────────────────────────────────────────────

describe('NEAR Viewing Key Benchmarks', () => {
  describe('encryptForViewing', () => {
    it('performance', () => {
      const testData = {
        sender: 'alice.testnet',
        recipient: 'bob.testnet',
        amount: '1000000000000000000000000',
        timestamp: Date.now(),
      }

      const iterations = 100
      const start = performance.now()

      for (let i = 0; i < iterations; i++) {
        encryptForViewing(testData, testViewingKey)
      }

      const elapsed = performance.now() - start
      const avgTime = elapsed / iterations

      console.log(`  encryptForViewing(): ${avgTime.toFixed(3)}ms avg`)

      // Target: < 5ms per encryption
      expect(avgTime).toBeLessThan(5)
    })
  })

  describe('decryptWithViewing', () => {
    it('performance', () => {
      const testData = {
        sender: 'alice.testnet',
        recipient: 'bob.testnet',
        amount: '1000000000000000000000000',
        timestamp: Date.now(),
      }
      const encrypted = encryptForViewing(testData, testViewingKey)

      const iterations = 100
      const start = performance.now()

      for (let i = 0; i < iterations; i++) {
        decryptWithViewing(encrypted, testViewingKey)
      }

      const elapsed = performance.now() - start
      const avgTime = elapsed / iterations

      console.log(`  decryptWithViewing(): ${avgTime.toFixed(3)}ms avg`)

      // Target: < 5ms per decryption
      expect(avgTime).toBeLessThan(5)
    })
  })
})

// ─── Batch Operation Benchmarks ───────────────────────────────────────────────

describe('NEAR Batch Operation Benchmarks', () => {
  describe('batch stealth address scanning', () => {
    it('scan 100 addresses performance', () => {
      // Generate 100 stealth addresses
      const addresses: StealthAddress[] = []

      for (let i = 0; i < 100; i++) {
        const { stealthAddress } = generateEd25519StealthAddress(testMetaAddress)
        addresses.push(stealthAddress)
      }

      const start = performance.now()

      let matchCount = 0
      for (const addr of addresses) {
        const isMatch = checkEd25519StealthAddress(
          addr,
          testSpendingPrivateKey,
          testViewingPrivateKey
        )
        if (isMatch) matchCount++
      }

      const elapsed = performance.now() - start
      const avgTime = elapsed / 100

      console.log(`  Scanned 100 addresses: ${elapsed.toFixed(3)}ms total (avg ${avgTime.toFixed(3)}ms)`)
      console.log(`  Matches found: ${matchCount}`)

      // All should match since we generated them for this meta-address
      expect(matchCount).toBe(100)

      // Target: < 500ms for 100 addresses (< 5ms each)
      expect(elapsed).toBeLessThan(500)
    })
  })

  describe('batch commitment generation', () => {
    it('100 commitments performance', () => {
      // Warm up
      commit(1n)

      const start = performance.now()

      for (let i = 0; i < 100; i++) {
        commit(BigInt(i * 1000000))
      }

      const elapsed = performance.now() - start
      const avgTime = elapsed / 100

      console.log(`  100 commitments: ${elapsed.toFixed(3)}ms total (avg ${avgTime.toFixed(3)}ms)`)

      // Target: < 1000ms for 100 commitments
      expect(elapsed).toBeLessThan(1000)
    })
  })

  describe('full privacy flow', () => {
    it('complete send flow performance', () => {
      // Generate a viewing key for this flow
      const flowViewingKey = generateViewingKey()

      const start = performance.now()

      // 1. Generate recipient meta-address
      const recipient = generateEd25519StealthMetaAddress('near')

      // 2. Generate stealth address for payment
      const { stealthAddress } = generateEd25519StealthAddress(recipient.metaAddress)

      // 3. Convert to NEAR address
      const nearAddress = ed25519PublicKeyToNearAddress(stealthAddress.address)

      // 4. Create commitment for amount
      const { commitment } = commit(1000000000000000000000000n) // 1 NEAR

      // 5. Encrypt metadata for viewing key
      const encrypted = encryptForViewing(
        {
          sender: 'alice.testnet',
          recipient: nearAddress,
          amount: '1000000000000000000000000',
          timestamp: Date.now(),
        },
        flowViewingKey
      )

      const elapsed = performance.now() - start

      console.log(`  Full send flow: ${elapsed.toFixed(3)}ms`)

      // Verify outputs
      expect(nearAddress.length).toBe(64)
      expect(commitment).toBeDefined()
      expect(encrypted).toBeDefined()

      // Target: < 50ms for complete flow
      expect(elapsed).toBeLessThan(50)
    })

    it('complete receive flow performance', () => {
      // Generate a viewing key for this flow
      const flowViewingKey = generateViewingKey()

      // Setup: create a payment
      const recipient = generateEd25519StealthMetaAddress('near')
      const { stealthAddress } = generateEd25519StealthAddress(recipient.metaAddress)
      const nearAddress = ed25519PublicKeyToNearAddress(stealthAddress.address)
      const encrypted = encryptForViewing(
        {
          sender: 'alice.testnet',
          recipient: nearAddress,
          amount: '1000000000000000000000000',
          timestamp: Date.now(),
        },
        flowViewingKey
      )

      const start = performance.now()

      // 1. Check if stealth address belongs to us
      const isOurs = checkEd25519StealthAddress(
        stealthAddress,
        recipient.spendingPrivateKey,
        recipient.viewingPrivateKey
      )

      // 2. Derive private key to spend
      const recovery = deriveEd25519StealthPrivateKey(
        stealthAddress,
        recipient.spendingPrivateKey,
        recipient.viewingPrivateKey
      )

      // 3. Decrypt metadata
      const decrypted = decryptWithViewing(encrypted, flowViewingKey)

      const elapsed = performance.now() - start

      console.log(`  Full receive flow: ${elapsed.toFixed(3)}ms`)

      // Verify
      expect(isOurs).toBe(true)
      expect(recovery.privateKey).toBeDefined()
      expect(decrypted.amount).toBe('1000000000000000000000000')

      // Target: < 20ms for receive flow
      expect(elapsed).toBeLessThan(20)
    })
  })
})

// ─── Memory Usage (Informational) ─────────────────────────────────────────────

describe('Memory Usage (Informational)', () => {
  it('report memory after operations', () => {
    // Force GC if available
    if (global.gc) {
      global.gc()
    }

    const initialMemory = process.memoryUsage()

    // Run many operations
    for (let i = 0; i < 1000; i++) {
      const { metaAddress } = generateEd25519StealthMetaAddress('near')
      generateEd25519StealthAddress(metaAddress)
      commit(BigInt(i))
    }

    const finalMemory = process.memoryUsage()

    const heapUsedDelta = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024

    console.log(`  Memory delta after 1000 operations: ${heapUsedDelta.toFixed(2)}MB`)
    console.log(`  Heap used: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`)

    // Informational only - no strict assertion
    expect(heapUsedDelta).toBeLessThan(100) // Sanity check: < 100MB growth
  })
})
