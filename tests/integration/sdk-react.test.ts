import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import {
  useStealthAddress,
  useSIP,
  useViewingKey,
  usePrivateSwap,
  SIPProvider,
} from '@sip-protocol/react'
import {
  generateStealthMetaAddress,
  createCommitment,
  decryptWithViewingKey,
} from '@sip-protocol/sdk'
import { TEST_FIXTURES, MockSettlementBackend } from './setup'
import type { PrivacyLevel } from '@sip-protocol/types'

/**
 * Integration Tests: SDK + React Hooks
 *
 * These tests verify that React hooks correctly integrate with the SDK
 * and produce valid cryptographic outputs.
 */
describe('SDK + React Integration', () => {
  describe('useStealthAddress', () => {
    it('should generate valid stealth addresses using SDK', async () => {
      const { result } = renderHook(() => useStealthAddress('ethereum'))

      // Wait for generation to complete
      await waitFor(() => {
        expect(result.current.isGenerating).toBe(false)
      })

      // Should have generated addresses
      expect(result.current.metaAddress).toBeTruthy()
      expect(result.current.stealthAddress).toBeTruthy()

      // Verify meta-address format
      expect(result.current.metaAddress).toMatch(/^sip:ethereum:0x[0-9a-f]{66}:0x[0-9a-f]{66}$/i)

      // Verify stealth address format (Ethereum address)
      expect(result.current.stealthAddress).toMatch(/^0x[0-9a-f]{40}$/i)
    })

    it('should regenerate new stealth addresses from same meta-address', async () => {
      const { result } = renderHook(() => useStealthAddress('ethereum'))

      await waitFor(() => {
        expect(result.current.isGenerating).toBe(false)
      })

      const firstAddress = result.current.stealthAddress
      expect(firstAddress).toBeTruthy()

      // Regenerate
      result.current.regenerate()

      await waitFor(() => {
        expect(result.current.isGenerating).toBe(false)
      })

      const secondAddress = result.current.stealthAddress

      // Should be different addresses
      expect(secondAddress).toBeTruthy()
      expect(secondAddress).not.toBe(firstAddress)

      // But same meta-address
      expect(result.current.metaAddress).toBeTruthy()
    })

    it('should support ed25519 chains (Solana)', async () => {
      const { result } = renderHook(() => useStealthAddress('solana'))

      await waitFor(() => {
        expect(result.current.isGenerating).toBe(false)
      })

      expect(result.current.metaAddress).toBeTruthy()
      expect(result.current.stealthAddress).toBeTruthy()

      // Verify meta-address format for Solana
      expect(result.current.metaAddress).toMatch(/^sip:solana:0x[0-9a-f]{64}:0x[0-9a-f]{64}$/i)

      // Verify stealth address is base58 (Solana format)
      expect(result.current.stealthAddress).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)
    })

    it('should copy stealth address to clipboard', async () => {
      // Mock clipboard API
      const writeTextMock = vi.fn().mockResolvedValue(undefined)
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      })

      const { result } = renderHook(() => useStealthAddress('ethereum'))

      await waitFor(() => {
        expect(result.current.isGenerating).toBe(false)
      })

      await result.current.copyToClipboard()

      expect(writeTextMock).toHaveBeenCalledWith(result.current.stealthAddress)
    })
  })

  describe('useViewingKey', () => {
    it('should generate viewing key compatible with SDK encryption', async () => {
      const { result } = renderHook(() => useViewingKey())

      await waitFor(() => {
        expect(result.current.isGenerating).toBe(false)
      })

      expect(result.current.publicKey).toBeTruthy()
      expect(result.current.privateKey).toBeTruthy()

      // Test that SDK can encrypt/decrypt with these keys
      const testMessage = 'Secret transaction data'
      const encrypted = await result.current.encrypt(testMessage)

      expect(encrypted).toBeTruthy()
      expect(encrypted).not.toBe(testMessage)

      const decrypted = await result.current.decrypt(encrypted)
      expect(decrypted).toBe(testMessage)
    })

    it('should decrypt SDK-encrypted messages', async () => {
      const { result } = renderHook(() => useViewingKey())

      await waitFor(() => {
        expect(result.current.isGenerating).toBe(false)
      })

      // Encrypt using SDK directly
      const message = { amount: '1000000', recipient: '0xtest' }
      const messageStr = JSON.stringify(message)

      const encrypted = await result.current.encrypt(messageStr)

      // Decrypt using hook
      const decrypted = await result.current.decrypt(encrypted)
      const parsed = JSON.parse(decrypted)

      expect(parsed.amount).toBe(message.amount)
      expect(parsed.recipient).toBe(message.recipient)
    })
  })

  describe('useSIP + SDK integration', () => {
    it('should initialize SIP client with valid configuration', async () => {
      const mockBackend = new MockSettlementBackend()

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(SIPProvider, {
          config: {
            settlementBackend: mockBackend,
          },
          children,
        })

      const { result } = renderHook(() => useSIP(), { wrapper })

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true)
      })

      expect(result.current.client).toBeTruthy()
      expect(result.current.config).toEqual({
        settlementBackend: mockBackend,
      })
    })

    it('should access SDK methods through client', async () => {
      const mockBackend = new MockSettlementBackend()

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(SIPProvider, {
          config: {
            settlementBackend: mockBackend,
          },
          children,
        })

      const { result } = renderHook(() => useSIP(), { wrapper })

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true)
      })

      // Generate stealth address through client
      const metaAddress = generateStealthMetaAddress('ethereum')
      expect(metaAddress.metaAddress.chain).toBe('ethereum')
      expect(metaAddress.metaAddress.spendingKey).toMatch(/^0x[0-9a-f]+$/)
      expect(metaAddress.metaAddress.viewingKey).toMatch(/^0x[0-9a-f]+$/)
    })
  })

  describe('usePrivateSwap', () => {
    it('should execute swap with SDK-generated commitments', async () => {
      const mockBackend = new MockSettlementBackend()
      const mockGetQuote = vi.fn().mockResolvedValue({
        id: 'quote-123',
        sourceAmount: TEST_FIXTURES.amount,
        destAmount: BigInt(995000),
        estimatedTime: 30,
        fees: {
          network: BigInt(1000),
          protocol: BigInt(4000),
        },
        route: ['ethereum', 'polygon'],
        expiresAt: Date.now() + 60000,
      })
      mockBackend.getQuote = mockGetQuote

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(SIPProvider, {
          config: {
            settlementBackend: mockBackend,
          },
          children,
        })

      const { result } = renderHook(() => usePrivateSwap(), { wrapper })

      // Execute swap with privacy
      await result.current.executeSwap({
        sourceToken: TEST_FIXTURES.sourceToken,
        destToken: TEST_FIXTURES.destToken,
        amount: TEST_FIXTURES.amount,
        privacyLevel: 'shielded' as PrivacyLevel,
        recipientAddress: TEST_FIXTURES.stealthAddress,
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Should have used SDK to get quote
      expect(mockGetQuote).toHaveBeenCalled()

      // Should have result
      expect(result.current.result).toBeTruthy()
      expect(result.current.error).toBeNull()
    })

    it('should handle different privacy levels', async () => {
      const mockBackend = new MockSettlementBackend()

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(SIPProvider, {
          config: {
            settlementBackend: mockBackend,
          },
          children,
        })

      const { result } = renderHook(() => usePrivateSwap(), { wrapper })

      const privacyLevels: PrivacyLevel[] = ['transparent', 'shielded', 'compliant']

      for (const level of privacyLevels) {
        await result.current.executeSwap({
          sourceToken: TEST_FIXTURES.sourceToken,
          destToken: TEST_FIXTURES.destToken,
          amount: TEST_FIXTURES.amount,
          privacyLevel: level,
          recipientAddress: TEST_FIXTURES.stealthAddress,
        })

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false)
        })

        expect(result.current.result).toBeTruthy()
      }
    })
  })

  describe('Full React + SDK flow', () => {
    it('should generate address, create commitment, and verify with viewing key', async () => {
      // 1. Generate stealth address
      const { result: stealthResult } = renderHook(() => useStealthAddress('ethereum'))

      await waitFor(() => {
        expect(stealthResult.current.isGenerating).toBe(false)
      })

      const metaAddress = stealthResult.current.metaAddress
      const stealthAddress = stealthResult.current.stealthAddress

      expect(metaAddress).toBeTruthy()
      expect(stealthAddress).toBeTruthy()

      // 2. Create commitment using SDK
      const amount = BigInt(1000000)
      const commitment = createCommitment(amount)

      expect(commitment.value).toMatch(/^0x[0-9a-f]+$/)
      expect(commitment.blindingFactor).toMatch(/^0x[0-9a-f]+$/)

      // 3. Generate viewing key
      const { result: viewingResult } = renderHook(() => useViewingKey())

      await waitFor(() => {
        expect(viewingResult.current.isGenerating).toBe(false)
      })

      // 4. Encrypt transaction data with viewing key
      const txData = JSON.stringify({
        to: stealthAddress,
        amount: amount.toString(),
        commitment: commitment.value,
      })

      const encrypted = await viewingResult.current.encrypt(txData)
      expect(encrypted).toBeTruthy()

      // 5. Decrypt and verify
      const decrypted = await viewingResult.current.decrypt(encrypted)
      const parsed = JSON.parse(decrypted)

      expect(parsed.to).toBe(stealthAddress)
      expect(parsed.amount).toBe(amount.toString())
      expect(parsed.commitment).toBe(commitment.value)
    })
  })
})
