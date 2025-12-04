import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useViewingKey } from '../../src/hooks/use-viewing-key'
import type { ViewingKey, EncryptedTransaction } from '@sip-protocol/types'
import * as sdk from '@sip-protocol/sdk'

// Mock the SDK functions
vi.mock('@sip-protocol/sdk', () => ({
  generateViewingKey: vi.fn(),
  decryptWithViewing: vi.fn(),
}))

describe('useViewingKey', () => {
  const mockViewingKey: ViewingKey = {
    key: '0xabc123def456',
    path: 'm/0',
    hash: '0x789ghi012jkl',
  }

  const mockEncryptedTransaction: EncryptedTransaction = {
    ciphertext: '0xencrypted',
    nonce: '0xnonce123',
    viewingKeyHash: '0x789ghi012jkl',
  }

  const mockDecryptedData = {
    sender: '0xsender123',
    recipient: '0xrecipient456',
    amount: '100',
    timestamp: 1234567890,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generate', () => {
    it('should generate a viewing key with default path', () => {
      vi.mocked(sdk.generateViewingKey).mockReturnValue(mockViewingKey)

      const { result } = renderHook(() => useViewingKey())

      let generatedKey: ViewingKey | undefined
      act(() => {
        generatedKey = result.current.generate()
      })

      expect(sdk.generateViewingKey).toHaveBeenCalledWith(undefined)
      expect(generatedKey).toEqual(mockViewingKey)
      expect(result.current.viewingKey).toEqual(mockViewingKey)
    })

    it('should generate a viewing key with custom path', () => {
      const customPath = 'm/0/audit'
      const customKey = { ...mockViewingKey, path: customPath }
      vi.mocked(sdk.generateViewingKey).mockReturnValue(customKey)

      const { result } = renderHook(() => useViewingKey())

      let generatedKey: ViewingKey | undefined
      act(() => {
        generatedKey = result.current.generate(customPath)
      })

      expect(sdk.generateViewingKey).toHaveBeenCalledWith(customPath)
      expect(generatedKey).toEqual(customKey)
      expect(result.current.viewingKey).toEqual(customKey)
    })

    it('should persist viewing key in state', () => {
      vi.mocked(sdk.generateViewingKey).mockReturnValue(mockViewingKey)

      const { result } = renderHook(() => useViewingKey())

      act(() => {
        result.current.generate()
      })

      expect(result.current.viewingKey).toEqual(mockViewingKey)
      expect(result.current.viewingKey).not.toBeNull()
    })

    it('should reset shared auditors when generating new key', () => {
      vi.mocked(sdk.generateViewingKey).mockReturnValue(mockViewingKey)

      const { result } = renderHook(() => useViewingKey())

      // Generate key and share with auditor
      act(() => {
        result.current.generate()
      })
      act(() => {
        void result.current.share('auditor-1')
      })

      expect(result.current.sharedWith).toHaveLength(1)

      // Generate new key
      act(() => {
        result.current.generate()
      })

      // Shared list should be reset
      expect(result.current.sharedWith).toHaveLength(0)
    })
  })

  describe('decrypt', () => {
    it('should decrypt encrypted transaction data', async () => {
      vi.mocked(sdk.generateViewingKey).mockReturnValue(mockViewingKey)
      vi.mocked(sdk.decryptWithViewing).mockReturnValue(mockDecryptedData)

      const { result } = renderHook(() => useViewingKey())

      // Generate key first
      act(() => {
        result.current.generate()
      })

      let decryptedData
      await act(async () => {
        decryptedData = await result.current.decrypt(mockEncryptedTransaction)
      })

      expect(sdk.decryptWithViewing).toHaveBeenCalledWith(
        mockEncryptedTransaction,
        mockViewingKey,
      )
      expect(decryptedData).toEqual(mockDecryptedData)
    })

    it('should throw error if no viewing key is set', async () => {
      const { result } = renderHook(() => useViewingKey())

      await expect(
        act(async () => {
          await result.current.decrypt(mockEncryptedTransaction)
        }),
      ).rejects.toThrow('No viewing key available. Call generate() first.')

      expect(sdk.decryptWithViewing).not.toHaveBeenCalled()
    })

    it('should propagate decryption errors from SDK', async () => {
      vi.mocked(sdk.generateViewingKey).mockReturnValue(mockViewingKey)
      vi.mocked(sdk.decryptWithViewing).mockImplementation(() => {
        throw new Error('Decryption failed - wrong key')
      })

      const { result } = renderHook(() => useViewingKey())

      act(() => {
        result.current.generate()
      })

      await expect(
        act(async () => {
          await result.current.decrypt(mockEncryptedTransaction)
        }),
      ).rejects.toThrow('Decryption failed - wrong key')
    })
  })

  describe('share', () => {
    it('should share viewing key with auditor', async () => {
      vi.mocked(sdk.generateViewingKey).mockReturnValue(mockViewingKey)

      const { result } = renderHook(() => useViewingKey())

      // Generate key first
      act(() => {
        result.current.generate()
      })

      await act(async () => {
        await result.current.share('auditor-alice')
      })

      expect(result.current.sharedWith).toHaveLength(1)
      expect(result.current.sharedWith[0]).toMatchObject({
        auditorId: 'auditor-alice',
        viewingKeyHash: mockViewingKey.hash,
      })
      expect(result.current.sharedWith[0].sharedAt).toBeGreaterThan(0)
    })

    it('should track multiple auditor shares', async () => {
      vi.mocked(sdk.generateViewingKey).mockReturnValue(mockViewingKey)

      const { result } = renderHook(() => useViewingKey())

      act(() => {
        result.current.generate()
      })

      await act(async () => {
        await result.current.share('auditor-alice')
        await result.current.share('auditor-bob')
        await result.current.share('auditor-charlie')
      })

      expect(result.current.sharedWith).toHaveLength(3)
      expect(result.current.sharedWith.map(s => s.auditorId)).toEqual([
        'auditor-alice',
        'auditor-bob',
        'auditor-charlie',
      ])
    })

    it('should throw error if no viewing key is set', async () => {
      const { result } = renderHook(() => useViewingKey())

      await expect(
        act(async () => {
          await result.current.share('auditor-alice')
        }),
      ).rejects.toThrow('No viewing key available. Call generate() first.')
    })

    it('should include timestamp in share entry', async () => {
      vi.mocked(sdk.generateViewingKey).mockReturnValue(mockViewingKey)
      const beforeTime = Date.now()

      const { result } = renderHook(() => useViewingKey())

      act(() => {
        result.current.generate()
      })

      await act(async () => {
        await result.current.share('auditor-alice')
      })

      const afterTime = Date.now()
      const shareEntry = result.current.sharedWith[0]

      expect(shareEntry.sharedAt).toBeGreaterThanOrEqual(beforeTime)
      expect(shareEntry.sharedAt).toBeLessThanOrEqual(afterTime)
    })
  })

  describe('initial state', () => {
    it('should initialize with null viewing key', () => {
      const { result } = renderHook(() => useViewingKey())
      expect(result.current.viewingKey).toBeNull()
    })

    it('should initialize with empty shared auditors list', () => {
      const { result } = renderHook(() => useViewingKey())
      expect(result.current.sharedWith).toEqual([])
    })
  })

  describe('integration', () => {
    it('should support full workflow: generate -> decrypt -> share', async () => {
      vi.mocked(sdk.generateViewingKey).mockReturnValue(mockViewingKey)
      vi.mocked(sdk.decryptWithViewing).mockReturnValue(mockDecryptedData)

      const { result } = renderHook(() => useViewingKey())

      // Generate key
      act(() => {
        result.current.generate('m/0/compliance')
      })
      expect(result.current.viewingKey).toEqual(mockViewingKey)

      // Decrypt data
      let decryptedData
      await act(async () => {
        decryptedData = await result.current.decrypt(mockEncryptedTransaction)
      })
      expect(decryptedData).toEqual(mockDecryptedData)

      // Share with auditor
      await act(async () => {
        await result.current.share('auditor-compliance')
      })
      expect(result.current.sharedWith).toHaveLength(1)
      expect(result.current.sharedWith[0].auditorId).toBe('auditor-compliance')
    })
  })
})
