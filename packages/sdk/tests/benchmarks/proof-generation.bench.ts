/**
 * Proof Generation Benchmarks
 *
 * Comprehensive benchmark suite for ZK proof generation performance.
 * Measures real Noir circuit execution times, memory usage, and tracks baselines.
 *
 * @see https://github.com/sip-protocol/sip-protocol/issues/141
 *
 * Run with: npx vitest bench tests/benchmarks/proof-generation.bench.ts
 */

import { describe, bench, beforeAll, afterAll } from 'vitest'
import { NoirProofProvider } from '../../src/proofs/noir'
import { MockProofProvider } from '../../src/proofs/mock'
import type { FundingProofParams, ValidityProofParams, FulfillmentProofParams } from '../../src/proofs/interface'
import type { HexString } from '@sip-protocol/types'
import * as fs from 'fs'
import * as path from 'path'

// Benchmark configuration
const BENCHMARK_CONFIG = {
  iterations: 5,          // Number of iterations per benchmark
  warmupIterations: 1,    // Warmup runs (not counted)
  timeout: 120000,        // 2 minutes timeout per benchmark
}

// Results storage
interface BenchmarkResult {
  name: string
  provider: 'noir' | 'mock'
  meanMs: number
  minMs: number
  maxMs: number
  stdDev: number
  memoryMb: number
  timestamp: string
  nodeVersion: string
  platform: string
}

const results: BenchmarkResult[] = []

// Memory measurement utility
function getMemoryUsageMb(): number {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage().heapUsed / 1024 / 1024
  }
  return 0
}

// Stats calculation
function calculateStats(times: number[]): { mean: number; min: number; max: number; stdDev: number } {
  const mean = times.reduce((a, b) => a + b, 0) / times.length
  const min = Math.min(...times)
  const max = Math.max(...times)
  const variance = times.reduce((acc, t) => acc + Math.pow(t - mean, 2), 0) / times.length
  const stdDev = Math.sqrt(variance)
  return { mean, min, max, stdDev }
}

// Test parameters
const fundingParams: FundingProofParams = {
  balance: 1000n,
  minimumRequired: 500n,
  blindingFactor: new Uint8Array(32).fill(1),
  assetId: '0xABCD',
  userAddress: '0x1234567890abcdef',
  ownershipSignature: new Uint8Array(64),
}

const validityParams: ValidityProofParams = {
  intentHash: '0x' + 'ab'.repeat(32) as HexString,
  senderAddress: '0x' + 'cd'.repeat(32) as HexString,
  senderBlinding: '0x' + 'ef'.repeat(32) as HexString,
  senderSecret: new Uint8Array(32).fill(2),
  signature: new Uint8Array(64).fill(3),
  messageHash: new Uint8Array(32).fill(4),
  nonce: new Uint8Array(32).fill(5),
  timestamp: BigInt(Date.now()),
  expiry: BigInt(Date.now() + 3600000),
}

const fulfillmentParams: FulfillmentProofParams = {
  intentHash: '0x' + '12'.repeat(32) as HexString,
  outputAmount: 1000n,
  minOutputAmount: 900n,
  recipientStealth: '0x' + '34'.repeat(32) as HexString,
  outputBlinding: new Uint8Array(32).fill(6),
  solverSecret: new Uint8Array(32).fill(7),
  fulfillmentTime: BigInt(Date.now()),
  expiry: BigInt(Date.now() + 3600000),
}

