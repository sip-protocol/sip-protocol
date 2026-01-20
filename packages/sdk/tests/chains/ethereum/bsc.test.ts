/**
 * BNB Chain (BSC) Support Tests
 *
 * Tests for BNB Chain configuration, token addresses, and PancakeSwap integration.
 *
 * @see packages/sdk/src/chains/ethereum/constants.ts
 * @see https://github.com/sip-protocol/sip-protocol/issues/425
 *
 * M20-26: BNB Chain support (reuse M18 Solidity contract)
 */

import { describe, it, expect } from 'vitest'

import {
  EVM_CHAIN_IDS,
  ETHEREUM_RPC_ENDPOINTS,
  ETHEREUM_EXPLORER_URLS,
  BSC_TOKEN_CONTRACTS,
  BSC_TOKEN_DECIMALS,
  PANCAKESWAP_CONTRACTS,
  PANCAKESWAP_TESTNET_CONTRACTS,
  ONE_GWEI,
  getChainId,
  getNetworkFromChainId,
  isTestnet,
  isL2Network,
  isAltL1Network,
  getExplorerUrl,
  getAddressExplorerUrl,
  isValidEthAddress,
} from '../../../src/chains/ethereum/constants'

import {
  getGasPriceSuggestion,
} from '../../../src/chains/ethereum/gas-estimation'

// ─── Chain Configuration Tests ───────────────────────────────────────────────

describe('BNB Chain Configuration', () => {
  describe('Chain IDs', () => {
    it('should have correct BSC mainnet chain ID', () => {
      expect(EVM_CHAIN_IDS.bsc).toBe(56)
    })

    it('should have correct BSC testnet chain ID', () => {
      expect(EVM_CHAIN_IDS['bsc-testnet']).toBe(97)
    })

    it('should resolve BSC network from chain ID', () => {
      expect(getNetworkFromChainId(56)).toBe('bsc')
      expect(getNetworkFromChainId(97)).toBe('bsc-testnet')
    })

    it('should get chain ID from network name', () => {
      expect(getChainId('bsc')).toBe(56)
      expect(getChainId('bsc-testnet')).toBe(97)
    })
  })

  describe('RPC Endpoints', () => {
    it('should have BSC mainnet RPC endpoint', () => {
      expect(ETHEREUM_RPC_ENDPOINTS.bsc).toBeDefined()
      expect(ETHEREUM_RPC_ENDPOINTS.bsc).toContain('binance')
    })

    it('should have BSC testnet RPC endpoint', () => {
      expect(ETHEREUM_RPC_ENDPOINTS['bsc-testnet']).toBeDefined()
      expect(ETHEREUM_RPC_ENDPOINTS['bsc-testnet']).toContain('binance')
    })
  })

  describe('Explorer URLs', () => {
    it('should have BSC mainnet explorer URL', () => {
      expect(ETHEREUM_EXPLORER_URLS.bsc).toBe('https://bscscan.com')
    })

    it('should have BSC testnet explorer URL', () => {
      expect(ETHEREUM_EXPLORER_URLS['bsc-testnet']).toBe('https://testnet.bscscan.com')
    })

    it('should generate correct transaction explorer URL', () => {
      const txHash = '0x1234567890abcdef'
      expect(getExplorerUrl(txHash, 'bsc')).toBe('https://bscscan.com/tx/0x1234567890abcdef')
    })

    it('should generate correct address explorer URL', () => {
      const address = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'
      expect(getAddressExplorerUrl(address, 'bsc')).toBe(
        'https://bscscan.com/address/0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'
      )
    })
  })

  describe('Network Type Detection', () => {
    it('should identify BSC testnet as testnet', () => {
      expect(isTestnet('bsc-testnet')).toBe(true)
    })

    it('should NOT identify BSC mainnet as testnet', () => {
      expect(isTestnet('bsc')).toBe(false)
    })

    it('should NOT identify BSC as L2', () => {
      expect(isL2Network('bsc')).toBe(false)
      expect(isL2Network('bsc-testnet')).toBe(false)
    })

    it('should identify BSC as Alt L1', () => {
      expect(isAltL1Network('bsc')).toBe(true)
      expect(isAltL1Network('bsc-testnet')).toBe(true)
    })

    it('should NOT identify Ethereum mainnet as Alt L1', () => {
      expect(isAltL1Network('mainnet')).toBe(false)
    })
  })
})

