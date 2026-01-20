/**
 * Chain-Specific Optimizations Tests
 *
 * @module tests/optimizations
 */

import { describe, it, expect } from 'vitest'
import type { ChainId } from '@sip-protocol/types'
import {
  solanaOptimizations,
  evmOptimizations,
  bnbOptimizations,
  detectChainFamily,
  getChainCharacteristics,
  selectOptimalConfig,
  compareCrossChainCosts,
  recommendCheapestChain,
  recommendProfile,
} from '../src/optimizations'

// Helper to cast strings to ChainId for testing extended chain support
const asChainId = (chain: string) => chain as ChainId

// ─── Chain Detection Tests ────────────────────────────────────────────────────

describe('Chain Detection', () => {
  it('detects Solana chains', () => {
    expect(detectChainFamily('solana')).toBe('solana')
  })

  it('detects EVM chains', () => {
    expect(detectChainFamily('ethereum')).toBe('evm')
    expect(detectChainFamily('arbitrum')).toBe('evm')
    expect(detectChainFamily('optimism')).toBe('evm')
    expect(detectChainFamily('base')).toBe('evm')
    expect(detectChainFamily('polygon')).toBe('evm')
    expect(detectChainFamily(asChainId('bsc'))).toBe('evm')
  })

  it('detects NEAR chains', () => {
    expect(detectChainFamily('near')).toBe('near')
  })

  it('detects Bitcoin', () => {
    expect(detectChainFamily('bitcoin')).toBe('bitcoin')
  })

  it('defaults to EVM for unknown chains', () => {
    expect(detectChainFamily(asChainId('unknown-chain'))).toBe('evm')
  })
})

// ─── Chain Characteristics Tests ──────────────────────────────────────────────

describe('Chain Characteristics', () => {
  it('returns Solana characteristics', () => {
    const chars = getChainCharacteristics('solana')
    expect(chars.family).toBe('solana')
    expect(chars.blockTime).toBe(0.4)
    expect(chars.costTier).toBe(1)
    expect(chars.nativeToken).toBe('SOL')
  })

  it('returns Ethereum characteristics', () => {
    const chars = getChainCharacteristics('ethereum')
    expect(chars.family).toBe('evm')
    expect(chars.blockTime).toBe(12)
    expect(chars.costTier).toBe(5)
    expect(chars.hasEIP1559).toBe(true)
  })

  it('returns L2 characteristics', () => {
    const arbitrum = getChainCharacteristics('arbitrum')
    expect(arbitrum.isL2).toBe(true)
    expect(arbitrum.costTier).toBe(2)

    const optimism = getChainCharacteristics('optimism')
    expect(optimism.isL2).toBe(true)
  })

  it('returns BSC characteristics', () => {
    const chars = getChainCharacteristics(asChainId('bsc'))
    expect(chars.costTier).toBe(1) // BSC is cheap
    expect(chars.nativeToken).toBe('BNB')
    expect(chars.hasEIP1559).toBe(false)
  })
})

// ─── Solana Optimizations Tests ───────────────────────────────────────────────

describe('Solana Optimizations', () => {
  it('calculates compute budget with buffer', () => {
    const budget = solanaOptimizations.calculateComputeBudget(
      { estimatedCU: 100000 },
      'standard'
    )
    // Should add 20% buffer
    expect(budget.units).toBe(120000)
    expect(budget.microLamportsPerCU).toBeGreaterThanOrEqual(100)
  })

  it('respects max compute units', () => {
    const budget = solanaOptimizations.calculateComputeBudget(
      { estimatedCU: 2000000 }, // Over max
      'standard'
    )
    expect(budget.units).toBe(solanaOptimizations.MAX_COMPUTE_UNITS)
  })

  it('adjusts fees by profile', () => {
    const economy = solanaOptimizations.calculateComputeBudget(
      { estimatedCU: 100000 },
      'economy'
    )
    const urgent = solanaOptimizations.calculateComputeBudget(
      { estimatedCU: 100000 },
      'urgent'
    )
    expect(urgent.microLamportsPerCU).toBeGreaterThan(
      economy.microLamportsPerCU
    )
  })

  it('estimates privacy transaction complexity', () => {
    const simple = solanaOptimizations.estimatePrivacyTxComplexity({
      transferCount: 1,
      createsATAs: false,
      includesMemo: true,
    })
    expect(simple.estimatedCU).toBeGreaterThan(10000)
    expect(simple.altRecommended).toBe(false)

    const complex = solanaOptimizations.estimatePrivacyTxComplexity({
      transferCount: 5,
      createsATAs: true,
      newATACount: 5,
      includesMemo: true,
    })
    expect(complex.estimatedCU).toBeGreaterThan(simple.estimatedCU)
    expect(complex.accountCount).toBeGreaterThan(simple.accountCount)
  })

  it('recommends ALT for complex transactions', () => {
    const complex = solanaOptimizations.estimatePrivacyTxComplexity({
      transferCount: 10,
      createsATAs: true,
      newATACount: 10,
      includesMemo: true,
    })
    expect(complex.altRecommended).toBe(true)
  })

  it('calculates optimal batches', () => {
    const batches = solanaOptimizations.calculateOptimalBatches(10, {
      maxCUPerTx: 400000,
      createsATAs: true,
    })
    expect(batches.length).toBeGreaterThan(1)
    expect(batches.reduce((a, b) => a + b, 0)).toBe(10)
  })

  it('assesses congestion levels', () => {
    expect(solanaOptimizations.assessCongestion(500)).toBe('low')
    expect(solanaOptimizations.assessCongestion(3000)).toBe('medium')
    expect(solanaOptimizations.assessCongestion(10000)).toBe('high')
    expect(solanaOptimizations.assessCongestion(50000)).toBe('extreme')
  })
})

