/**
 * Surveillance Analysis Module Tests
 */

import { describe, it, expect, vi } from 'vitest'
import {
  analyzeAddressReuse,
  detectClusters,
  detectExchangeExposure,
  analyzeTemporalPatterns,
  calculatePrivacyScore,
  calculateSIPComparison,
  KNOWN_EXCHANGES,
} from '../src/surveillance'
import type { AnalyzableTransaction, SocialLinkResult } from '../src/surveillance'

// Helper to create mock transactions
function createMockTransaction(
  overrides: Partial<AnalyzableTransaction> = {}
): AnalyzableTransaction {
  return {
    signature: `sig_${Math.random().toString(36).slice(2)}`,
    slot: 123456789,
    timestamp: Math.floor(Date.now() / 1000),
    sender: 'sender123',
    recipient: 'recipient456',
    amount: BigInt(1000000),
    mint: null,
    fee: BigInt(5000),
    involvedAddresses: ['sender123', 'recipient456'],
    type: 'transfer',
    success: true,
    ...overrides,
  }
}

describe('Address Reuse Detection', () => {
  it('should detect reuse when wallet is used multiple times', () => {
    const wallet = 'wallet123'
    const transactions = [
      createMockTransaction({
        sender: wallet,
        recipient: 'other1',
        involvedAddresses: [wallet, 'other1'],
      }),
      createMockTransaction({
        sender: wallet,
        recipient: 'other2',
        involvedAddresses: [wallet, 'other2'],
      }),
    ]

    const result = analyzeAddressReuse(transactions, wallet)

    // Algorithm counts wallet usage across transactions
    expect(result.totalReuseCount).toBeGreaterThan(0)
    expect(result.scoreDeduction).toBeGreaterThan(0)
  })

  it('should return zero for single transaction', () => {
    const wallet = 'wallet123'
    const transactions = [
      createMockTransaction({
        sender: wallet,
        recipient: 'other1',
        involvedAddresses: [wallet, 'other1'],
      }),
    ]

    const result = analyzeAddressReuse(transactions, wallet)

    // Single transaction = no reuse
    expect(result.receiveReuseCount).toBe(0)
    expect(result.sendReuseCount).toBe(0)
  })

  it('should cap score deduction at 25', () => {
    const wallet = 'wallet123'
    const transactions = Array(50)
      .fill(null)
      .map((_, i) =>
        createMockTransaction({
          sender: `other${i}`,
          recipient: wallet,
          involvedAddresses: [`other${i}`, wallet],
        })
      )

    const result = analyzeAddressReuse(transactions, wallet)

    // Many transactions but deduction capped at 25
    expect(result.scoreDeduction).toBeLessThanOrEqual(25)
  })
})

describe('Cluster Detection', () => {
  it('should not detect clusters for simple transfers', () => {
    const wallet = 'wallet123'
    const transactions = [
      createMockTransaction({
        sender: wallet,
        recipient: 'other1',
        involvedAddresses: [wallet, 'other1'],
      }),
    ]

    const result = detectClusters(transactions, wallet)

    expect(result.linkedAddressCount).toBe(0)
    expect(result.scoreDeduction).toBe(0)
  })

  it('should detect linked addresses from repeated interactions', () => {
    const wallet = 'wallet123'
    const linkedAddr = 'linkedAddr456'

    // Create multiple transactions between wallet and linked address
    const transactions = [
      createMockTransaction({
        sender: wallet,
        recipient: 'other',
        involvedAddresses: [wallet, linkedAddr, 'other'],
      }),
      createMockTransaction({
        sender: wallet,
        recipient: 'other2',
        involvedAddresses: [wallet, linkedAddr, 'other2'],
      }),
      createMockTransaction({
        sender: wallet,
        recipient: 'other3',
        involvedAddresses: [wallet, linkedAddr, 'other3'],
      }),
    ]

    const result = detectClusters(transactions, wallet)

    // Should detect linkedAddr as linked (appears in 3 txs with wallet)
    expect(result.linkedAddressCount).toBeGreaterThan(0)
  })
})