// ─── Token Configuration Tests ───────────────────────────────────────────────

describe('BSC Token Configuration', () => {
  describe('Token Addresses', () => {
    it('should have valid WBNB address', () => {
      expect(BSC_TOKEN_CONTRACTS.WBNB).toBe('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c')
      expect(isValidEthAddress(BSC_TOKEN_CONTRACTS.WBNB)).toBe(true)
    })

    it('should have valid USDC address', () => {
      expect(BSC_TOKEN_CONTRACTS.USDC).toBe('0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d')
      expect(isValidEthAddress(BSC_TOKEN_CONTRACTS.USDC)).toBe(true)
    })

    it('should have valid USDT address', () => {
      expect(BSC_TOKEN_CONTRACTS.USDT).toBe('0x55d398326f99059fF775485246999027B3197955')
      expect(isValidEthAddress(BSC_TOKEN_CONTRACTS.USDT)).toBe(true)
    })

    it('should have valid CAKE (PancakeSwap) address', () => {
      expect(BSC_TOKEN_CONTRACTS.CAKE).toBe('0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82')
      expect(isValidEthAddress(BSC_TOKEN_CONTRACTS.CAKE)).toBe(true)
    })

    it('should have valid ETH (Binance-Peg) address', () => {
      expect(BSC_TOKEN_CONTRACTS.ETH).toBe('0x2170Ed0880ac9A755fd29B2688956BD959F933F8')
      expect(isValidEthAddress(BSC_TOKEN_CONTRACTS.ETH)).toBe(true)
    })

    it('should have valid BTCB address', () => {
      expect(BSC_TOKEN_CONTRACTS.BTCB).toBe('0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c')
      expect(isValidEthAddress(BSC_TOKEN_CONTRACTS.BTCB)).toBe(true)
    })
  })

  describe('Token Decimals', () => {
    it('should have correct BNB decimals', () => {
      expect(BSC_TOKEN_DECIMALS.BNB).toBe(18)
    })

    it('should have correct WBNB decimals', () => {
      expect(BSC_TOKEN_DECIMALS.WBNB).toBe(18)
    })

    it('should have correct stablecoin decimals (18 on BSC)', () => {
      // Note: BSC uses 18 decimals for stablecoins, unlike Ethereum's 6
      expect(BSC_TOKEN_DECIMALS.USDC).toBe(18)
      expect(BSC_TOKEN_DECIMALS.USDT).toBe(18)
      expect(BSC_TOKEN_DECIMALS.DAI).toBe(18)
    })

    it('should have correct CAKE decimals', () => {
      expect(BSC_TOKEN_DECIMALS.CAKE).toBe(18)
    })
  })
})

// ─── PancakeSwap Integration Tests ───────────────────────────────────────────

describe('PancakeSwap Integration', () => {
  describe('Mainnet Contracts', () => {
    it('should have valid SmartRouter address', () => {
      expect(PANCAKESWAP_CONTRACTS.SMART_ROUTER).toBe('0x13f4EA83D0bd40E75C8222255bc855a974568Dd4')
      expect(isValidEthAddress(PANCAKESWAP_CONTRACTS.SMART_ROUTER)).toBe(true)
    })

    it('should have valid V3 Router address', () => {
      expect(PANCAKESWAP_CONTRACTS.V3_ROUTER).toBeDefined()
      expect(isValidEthAddress(PANCAKESWAP_CONTRACTS.V3_ROUTER)).toBe(true)
    })

    it('should have valid V2 Router address', () => {
      expect(PANCAKESWAP_CONTRACTS.V2_ROUTER).toBe('0x10ED43C718714eb63d5aA57B78B54704E256024E')
      expect(isValidEthAddress(PANCAKESWAP_CONTRACTS.V2_ROUTER)).toBe(true)
    })

    it('should have valid V3 Factory address', () => {
      expect(PANCAKESWAP_CONTRACTS.V3_FACTORY).toBeDefined()
      expect(isValidEthAddress(PANCAKESWAP_CONTRACTS.V3_FACTORY)).toBe(true)
    })

    it('should have valid V2 Factory address', () => {
      expect(PANCAKESWAP_CONTRACTS.V2_FACTORY).toBe('0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73')
      expect(isValidEthAddress(PANCAKESWAP_CONTRACTS.V2_FACTORY)).toBe(true)
    })

    it('should have valid Quoter V2 address', () => {
      expect(PANCAKESWAP_CONTRACTS.QUOTER_V2).toBeDefined()
      expect(isValidEthAddress(PANCAKESWAP_CONTRACTS.QUOTER_V2)).toBe(true)
    })
  })

  describe('Testnet Contracts', () => {
    it('should have valid testnet SmartRouter address', () => {
      expect(PANCAKESWAP_TESTNET_CONTRACTS.SMART_ROUTER).toBeDefined()
      expect(isValidEthAddress(PANCAKESWAP_TESTNET_CONTRACTS.SMART_ROUTER)).toBe(true)
    })

    it('should have valid testnet V2 Router address', () => {
      expect(PANCAKESWAP_TESTNET_CONTRACTS.V2_ROUTER).toBe('0xD99D1c33F9fC3444f8101754aBC46c52416550D1')
      expect(isValidEthAddress(PANCAKESWAP_TESTNET_CONTRACTS.V2_ROUTER)).toBe(true)
    })

    it('should have valid testnet V2 Factory address', () => {
      expect(PANCAKESWAP_TESTNET_CONTRACTS.V2_FACTORY).toBe('0x6725F303b657a9451d8BA641348b6761A6CC7a17')
      expect(isValidEthAddress(PANCAKESWAP_TESTNET_CONTRACTS.V2_FACTORY)).toBe(true)
    })
  })
})

