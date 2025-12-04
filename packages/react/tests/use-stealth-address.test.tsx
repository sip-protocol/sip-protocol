import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useStealthAddress } from '../src/hooks/use-stealth-address'
import * as sdk from '@sip-protocol/sdk'

// Mock the SDK functions
vi.mock('@sip-protocol/sdk', () => ({
  generateStealthMetaAddress: vi.fn(),
  generateStealthAddress: vi.fn(),
  generateEd25519StealthMetaAddress: vi.fn(),
  generateEd25519StealthAddress: vi.fn(),
  encodeStealthMetaAddress: vi.fn(),
  isEd25519Chain: vi.fn(),
}))

describe('useStealthAddress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('secp256k1 chains (Ethereum)', () => {
    beforeEach(() => {
      // Mock isEd25519Chain to return false for Ethereum
      vi.mocked(sdk.isEd25519Chain).mockReturnValue(false)

      // Mock meta-address generation
      vi.mocked(sdk.generateStealthMetaAddress).mockReturnValue({
        metaAddress: {
          chain: 'ethereum',
          spendingKey: '0x02abc123',
          viewingKey: '0x03def456',
        },
        spendingPrivateKey: '0xpriv1',
        viewingPrivateKey: '0xpriv2',
      })

      // Mock stealth address generation
      vi.mocked(sdk.generateStealthAddress).mockReturnValue({
        stealthAddress: {
          address: '0xstealth123',
          ephemeralPublicKey: '0xeph123',
          viewTag: 42,
        },
        sharedSecret: '0xsecret123',
      })

      // Mock encoding
      vi.mocked(sdk.encodeStealthMetaAddress).mockReturnValue(
        'sip:ethereum:0x02abc123:0x03def456'
      )
    })

    it('should auto-generate meta-address and stealth address on mount', async () => {
      const { result } = renderHook(() => useStealthAddress('ethereum'))

      // Initially generating
      expect(result.current.isGenerating).toBe(true)
      expect(result.current.metaAddress).toBe(null)
      expect(result.current.stealthAddress).toBe(null)

      // Wait for generation to complete
      await waitFor(() => {
        expect(result.current.isGenerating).toBe(false)
      })

      // Check results
      expect(result.current.metaAddress).toBe('sip:ethereum:0x02abc123:0x03def456')
      expect(result.current.stealthAddress).toBe('0xstealth123')

      // Verify SDK functions were called
      expect(sdk.generateStealthMetaAddress).toHaveBeenCalledWith('ethereum')
      expect(sdk.generateStealthAddress).toHaveBeenCalledWith({
        chain: 'ethereum',
        spendingKey: '0x02abc123',
        viewingKey: '0x03def456',
      })
      expect(sdk.encodeStealthMetaAddress).toHaveBeenCalled()
    })

    it('should regenerate stealth address when regenerate is called', async () => {
      const { result } = renderHook(() => useStealthAddress('ethereum'))

      // Wait for initial generation
      await waitFor(() => {
        expect(result.current.isGenerating).toBe(false)
      })

      // Mock a new stealth address for regeneration
      vi.mocked(sdk.generateStealthAddress).mockReturnValue({
        stealthAddress: {
          address: '0xstealth456',
          ephemeralPublicKey: '0xeph456',
          viewTag: 99,
        },
        sharedSecret: '0xsecret456',
      })

      // Regenerate
      act(() => {
        result.current.regenerate()
      })

      // Wait for regeneration to complete
      await waitFor(() => {
        expect(result.current.stealthAddress).toBe('0xstealth456')
      })

      // Meta-address should remain the same
      expect(result.current.metaAddress).toBe('sip:ethereum:0x02abc123:0x03def456')

      // generateStealthAddress should be called again (2 times total)
      expect(sdk.generateStealthAddress).toHaveBeenCalledTimes(2)
    })

    it('should track loading state during regeneration', async () => {
      const { result } = renderHook(() => useStealthAddress('ethereum'))

      // Wait for initial generation
      await waitFor(() => {
        expect(result.current.isGenerating).toBe(false)
      })

      // Start regeneration
      act(() => {
        result.current.regenerate()
      })

      // Should be generating immediately after call
      expect(result.current.isGenerating).toBe(true)

      // Wait for completion
      await waitFor(() => {
        expect(result.current.isGenerating).toBe(false)
      })
    })

    it('should handle errors gracefully during generation', async () => {
      // Mock generation to throw error
      vi.mocked(sdk.generateStealthMetaAddress).mockImplementation(() => {
        throw new Error('Generation failed')
      })

      const { result } = renderHook(() => useStealthAddress('ethereum'))

      // Wait for error handling
      await waitFor(() => {
        expect(result.current.isGenerating).toBe(false)
      })

      // Should set null values on error
      expect(result.current.metaAddress).toBe(null)
      expect(result.current.stealthAddress).toBe(null)
      // Should set error state instead of just console.error
      expect(result.current.error).toBeInstanceOf(Error)
      expect(result.current.error?.message).toBe('Generation failed')
    })

    it('should clear error with clearError function', async () => {
      // Mock generation to throw error
      vi.mocked(sdk.generateStealthMetaAddress).mockImplementation(() => {
        throw new Error('Generation failed')
      })

      const { result } = renderHook(() => useStealthAddress('ethereum'))

      // Wait for error handling
      await waitFor(() => {
        expect(result.current.isGenerating).toBe(false)
      })

      // Error should be set
      expect(result.current.error).toBeInstanceOf(Error)

      // Clear the error
      act(() => {
        result.current.clearError()
      })

      // Error should be cleared
      expect(result.current.error).toBe(null)
    })

    it('should not regenerate if metaAddress is null', async () => {
      const { result } = renderHook(() => useStealthAddress('ethereum'))

      // Manually clear the meta-address (simulate error state)
      await waitFor(() => {
        expect(result.current.isGenerating).toBe(false)
      })

      // Force metaAddress to null
      vi.mocked(sdk.generateStealthMetaAddress).mockImplementation(() => {
        throw new Error('Fail')
      })

      const { result: result2 } = renderHook(() => useStealthAddress('ethereum'))

      await waitFor(() => {
        expect(result2.current.isGenerating).toBe(false)
      })

      const callsBefore = vi.mocked(sdk.generateStealthAddress).mock.calls.length

      // Try to regenerate when metaAddress is null
      act(() => {
        result2.current.regenerate()
      })

      // Should not call generateStealthAddress again
      expect(vi.mocked(sdk.generateStealthAddress).mock.calls.length).toBe(callsBefore)
    })
  })

  describe('ed25519 chains (Solana)', () => {
    beforeEach(() => {
      // Mock isEd25519Chain to return true for Solana
      vi.mocked(sdk.isEd25519Chain).mockReturnValue(true)

      // Mock ed25519 meta-address generation
      vi.mocked(sdk.generateEd25519StealthMetaAddress).mockReturnValue({
        metaAddress: {
          chain: 'solana',
          spendingKey: '0xsolabc123',
          viewingKey: '0xsoldef456',
        },
        spendingPrivateKey: '0xsolpriv1',
        viewingPrivateKey: '0xsolpriv2',
      })

      // Mock ed25519 stealth address generation
      vi.mocked(sdk.generateEd25519StealthAddress).mockReturnValue({
        stealthAddress: {
          address: '0xsolstealth123',
          ephemeralPublicKey: '0xsoleph123',
          viewTag: 77,
        },
        sharedSecret: '0xsolsecret123',
      })

      // Mock encoding
      vi.mocked(sdk.encodeStealthMetaAddress).mockReturnValue(
        'sip:solana:0xsolabc123:0xsoldef456'
      )
    })

    it('should use ed25519 functions for Solana chain', async () => {
      const { result } = renderHook(() => useStealthAddress('solana'))

      // Wait for generation
      await waitFor(() => {
        expect(result.current.isGenerating).toBe(false)
      })

      // Verify ed25519 functions were called
      expect(sdk.generateEd25519StealthMetaAddress).toHaveBeenCalledWith('solana')
      expect(sdk.generateEd25519StealthAddress).toHaveBeenCalledWith({
        chain: 'solana',
        spendingKey: '0xsolabc123',
        viewingKey: '0xsoldef456',
      })

      // Check results
      expect(result.current.metaAddress).toBe('sip:solana:0xsolabc123:0xsoldef456')
      expect(result.current.stealthAddress).toBe('0xsolstealth123')
    })
  })

  describe('copyToClipboard', () => {
    beforeEach(() => {
      vi.mocked(sdk.isEd25519Chain).mockReturnValue(false)

      vi.mocked(sdk.generateStealthMetaAddress).mockReturnValue({
        metaAddress: {
          chain: 'ethereum',
          spendingKey: '0x02abc123',
          viewingKey: '0x03def456',
        },
        spendingPrivateKey: '0xpriv1',
        viewingPrivateKey: '0xpriv2',
      })

      vi.mocked(sdk.generateStealthAddress).mockReturnValue({
        stealthAddress: {
          address: '0xstealth123',
          ephemeralPublicKey: '0xeph123',
          viewTag: 42,
        },
        sharedSecret: '0xsecret123',
      })

      vi.mocked(sdk.encodeStealthMetaAddress).mockReturnValue(
        'sip:ethereum:0x02abc123:0x03def456'
      )
    })

    it('should copy stealth address to clipboard', async () => {
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

      await act(async () => {
        await result.current.copyToClipboard()
      })

      expect(writeTextMock).toHaveBeenCalledWith('0xstealth123')
    })

    it('should handle clipboard API failure gracefully with fallback', async () => {
      // Mock clipboard API to fail
      const writeTextMock = vi.fn().mockRejectedValue(new Error('Clipboard failed'))
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      })

      // Mock document methods for fallback
      const createElementSpy = vi.spyOn(document, 'createElement')
      const appendChildSpy = vi.spyOn(document.body, 'appendChild')
      const removeChildSpy = vi.spyOn(document.body, 'removeChild')

      // Mock execCommand if it exists, otherwise define it
      const originalExecCommand = document.execCommand
      document.execCommand = vi.fn().mockReturnValue(true) as any

      const { result } = renderHook(() => useStealthAddress('ethereum'))

      await waitFor(() => {
        expect(result.current.isGenerating).toBe(false)
      })

      await act(async () => {
        await result.current.copyToClipboard()
      })

      // Should attempt fallback (clipboard API failed but fallback succeeded)
      expect(createElementSpy).toHaveBeenCalledWith('textarea')
      expect(appendChildSpy).toHaveBeenCalled()
      expect(document.execCommand).toHaveBeenCalledWith('copy')
      expect(removeChildSpy).toHaveBeenCalled()
      // No error since fallback succeeded
      expect(result.current.error).toBe(null)

      createElementSpy.mockRestore()
      appendChildSpy.mockRestore()
      removeChildSpy.mockRestore()
      document.execCommand = originalExecCommand
    })

    it('should set error state when both clipboard methods fail', async () => {
      // Mock clipboard API to fail
      const writeTextMock = vi.fn().mockRejectedValue(new Error('Clipboard failed'))
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      })

      // Mock execCommand to also fail
      const originalExecCommand = document.execCommand
      document.execCommand = vi.fn().mockImplementation(() => {
        throw new Error('execCommand failed')
      }) as any

      const { result } = renderHook(() => useStealthAddress('ethereum'))

      await waitFor(() => {
        expect(result.current.isGenerating).toBe(false)
      })

      await act(async () => {
        await result.current.copyToClipboard()
      })

      // Should have error set since both methods failed
      expect(result.current.error).toBeInstanceOf(Error)
      // Error is set (original error from execCommand)
      expect(result.current.error?.message).toBe('execCommand failed')

      document.execCommand = originalExecCommand
    })

    it('should do nothing if stealthAddress is null', async () => {
      const writeTextMock = vi.fn()
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      })

      // Mock to fail generation
      vi.mocked(sdk.generateStealthMetaAddress).mockImplementation(() => {
        throw new Error('Fail')
      })

      const { result } = renderHook(() => useStealthAddress('ethereum'))

      await waitFor(() => {
        expect(result.current.isGenerating).toBe(false)
      })

      await act(async () => {
        await result.current.copyToClipboard()
      })

      // Should not attempt to copy
      expect(writeTextMock).not.toHaveBeenCalled()
    })
  })

  describe('chain changes', () => {
    it('should regenerate addresses when chain changes', async () => {
      vi.mocked(sdk.isEd25519Chain).mockReturnValue(false)

      // Ethereum setup
      vi.mocked(sdk.generateStealthMetaAddress).mockReturnValue({
        metaAddress: {
          chain: 'ethereum',
          spendingKey: '0x02abc123',
          viewingKey: '0x03def456',
        },
        spendingPrivateKey: '0xpriv1',
        viewingPrivateKey: '0xpriv2',
      })

      vi.mocked(sdk.generateStealthAddress).mockReturnValue({
        stealthAddress: {
          address: '0xstealth123',
          ephemeralPublicKey: '0xeph123',
          viewTag: 42,
        },
        sharedSecret: '0xsecret123',
      })

      vi.mocked(sdk.encodeStealthMetaAddress).mockReturnValue(
        'sip:ethereum:0x02abc123:0x03def456'
      )

      const { result, rerender } = renderHook(
        ({ chain }) => useStealthAddress(chain),
        { initialProps: { chain: 'ethereum' as const } }
      )

      await waitFor(() => {
        expect(result.current.isGenerating).toBe(false)
      })

      expect(result.current.metaAddress).toBe('sip:ethereum:0x02abc123:0x03def456')

      // Change to Polygon
      vi.mocked(sdk.generateStealthMetaAddress).mockReturnValue({
        metaAddress: {
          chain: 'polygon',
          spendingKey: '0x02xyz789',
          viewingKey: '0x03uvw012',
        },
        spendingPrivateKey: '0xpriv3',
        viewingPrivateKey: '0xpriv4',
      })

      vi.mocked(sdk.encodeStealthMetaAddress).mockReturnValue(
        'sip:polygon:0x02xyz789:0x03uvw012'
      )

      rerender({ chain: 'polygon' })

      await waitFor(() => {
        expect(result.current.metaAddress).toBe('sip:polygon:0x02xyz789:0x03uvw012')
      })

      // Should have called generation twice (once for each chain)
      expect(sdk.generateStealthMetaAddress).toHaveBeenCalledTimes(2)
      expect(sdk.generateStealthMetaAddress).toHaveBeenNthCalledWith(1, 'ethereum')
      expect(sdk.generateStealthMetaAddress).toHaveBeenNthCalledWith(2, 'polygon')
    })
  })
})