describe('Exchange Exposure Detection', () => {
  it('should detect known exchange interactions', () => {
    const wallet = 'wallet123'
    const binanceAddr = KNOWN_EXCHANGES.find(e => e.name === 'Binance')?.addresses[0]

    if (!binanceAddr) {
      throw new Error('Binance address not found in KNOWN_EXCHANGES')
    }

    const transactions = [
      createMockTransaction({
        sender: wallet,
        recipient: binanceAddr,
        involvedAddresses: [wallet, binanceAddr],
      }),
    ]

    const result = detectExchangeExposure(transactions, wallet)

    expect(result.exchangeCount).toBe(1)
    expect(result.depositCount).toBe(1)
    expect(result.exchanges[0].name).toBe('Binance')
    expect(result.exchanges[0].kycRequired).toBe(true)
    expect(result.scoreDeduction).toBe(8) // CEX deduction
  })

  it('should differentiate between CEX and DEX', () => {
    const wallet = 'wallet123'
    const jupiterAddr = KNOWN_EXCHANGES.find(e => e.name === 'Jupiter')?.addresses[0]

    if (!jupiterAddr) {
      throw new Error('Jupiter address not found in KNOWN_EXCHANGES')
    }

    const transactions = [
      createMockTransaction({
        sender: wallet,
        recipient: jupiterAddr,
        involvedAddresses: [wallet, jupiterAddr],
        type: 'swap',
      }),
    ]

    const result = detectExchangeExposure(transactions, wallet)

    expect(result.exchangeCount).toBe(1)
    expect(result.exchanges[0].name).toBe('Jupiter')
    expect(result.exchanges[0].kycRequired).toBe(false)
    expect(result.scoreDeduction).toBe(2) // DEX deduction (lower than CEX)
  })

  it('should cap exchange exposure score at 20', () => {
    const wallet = 'wallet123'

    // Interact with all known CEXes
    const cexExchanges = KNOWN_EXCHANGES.filter(e => e.type === 'cex')
    const transactions = cexExchanges.map((exchange) =>
      createMockTransaction({
        sender: wallet,
        recipient: exchange.addresses[0],
        involvedAddresses: [wallet, exchange.addresses[0]],
      })
    )

    const result = detectExchangeExposure(transactions, wallet)

    expect(result.scoreDeduction).toBeLessThanOrEqual(20) // Capped
  })
})

describe('Temporal Pattern Detection', () => {
  it('should return no patterns for few transactions', () => {
    const transactions = [
      createMockTransaction({ timestamp: 1000 }),
      createMockTransaction({ timestamp: 2000 }),
    ]

    const result = analyzeTemporalPatterns(transactions)

    expect(result.patterns.length).toBe(0)
    expect(result.scoreDeduction).toBe(0)
  })

  it('should detect regular schedule patterns', () => {
    // Create transactions all on Monday at 9am UTC
    const monday9am = new Date('2025-01-06T09:00:00Z').getTime() / 1000
    const oneWeek = 7 * 24 * 60 * 60

    const transactions = Array(10)
      .fill(null)
      .map((_, i) =>
        createMockTransaction({
          timestamp: monday9am + i * oneWeek,
        })
      )

    const result = analyzeTemporalPatterns(transactions)

    // Should detect a regular schedule
    const schedulePattern = result.patterns.find(
      (p) => p.type === 'regular-schedule'
    )
    expect(schedulePattern).toBeDefined()
  })
})