// ─── Gas Estimation Tests ────────────────────────────────────────────────────

describe('BSC Gas Estimation', () => {
  // BSC base fee is ~3 gwei
  const BSC_BASE_FEE = 3n * ONE_GWEI
  // Ethereum base fee is ~30 gwei
  const ETH_BASE_FEE = 30n * ONE_GWEI

  it('should get gas price suggestion for BSC mainnet', () => {
    const gasPrice = getGasPriceSuggestion(BSC_BASE_FEE, 'standard')

    expect(gasPrice).toBeDefined()
    expect(gasPrice.baseFeePerGas).toBe(BSC_BASE_FEE)
    expect(gasPrice.maxFeePerGas).toBeGreaterThan(0n)
    expect(gasPrice.maxPriorityFeePerGas).toBeGreaterThan(0n)
  })

  it('should get gas price suggestion for different speeds', () => {
    const slowGas = getGasPriceSuggestion(BSC_BASE_FEE, 'slow')
    const standardGas = getGasPriceSuggestion(BSC_BASE_FEE, 'standard')
    const fastGas = getGasPriceSuggestion(BSC_BASE_FEE, 'fast')

    // Fast should have higher priority fee than standard
    expect(fastGas.maxPriorityFeePerGas).toBeGreaterThan(standardGas.maxPriorityFeePerGas)
    // Standard should have higher priority fee than slow
    expect(standardGas.maxPriorityFeePerGas).toBeGreaterThan(slowGas.maxPriorityFeePerGas)
  })

  it('should have lower gas price than Ethereum mainnet', () => {
    const bscGas = getGasPriceSuggestion(BSC_BASE_FEE, 'standard')
    const ethGas = getGasPriceSuggestion(ETH_BASE_FEE, 'standard')

    // BSC gas should be significantly lower than Ethereum
    expect(bscGas.baseFeePerGas).toBeLessThan(ethGas.baseFeePerGas)
    expect(bscGas.maxFeePerGas).toBeLessThan(ethGas.maxFeePerGas)
  })
})

// ─── Deployment Compatibility Tests ──────────────────────────────────────────

describe('BSC Deployment Compatibility', () => {
  it('should use EVM-compatible chain ID format', () => {
    // Chain IDs should be positive integers
    expect(typeof EVM_CHAIN_IDS.bsc).toBe('number')
    expect(EVM_CHAIN_IDS.bsc).toBeGreaterThan(0)
  })

  it('should have compatible RPC endpoint format', () => {
    // RPC endpoints should be valid URLs
    expect(ETHEREUM_RPC_ENDPOINTS.bsc).toMatch(/^https?:\/\//)
  })

  it('should have compatible explorer API format', () => {
    // Explorer URLs should support etherscan-compatible API
    expect(ETHEREUM_EXPLORER_URLS.bsc).toContain('bscscan.com')
  })
})