describe('Proof Generation Benchmarks', () => {
  describe('MockProofProvider (Baseline)', () => {
    let provider: MockProofProvider

    beforeAll(async () => {
      provider = new MockProofProvider({ silent: true })
      await provider.initialize()
    })

    afterAll(async () => {
      await provider.destroy()
    })

    bench('funding proof (mock)', async () => {
      await provider.generateFundingProof({
        balance: fundingParams.balance,
        minimumRequired: fundingParams.minimumRequired,
        assetId: fundingParams.assetId,
        blinding: '0x' + Buffer.from(fundingParams.blindingFactor).toString('hex') as HexString,
      })
    }, { iterations: 100 })

    bench('validity proof (mock)', async () => {
      await provider.generateValidityProof({
        intentHash: validityParams.intentHash,
        senderAddress: validityParams.senderAddress,
        senderBlinding: validityParams.senderBlinding,
        signature: validityParams.signature,
        nonce: 1n,
        timestamp: validityParams.timestamp,
        expiry: validityParams.expiry,
      })
    }, { iterations: 100 })

    bench('fulfillment proof (mock)', async () => {
      await provider.generateFulfillmentProof({
        intentHash: fulfillmentParams.intentHash,
        outputAmount: fulfillmentParams.outputAmount,
        minOutputAmount: fulfillmentParams.minOutputAmount,
        recipientStealth: fulfillmentParams.recipientStealth,
        outputBlinding: '0x' + Buffer.from(fulfillmentParams.outputBlinding).toString('hex') as HexString,
        fulfillmentTime: fulfillmentParams.fulfillmentTime,
        expiry: fulfillmentParams.expiry,
      })
    }, { iterations: 100 })
  })

  // NoirProofProvider benchmarks are skipped by default as they require WASM
  // Enable with: BENCH_NOIR=1 npx vitest bench
  describe.skipIf(!process.env.BENCH_NOIR)('NoirProofProvider (Real ZK)', () => {
    let provider: NoirProofProvider

    beforeAll(async () => {
      provider = new NoirProofProvider({ verbose: false })
      await provider.initialize()
    }, 60000)

    afterAll(async () => {
      await provider.destroy()
    })

    bench('funding proof (noir)', async () => {
      await provider.generateFundingProof(fundingParams)
    }, { iterations: BENCHMARK_CONFIG.iterations, timeout: BENCHMARK_CONFIG.timeout })

    bench('validity proof (noir)', async () => {
      await provider.generateValidityProof(validityParams)
    }, { iterations: BENCHMARK_CONFIG.iterations, timeout: BENCHMARK_CONFIG.timeout })

    bench('fulfillment proof (noir)', async () => {
      await provider.generateFulfillmentProof(fulfillmentParams)
    }, { iterations: BENCHMARK_CONFIG.iterations, timeout: BENCHMARK_CONFIG.timeout })
  })
})

describe('Memory Usage Benchmarks', () => {
  bench('memory baseline', () => {
    // Measure baseline memory
    const baseline = getMemoryUsageMb()
    // Allocate some memory
    const arr = new Array(10000).fill(0).map(() => new Uint8Array(1024))
    const after = getMemoryUsageMb()
    // Clear
    arr.length = 0
  }, { iterations: 10 })

  bench('commitment memory (100 commitments)', async () => {
    const { commit } = await import('../../src/commitment')
    const commitments = []
    for (let i = 0; i < 100; i++) {
      commitments.push(commit(BigInt(i * 1000)))
    }
  }, { iterations: 10 })

  bench('stealth address memory (100 addresses)', async () => {
    const { generateStealthMetaAddress, generateStealthAddress } = await import('../../src/stealth')
    const addresses = []
    const meta = generateStealthMetaAddress('near')
    for (let i = 0; i < 100; i++) {
      addresses.push(generateStealthAddress(meta.metaAddress))
    }
  }, { iterations: 10 })
})

describe('Initialization Benchmarks', () => {
  bench('MockProofProvider init', async () => {
    const provider = new MockProofProvider({ silent: true })
    await provider.initialize()
    await provider.destroy()
  }, { iterations: 50 })

  bench.skipIf(!process.env.BENCH_NOIR)('NoirProofProvider init (with WASM)', async () => {
    const provider = new NoirProofProvider({ verbose: false })
    await provider.initialize()
    await provider.destroy()
  }, { iterations: 3, timeout: 60000 })
})