// ─── EVM Optimizations Tests ──────────────────────────────────────────────────

describe('EVM Optimizations', () => {
  it('estimates privacy transaction complexity', () => {
    const complexity = evmOptimizations.estimatePrivacyTxComplexity({
      transferCount: 1,
      includesApproval: true,
      includesAnnouncement: true,
    })
    expect(complexity.estimatedGas).toBeGreaterThan(21000n)
    expect(complexity.storageWrites).toBeGreaterThan(0)
  })

  it('calculates L2 gas estimate', () => {
    const complexity = evmOptimizations.estimatePrivacyTxComplexity({
      transferCount: 1,
      includesApproval: false,
      includesAnnouncement: true,
    })

    const l2Estimate = evmOptimizations.calculateL2GasEstimate(
      'arbitrum',
      complexity,
      100_000_000n, // 0.1 gwei L2
      30_000_000_000n // 30 gwei L1
    )

    expect(l2Estimate.l2Gas).toBeGreaterThan(0n)
    expect(l2Estimate.l1DataGas).toBeGreaterThan(0n)
    expect(l2Estimate.totalGas).toBe(l2Estimate.l2Gas + l2Estimate.l1DataGas)
  })

  it('optimizes for L2 networks', () => {
    const complexity = evmOptimizations.estimatePrivacyTxComplexity({
      transferCount: 1,
      includesApproval: false,
      includesAnnouncement: true,
    })

    const result = evmOptimizations.optimizeTransaction(
      'arbitrum',
      complexity,
      'standard',
      100_000_000n,
      30_000_000_000n
    )

    expect(result.strategies).toContain(
      'Compress calldata for lower L1 data costs'
    )
    expect(result.l2Estimate).toBeDefined()
  })

  it('checks EIP-4844 support', () => {
    expect(evmOptimizations.supportsEIP4844('mainnet')).toBe(true)
    expect(evmOptimizations.supportsEIP4844('arbitrum')).toBe(true)
    expect(evmOptimizations.supportsEIP4844('bsc')).toBe(false)
  })

  it('analyzes storage packing', () => {
    const advice = evmOptimizations.analyzeStoragePacking([
      { name: 'balance', size: 32 },
      { name: 'active', size: 1 },
      { name: 'owner', size: 20 },
      { name: 'timestamp', size: 8 },
    ])

    // 4 variables could pack into 2 slots
    expect(advice.optimizedSlots).toBeLessThan(advice.currentSlots)
    expect(advice.gasSavings).toBeGreaterThan(0n)
  })
})

// ─── BNB Optimizations Tests ──────────────────────────────────────────────────

