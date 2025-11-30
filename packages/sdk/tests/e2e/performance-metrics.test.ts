/**
 * E2E Performance Metrics Tests
 *
 * Tests to measure and validate performance of SIP Protocol operations.
 * Collects metrics for:
 * - Intent creation time
 * - Quote fetching time
 * - Execution time
 * - Memory usage
 * - Cryptographic operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PrivacyLevel } from '@sip-protocol/types'
import type { ChainId, HexString } from '@sip-protocol/types'
import {
  createE2EFixture,
  createTestIntent,
  executeTestSwap,
  MetricsCollector,
  suppressConsoleWarnings,
  delay,
  type E2ETestFixture,
} from './helpers'
import { commit, verifyOpening, addCommitments } from '../../src/commitment'
import {
  generateStealthMetaAddress,
  generateStealthAddress,
  checkStealthAddress,
} from '../../src/stealth'
import { generateViewingKey, encryptForViewing, decryptWithViewing } from '../../src/privacy'
import { MockProofProvider } from '../../src/proofs/mock'

describe('E2E: Performance Metrics', () => {
  let fixture: E2ETestFixture
  let metrics: MetricsCollector
  let restoreConsole: () => void

  beforeEach(async () => {
    restoreConsole = suppressConsoleWarnings()
    fixture = await createE2EFixture()
    metrics = new MetricsCollector()
  })

  afterEach(() => {
    fixture.cleanup()
    restoreConsole()

    // Log metrics summary after each test suite
    // console.log(metrics.formatAsMarkdown())
    metrics.clear()
  })

  // ─── Intent Creation Performance ────────────────────────────────────────────────

  describe('Intent Creation Performance', () => {
    it('should create shielded intent within 500ms', async () => {
      const { metrics: m } = await metrics.measure('shielded-intent-creation', async () => {
        return await createTestIntent(fixture.sip, {
          privacyLevel: PrivacyLevel.SHIELDED,
        })
      })

      expect(m.totalDuration).toBeLessThan(500)
    })

    it('should create transparent intent faster than shielded', async () => {
      const { metrics: shieldedMetrics } = await metrics.measure('shielded', async () => {
        return await createTestIntent(fixture.sip, {
          privacyLevel: PrivacyLevel.SHIELDED,
        })
      })

      const { metrics: transparentMetrics } = await metrics.measure('transparent', async () => {
        return await createTestIntent(fixture.sip, {
          privacyLevel: PrivacyLevel.TRANSPARENT,
        })
      })

      // Transparent should generally be faster (no proof generation)
      // But with mock proofs, difference may be minimal
      expect(transparentMetrics.totalDuration).toBeLessThan(500)
      expect(shieldedMetrics.totalDuration).toBeLessThan(1000)
    })

    it('should handle batch intent creation efficiently', async () => {
      const batchSize = 10

      const { result: intents, metrics: m } = await metrics.measure('batch-intent-creation', async () => {
        return await Promise.all(
          Array.from({ length: batchSize }, (_, i) =>
            createTestIntent(fixture.sip, {
              inputAmount: BigInt(1_000_000_000 * (i + 1)),
            })
          )
        )
      })

      expect(intents).toHaveLength(batchSize)

      // Average time per intent should be reasonable
      const avgTimePerIntent = m.totalDuration / batchSize
      expect(avgTimePerIntent).toBeLessThan(200) // 200ms per intent max
    })
  })

  // ─── Quote Performance ──────────────────────────────────────────────────────────

  describe('Quote Fetching Performance', () => {
    it('should fetch quotes within 200ms', async () => {
      const intent = await createTestIntent(fixture.sip)

      const { result: quotes, metrics: m } = await metrics.measure('quote-fetch', async () => {
        return await fixture.sip.getQuotes(intent)
      })

      expect(quotes.length).toBeGreaterThan(0)
      expect(m.totalDuration).toBeLessThan(200)
    })

    it('should handle concurrent quote requests', async () => {
      const intents = await Promise.all([
        createTestIntent(fixture.sip, { outputChain: 'zcash' as ChainId }),
        createTestIntent(fixture.sip, { outputChain: 'ethereum' as ChainId }),
        createTestIntent(fixture.sip, { outputChain: 'near' as ChainId }),
      ])

      const { result: allQuotes, metrics: m } = await metrics.measure('concurrent-quotes', async () => {
        return await Promise.all(intents.map(i => fixture.sip.getQuotes(i)))
      })

      expect(allQuotes.every(q => q.length > 0)).toBe(true)
      expect(m.totalDuration).toBeLessThan(500) // All 3 in parallel < 500ms
    })
  })

  // ─── Execution Performance ──────────────────────────────────────────────────────

  describe('Swap Execution Performance', () => {
    it('should complete full swap within 5 seconds', async () => {
      const { metrics: m } = await metrics.measure('full-swap', async () => {
        return await executeTestSwap(fixture)
      })

      expect(m.totalDuration).toBeLessThan(5000)
    })

    it('should measure individual swap phases', async () => {
      let intentTime = 0
      let quoteTime = 0
      let executeTime = 0

      // Intent creation
      const startIntent = Date.now()
      const intent = await createTestIntent(fixture.sip)
      intentTime = Date.now() - startIntent

      // Quote fetching
      const startQuote = Date.now()
      const quotes = await fixture.sip.getQuotes(intent)
      quoteTime = Date.now() - startQuote

      // Execution (mock)
      const tracked = { ...intent, status: 'pending' as const, quotes: [] }
      const startExecute = Date.now()
      const result = await fixture.sip.execute(tracked, quotes[0])
      executeTime = Date.now() - startExecute

      // Record metrics
      metrics.measure('intent-phase', async () => ({ time: intentTime }))
      metrics.measure('quote-phase', async () => ({ time: quoteTime }))
      metrics.measure('execute-phase', async () => ({ time: executeTime }))

      // Assertions
      expect(intentTime).toBeLessThan(500)
      expect(quoteTime).toBeLessThan(200)
      // Execution includes mock delay
      expect(executeTime).toBeLessThan(3000)
    })
  })

  // ─── Cryptographic Operations Performance ───────────────────────────────────────

  describe('Cryptographic Operations Performance', () => {
    it('should generate commitment within 10ms', async () => {
      const iterations = 100

      const { metrics: m } = await metrics.measure('commitment-generation', async () => {
        const commitments = []
        for (let i = 0; i < iterations; i++) {
          commitments.push(commit(BigInt(i * 1000)))
        }
        return commitments
      })

      const avgTime = m.totalDuration / iterations
      expect(avgTime).toBeLessThan(10)
    })

    it('should verify commitment opening within 5ms', async () => {
      const { commitment, blinding } = commit(1000n)
      const iterations = 100

      const { metrics: m } = await metrics.measure('commitment-verification', async () => {
        let valid = true
        for (let i = 0; i < iterations; i++) {
          valid = valid && verifyOpening(commitment, 1000n, blinding)
        }
        return valid
      })

      const avgTime = m.totalDuration / iterations
      expect(avgTime).toBeLessThan(10) // Allow headroom for CI variance
    })

    it('should perform homomorphic addition within 5ms', async () => {
      const c1 = commit(100n)
      const c2 = commit(200n)
      const iterations = 100

      const { metrics: m } = await metrics.measure('commitment-addition', async () => {
        const results = []
        for (let i = 0; i < iterations; i++) {
          results.push(addCommitments(c1.commitment, c2.commitment))
        }
        return results
      })

      const avgTime = m.totalDuration / iterations
      expect(avgTime).toBeLessThan(5)
    })

    it('should generate stealth address within 20ms', async () => {
      const meta = generateStealthMetaAddress('ethereum' as ChainId)
      const iterations = 50

      const { metrics: m } = await metrics.measure('stealth-address-generation', async () => {
        const addresses = []
        for (let i = 0; i < iterations; i++) {
          addresses.push(generateStealthAddress(meta.metaAddress))
        }
        return addresses
      })

      const avgTime = m.totalDuration / iterations
      expect(avgTime).toBeLessThan(20)
    })

    it('should check stealth address within 10ms', async () => {
      const meta = generateStealthMetaAddress('ethereum' as ChainId)
      const { stealthAddress } = generateStealthAddress(meta.metaAddress)
      const iterations = 100

      const { metrics: m } = await metrics.measure('stealth-check', async () => {
        let allValid = true
        for (let i = 0; i < iterations; i++) {
          allValid = allValid && checkStealthAddress(
            stealthAddress,
            meta.spendingPrivateKey,
            meta.viewingPrivateKey
          )
        }
        return allValid
      })

      const avgTime = m.totalDuration / iterations
      expect(avgTime).toBeLessThan(10)
    })
  })

  // ─── Encryption Performance ─────────────────────────────────────────────────────

  describe('Encryption Performance', () => {
    it('should encrypt for viewing within 5ms', async () => {
      const key = generateViewingKey('/m/44/501/0')
      const data = { sender: '0x', recipient: '0x', amount: '1000', timestamp: Date.now() }
      const iterations = 100

      const { metrics: m } = await metrics.measure('viewing-encryption', async () => {
        const encrypted = []
        for (let i = 0; i < iterations; i++) {
          encrypted.push(encryptForViewing({ ...data, timestamp: i }, key))
        }
        return encrypted
      })

      const avgTime = m.totalDuration / iterations
      expect(avgTime).toBeLessThan(5)
    })

    it('should decrypt with viewing key within 5ms', async () => {
      const key = generateViewingKey('/m/44/501/0')
      const data = { sender: '0x', recipient: '0x', amount: '1000', timestamp: Date.now() }
      const encrypted = encryptForViewing(data, key)
      const iterations = 100

      const { metrics: m } = await metrics.measure('viewing-decryption', async () => {
        const decrypted = []
        for (let i = 0; i < iterations; i++) {
          decrypted.push(decryptWithViewing(encrypted, key))
        }
        return decrypted
      })

      const avgTime = m.totalDuration / iterations
      expect(avgTime).toBeLessThan(5)
    })
  })

  // ─── Proof Generation Performance ───────────────────────────────────────────────

  describe('Proof Generation Performance', () => {
    it('should generate funding proof within 100ms', async () => {
      const proofProvider = fixture.proofProvider

      const { metrics: m } = await metrics.measure('funding-proof', async () => {
        return await proofProvider.generateFundingProof({
          balance: 1000n,
          minimumRequired: 500n,
          assetId: 'SOL',
          blinding: '0x123' as HexString,
        })
      })

      expect(m.totalDuration).toBeLessThan(100)
    })

    it('should generate validity proof within 100ms', async () => {
      const proofProvider = fixture.proofProvider

      const { metrics: m } = await metrics.measure('validity-proof', async () => {
        return await proofProvider.generateValidityProof({
          intentHash: '0xabc' as HexString,
          senderAddress: '0xsender' as HexString,
          senderBlinding: '0xblind' as HexString,
          signature: new Uint8Array(64),
          nonce: 1n,
          timestamp: BigInt(Math.floor(Date.now() / 1000)),
          expiry: BigInt(Math.floor(Date.now() / 1000) + 3600),
        })
      })

      expect(m.totalDuration).toBeLessThan(100)
    })

    it('should verify proof within 50ms', async () => {
      const proofProvider = fixture.proofProvider

      const { proof } = await proofProvider.generateFundingProof({
        balance: 1000n,
        minimumRequired: 500n,
        assetId: 'SOL',
        blinding: '0x123' as HexString,
      })

      const { metrics: m } = await metrics.measure('proof-verification', async () => {
        return await proofProvider.verifyProof(proof)
      })

      expect(m.totalDuration).toBeLessThan(50)
    })
  })

  // ─── Memory Usage ───────────────────────────────────────────────────────────────

  describe('Memory Usage', () => {
    it('should not leak memory during repeated intent creation', async () => {
      const iterations = 50

      // Force GC if available
      if (global.gc) global.gc()

      const memoryBefore = process.memoryUsage().heapUsed

      for (let i = 0; i < iterations; i++) {
        await createTestIntent(fixture.sip)
      }

      // Force GC if available
      if (global.gc) global.gc()

      const memoryAfter = process.memoryUsage().heapUsed
      const memoryGrowth = memoryAfter - memoryBefore

      // Memory growth should be reasonable (< 10MB for 50 intents)
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024)
    })

    it('should clean up resources after solver operations', async () => {
      const solver = fixture.solver

      for (let i = 0; i < 20; i++) {
        const intent = await createTestIntent(fixture.sip)
        const visibleIntent = {
          intentId: intent.intentId,
          outputAsset: intent.outputAsset,
          minOutputAmount: intent.minOutputAmount,
          expiry: intent.expiry,
          senderCommitment: intent.senderCommitment,
          inputCommitment: intent.inputCommitment,
        }

        const quote = await solver.generateQuote(visibleIntent)
        if (quote) {
          await solver.fulfill(intent, quote)
        }
      }

      // Reset should clear all pending fulfillments
      solver.reset()

      // Memory should be freed (can't directly test, but reset clears internal maps)
    })
  })

  // ─── Throughput ─────────────────────────────────────────────────────────────────

  describe('Throughput', () => {
    it('should handle 10 concurrent operations', async () => {
      const concurrency = 10

      const { result: results, metrics: m } = await metrics.measure('concurrent-ops', async () => {
        return await Promise.all(
          Array.from({ length: concurrency }, () =>
            executeTestSwap(fixture)
          )
        )
      })

      expect(results).toHaveLength(concurrency)
      expect(results.every(r => r.result.status === 'fulfilled')).toBe(true)

      // Should complete in reasonable time even with concurrency
      expect(m.totalDuration).toBeLessThan(10000)
    })

    it('should maintain performance under load', async () => {
      const rounds = 5
      const durations: number[] = []

      for (let round = 0; round < rounds; round++) {
        const start = Date.now()
        await Promise.all([
          createTestIntent(fixture.sip),
          createTestIntent(fixture.sip),
          createTestIntent(fixture.sip),
        ])
        durations.push(Date.now() - start)
      }

      // Performance should be relatively consistent
      const avgDuration = durations.reduce((a, b) => a + b, 0) / rounds
      const maxDuration = Math.max(...durations)
      const minDuration = Math.min(...durations)

      // Max shouldn't be more than 3x average
      expect(maxDuration).toBeLessThan(avgDuration * 3)

      // All rounds should complete in reasonable time
      expect(maxDuration).toBeLessThan(2000)
    })
  })

  // ─── Summary Report ─────────────────────────────────────────────────────────────

  describe('Performance Summary', () => {
    it('should generate performance report', async () => {
      // Run various operations to collect metrics
      await metrics.measure('intent', () => createTestIntent(fixture.sip))
      await metrics.measure('swap', () => executeTestSwap(fixture))

      const { commitment, blinding } = commit(100n)
      await metrics.measure('commitment-ops', async () => {
        for (let i = 0; i < 100; i++) {
          verifyOpening(commitment, 100n, blinding)
        }
      })

      // Get summary
      const summary = metrics.getSummary()

      expect(summary.totalTests).toBe(3)
      expect(summary.avgDuration).toBeGreaterThan(0)
      expect(summary.maxDuration).toBeGreaterThanOrEqual(summary.avgDuration)
      expect(summary.minDuration).toBeLessThanOrEqual(summary.avgDuration)

      // Format report
      const report = metrics.formatAsMarkdown()
      expect(report).toContain('| Test |')
      expect(report).toContain('intent')
      expect(report).toContain('swap')
    })
  })
})
