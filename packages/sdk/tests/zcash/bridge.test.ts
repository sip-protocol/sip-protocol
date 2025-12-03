/**
 * ZcashBridge Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  ZcashBridge,
  createZcashBridge,
  type ZcashBridgeConfig,
  type BridgeParams,
  type BridgeRoute,
} from '../../src/zcash/bridge'
import { ValidationError, IntentError } from '../../src/errors'
import type { BridgeProvider } from '../../src/zcash/swap-service'

describe('ZcashBridge', () => {
  let bridge: ZcashBridge

  beforeEach(() => {
    bridge = new ZcashBridge({ mode: 'demo' })
  })

  // ─── Constructor ─────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should create bridge in demo mode', () => {
      const b = new ZcashBridge({ mode: 'demo' })
      expect(b).toBeInstanceOf(ZcashBridge)
    })

    it('should create bridge in production mode', () => {
      const b = new ZcashBridge({ mode: 'production' })
      expect(b).toBeInstanceOf(ZcashBridge)
    })

    it('should accept custom slippage', () => {
      const b = new ZcashBridge({
        mode: 'demo',
        defaultSlippage: 200, // 2%
      })
      expect(b).toBeInstanceOf(ZcashBridge)
    })
  })

  // ─── createZcashBridge ───────────────────────────────────────────────────────

  describe('createZcashBridge', () => {
    it('should create bridge instance', () => {
      const b = createZcashBridge({ mode: 'demo' })
      expect(b).toBeInstanceOf(ZcashBridge)
    })
  })

  // ─── getSupportedRoutes ──────────────────────────────────────────────────────

  describe('getSupportedRoutes', () => {
    it('should return all supported routes', () => {
      const routes = bridge.getSupportedRoutes()

      expect(routes.length).toBeGreaterThan(0)
      expect(routes.every((r) => r.sourceChain)).toBe(true)
      expect(routes.every((r) => r.sourceToken)).toBe(true)
    })

    it('should include ETH→ZEC route', () => {
      const routes = bridge.getSupportedRoutes()
      const ethRoute = routes.find(
        (r) => r.sourceChain === 'ethereum' && r.sourceToken === 'ETH',
      )

      expect(ethRoute).toBeDefined()
      expect(ethRoute!.active).toBe(true)
      expect(ethRoute!.feeBps).toBeGreaterThan(0)
    })

    it('should include SOL→ZEC route', () => {
      const routes = bridge.getSupportedRoutes()
      const solRoute = routes.find(
        (r) => r.sourceChain === 'solana' && r.sourceToken === 'SOL',
      )

      expect(solRoute).toBeDefined()
      expect(solRoute!.active).toBe(true)
    })

    it('should include stablecoin routes', () => {
      const routes = bridge.getSupportedRoutes()

      const ethUsdc = routes.find(
        (r) => r.sourceChain === 'ethereum' && r.sourceToken === 'USDC',
      )
      const solUsdc = routes.find(
        (r) => r.sourceChain === 'solana' && r.sourceToken === 'USDC',
      )

      expect(ethUsdc).toBeDefined()
      expect(solUsdc).toBeDefined()
    })

    it('should include min/max amounts', () => {
      const routes = bridge.getSupportedRoutes()

      routes.forEach((route) => {
        expect(route.minAmount).toBeGreaterThan(0n)
        expect(route.maxAmount).toBeGreaterThan(route.minAmount)
      })
    })

    it('should include estimated times', () => {
      const routes = bridge.getSupportedRoutes()

      routes.forEach((route) => {
        expect(route.estimatedTime).toBeGreaterThan(0)
      })
    })
  })

  // ─── getRoutesForChain ───────────────────────────────────────────────────────

  describe('getRoutesForChain', () => {
    it('should return routes for ethereum', () => {
      const routes = bridge.getRoutesForChain('ethereum')

      expect(routes.length).toBeGreaterThan(0)
      expect(routes.every((r) => r.sourceChain === 'ethereum')).toBe(true)
    })

    it('should return routes for solana', () => {
      const routes = bridge.getRoutesForChain('solana')

      expect(routes.length).toBeGreaterThan(0)
      expect(routes.every((r) => r.sourceChain === 'solana')).toBe(true)
    })

    it('should return routes for near', () => {
      const routes = bridge.getRoutesForChain('near')

      expect(routes.length).toBeGreaterThan(0)
      expect(routes.every((r) => r.sourceChain === 'near')).toBe(true)
    })
  })

  // ─── isRouteSupported ────────────────────────────────────────────────────────

  describe('isRouteSupported', () => {
    it('should return true for ETH→ZEC', () => {
      expect(bridge.isRouteSupported('ethereum', 'ETH')).toBe(true)
    })

    it('should return true for SOL→ZEC', () => {
      expect(bridge.isRouteSupported('solana', 'SOL')).toBe(true)
    })

    it('should return true for NEAR→ZEC', () => {
      expect(bridge.isRouteSupported('near', 'NEAR')).toBe(true)
    })

    it('should return true for USDC on ethereum', () => {
      expect(bridge.isRouteSupported('ethereum', 'USDC')).toBe(true)
    })

    it('should return false for unsupported routes', () => {
      // SOL token on ethereum is not a valid route
      expect(bridge.isRouteSupported('ethereum', 'SOL')).toBe(false)
    })
  })

  // ─── getRoute ────────────────────────────────────────────────────────────────

  describe('getRoute', () => {
    it('should return route details for valid route', () => {
      const route = bridge.getRoute('ethereum', 'ETH')

      expect(route).not.toBeNull()
      expect(route!.sourceChain).toBe('ethereum')
      expect(route!.sourceToken).toBe('ETH')
      expect(route!.active).toBe(true)
    })

    it('should return null for invalid route', () => {
      const route = bridge.getRoute('ethereum', 'SOL')
      expect(route).toBeNull()
    })
  })

  // ─── bridgeToShielded ────────────────────────────────────────────────────────

  describe('bridgeToShielded', () => {
    const validParams: BridgeParams = {
      sourceChain: 'ethereum',
      sourceToken: 'ETH',
      amount: 1000000000000000000n, // 1 ETH
      recipientAddress: 'zs1testaddress1234567890abcdef',
    }

    describe('validation', () => {
      it('should throw on missing source chain', async () => {
        await expect(
          bridge.bridgeToShielded({
            ...validParams,
            sourceChain: '' as any,
          }),
        ).rejects.toThrow(ValidationError)
      })

      it('should throw on missing source token', async () => {
        await expect(
          bridge.bridgeToShielded({
            ...validParams,
            sourceToken: '' as any,
          }),
        ).rejects.toThrow(ValidationError)
      })

      it('should throw on zero amount', async () => {
        await expect(
          bridge.bridgeToShielded({
            ...validParams,
            amount: 0n,
          }),
        ).rejects.toThrow(ValidationError)
      })

      it('should throw on negative amount', async () => {
        await expect(
          bridge.bridgeToShielded({
            ...validParams,
            amount: -1n,
          }),
        ).rejects.toThrow(ValidationError)
      })

      it('should throw on missing recipient address', async () => {
        await expect(
          bridge.bridgeToShielded({
            ...validParams,
            recipientAddress: '',
          }),
        ).rejects.toThrow(ValidationError)
      })

      it('should throw on unsupported route', async () => {
        await expect(
          bridge.bridgeToShielded({
            ...validParams,
            sourceChain: 'ethereum',
            sourceToken: 'SOL', // Not supported on ethereum
          }),
        ).rejects.toThrow(ValidationError)
      })

      it('should throw on invalid shielded address format', async () => {
        await expect(
          bridge.bridgeToShielded({
            ...validParams,
            recipientAddress: 'invalid_address',
          }),
        ).rejects.toThrow(ValidationError)
      })

      it('should throw on amount below minimum', async () => {
        await expect(
          bridge.bridgeToShielded({
            ...validParams,
            amount: 1n, // Too small
          }),
        ).rejects.toThrow(ValidationError)
      })
    })

    describe('ETH→ZEC route', () => {
      it('should bridge ETH to shielded ZEC', async () => {
        const result = await bridge.bridgeToShielded(validParams)

        expect(result.requestId).toBeDefined()
        expect(result.status).toBe('completed')
        expect(result.recipientAddress).toBe(validParams.recipientAddress)
        expect(result.sourceTxHash).toBeDefined()
        expect(result.shieldedTxId).toBeDefined()
        expect(result.amountReceived).toBeGreaterThan(0n)
        expect(result.amountReceivedFormatted).toBeDefined()
      })

      it('should include transparent intermediary for shielded transfers', async () => {
        const result = await bridge.bridgeToShielded({
          ...validParams,
          shield: true,
        })

        expect(result.status).toBe('completed')
        expect(result.transparentAddress).toBeDefined()
        expect(result.transparentAddress!.startsWith('t1')).toBe(true)
      })

      it('should calculate fees', async () => {
        const result = await bridge.bridgeToShielded(validParams)

        expect(result.totalFee).toBeGreaterThan(0n)
      })
    })

    describe('SOL→ZEC route', () => {
      it('should bridge SOL to shielded ZEC', async () => {
        const result = await bridge.bridgeToShielded({
          sourceChain: 'solana',
          sourceToken: 'SOL',
          amount: 10000000000n, // 10 SOL
          recipientAddress: 'zs1testaddress1234567890abcdef',
        })

        expect(result.status).toBe('completed')
        expect(result.amountReceived).toBeGreaterThan(0n)
      })
    })

    describe('USDC routes', () => {
      it('should bridge USDC from ethereum to ZEC', async () => {
        const result = await bridge.bridgeToShielded({
          sourceChain: 'ethereum',
          sourceToken: 'USDC',
          amount: 100000000n, // 100 USDC
          recipientAddress: 'zs1testaddress1234567890abcdef',
        })

        expect(result.status).toBe('completed')
        expect(result.amountReceived).toBeGreaterThan(0n)
      })

      it('should bridge USDC from solana to ZEC', async () => {
        const result = await bridge.bridgeToShielded({
          sourceChain: 'solana',
          sourceToken: 'USDC',
          amount: 100000000n, // 100 USDC
          recipientAddress: 'zs1testaddress1234567890abcdef',
        })

        expect(result.status).toBe('completed')
      })
    })

    describe('memo support', () => {
      it('should accept memo parameter', async () => {
        const result = await bridge.bridgeToShielded({
          ...validParams,
          memo: 'Test payment from SIP',
        })

        expect(result.status).toBe('completed')
      })
    })

    describe('shield option', () => {
      it('should shield by default', async () => {
        const result = await bridge.bridgeToShielded(validParams)

        expect(result.shieldedTxId).toBeDefined()
      })

      it('should skip shielding when shield=false', async () => {
        const result = await bridge.bridgeToShielded({
          sourceChain: 'ethereum',
          sourceToken: 'ETH',
          amount: 1000000000000000000n,
          recipientAddress: 't1testaddress1234567890abcdef', // t-address
          shield: false,
        })

        expect(result.status).toBe('completed')
        expect(result.shieldedTxId).toBeUndefined()
      })
    })

    describe('address formats', () => {
      it('should accept zs1 addresses', async () => {
        const result = await bridge.bridgeToShielded({
          ...validParams,
          recipientAddress: 'zs1abcdefghijklmnopqrstuvwxyz123456',
        })

        expect(result.status).toBe('completed')
      })

      it('should accept u1 unified addresses', async () => {
        const result = await bridge.bridgeToShielded({
          ...validParams,
          recipientAddress: 'u1abcdefghijklmnopqrstuvwxyz123456',
        })

        expect(result.status).toBe('completed')
      })

      it('should accept testnet addresses', async () => {
        const result = await bridge.bridgeToShielded({
          ...validParams,
          recipientAddress: 'ztestsaplingabcdefghijklmnop',
        })

        expect(result.status).toBe('completed')
      })
    })
  })

  // ─── getStatus ───────────────────────────────────────────────────────────────

  describe('getStatus', () => {
    it('should return status for existing request', async () => {
      const result = await bridge.bridgeToShielded({
        sourceChain: 'ethereum',
        sourceToken: 'ETH',
        amount: 1000000000000000000n,
        recipientAddress: 'zs1testaddress1234567890abcdef',
      })

      const status = bridge.getStatus(result.requestId)

      expect(status).not.toBeNull()
      expect(status!.requestId).toBe(result.requestId)
      expect(status!.status).toBe('completed')
    })

    it('should return null for non-existent request', () => {
      const status = bridge.getStatus('non_existent_id')
      expect(status).toBeNull()
    })
  })

  // ─── waitForCompletion ───────────────────────────────────────────────────────

  describe('waitForCompletion', () => {
    it('should return completed result immediately if already done', async () => {
      const result = await bridge.bridgeToShielded({
        sourceChain: 'ethereum',
        sourceToken: 'ETH',
        amount: 1000000000000000000n,
        recipientAddress: 'zs1testaddress1234567890abcdef',
      })

      const completed = await bridge.waitForCompletion(result.requestId)

      expect(completed.status).toBe('completed')
    })

    it('should throw for non-existent request', async () => {
      await expect(
        bridge.waitForCompletion('non_existent_id'),
      ).rejects.toThrow(IntentError)
    })
  })

  // ─── Production Mode ─────────────────────────────────────────────────────────

  describe('production mode', () => {
    it('should throw if bridge provider not configured', async () => {
      const prodBridge = new ZcashBridge({ mode: 'production' })

      await expect(
        prodBridge.bridgeToShielded({
          sourceChain: 'ethereum',
          sourceToken: 'ETH',
          amount: 1000000000000000000n,
          recipientAddress: 'zs1testaddress1234567890abcdef',
        }),
      ).rejects.toThrow(IntentError)
    })

    it('should use bridge provider when configured', async () => {
      const mockBridgeProvider: BridgeProvider = {
        name: 'MockBridge',
        getQuote: vi.fn().mockResolvedValue({
          quoteId: 'mock_quote_123',
          amountIn: 1000000000000000000n,
          amountOut: 7000000000n, // 70 ZEC in zatoshis
          fee: 50000000n,
          exchangeRate: 0.014,
          validUntil: Math.floor(Date.now() / 1000) + 60,
        }),
        executeSwap: vi.fn().mockResolvedValue({
          txHash: '0xmocktxhash',
          status: 'completed',
          amountReceived: 7000000000n,
        }),
        getSupportedChains: vi.fn().mockResolvedValue(['ethereum', 'solana']),
      }

      const prodBridge = new ZcashBridge({
        mode: 'production',
        bridgeProvider: mockBridgeProvider,
      })

      const result = await prodBridge.bridgeToShielded({
        sourceChain: 'ethereum',
        sourceToken: 'ETH',
        amount: 1000000000000000000n,
        recipientAddress: 'zs1testaddress1234567890abcdef',
      })

      expect(result.status).toBe('completed')
      expect(mockBridgeProvider.getQuote).toHaveBeenCalled()
      expect(mockBridgeProvider.executeSwap).toHaveBeenCalled()
    })
  })

  // ─── Chain Coverage ──────────────────────────────────────────────────────────

  describe('chain coverage', () => {
    const chains: Array<{ chain: any; token: any; amount: bigint }> = [
      { chain: 'ethereum', token: 'ETH', amount: 1000000000000000000n },      // 1 ETH (~$2500)
      { chain: 'solana', token: 'SOL', amount: 10000000000n },                 // 10 SOL (~$1200)
      { chain: 'near', token: 'NEAR', amount: 100000000000000000000000000n }, // 100 NEAR (~$500)
      { chain: 'polygon', token: 'MATIC', amount: 20000000000000000000n },    // 20 MATIC (~$16)
      { chain: 'arbitrum', token: 'ETH', amount: 1000000000000000000n },      // 1 ETH (~$2500)
      { chain: 'base', token: 'ETH', amount: 1000000000000000000n },          // 1 ETH (~$2500)
    ]

    chains.forEach(({ chain, token, amount }) => {
      it(`should support ${chain}:${token} → ZEC route`, async () => {
        const result = await bridge.bridgeToShielded({
          sourceChain: chain,
          sourceToken: token,
          amount,
          recipientAddress: 'zs1testaddress1234567890abcdef',
        })

        expect(result.status).toBe('completed')
        expect(result.amountReceived).toBeGreaterThan(0n)
      })
    })
  })
})