describe('BNB Chain Optimizations', () => {
  it('identifies BNB networks', () => {
    expect(bnbOptimizations.isBNBNetwork('bsc')).toBe(true)
    expect(bnbOptimizations.isBNBNetwork('bsc-testnet')).toBe(true)
    expect(bnbOptimizations.isBNBNetwork('mainnet')).toBe(false)
  })

  it('gets PancakeSwap contracts', () => {
    const mainnet = bnbOptimizations.getPancakeSwapContracts('bsc')
    expect(mainnet.SMART_ROUTER).toMatch(/^0x/)

    const testnet = bnbOptimizations.getPancakeSwapContracts('bsc-testnet')
    expect(testnet.SMART_ROUTER).not.toBe(mainnet.SMART_ROUTER)
  })

  it('gets optimal router for swap', () => {
    const result = bnbOptimizations.getOptimalRouter(
      '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
      '0x55d398326f99059fF775485246999027B3197955', // USDT
      10n ** 18n, // 1 BNB
      'bsc'
    )

    expect(result.routerAddress).toMatch(/^0x/)
    expect(['v2', 'v3', 'smart']).toContain(result.version)
  })

  it('estimates BSC privacy gas', () => {
    const gas = bnbOptimizations.estimateBSCPrivacyGas({
      transferCount: 1,
      includesApproval: true,
      includesSwap: true,
      swapVersion: 'v2',
    })
    expect(gas).toBeGreaterThan(21000n)
  })

  it('compares BSC vs Ethereum costs', () => {
    const complexity = evmOptimizations.estimatePrivacyTxComplexity({
      transferCount: 1,
      includesApproval: false,
      includesAnnouncement: true,
    })

    const comparison = bnbOptimizations.compareBSCvsEthereum(
      complexity,
      30_000_000_000n // 30 gwei ETH
    )

    expect(comparison.savingsPercent).toBeGreaterThan(80) // BSC should be >80% cheaper
  })

  it('converts decimals between chains', () => {
    // 1 USDC on ETH (6 decimals) = 1_000_000
    const bscAmount = bnbOptimizations.convertDecimals(
      1_000_000n,
      'USDC',
      'eth-to-bsc'
    )
    // Should be 1e18 on BSC
    expect(bscAmount).toBe(1_000_000_000_000_000_000n)

    // Convert back
    const ethAmount = bnbOptimizations.convertDecimals(
      bscAmount,
      'USDC',
      'bsc-to-eth'
    )
    expect(ethAmount).toBe(1_000_000n)
  })
})

// ─── Unified Optimization Tests ───────────────────────────────────────────────

describe('Unified Optimization', () => {
  it('selects Solana config', () => {
    const result = selectOptimalConfig('solana', 'standard', {
      complexityHint: 'medium',
    })

    expect(result.family).toBe('solana')
    expect(result.fees.priorityFee).toBeGreaterThan(0n)
    expect(result.limits.computeLimit).toBeGreaterThan(0n)
    expect(result.recommendations.length).toBeGreaterThan(0)
  })

  it('selects EVM config', () => {
    const result = selectOptimalConfig('ethereum', 'fast', {
      baseFee: 30_000_000_000n,
    })

    expect(result.family).toBe('evm')
    expect(result.fees.maxFee).toBeGreaterThan(result.fees.priorityFee)
  })

  it('handles BSC specially', () => {
    const result = selectOptimalConfig(asChainId('bsc'), 'standard')

    expect(result.family).toBe('evm')
    expect(result.recommendations.some((r) => r.includes('BSC'))).toBe(true)
  })

  it('handles NEAR', () => {
    const result = selectOptimalConfig('near', 'standard')

    expect(result.family).toBe('near')
    expect(result.chainSpecific.storageDeposit).toBe(true)
  })
})

// ─── Cost Comparison Tests ────────────────────────────────────────────────────

describe('Cost Comparison', () => {
  it('compares costs across chains', () => {
    const comparison = compareCrossChainCosts([
      'ethereum',
      'solana',
      'arbitrum',
      asChainId('bsc'),
    ])

    // Should be sorted by cost tier
    expect(comparison[0].costTier).toBeLessThanOrEqual(comparison[1].costTier)

    // Solana and BSC should be cheapest
    const cheapestChains = comparison.slice(0, 2).map((c) => c.chain)
    expect(
      cheapestChains.includes('solana') || cheapestChains.includes('bsc')
    ).toBe(true)
  })

  it('recommends cheapest chain', () => {
    const cheapest = recommendCheapestChain(
      ['ethereum', 'solana', 'arbitrum', asChainId('bsc')],
      {}
    )

    expect(cheapest).toBeDefined()
    // Should be solana or bsc (both tier 1)
    expect(['solana', 'bsc']).toContain(cheapest)
  })

  it('respects block time constraint', () => {
    const cheapest = recommendCheapestChain(
      ['ethereum', 'solana', 'arbitrum'],
      { maxBlockTime: 1 }
    )

    // Only Solana and Arbitrum have block time <= 1s
    // Arbitrum is 0.25s, Solana is 0.4s
    expect(['solana', 'arbitrum']).toContain(cheapest)
  })
})

// ─── Profile Recommendation Tests ─────────────────────────────────────────────

describe('Profile Recommendation', () => {
  it('recommends economy for low value, low urgency', () => {
    const profile = recommendProfile({
      valueUsd: 10,
      urgency: 3,
      chain: 'ethereum',
    })
    expect(profile).toBe('economy')
  })

  it('recommends urgent for high value, high urgency', () => {
    const profile = recommendProfile({
      valueUsd: 50000,
      urgency: 8,
    })
    expect(profile).toBe('urgent')
  })

  it('uses standard for cheap chains regardless of urgency', () => {
    const profile = recommendProfile({
      valueUsd: 100,
      urgency: 3,
      chain: 'solana', // Cheap chain
    })
    expect(profile).toBe('standard')
  })
})