describe('Privacy Score Calculation', () => {
  it('should calculate perfect score for private wallet', () => {
    const addressReuse = {
      receiveReuseCount: 0,
      sendReuseCount: 0,
      totalReuseCount: 0,
      scoreDeduction: 0,
      reusedAddresses: [],
    }

    const cluster = {
      linkedAddressCount: 0,
      confidence: 0,
      scoreDeduction: 0,
      clusters: [],
    }

    const exchangeExposure = {
      exchangeCount: 0,
      depositCount: 0,
      withdrawalCount: 0,
      scoreDeduction: 0,
      exchanges: [],
    }

    const temporalPatterns = {
      patterns: [],
      scoreDeduction: 0,
    }

    const socialLinks: SocialLinkResult = {
      isDoxxed: false,
      partialExposure: false,
      scoreDeduction: 0,
      links: [],
    }

    const result = calculatePrivacyScore(
      addressReuse,
      cluster,
      exchangeExposure,
      temporalPatterns,
      socialLinks,
      'wallet123'
    )

    expect(result.overall).toBe(100)
    expect(result.risk).toBe('low')
    expect(result.recommendations.length).toBe(0)
  })

  it('should calculate low score for exposed wallet', () => {
    const addressReuse = {
      receiveReuseCount: 20,
      sendReuseCount: 10,
      totalReuseCount: 30,
      scoreDeduction: 25, // Max
      reusedAddresses: [],
    }

    const cluster = {
      linkedAddressCount: 10,
      confidence: 0.9,
      scoreDeduction: 25, // Max
      clusters: [],
    }

    const exchangeExposure = {
      exchangeCount: 5,
      depositCount: 20,
      withdrawalCount: 15,
      scoreDeduction: 20, // Max
      exchanges: [],
    }

    const temporalPatterns = {
      patterns: [{ type: 'regular-schedule' as const, description: 'test', confidence: 0.8, evidence: {} }],
      scoreDeduction: 15, // Max
      inferredTimezone: 'EST',
    }

    const socialLinks: SocialLinkResult = {
      isDoxxed: true,
      partialExposure: true,
      scoreDeduction: 15, // Max
      links: [],
    }

    const result = calculatePrivacyScore(
      addressReuse,
      cluster,
      exchangeExposure,
      temporalPatterns,
      socialLinks,
      'wallet123'
    )

    expect(result.overall).toBe(0)
    expect(result.risk).toBe('critical')
    expect(result.recommendations.length).toBeGreaterThan(0)
  })
})

describe('SIP Protection Comparison', () => {
  it('should show improvement with SIP', () => {
    const addressReuse = {
      receiveReuseCount: 10,
      sendReuseCount: 5,
      totalReuseCount: 15,
      scoreDeduction: 20,
      reusedAddresses: [],
    }

    const cluster = {
      linkedAddressCount: 5,
      confidence: 0.8,
      scoreDeduction: 15,
      clusters: [],
    }

    const exchangeExposure = {
      exchangeCount: 2,
      depositCount: 5,
      withdrawalCount: 3,
      scoreDeduction: 10,
      exchanges: [],
    }

    const temporalPatterns = {
      patterns: [],
      scoreDeduction: 0,
    }

    const socialLinks: SocialLinkResult = {
      isDoxxed: false,
      partialExposure: false,
      scoreDeduction: 0,
      links: [],
    }

    const privacyScore = calculatePrivacyScore(
      addressReuse,
      cluster,
      exchangeExposure,
      temporalPatterns,
      socialLinks,
      'wallet123'
    )

    const comparison = calculateSIPComparison(privacyScore)

    expect(comparison.projectedScore).toBeGreaterThan(comparison.currentScore)
    expect(comparison.improvement).toBeGreaterThan(0)
    expect(comparison.improvements.length).toBeGreaterThan(0)
  })
})

describe('Known Exchanges List', () => {
  it('should have Binance addresses', () => {
    const binance = KNOWN_EXCHANGES.find((e) => e.name === 'Binance')
    expect(binance).toBeDefined()
    expect(binance?.type).toBe('cex')
    expect(binance?.kycRequired).toBe(true)
  })

  it('should have Jupiter addresses', () => {
    const jupiter = KNOWN_EXCHANGES.find((e) => e.name === 'Jupiter')
    expect(jupiter).toBeDefined()
    expect(jupiter?.type).toBe('dex')
    expect(jupiter?.kycRequired).toBe(false)
  })

  it('should have multiple exchanges', () => {
    expect(KNOWN_EXCHANGES.length).toBeGreaterThan(5)
  })
})
