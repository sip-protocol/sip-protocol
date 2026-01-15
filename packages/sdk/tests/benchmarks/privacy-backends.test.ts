/**
 * Privacy Backends Performance Benchmarks
 *
 * Comprehensive benchmarks for privacy backend operations including:
 * - Latency percentiles (p50, p95, p99)
 * - Throughput measurements (ops/sec)
 * - Memory footprint estimation
 * - Comparison across backends
 *
 * @see https://github.com/sip-protocol/sip-protocol/issues/510
 */

import { describe, it, expect, beforeAll } from 'vitest'
import {
  SIPNativeBackend,
  MockBackend,
  PrivacyBackendRegistry,
  SmartRouter,
  type PrivacyBackend,
  type TransferParams,
} from '../../src/privacy-backends'

// ─── Benchmark Utilities ─────────────────────────────────────────────────────

interface BenchmarkResult {
  /** Operation name */
  name: string
  /** Number of iterations */
  iterations: number
  /** Total time in milliseconds */
  totalMs: number
  /** Average time per operation in milliseconds */
  avgMs: number
  /** Operations per second */
  opsPerSec: number
  /** Percentile latencies in milliseconds */
  percentiles: {
    p50: number
    p95: number
    p99: number
    min: number
    max: number
  }
}

interface MemorySnapshot {
  heapUsed: number
  heapTotal: number
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sortedArr: number[], p: number): number {
  const index = Math.ceil((p / 100) * sortedArr.length) - 1
  return sortedArr[Math.max(0, index)]
}

/**
 * Run a benchmark with multiple iterations
 */
async function benchmark(
  name: string,
  fn: () => Promise<void> | void,
  iterations: number = 100
): Promise<BenchmarkResult> {
  const times: number[] = []

  // Warmup (10% of iterations)
  const warmupCount = Math.max(1, Math.floor(iterations * 0.1))
  for (let i = 0; i < warmupCount; i++) {
    await fn()
  }

  // Actual benchmark
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    await fn()
    times.push(performance.now() - start)
  }

  // Sort for percentile calculation
  const sortedTimes = [...times].sort((a, b) => a - b)
  const totalMs = times.reduce((a, b) => a + b, 0)

  return {
    name,
    iterations,
    totalMs,
    avgMs: totalMs / iterations,
    opsPerSec: (iterations / totalMs) * 1000,
    percentiles: {
      p50: percentile(sortedTimes, 50),
      p95: percentile(sortedTimes, 95),
      p99: percentile(sortedTimes, 99),
      min: sortedTimes[0],
      max: sortedTimes[sortedTimes.length - 1],
    },
  }
}

/**
 * Get current memory snapshot (Node.js only)
 */
function getMemorySnapshot(): MemorySnapshot | null {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const mem = process.memoryUsage()
    return {
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
    }
  }
  return null
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * Format benchmark result as table row
 */
function formatResult(result: BenchmarkResult): string {
  return [
    `  ${result.name}:`,
    `    Iterations: ${result.iterations}`,
    `    Avg: ${result.avgMs.toFixed(3)}ms`,
    `    Throughput: ${result.opsPerSec.toFixed(1)} ops/sec`,
    `    p50: ${result.percentiles.p50.toFixed(3)}ms`,
    `    p95: ${result.percentiles.p95.toFixed(3)}ms`,
    `    p99: ${result.percentiles.p99.toFixed(3)}ms`,
    `    Min: ${result.percentiles.min.toFixed(3)}ms`,
    `    Max: ${result.percentiles.max.toFixed(3)}ms`,
  ].join('\n')
}

// ─── Test Data ───────────────────────────────────────────────────────────────

const testParams: TransferParams = {
  chain: 'solana',
  sender: 'sender-address-1234567890abcdef',
  recipient: 'recipient-address-1234567890abcdef',
  mint: null,
  amount: 1000000n,
  decimals: 9,
}

// ─── Benchmarks ──────────────────────────────────────────────────────────────

