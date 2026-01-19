/**
 * Ethereum Gas Estimation Tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  estimateEthTransferGas,
  estimateTokenTransferGas,
  estimateClaimGas,
  estimateRegistryGas,
  clearGasPriceCache,
  updateGasPriceCache,
  parseGasPriceResponse,
  parseFeeHistoryResponse,
  calculateEffectiveGasPrice,
  formatGasCost,
  getGasPriceSuggestion,
  ONE_GWEI,
  ONE_ETH,
  DEFAULT_GAS_LIMITS,
} from '../../../src/chains/ethereum'

describe('Ethereum Gas Estimation', () => {
  beforeEach(() => {
    clearGasPriceCache()
  })

  describe('estimateEthTransferGas', () => {
    it('should estimate gas for ETH transfer', () => {
      const estimate = estimateEthTransferGas('mainnet')

      expect(estimate.breakdown.transferGas).toBe(DEFAULT_GAS_LIMITS.ethTransfer)
      expect(estimate.breakdown.announcementGas).toBe(DEFAULT_GAS_LIMITS.announcement)
      expect(estimate.breakdown.totalGas).toBe(
        DEFAULT_GAS_LIMITS.ethTransfer + DEFAULT_GAS_LIMITS.announcement
      )
      expect(estimate.estimatedCostWei).toBeGreaterThan(0n)
      expect(estimate.estimatedCostEth).toBeTruthy()
    })

    it('should include EIP-1559 pricing by default', () => {
      const estimate = estimateEthTransferGas('mainnet')

      expect(estimate.eip1559).toBeDefined()
      expect(estimate.eip1559?.baseFeePerGas).toBeGreaterThan(0n)
      expect(estimate.eip1559?.maxPriorityFeePerGas).toBeGreaterThan(0n)
      expect(estimate.eip1559?.maxFeePerGas).toBeGreaterThan(estimate.eip1559?.baseFeePerGas ?? 0n)
    })

    it('should use legacy pricing when specified', () => {
      const estimate = estimateEthTransferGas('mainnet', { legacyPricing: true })

      expect(estimate.eip1559).toBeUndefined()
      expect(estimate.legacyGasPrice).toBeGreaterThan(0n)
    })

    it('should provide cost range', () => {
      const estimate = estimateEthTransferGas('mainnet')

      expect(estimate.costRange.minWei).toBeLessThanOrEqual(estimate.costRange.maxWei)
      expect(estimate.costRange.minEth).toBeTruthy()
      expect(estimate.costRange.maxEth).toBeTruthy()
    })

    it('should use different gas prices for different networks', () => {
      const mainnetEstimate = estimateEthTransferGas('mainnet')
      const arbitrumEstimate = estimateEthTransferGas('arbitrum')

      // Mainnet should be more expensive than Arbitrum
      expect(mainnetEstimate.estimatedCostWei).toBeGreaterThan(arbitrumEstimate.estimatedCostWei)
    })

    it('should respect custom base fee override', () => {
      const customBaseFee = 50n * ONE_GWEI
      const estimate = estimateEthTransferGas('mainnet', { customBaseFee })

      expect(estimate.eip1559?.baseFeePerGas).toBe(customBaseFee)
    })

    it('should apply priority fee buffer', () => {
      const estimate1 = estimateEthTransferGas('mainnet', { priorityFeeBuffer: 0 })
      const estimate2 = estimateEthTransferGas('mainnet', { priorityFeeBuffer: 50 })

      expect(estimate2.estimatedCostWei).toBeGreaterThan(estimate1.estimatedCostWei)
    })
  })

  describe('estimateTokenTransferGas', () => {
    it('should estimate gas for token transfer', () => {
      const estimate = estimateTokenTransferGas('mainnet')

      expect(estimate.breakdown.transferGas).toBe(DEFAULT_GAS_LIMITS.erc20Transfer)
      expect(estimate.breakdown.announcementGas).toBe(DEFAULT_GAS_LIMITS.announcement)
    })

    it('should include approval gas when specified', () => {
      const withoutApproval = estimateTokenTransferGas('mainnet', false)
      const withApproval = estimateTokenTransferGas('mainnet', true)

      expect(withApproval.breakdown.transferGas).toBe(
        DEFAULT_GAS_LIMITS.erc20Transfer + DEFAULT_GAS_LIMITS.erc20Approve
      )
      expect(withApproval.breakdown.transferGas).toBeGreaterThan(withoutApproval.breakdown.transferGas)
    })
  })

  describe('estimateClaimGas', () => {
    it('should estimate gas for ETH claim', () => {
      const estimate = estimateClaimGas('mainnet', false)

      expect(estimate.breakdown.transferGas).toBe(DEFAULT_GAS_LIMITS.ethTransfer)
      expect(estimate.breakdown.announcementGas).toBe(0n)
    })

    it('should estimate gas for token claim', () => {
      const estimate = estimateClaimGas('mainnet', true)

      expect(estimate.breakdown.transferGas).toBe(DEFAULT_GAS_LIMITS.erc20Transfer)
    })
  })

  describe('estimateRegistryGas', () => {
    it('should estimate gas for register operation', () => {
      const estimate = estimateRegistryGas('mainnet', 'register')

      expect(estimate.breakdown.transferGas).toBe(DEFAULT_GAS_LIMITS.registryRegister)
    })

    it('should estimate gas for update operation', () => {
      const estimate = estimateRegistryGas('mainnet', 'update')

      expect(estimate.breakdown.transferGas).toBe(DEFAULT_GAS_LIMITS.registryUpdate)
    })

    it('should return zero gas for query operation', () => {
      const estimate = estimateRegistryGas('mainnet', 'query')

      expect(estimate.breakdown.totalGas).toBe(0n)
    })
  })

  describe('gas price cache', () => {
    it('should use cached gas prices', () => {
      const customBaseFee = 100n * ONE_GWEI
      const customPriorityFee = 5n * ONE_GWEI

      updateGasPriceCache('mainnet', customBaseFee, customPriorityFee)

      const estimate = estimateEthTransferGas('mainnet')
      expect(estimate.eip1559?.baseFeePerGas).toBe(customBaseFee)
    })

    it('should clear cache', () => {
      updateGasPriceCache('mainnet', 100n * ONE_GWEI, 5n * ONE_GWEI)
      clearGasPriceCache()

      const estimate = estimateEthTransferGas('mainnet')
      // Should use default, not cached value
      expect(estimate.eip1559?.baseFeePerGas).toBe(30n * ONE_GWEI)
    })
  })

  describe('parseGasPriceResponse', () => {
    it('should parse hex gas price', () => {
      // 30 gwei in hex
      const response = '0x6FC23AC00' as `0x${string}`
      const gasPrice = parseGasPriceResponse(response)

      expect(gasPrice).toBe(30000000000n)
    })
  })

  describe('parseFeeHistoryResponse', () => {
    it('should parse fee history response', () => {
      const baseFees = ['0x6FC23AC00', '0x7D2B7500'] as `0x${string}`[]
      const rewards = [['0x77359400', '0x9502F900']] as `0x${string}`[][]

      const { baseFee, priorityFee } = parseFeeHistoryResponse(baseFees, rewards)

      expect(baseFee).toBe(30000000000n) // First base fee
      expect(priorityFee).toBeGreaterThan(0n)
    })

    it('should handle empty rewards', () => {
      const baseFees = ['0x6FC23AC00'] as `0x${string}`[]
      const rewards: `0x${string}`[][] = [[]]

      const { baseFee, priorityFee } = parseFeeHistoryResponse(baseFees, rewards)

      expect(baseFee).toBe(30000000000n)
      expect(priorityFee).toBe(2n * ONE_GWEI) // Default priority fee
    })
  })

  describe('calculateEffectiveGasPrice', () => {
    it('should calculate effective gas price', () => {
      const baseFee = 30n * ONE_GWEI
      const maxPriorityFee = 2n * ONE_GWEI
      const maxFee = 50n * ONE_GWEI

      const effective = calculateEffectiveGasPrice(baseFee, maxPriorityFee, maxFee)

      expect(effective).toBe(baseFee + maxPriorityFee)
    })

    it('should cap at max fee', () => {
      const baseFee = 30n * ONE_GWEI
      const maxPriorityFee = 30n * ONE_GWEI // Would exceed max
      const maxFee = 35n * ONE_GWEI

      const effective = calculateEffectiveGasPrice(baseFee, maxPriorityFee, maxFee)

      expect(effective).toBeLessThanOrEqual(maxFee)
    })
  })

  describe('formatGasCost', () => {
    it('should format ETH cost', () => {
      const costWei = ONE_ETH // 1 ETH
      const formatted = formatGasCost(costWei)

      expect(formatted.eth).toBe('1')
      expect(formatted.usd).toBeUndefined()
    })

    it('should format USD cost when price provided', () => {
      const costWei = ONE_ETH // 1 ETH
      const formatted = formatGasCost(costWei, 2500)

      expect(formatted.eth).toBe('1')
      expect(formatted.usd).toBe('2500.00')
    })

    it('should handle small amounts', () => {
      const costWei = 1000000000000000n // 0.001 ETH
      const formatted = formatGasCost(costWei, 2500)

      expect(formatted.eth).toBe('0.001')
      expect(formatted.usd).toBe('2.50')
    })
  })

  describe('getGasPriceSuggestion', () => {
    it('should return slow suggestion', () => {
      const baseFee = 30n * ONE_GWEI
      const suggestion = getGasPriceSuggestion(baseFee, 'slow')

      expect(suggestion.maxPriorityFeePerGas).toBe(ONE_GWEI)
      expect(suggestion.baseFeePerGas).toBe(baseFee)
    })

    it('should return standard suggestion', () => {
      const baseFee = 30n * ONE_GWEI
      const suggestion = getGasPriceSuggestion(baseFee, 'standard')

      expect(suggestion.maxPriorityFeePerGas).toBe(2n * ONE_GWEI)
    })

    it('should return fast suggestion', () => {
      const baseFee = 30n * ONE_GWEI
      const suggestion = getGasPriceSuggestion(baseFee, 'fast')

      expect(suggestion.maxPriorityFeePerGas).toBe(5n * ONE_GWEI)
    })

    it('should calculate max fee correctly', () => {
      const baseFee = 30n * ONE_GWEI
      const suggestion = getGasPriceSuggestion(baseFee, 'standard')

      // maxFee = 2 * baseFee + priorityFee
      const expectedMaxFee = baseFee * 2n + 2n * ONE_GWEI
      expect(suggestion.maxFeePerGas).toBe(expectedMaxFee)
    })
  })
})
