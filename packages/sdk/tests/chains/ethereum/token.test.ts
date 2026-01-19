/**
 * Ethereum Token Helper Tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  TokenHelper,
  createTokenHelper,
  createMainnetTokenHelper,
  createSepoliaTokenHelper,
  MAX_UINT256,
} from '../../../src/chains/ethereum'

describe('Ethereum Token Helper', () => {
  let helper: TokenHelper

  beforeEach(() => {
    helper = new TokenHelper('mainnet')
  })

  describe('constructor', () => {
    it('should create with default settings', () => {
      expect(helper.getNetwork()).toBe('mainnet')
    })

    it('should create with custom network', () => {
      const sepoliaHelper = new TokenHelper('sepolia')
      expect(sepoliaHelper.getNetwork()).toBe('sepolia')
    })

    it('should create with custom RPC URL', () => {
      const customHelper = new TokenHelper('mainnet', {
        rpcUrl: 'https://custom-rpc.example.com',
      })
      expect(customHelper.getNetwork()).toBe('mainnet')
    })
  })

  describe('factory functions', () => {
    it('should create helper with factory', () => {
      const factoryHelper = createTokenHelper('sepolia')
      expect(factoryHelper.getNetwork()).toBe('sepolia')
    })

    it('should create mainnet helper', () => {
      const mainnetHelper = createMainnetTokenHelper()
      expect(mainnetHelper.getNetwork()).toBe('mainnet')
    })

    it('should create mainnet helper with custom URL', () => {
      const customHelper = createMainnetTokenHelper('https://custom.example.com')
      expect(customHelper.getNetwork()).toBe('mainnet')
    })

    it('should create Sepolia helper', () => {
      const sepoliaHelper = createSepoliaTokenHelper()
      expect(sepoliaHelper.getNetwork()).toBe('sepolia')
    })
  })

  describe('buildApproval', () => {
    const tokenAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}` // USDC
    const spender = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D' as `0x${string}` // Uniswap router

    it('should build approval with unlimited amount by default', () => {
      const approval = helper.buildApproval(tokenAddress, spender)

      expect(approval.tokenAddress).toBe(tokenAddress)
      expect(approval.spender).toBe(spender)
      expect(approval.amount).toBe(MAX_UINT256)
      expect(approval.tx.to).toBe(tokenAddress)
      expect(approval.tx.value).toBe(0n)
      expect(approval.estimatedGas).toBeGreaterThan(0n)
    })

    it('should build approval with specific amount', () => {
      const amount = 100_000_000n // 100 USDC
      const approval = helper.buildApproval(tokenAddress, spender, amount)

      expect(approval.amount).toBe(amount)
      expect(approval.tx.data).toContain('095ea7b3') // approve selector
    })

    it('should encode spender address in call data', () => {
      const approval = helper.buildApproval(tokenAddress, spender)

      // Approve selector is 0x095ea7b3
      expect(approval.tx.data.startsWith('0x095ea7b3')).toBe(true)
      // Spender address should be in the data (lowercase, padded to 64 chars)
      expect(approval.tx.data.toLowerCase()).toContain(
        spender.slice(2).toLowerCase().padStart(64, '0')
      )
    })

    it('should encode amount in call data', () => {
      const amount = 1000n
      const approval = helper.buildApproval(tokenAddress, spender, amount)

      // Amount should be encoded in hex, padded to 64 chars
      const amountHex = amount.toString(16).padStart(64, '0')
      expect(approval.tx.data.toLowerCase()).toContain(amountHex)
    })
  })

  describe('formatAmount', () => {
    it('should format whole numbers', () => {
      expect(helper.formatAmount(1000000n, 6)).toBe('1') // 1 USDC
      expect(helper.formatAmount(1000000000000000000n, 18)).toBe('1') // 1 ETH
    })

    it('should format fractional amounts', () => {
      expect(helper.formatAmount(1500000n, 6)).toBe('1.5') // 1.5 USDC
      expect(helper.formatAmount(1234567n, 6)).toBe('1.234567') // 1.234567 USDC
    })

    it('should trim trailing zeros', () => {
      expect(helper.formatAmount(1100000n, 6)).toBe('1.1')
      expect(helper.formatAmount(1010000n, 6)).toBe('1.01')
    })

    it('should handle zero', () => {
      expect(helper.formatAmount(0n, 6)).toBe('0')
      expect(helper.formatAmount(0n, 18)).toBe('0')
    })

    it('should handle small amounts', () => {
      expect(helper.formatAmount(1n, 6)).toBe('0.000001')
      expect(helper.formatAmount(1n, 18)).toBe('0.000000000000000001')
    })
  })

  describe('parseAmount', () => {
    it('should parse whole numbers', () => {
      expect(helper.parseAmount('1', 6)).toBe(1000000n)
      expect(helper.parseAmount('1', 18)).toBe(1000000000000000000n)
    })

    it('should parse fractional amounts', () => {
      expect(helper.parseAmount('1.5', 6)).toBe(1500000n)
      expect(helper.parseAmount('1.234567', 6)).toBe(1234567n)
    })

    it('should handle amounts with fewer decimals', () => {
      expect(helper.parseAmount('1.1', 6)).toBe(1100000n)
      expect(helper.parseAmount('1.01', 6)).toBe(1010000n)
    })

    it('should truncate excess decimals', () => {
      // 1.1234567 with 6 decimals should truncate to 1.123456
      expect(helper.parseAmount('1.1234567', 6)).toBe(1123456n)
    })

    it('should handle zero', () => {
      expect(helper.parseAmount('0', 6)).toBe(0n)
      expect(helper.parseAmount('0.0', 6)).toBe(0n)
    })
  })

  describe('buildPermitCallData', () => {
    it('should encode permit call correctly', () => {
      const owner = '0x1234567890123456789012345678901234567890' as `0x${string}`
      const spender = '0xabcdef0123456789abcdef0123456789abcdef01' as `0x${string}`
      const value = 1000000n
      const deadline = 1700000000n
      const v = 28
      const r = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as `0x${string}`
      const s = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as `0x${string}`

      const callData = helper.buildPermitCallData({
        owner,
        spender,
        value,
        deadline,
        v,
        r,
        s,
      })

      // Should start with permit selector
      expect(callData.startsWith('0xd505accf')).toBe(true)

      // Should contain encoded parameters
      expect(callData.toLowerCase()).toContain(owner.slice(2).toLowerCase().padStart(64, '0'))
      expect(callData.toLowerCase()).toContain(spender.slice(2).toLowerCase().padStart(64, '0'))
    })
  })

  describe('metadata cache', () => {
    it('should clear cache', () => {
      // Just verify the method exists and doesn't throw
      expect(() => helper.clearCache()).not.toThrow()
    })
  })

  describe('MAX_UINT256', () => {
    it('should be correct value', () => {
      expect(MAX_UINT256).toBe(2n ** 256n - 1n)
    })

    it('should be used for unlimited approvals', () => {
      const tokenAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`
      const spender = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D' as `0x${string}`

      const approval = helper.buildApproval(tokenAddress, spender)
      expect(approval.amount).toBe(MAX_UINT256)
    })
  })

  describe('ERC-20 function selectors', () => {
    it('should use correct approve selector', () => {
      const tokenAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`
      const spender = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D' as `0x${string}`

      const approval = helper.buildApproval(tokenAddress, spender)
      expect(approval.tx.data.startsWith('0x095ea7b3')).toBe(true)
    })

    it('should use correct permit selector', () => {
      const callData = helper.buildPermitCallData({
        owner: '0x1234567890123456789012345678901234567890' as `0x${string}`,
        spender: '0xabcdef0123456789abcdef0123456789abcdef01' as `0x${string}`,
        value: 1000000n,
        deadline: 1700000000n,
        v: 28,
        r: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as `0x${string}`,
        s: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as `0x${string}`,
      })

      expect(callData.startsWith('0xd505accf')).toBe(true)
    })
  })

  describe('format and parse roundtrip', () => {
    it('should roundtrip whole numbers', () => {
      const amount = 1000000n // 1 USDC
      const formatted = helper.formatAmount(amount, 6)
      const parsed = helper.parseAmount(formatted, 6)
      expect(parsed).toBe(amount)
    })

    it('should roundtrip fractional amounts', () => {
      const amount = 1234567n // 1.234567 USDC
      const formatted = helper.formatAmount(amount, 6)
      const parsed = helper.parseAmount(formatted, 6)
      expect(parsed).toBe(amount)
    })

    it('should roundtrip large amounts', () => {
      const amount = 1000000000000n // 1,000,000 USDC
      const formatted = helper.formatAmount(amount, 6)
      const parsed = helper.parseAmount(formatted, 6)
      expect(parsed).toBe(amount)
    })
  })

  // Note: The following tests require network access and are integration tests
  // They are commented out but can be enabled for integration testing

  /*
  describe('integration: getTokenMetadata', () => {
    it('should get USDC metadata', async () => {
      const sepoliaHelper = createSepoliaTokenHelper()
      const usdc = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}` // Sepolia USDC

      const metadata = await sepoliaHelper.getTokenMetadata(usdc)

      expect(metadata.symbol).toBe('USDC')
      expect(metadata.decimals).toBe(6)
      expect(metadata.address).toBe(usdc)
    })

    it('should cache metadata', async () => {
      const sepoliaHelper = createSepoliaTokenHelper()
      const usdc = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`

      // First call - fetches from network
      const metadata1 = await sepoliaHelper.getTokenMetadata(usdc)

      // Second call - should use cache
      const metadata2 = await sepoliaHelper.getTokenMetadata(usdc)

      expect(metadata1).toEqual(metadata2)
    })
  })

  describe('integration: getBalance', () => {
    it('should get token balance', async () => {
      const sepoliaHelper = createSepoliaTokenHelper()
      const usdc = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`
      const zeroAddress = '0x0000000000000000000000000000000000000000' as `0x${string}`

      const balance = await sepoliaHelper.getBalance(usdc, zeroAddress)
      expect(balance).toBeGreaterThanOrEqual(0n)
    })
  })

  describe('integration: getAllowance', () => {
    it('should get allowance', async () => {
      const sepoliaHelper = createSepoliaTokenHelper()
      const usdc = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`
      const owner = '0x0000000000000000000000000000000000000000' as `0x${string}`
      const spender = '0x0000000000000000000000000000000000000001' as `0x${string}`

      const allowance = await sepoliaHelper.getAllowance(usdc, owner, spender)
      expect(allowance).toBeGreaterThanOrEqual(0n)
    })
  })

  describe('integration: checkTransfer', () => {
    it('should check transfer feasibility', async () => {
      const sepoliaHelper = createSepoliaTokenHelper()
      const usdc = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`
      const owner = '0x0000000000000000000000000000000000000000' as `0x${string}`
      const spender = '0x0000000000000000000000000000000000000001' as `0x${string}`

      const check = await sepoliaHelper.checkTransfer({
        owner,
        spender,
        tokenAddress: usdc,
        amount: 1000000n,
      })

      expect(check.balance).toBeGreaterThanOrEqual(0n)
      expect(check.allowance).toBeGreaterThanOrEqual(0n)
      expect(check.needsApproval).toBeDefined()
      expect(check.gasEstimate).toBeDefined()
    })
  })

  describe('integration: supportsPermit', () => {
    it('should check permit support', async () => {
      const sepoliaHelper = createSepoliaTokenHelper()
      const usdc = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`

      const supports = await sepoliaHelper.supportsPermit(usdc)
      expect(typeof supports).toBe('boolean')
    })
  })
  */
})
