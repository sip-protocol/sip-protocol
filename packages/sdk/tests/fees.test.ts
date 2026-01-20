/**
 * Fee Module Tests
 *
 * @module tests/fees
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  FeeCalculator,
  createFeeCalculator,
  estimateFee,
  formatFee,
  bpsToPercent,
  percentToBps,
  DEFAULT_FEE_TIERS,
  DEFAULT_CHAIN_FEES,
  NEARFeeContract,
  createNEARFeeContract,
  createMainnetFeeContract,
  createTestnetFeeContract,
  NEAR_FEE_CONTRACTS,
  DEFAULT_TREASURY,
} from '../src/fees'

// ─── Fee Calculator Tests ────────────────────────────────────────────────────

describe('FeeCalculator', () => {
  let calculator: FeeCalculator

  beforeEach(() => {
    calculator = new FeeCalculator()
  })

  describe('basic fee calculation', () => {
    it('calculates percentage-based fee', () => {
      const result = calculator.calculate({
        amount: 1000000000000000000000000n, // 1 NEAR (24 decimals)
        amountUsd: 5.0,
        sourceChain: 'near',
        destinationChain: 'ethereum',
        viewingKeyDisclosed: false,
      })

      expect(result.protocolFee).toBeGreaterThan(0n)
      expect(result.protocolFeeUsd).toBeGreaterThan(0)
      expect(result.appliedBps).toBe(10) // Standard tier
    })

    it('applies viewing key discount', () => {
      const withoutDiscount = calculator.calculate({
        amount: 1000000000000000000000000n,
        amountUsd: 5.0,
        sourceChain: 'near',
        destinationChain: 'ethereum',
        viewingKeyDisclosed: false,
      })

      const withDiscount = calculator.calculate({
        amount: 1000000000000000000000000n,
        amountUsd: 5.0,
        sourceChain: 'near',
        destinationChain: 'ethereum',
        viewingKeyDisclosed: true,
      })

      expect(withDiscount.protocolFee).toBeLessThan(withoutDiscount.protocolFee)
      expect(withDiscount.discountBps).toBe(5) // 50% discount
    })

    it('respects minimum fee', () => {
      const result = calculator.calculate({
        amount: 1000n, // Very small amount
        amountUsd: 0.001, // $0.001
        sourceChain: 'near',
        destinationChain: 'near',
        viewingKeyDisclosed: false,
      })

      expect(result.protocolFeeUsd).toBeGreaterThanOrEqual(0.01) // Min fee
    })

    it('respects maximum fee', () => {
      const result = calculator.calculate({
        amount: 100000000000000000000000000000n, // 100,000 NEAR
        amountUsd: 500000, // $500k
        sourceChain: 'near',
        destinationChain: 'ethereum',
        viewingKeyDisclosed: false,
      })

      expect(result.protocolFeeUsd).toBeLessThanOrEqual(100) // Max fee
    })
  })

  describe('tiered pricing', () => {
    it('applies standard tier for small volumes', () => {
      const result = calculator.calculate({
        amount: 1000000000000000000000000n,
        amountUsd: 100, // $100 - Standard tier
        sourceChain: 'near',
        destinationChain: 'near',
        viewingKeyDisclosed: false,
      })

      expect(result.tierName).toBe('Standard')
      expect(result.appliedBps).toBe(10)
    })

    it('applies silver tier for medium volumes', () => {
      const result = calculator.calculate({
        amount: 10000000000000000000000000n,
        amountUsd: 5000, // $5k - Silver tier
        sourceChain: 'near',
        destinationChain: 'near',
        viewingKeyDisclosed: false,
      })

      expect(result.tierName).toBe('Silver')
      expect(result.appliedBps).toBe(8)
    })

    it('applies gold tier for large volumes', () => {
      const result = calculator.calculate({
        amount: 50000000000000000000000000n,
        amountUsd: 50000, // $50k - Gold tier
        sourceChain: 'near',
        destinationChain: 'near',
        viewingKeyDisclosed: false,
      })

      expect(result.tierName).toBe('Gold')
      expect(result.appliedBps).toBe(5)
    })

    it('applies platinum tier for very large volumes', () => {
      const result = calculator.calculate({
        amount: 100000000000000000000000000n,
        amountUsd: 200000, // $200k - Platinum tier
        sourceChain: 'near',
        destinationChain: 'near',
        viewingKeyDisclosed: false,
      })

      expect(result.tierName).toBe('Platinum')
      expect(result.appliedBps).toBe(3)
    })
  })

  describe('chain-specific fees', () => {
    it('uses ethereum config for ethereum chain', () => {
      const result = calculator.calculate({
        amount: 1000000000000000000n, // 1 ETH
        amountUsd: 2000,
        sourceChain: 'ethereum',
        destinationChain: 'near',
        viewingKeyDisclosed: false,
      })

      expect(result.protocolFeeUsd).toBeGreaterThanOrEqual(0.10) // Higher min for ETH
    })

    it('handles unknown chains gracefully', () => {
      const result = calculator.calculate({
        amount: 1000000000n,
        amountUsd: 100,
        sourceChain: 'zcash', // Not in default config
        destinationChain: 'near',
        viewingKeyDisclosed: false,
      })

      expect(result.protocolFee).toBeGreaterThan(0n)
    })
  })

  describe('custom configuration', () => {
    it('accepts custom chain configs', () => {
      const customCalculator = new FeeCalculator({
        chainConfigs: {
          near: {
            ...DEFAULT_CHAIN_FEES.near,
            model: 'percentage', // Use percentage model instead of tiered
            baseBps: 20, // 0.2% instead of 0.1%
          },
        },
      })

      const result = customCalculator.calculate({
        amount: 1000000000000000000000000n,
        amountUsd: 100,
        sourceChain: 'near',
        destinationChain: 'near',
        viewingKeyDisclosed: false,
      })

      expect(result.appliedBps).toBe(20)
    })

    it('applies custom override', () => {
      const result = calculator.calculate({
        amount: 1000000000000000000000000n,
        amountUsd: 100,
        sourceChain: 'near',
        destinationChain: 'near',
        viewingKeyDisclosed: false,
        customBps: 5, // Custom 0.05%
      })

      expect(result.appliedBps).toBe(5)
    })
  })
})

// ─── Fee Utility Tests ───────────────────────────────────────────────────────

describe('Fee Utilities', () => {
  it('estimateFee returns quick estimate', () => {
    const fee = estimateFee(100, 'near', false)
    expect(fee).toBeGreaterThan(0)
  })

  it('formatFee formats correctly', () => {
    const formatted = formatFee(0.50, 10)
    expect(formatted).toBe('$0.50 (0.10%)')
  })

  it('bpsToPercent converts correctly', () => {
    expect(bpsToPercent(100)).toBe('1.00%')
    expect(bpsToPercent(10)).toBe('0.10%')
    expect(bpsToPercent(5)).toBe('0.05%')
  })

  it('percentToBps converts correctly', () => {
    expect(percentToBps(1)).toBe(100)
    expect(percentToBps(0.1)).toBe(10)
    expect(percentToBps(0.05)).toBe(5)
  })

  it('createFeeCalculator factory works', () => {
    const calculator = createFeeCalculator()
    expect(calculator).toBeInstanceOf(FeeCalculator)
  })
})

// ─── Default Configuration Tests ─────────────────────────────────────────────

describe('Default Configuration', () => {
  it('has correct default fee tiers', () => {
    expect(DEFAULT_FEE_TIERS).toHaveLength(4)
    expect(DEFAULT_FEE_TIERS[0].name).toBe('Standard')
    expect(DEFAULT_FEE_TIERS[3].name).toBe('Platinum')
  })

  it('has default configs for major chains', () => {
    expect(DEFAULT_CHAIN_FEES.near).toBeDefined()
    expect(DEFAULT_CHAIN_FEES.ethereum).toBeDefined()
    expect(DEFAULT_CHAIN_FEES.solana).toBeDefined()
    expect(DEFAULT_CHAIN_FEES.arbitrum).toBeDefined()
    expect(DEFAULT_CHAIN_FEES.bsc).toBeDefined()
  })

  it('all chains have viewing key discount', () => {
    Object.values(DEFAULT_CHAIN_FEES).forEach((config) => {
      expect(config.viewingKeyDiscountBps).toBe(5)
    })
  })
})

// ─── NEAR Fee Contract Tests ─────────────────────────────────────────────────

describe('NEARFeeContract', () => {
  let contract: NEARFeeContract

  beforeEach(() => {
    contract = new NEARFeeContract({ network: 'testnet' })
  })

  describe('initialization', () => {
    it('creates mainnet contract', () => {
      const mainnet = createMainnetFeeContract()
      expect(mainnet.getContractId()).toBe(NEAR_FEE_CONTRACTS.mainnet)
      expect(mainnet.getNetwork()).toBe('mainnet')
    })

    it('creates testnet contract', () => {
      const testnet = createTestnetFeeContract()
      expect(testnet.getContractId()).toBe(NEAR_FEE_CONTRACTS.testnet)
      expect(testnet.getNetwork()).toBe('testnet')
    })

    it('factory function works', () => {
      const contract = createNEARFeeContract({ network: 'mainnet' })
      expect(contract).toBeInstanceOf(NEARFeeContract)
    })
  })

  describe('fee calculation', () => {
    it('calculates fee for swap', async () => {
      const result = await contract.calculateFee({
        amount: 1000000000000000000000000n,
        amountUsd: 5.0,
        sourceChain: 'near',
        destinationChain: 'ethereum',
      })

      expect(result.protocolFee).toBeGreaterThan(0n)
      expect(result.protocolFeeUsd).toBeGreaterThan(0)
    })

    it('returns zero when paused', async () => {
      await contract.pause()

      const result = await contract.calculateFee({
        amount: 1000000000000000000000000n,
        amountUsd: 5.0,
        sourceChain: 'near',
        destinationChain: 'ethereum',
      })

      expect(result.protocolFee).toBe(0n)
      expect(result.protocolFeeUsd).toBe(0)

      await contract.resume()
    })

    it('estimates fee for UI', async () => {
      const estimate = await contract.estimateFee(100, 'near')

      expect(estimate.feeUsd).toBeGreaterThan(0)
      expect(estimate.bps).toBeGreaterThan(0)
    })
  })

  describe('fee collection', () => {
    it('collects fee', async () => {
      const result = await contract.collectFee({
        amount: 1000000000000000000000000n,
        amountUsd: 5.0,
        sourceChain: 'near',
        destinationChain: 'ethereum',
      })

      expect(result.feeAmount).toBeGreaterThan(0n)
      expect(result.treasuryAccount).toBe(DEFAULT_TREASURY.nearAccount)
    })

    it('updates total collected', async () => {
      const initialState = await contract.getState()
      const initialTotal = initialState.totalCollected

      await contract.collectFee({
        amount: 1000000000000000000000000n,
        amountUsd: 5.0,
        sourceChain: 'near',
        destinationChain: 'ethereum',
      })

      const finalState = await contract.getState()
      expect(finalState.totalCollected).toBeGreaterThan(initialTotal)
    })

    it('fails when paused', async () => {
      await contract.pause()

      await expect(
        contract.collectFee({
          amount: 1000000000000000000000000n,
          amountUsd: 5.0,
          sourceChain: 'near',
          destinationChain: 'ethereum',
        })
      ).rejects.toThrow('Fee collection is paused')

      await contract.resume()
    })
  })

  describe('state management', () => {
    it('gets contract state', async () => {
      const state = await contract.getState()

      expect(state.owner).toBeDefined()
      expect(state.treasury).toBeDefined()
      expect(state.config).toBeDefined()
      expect(state.paused).toBe(false)
    })

    it('gets fee config', async () => {
      const config = await contract.getConfig()

      expect(config.chain).toBe('near')
      expect(config.baseBps).toBe(10)
    })

    it('updates config', async () => {
      await contract.updateConfig({ baseBps: 15 })

      const config = await contract.getConfig()
      expect(config.baseBps).toBe(15)
    })

    it('pauses and resumes', async () => {
      expect(await contract.isPaused()).toBe(false)

      await contract.pause()
      expect(await contract.isPaused()).toBe(true)

      await contract.resume()
      expect(await contract.isPaused()).toBe(false)
    })
  })

  describe('treasury operations', () => {
    it('gets treasury config', async () => {
      const treasury = await contract.getTreasury()

      expect(treasury.nearAccount).toBeDefined()
      expect(treasury.evmAddress).toBeDefined()
    })

    it('withdraws to treasury', async () => {
      // First collect some fees
      await contract.collectFee({
        amount: 1000000000000000000000000n,
        amountUsd: 5.0,
        sourceChain: 'near',
        destinationChain: 'ethereum',
      })

      const txHash = await contract.withdrawToTreasury()
      expect(txHash).toContain('withdraw_')
    })

    it('fails withdrawal when insufficient balance', async () => {
      await expect(
        contract.withdrawToTreasury(999999999999999999999999999n)
      ).rejects.toThrow('Insufficient balance')
    })
  })

  describe('statistics', () => {
    it('gets fee stats', async () => {
      const stats = await contract.getStats()

      expect(stats.totalCollectedUsd).toBeGreaterThanOrEqual(0)
      expect(stats.periodStart).toBeLessThan(stats.periodEnd)
    })
  })
})

// ─── Contract Constants Tests ────────────────────────────────────────────────

describe('Contract Constants', () => {
  it('has correct contract addresses', () => {
    expect(NEAR_FEE_CONTRACTS.mainnet).toBe('fee.sip-protocol.near')
    expect(NEAR_FEE_CONTRACTS.testnet).toBe('fee.sip-protocol.testnet')
  })

  it('has correct treasury defaults', () => {
    expect(DEFAULT_TREASURY.nearAccount).toBe('treasury.sip-protocol.near')
    expect(DEFAULT_TREASURY.multiSigThreshold).toBe(2)
  })
})