describe('Privacy Backends Benchmarks', () => {
  let sipNative: SIPNativeBackend
  let mockBackend: MockBackend
  let registry: PrivacyBackendRegistry
  let router: SmartRouter

  beforeAll(() => {
    sipNative = new SIPNativeBackend()
    mockBackend = new MockBackend({ latencyMs: 0 }) // No artificial delay
    registry = new PrivacyBackendRegistry({ enableHealthTracking: false })
    registry.register(sipNative)
    registry.register(mockBackend)
    router = new SmartRouter(registry)
  })

  describe('SIPNativeBackend', () => {
    it('checkAvailability() benchmark', async () => {
      const result = await benchmark(
        'SIPNativeBackend.checkAvailability',
        async () => {
          await sipNative.checkAvailability(testParams)
        },
        100
      )

      console.log(formatResult(result))

      // Performance assertions (loose - just sanity checks)
      expect(result.avgMs).toBeLessThan(10) // Should be fast
      expect(result.percentiles.p99).toBeLessThan(50) // Tail latency reasonable
    })

    it('getCapabilities() benchmark', async () => {
      const result = await benchmark(
        'SIPNativeBackend.getCapabilities',
        () => {
          sipNative.getCapabilities()
        },
        1000
      )

      console.log(formatResult(result))

      // Capabilities is a pure read, should be sub-millisecond
      expect(result.avgMs).toBeLessThan(1)
    })

    it('execute() benchmark', async () => {
      const result = await benchmark(
        'SIPNativeBackend.execute',
        async () => {
          await sipNative.execute(testParams)
        },
        100
      )

      console.log(formatResult(result))

      // Execute should be reasonably fast (mock execution)
      expect(result.avgMs).toBeLessThan(50)
    })

    it('estimateCost() benchmark', async () => {
      const result = await benchmark(
        'SIPNativeBackend.estimateCost',
        async () => {
          await sipNative.estimateCost(testParams)
        },
        100
      )

      console.log(formatResult(result))

      expect(result.avgMs).toBeLessThan(10)
    })
  })

  describe('MockBackend', () => {
    it('checkAvailability() benchmark', async () => {
      const result = await benchmark(
        'MockBackend.checkAvailability',
        async () => {
          await mockBackend.checkAvailability(testParams)
        },
        100
      )

      console.log(formatResult(result))
      expect(result.avgMs).toBeLessThan(5)
    })

    it('execute() benchmark', async () => {
      const result = await benchmark(
        'MockBackend.execute',
        async () => {
          await mockBackend.execute(testParams)
        },
        100
      )

      console.log(formatResult(result))
      expect(result.avgMs).toBeLessThan(5)
    })
  })

  describe('PrivacyBackendRegistry', () => {
    it('get() benchmark', async () => {
      const result = await benchmark(
        'Registry.get',
        () => {
          registry.get('sip-native')
          registry.get('mock')
        },
        1000
      )

      console.log(formatResult(result))

      // Map lookup should be sub-millisecond
      expect(result.avgMs).toBeLessThan(1)
    })

    it('getAll() benchmark', async () => {
      const result = await benchmark(
        'Registry.getAll',
        () => {
          registry.getAll()
        },
        1000
      )

      console.log(formatResult(result))
      expect(result.avgMs).toBeLessThan(1)
    })

    it('getByChain() benchmark', async () => {
      const result = await benchmark(
        'Registry.getByChain',
        () => {
          registry.getByChain('solana')
        },
        1000
      )

      console.log(formatResult(result))
      expect(result.avgMs).toBeLessThan(1)
    })

    it('findAvailable() benchmark', async () => {
      const result = await benchmark(
        'Registry.findAvailable',
        async () => {
          await registry.findAvailable(testParams)
        },
        100
      )

      console.log(formatResult(result))
      expect(result.avgMs).toBeLessThan(20)
    })
  })

  describe('SmartRouter', () => {
    it('selectBackend() benchmark', async () => {
      const result = await benchmark(
        'SmartRouter.selectBackend',
        async () => {
          await router.selectBackend(testParams, { prioritize: 'privacy' })
        },
        100
      )

      console.log(formatResult(result))
      expect(result.avgMs).toBeLessThan(20)
    })

    it('execute() benchmark', async () => {
      const result = await benchmark(
        'SmartRouter.execute',
        async () => {
          await router.execute(testParams, { prioritize: 'speed' })
        },
        50
      )

      console.log(formatResult(result))
      expect(result.avgMs).toBeLessThan(50)
    })
  })

  describe('Throughput Tests', () => {
    it('sustained checkAvailability throughput (1000 ops)', async () => {
      const startMem = getMemorySnapshot()
      const iterations = 1000
      const start = performance.now()

      for (let i = 0; i < iterations; i++) {
        await sipNative.checkAvailability(testParams)
      }

      const totalMs = performance.now() - start
      const opsPerSec = (iterations / totalMs) * 1000
      const endMem = getMemorySnapshot()

      console.log(`  Throughput Test (${iterations} ops):`)
      console.log(`    Total Time: ${totalMs.toFixed(3)}ms`)
      console.log(`    Throughput: ${opsPerSec.toFixed(1)} ops/sec`)

      if (startMem && endMem) {
        const memDiff = endMem.heapUsed - startMem.heapUsed
        console.log(`    Memory Delta: ${formatBytes(memDiff)}`)
      }

      expect(opsPerSec).toBeGreaterThan(100) // At least 100 ops/sec
    })

    it('concurrent execute throughput (50 concurrent)', async () => {
      const concurrency = 50
      const start = performance.now()

      const promises = Array.from({ length: concurrency }, () =>
        mockBackend.execute(testParams)
      )

      await Promise.all(promises)

      const totalMs = performance.now() - start
      const opsPerSec = (concurrency / totalMs) * 1000

      console.log(`  Concurrent Test (${concurrency} concurrent):`)
      console.log(`    Total Time: ${totalMs.toFixed(3)}ms`)
      console.log(`    Throughput: ${opsPerSec.toFixed(1)} ops/sec`)

      expect(totalMs).toBeLessThan(1000) // Complete in under 1 second
    })
  })

  describe('Memory Footprint', () => {
    it('registry memory with multiple backends', () => {
      const startMem = getMemorySnapshot()

      const testRegistry = new PrivacyBackendRegistry({ enableHealthTracking: false })
      for (let i = 0; i < 100; i++) {
        testRegistry.register(
          new MockBackend({ name: `test-backend-${i}` }),
          { override: false }
        )
      }

      const endMem = getMemorySnapshot()

      if (startMem && endMem) {
        const memPerBackend = (endMem.heapUsed - startMem.heapUsed) / 100
        console.log(`  Registry with 100 backends:`)
        console.log(`    Total Memory: ${formatBytes(endMem.heapUsed - startMem.heapUsed)}`)
        console.log(`    Per Backend: ${formatBytes(memPerBackend)}`)

        // Each backend should use less than 10KB
        expect(memPerBackend).toBeLessThan(10 * 1024)
      } else {
        console.log(`  Memory profiling not available in this environment`)
      }

      expect(testRegistry.count()).toBe(100)
    })
  })

  describe('Backend Comparison', () => {
    it('compare checkAvailability across backends', async () => {
      const backends: PrivacyBackend[] = [sipNative, mockBackend]
      const results: BenchmarkResult[] = []

      for (const backend of backends) {
        const result = await benchmark(
          backend.name,
          async () => {
            await backend.checkAvailability(testParams)
          },
          50
        )
        results.push(result)
      }

      console.log('\n  Backend Comparison (checkAvailability):')
      console.log('  ┌─────────────────────────────────────────────────────┐')
      console.log('  │ Backend           │ Avg (ms) │ p95 (ms) │ ops/sec  │')
      console.log('  ├───────────────────┼──────────┼──────────┼──────────┤')

      for (const r of results) {
        const name = r.name.padEnd(17)
        const avg = r.avgMs.toFixed(3).padStart(8)
        const p95 = r.percentiles.p95.toFixed(3).padStart(8)
        const ops = r.opsPerSec.toFixed(1).padStart(8)
        console.log(`  │ ${name} │ ${avg} │ ${p95} │ ${ops} │`)
      }

      console.log('  └─────────────────────────────────────────────────────┘')

      // All backends should complete
      expect(results.length).toBe(backends.length)
    })

    it('compare execute across backends', async () => {
      const backends: PrivacyBackend[] = [sipNative, mockBackend]
      const results: BenchmarkResult[] = []

      for (const backend of backends) {
        const result = await benchmark(
          backend.name,
          async () => {
            await backend.execute(testParams)
          },
          50
        )
        results.push(result)
      }

      console.log('\n  Backend Comparison (execute):')
      console.log('  ┌─────────────────────────────────────────────────────┐')
      console.log('  │ Backend           │ Avg (ms) │ p95 (ms) │ ops/sec  │')
      console.log('  ├───────────────────┼──────────┼──────────┼──────────┤')

      for (const r of results) {
        const name = r.name.padEnd(17)
        const avg = r.avgMs.toFixed(3).padStart(8)
        const p95 = r.percentiles.p95.toFixed(3).padStart(8)
        const ops = r.opsPerSec.toFixed(1).padStart(8)
        console.log(`  │ ${name} │ ${avg} │ ${p95} │ ${ops} │`)
      }

      console.log('  └─────────────────────────────────────────────────────┘')

      expect(results.length).toBe(backends.length)
    })
  })
})

// ─── Exported Utilities (for CI integration) ─────────────────────────────────

export {
  benchmark,
  formatResult,
  getMemorySnapshot,
  formatBytes,
  type BenchmarkResult,
  type MemorySnapshot,
}
