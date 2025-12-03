/**
 * DirectChainBackend Tests
 *
 * Tests for same-chain settlement backend
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { DirectChainBackend, type DirectChainBackendConfig } from '../../../src/settlement/backends/direct-chain'
import { SwapStatus } from '../../../src/settlement/interface'
import { PrivacyLevel, type ChainId } from '@sip-protocol/types'
import { MockWalletAdapter } from '../../../src/wallet/base-adapter'
import { ValidationError } from '../../../src/errors'
import { generateStealthMetaAddress, generateEd25519StealthMetaAddress } from '../../../src/stealth'

describe('DirectChainBackend', () => {
  let backend: DirectChainBackend

  beforeEach(() => {
    backend = new DirectChainBackend()
  })

  describe('constructor', () => {
    it('should create backend with default config', () => {
      expect(backend).toBeDefined()
      expect(backend.name).toBe('direct-chain')
    })

    it('should create backend with custom config', () => {
      const mockWallet = new MockWalletAdapter({ chain: 'ethereum' })
      const customBackend = new DirectChainBackend({
        walletAdapter: mockWallet,
        protocolFeeBps: 50, // 0.5%
      })

      expect(customBackend).toBeDefined()
      expect(customBackend.getWalletAdapter()).toBe(mockWallet)
    })
  })

  describe('capabilities', () => {
    it('should expose correct capabilities', () => {
      const caps = backend.capabilities

      expect(caps.supportedSourceChains).toContain('ethereum')
      expect(caps.supportedSourceChains).toContain('solana')
      expect(caps.supportedSourceChains).toContain('near')
      expect(caps.supportedDestinationChains).toContain('ethereum')
      expect(caps.supportedPrivacyLevels).toContain(PrivacyLevel.TRANSPARENT)
      expect(caps.supportedPrivacyLevels).toContain(PrivacyLevel.SHIELDED)
      expect(caps.supportedPrivacyLevels).toContain(PrivacyLevel.COMPLIANT)
      expect(caps.supportsCancellation).toBe(false)
      expect(caps.supportsRefunds).toBe(true)
      expect(caps.features).toContain('same-chain-only')
      expect(caps.features).toContain('stealth-addresses')
    })
  })

  describe('getQuote - validation', () => {
    it('should reject cross-chain requests', async () => {
      await expect(
        backend.getQuote({
          fromChain: 'ethereum',
          toChain: 'solana',
          fromToken: 'ETH',
          toToken: 'SOL',
          amount: 1000000000000000000n,
          privacyLevel: PrivacyLevel.TRANSPARENT,
          senderAddress: '0x1234567890123456789012345678901234567890',
        })
      ).rejects.toThrow(ValidationError)

      await expect(
        backend.getQuote({
          fromChain: 'ethereum',
          toChain: 'solana',
          fromToken: 'ETH',
          toToken: 'SOL',
          amount: 1000000000000000000n,
          privacyLevel: PrivacyLevel.TRANSPARENT,
          senderAddress: '0x1234567890123456789012345678901234567890',
        })
      ).rejects.toThrow(/only supports same-chain transfers/)
    })

    it('should reject unsupported chains', async () => {
      await expect(
        backend.getQuote({
          fromChain: 'unsupported-chain' as ChainId,
          toChain: 'unsupported-chain' as ChainId,
          fromToken: 'XYZ',
          toToken: 'XYZ',
          amount: 1000n,
          privacyLevel: PrivacyLevel.TRANSPARENT,
          senderAddress: '0x1234567890123456789012345678901234567890',
        })
      ).rejects.toThrow(ValidationError)
    })

    it('should require senderAddress for transparent mode', async () => {
      await expect(
        backend.getQuote({
          fromChain: 'ethereum',
          toChain: 'ethereum',
          fromToken: 'ETH',
          toToken: 'ETH',
          amount: 1000000000000000000n,
          privacyLevel: PrivacyLevel.TRANSPARENT,
        })
      ).rejects.toThrow(/senderAddress is required/)
    })

    it('should require recipientMetaAddress for shielded mode', async () => {
      await expect(
        backend.getQuote({
          fromChain: 'ethereum',
          toChain: 'ethereum',
          fromToken: 'ETH',
          toToken: 'ETH',
          amount: 1000000000000000000n,
          privacyLevel: PrivacyLevel.SHIELDED,
          senderAddress: '0x1234567890123456789012345678901234567890',
        })
      ).rejects.toThrow(/recipientMetaAddress is required/)
    })

    it('should reject amounts too small for fees', async () => {
      await expect(
        backend.getQuote({
          fromChain: 'ethereum',
          toChain: 'ethereum',
          fromToken: 'ETH',
          toToken: 'ETH',
          amount: 100n, // Too small
          privacyLevel: PrivacyLevel.TRANSPARENT,
          senderAddress: '0x1234567890123456789012345678901234567890',
        })
      ).rejects.toThrow(/Amount too small to cover fees/)
    })
  })

  describe('getQuote - transparent mode', () => {
    it('should generate quote for transparent ETH transfer', async () => {
      const quote = await backend.getQuote({
        fromChain: 'ethereum',
        toChain: 'ethereum',
        fromToken: 'ETH',
        toToken: 'ETH',
        amount: 1000000000000000000n, // 1 ETH
        privacyLevel: PrivacyLevel.TRANSPARENT,
        senderAddress: '0x1234567890123456789012345678901234567890',
      })

      expect(quote).toBeDefined()
      expect(quote.quoteId).toBeDefined()
      expect(quote.amountIn).toBe('1000000000000000000')
      expect(BigInt(quote.amountOut)).toBeLessThan(1000000000000000000n)
      expect(quote.fees.networkFee).toBeDefined()
      expect(quote.depositAddress).toBe('0x1234567890123456789012345678901234567890')
      expect(quote.recipientAddress).toBe('0x1234567890123456789012345678901234567890')
      expect(quote.route?.hops).toBe(1)
      expect(quote.route?.steps[0]?.protocol).toBe('direct-chain')
    })

    it('should generate quote for transparent SOL transfer', async () => {
      const quote = await backend.getQuote({
        fromChain: 'solana',
        toChain: 'solana',
        fromToken: 'SOL',
        toToken: 'SOL',
        amount: 1000000000n, // 1 SOL
        privacyLevel: PrivacyLevel.TRANSPARENT,
        senderAddress: 'SoLaNaAddReSS1111111111111111111111111111111',
      })

      expect(quote).toBeDefined()
      expect(quote.quoteId).toBeDefined()
      expect(BigInt(quote.amountOut)).toBeLessThan(1000000000n)
    })

    it('should apply slippage tolerance', async () => {
      const quote = await backend.getQuote({
        fromChain: 'ethereum',
        toChain: 'ethereum',
        fromToken: 'ETH',
        toToken: 'ETH',
        amount: 1000000000000000000n,
        privacyLevel: PrivacyLevel.TRANSPARENT,
        senderAddress: '0x1234567890123456789012345678901234567890',
        slippageTolerance: 100, // 1%
      })

      expect(BigInt(quote.minAmountOut)).toBeLessThan(BigInt(quote.amountOut))
    })
  })

  describe('getQuote - shielded mode', () => {
    it('should generate quote with stealth address for ETH (secp256k1)', async () => {
      const { metaAddress } = generateStealthMetaAddress('ethereum')

      const quote = await backend.getQuote({
        fromChain: 'ethereum',
        toChain: 'ethereum',
        fromToken: 'ETH',
        toToken: 'ETH',
        amount: 1000000000000000000n,
        privacyLevel: PrivacyLevel.SHIELDED,
        recipientMetaAddress: metaAddress,
        senderAddress: '0x1234567890123456789012345678901234567890',
      })

      expect(quote).toBeDefined()
      expect(quote.recipientAddress).not.toBe('0x1234567890123456789012345678901234567890')
      expect(quote.recipientAddress).toMatch(/^0x[a-fA-F0-9]{40}$/) // ETH address format
      expect(quote.metadata?.stealthAddress).toBeDefined()
      expect(quote.metadata?.stealthAddress.address).toBeDefined()
      expect(quote.metadata?.stealthAddress.ephemeralPublicKey).toBeDefined()
    })

    it('should generate quote with stealth address for SOL (ed25519)', async () => {
      const { metaAddress } = generateEd25519StealthMetaAddress('solana')

      const quote = await backend.getQuote({
        fromChain: 'solana',
        toChain: 'solana',
        fromToken: 'SOL',
        toToken: 'SOL',
        amount: 1000000000n,
        privacyLevel: PrivacyLevel.SHIELDED,
        recipientMetaAddress: metaAddress,
        senderAddress: 'SoLaNaAddReSS1111111111111111111111111111111',
      })

      expect(quote).toBeDefined()
      expect(quote.recipientAddress).not.toBe('SoLaNaAddReSS1111111111111111111111111111111')
      expect(quote.metadata?.stealthAddress).toBeDefined()
    })

    it('should generate quote with stealth address for NEAR (ed25519)', async () => {
      const { metaAddress } = generateEd25519StealthMetaAddress('near')

      const quote = await backend.getQuote({
        fromChain: 'near',
        toChain: 'near',
        fromToken: 'NEAR',
        toToken: 'NEAR',
        amount: 1000000000000000000000000n, // 1 NEAR
        privacyLevel: PrivacyLevel.SHIELDED,
        recipientMetaAddress: metaAddress,
        senderAddress: 'test.near',
      })

      expect(quote).toBeDefined()
      expect(quote.recipientAddress).not.toBe('test.near')
      expect(quote.metadata?.stealthAddress).toBeDefined()
    })
  })

  describe('executeSwap', () => {
    it('should fail without wallet adapter', async () => {
      const quote = await backend.getQuote({
        fromChain: 'ethereum',
        toChain: 'ethereum',
        fromToken: 'ETH',
        toToken: 'ETH',
        amount: 1000000000000000000n,
        privacyLevel: PrivacyLevel.TRANSPARENT,
        senderAddress: '0x1234567890123456789012345678901234567890',
      })

      await expect(
        backend.executeSwap({ quoteId: quote.quoteId })
      ).rejects.toThrow(/Wallet adapter not configured/)
    })

    it('should fail with invalid quote ID', async () => {
      const mockWallet = new MockWalletAdapter({ chain: 'ethereum' })
      backend.setWalletAdapter(mockWallet)
      await mockWallet.connect()

      await expect(
        backend.executeSwap({ quoteId: 'invalid-quote-id' })
      ).rejects.toThrow(/Quote not found/)
    })

    it('should execute transparent swap successfully', async () => {
      const mockWallet = new MockWalletAdapter({
        chain: 'ethereum',
        address: '0x1234567890123456789012345678901234567890',
        balance: 10000000000000000000n, // 10 ETH
      })
      backend.setWalletAdapter(mockWallet)
      await mockWallet.connect()

      const quote = await backend.getQuote({
        fromChain: 'ethereum',
        toChain: 'ethereum',
        fromToken: 'ETH',
        toToken: 'ETH',
        amount: 1000000000000000000n,
        privacyLevel: PrivacyLevel.TRANSPARENT,
        senderAddress: '0x1234567890123456789012345678901234567890',
      })

      const result = await backend.executeSwap({ quoteId: quote.quoteId })

      expect(result).toBeDefined()
      expect(result.status).toBe(SwapStatus.SUCCESS)
      expect(result.swapId).toBeDefined()
      expect(result.depositTxHash).toBeDefined()
      expect(result.settlementTxHash).toBe(result.depositTxHash)
    })

    it('should execute shielded swap successfully', async () => {
      const { metaAddress } = generateStealthMetaAddress('ethereum')
      const mockWallet = new MockWalletAdapter({
        chain: 'ethereum',
        address: '0x1234567890123456789012345678901234567890',
        balance: 10000000000000000000n,
      })
      backend.setWalletAdapter(mockWallet)
      await mockWallet.connect()

      const quote = await backend.getQuote({
        fromChain: 'ethereum',
        toChain: 'ethereum',
        fromToken: 'ETH',
        toToken: 'ETH',
        amount: 1000000000000000000n,
        privacyLevel: PrivacyLevel.SHIELDED,
        recipientMetaAddress: metaAddress,
        senderAddress: '0x1234567890123456789012345678901234567890',
      })

      const result = await backend.executeSwap({ quoteId: quote.quoteId })

      expect(result).toBeDefined()
      expect(result.status).toBe(SwapStatus.SUCCESS)
      expect(result.metadata?.stealthAddress).toBeDefined()
      expect(result.metadata?.privacyLevel).toBe(PrivacyLevel.SHIELDED)
    })

    it('should fail with disconnected wallet', async () => {
      const mockWallet = new MockWalletAdapter({ chain: 'ethereum' })
      backend.setWalletAdapter(mockWallet)
      // Don't connect wallet

      const quote = await backend.getQuote({
        fromChain: 'ethereum',
        toChain: 'ethereum',
        fromToken: 'ETH',
        toToken: 'ETH',
        amount: 1000000000000000000n,
        privacyLevel: PrivacyLevel.TRANSPARENT,
        senderAddress: '0x1234567890123456789012345678901234567890',
      })

      await expect(
        backend.executeSwap({ quoteId: quote.quoteId })
      ).rejects.toThrow(/Wallet not connected/)
    })

    it('should fail with wrong chain wallet', async () => {
      const mockWallet = new MockWalletAdapter({ chain: 'solana' }) // Wrong chain
      backend.setWalletAdapter(mockWallet)
      await mockWallet.connect()

      const quote = await backend.getQuote({
        fromChain: 'ethereum',
        toChain: 'ethereum',
        fromToken: 'ETH',
        toToken: 'ETH',
        amount: 1000000000000000000n,
        privacyLevel: PrivacyLevel.TRANSPARENT,
        senderAddress: '0x1234567890123456789012345678901234567890',
      })

      await expect(
        backend.executeSwap({ quoteId: quote.quoteId })
      ).rejects.toThrow(/Wallet chain mismatch/)
    })

    it('should handle transaction failure gracefully', async () => {
      const mockWallet = new MockWalletAdapter({
        chain: 'ethereum',
        address: '0x1234567890123456789012345678901234567890',
        shouldFailSign: true, // Force failure
      })
      backend.setWalletAdapter(mockWallet)
      await mockWallet.connect()

      const quote = await backend.getQuote({
        fromChain: 'ethereum',
        toChain: 'ethereum',
        fromToken: 'ETH',
        toToken: 'ETH',
        amount: 1000000000000000000n,
        privacyLevel: PrivacyLevel.TRANSPARENT,
        senderAddress: '0x1234567890123456789012345678901234567890',
      })

      const result = await backend.executeSwap({ quoteId: quote.quoteId })

      expect(result.status).toBe(SwapStatus.FAILED)
      expect(result.errorMessage).toBeDefined()
    })
  })

  describe('getStatus', () => {
    it('should return status for valid swap', async () => {
      const quote = await backend.getQuote({
        fromChain: 'ethereum',
        toChain: 'ethereum',
        fromToken: 'ETH',
        toToken: 'ETH',
        amount: 1000000000000000000n,
        privacyLevel: PrivacyLevel.TRANSPARENT,
        senderAddress: '0x1234567890123456789012345678901234567890',
      })

      const swapId = quote.metadata?.swapId as string
      const status = await backend.getStatus(swapId)

      expect(status).toBeDefined()
      expect(status.swapId).toBe(swapId)
      expect(status.quoteId).toBe(quote.quoteId)
      expect(status.status).toBe(SwapStatus.PENDING_DEPOSIT)
      expect(status.amountIn).toBe('1000000000000000000')
      expect(status.metadata?.fromChain).toBe('ethereum')
      expect(status.metadata?.toChain).toBe('ethereum')
    })

    it('should fail for invalid swap ID', async () => {
      await expect(
        backend.getStatus('invalid-swap-id')
      ).rejects.toThrow(/Swap not found/)
    })
  })

  describe('getDryQuote', () => {
    it('should return quote without storing swap data', async () => {
      const dryQuote = await backend.getDryQuote({
        fromChain: 'ethereum',
        toChain: 'ethereum',
        fromToken: 'ETH',
        toToken: 'ETH',
        amount: 1000000000000000000n,
        privacyLevel: PrivacyLevel.TRANSPARENT,
        senderAddress: '0x1234567890123456789012345678901234567890',
      })

      expect(dryQuote).toBeDefined()
      expect(dryQuote.quoteId).toBeDefined()

      // Try to get status - should fail because swap wasn't stored
      await expect(
        backend.getStatus(dryQuote.metadata?.swapId as string)
      ).rejects.toThrow(/Swap not found/)
    })
  })

  describe('multiple chains', () => {
    const chains: ChainId[] = ['ethereum', 'solana', 'near', 'polygon', 'arbitrum', 'optimism', 'base']

    chains.forEach((chain) => {
      it(`should support ${chain} transparent transfers`, async () => {
        // Use appropriate amounts for each chain
        const amount = chain === 'near'
          ? 1000000000000000000000000n // 1 NEAR (need more for gas)
          : 1000000000000000000n // 1 ETH/SOL/etc

        const senderAddress = chain === 'solana' || chain === 'near'
          ? 'SoLaNaAddReSS1111111111111111111111111111111'
          : '0x1234567890123456789012345678901234567890'

        const quote = await backend.getQuote({
          fromChain: chain,
          toChain: chain,
          fromToken: 'TOKEN',
          toToken: 'TOKEN',
          amount,
          privacyLevel: PrivacyLevel.TRANSPARENT,
          senderAddress,
        })

        expect(quote).toBeDefined()
        expect(quote.route?.steps[0]?.tokenIn.chain).toBe(chain)
        expect(quote.route?.steps[0]?.tokenOut.chain).toBe(chain)
      })
    })
  })

  describe('clearSwaps', () => {
    it('should clear all swap data', async () => {
      const quote = await backend.getQuote({
        fromChain: 'ethereum',
        toChain: 'ethereum',
        fromToken: 'ETH',
        toToken: 'ETH',
        amount: 1000000000000000000n,
        privacyLevel: PrivacyLevel.TRANSPARENT,
        senderAddress: '0x1234567890123456789012345678901234567890',
      })

      const swapId = quote.metadata?.swapId as string

      // Should be able to get status
      await expect(backend.getStatus(swapId)).resolves.toBeDefined()

      // Clear swaps
      backend.clearSwaps()

      // Should fail after clearing
      await expect(backend.getStatus(swapId)).rejects.toThrow(/Swap not found/)
    })
  })

  describe('protocol fees', () => {
    it('should apply protocol fees when configured', async () => {
      const backendWithFees = new DirectChainBackend({
        protocolFeeBps: 50, // 0.5%
      })

      const quote = await backendWithFees.getQuote({
        fromChain: 'ethereum',
        toChain: 'ethereum',
        fromToken: 'ETH',
        toToken: 'ETH',
        amount: 1000000000000000000n, // 1 ETH
        privacyLevel: PrivacyLevel.TRANSPARENT,
        senderAddress: '0x1234567890123456789012345678901234567890',
      })

      expect(BigInt(quote.fees.protocolFee)).toBeGreaterThan(0n)
    })

    it('should have zero protocol fees by default', async () => {
      const quote = await backend.getQuote({
        fromChain: 'ethereum',
        toChain: 'ethereum',
        fromToken: 'ETH',
        toToken: 'ETH',
        amount: 1000000000000000000n,
        privacyLevel: PrivacyLevel.TRANSPARENT,
        senderAddress: '0x1234567890123456789012345678901234567890',
      })

      expect(BigInt(quote.fees.protocolFee)).toBe(0n)
    })
  })
})
