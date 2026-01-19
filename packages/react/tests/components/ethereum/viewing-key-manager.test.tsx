/**
 * Ethereum Viewing Key Manager Tests
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { renderHook, act } from '@testing-library/react'
import {
  EthereumViewingKeyManager,
  useEthereumViewingKey,
  type EthereumViewingKey,
} from '../../../src/components/ethereum/viewing-key-manager'

// Mock viewing keys
const mockKeys: EthereumViewingKey[] = [
  {
    id: 'vk_1',
    publicKey: '0x' + 'ab'.repeat(32),
    privateKey: '0x' + 'cd'.repeat(32),
    label: 'Primary Key',
    status: 'active',
    createdAt: Date.now() - 86400000,
    usageHistory: [{ timestamp: Date.now() - 86400000, action: 'created' }],
    chainId: 1,
  },
  {
    id: 'vk_2',
    publicKey: '0x' + 'ef'.repeat(32),
    label: 'Auditor Key',
    status: 'active',
    createdAt: Date.now() - 3600000,
    usageHistory: [
      { timestamp: Date.now() - 3600000, action: 'created' },
      { timestamp: Date.now() - 1800000, action: 'shared', recipient: 'auditor@company.com' },
    ],
    sharedWith: ['auditor@company.com'],
    chainId: 1,
  },
]

describe('EthereumViewingKeyManager', () => {
  // ─── Component Rendering ─────────────────────────────────────────────────────

  describe('Component Rendering', () => {
    it('should render empty state', () => {
      render(<EthereumViewingKeyManager keys={[]} />)
      expect(screen.getByTestId('empty-state')).toBeInTheDocument()
      expect(screen.getByText(/No viewing keys yet/)).toBeInTheDocument()
    })

    it('should render key list', () => {
      render(<EthereumViewingKeyManager keys={mockKeys} />)
      expect(screen.getByTestId('key-list')).toBeInTheDocument()
      expect(screen.getByText('Primary Key')).toBeInTheDocument()
      expect(screen.getByText('Auditor Key')).toBeInTheDocument()
    })

    it('should show key status badges', () => {
      render(<EthereumViewingKeyManager keys={mockKeys} />)
      const badges = screen.getAllByText('active')
      expect(badges.length).toBe(2)
    })

    it('should truncate public keys', () => {
      render(<EthereumViewingKeyManager keys={mockKeys} />)
      // Key should be truncated to show first and last 8 chars
      expect(screen.getByText(/0xababab.*ababab/)).toBeInTheDocument()
    })

    it('should show backup reminder', () => {
      const keysNeedingBackup = [
        {
          ...mockKeys[0],
          usageHistory: [{ timestamp: Date.now(), action: 'created' as const }],
        },
      ]
      render(<EthereumViewingKeyManager keys={keysNeedingBackup} showBackupReminder />)
      expect(screen.getByTestId('backup-reminder')).toBeInTheDocument()
    })
  })

  // ─── Key Operations ──────────────────────────────────────────────────────────

  describe('Key Operations', () => {
    it('should show generate button when callback provided', () => {
      const onGenerateKey = vi.fn()
      render(<EthereumViewingKeyManager keys={mockKeys} onGenerateKey={onGenerateKey} />)
      expect(screen.getByRole('button', { name: /generate/i })).toBeInTheDocument()
    })

    it('should not show generate button when callback not provided', () => {
      render(<EthereumViewingKeyManager keys={mockKeys} />)
      expect(screen.queryByRole('button', { name: /generate/i })).not.toBeInTheDocument()
    })

    it('should show export button for active keys', () => {
      const onExportKey = vi.fn()
      render(<EthereumViewingKeyManager keys={mockKeys} onExportKey={onExportKey} />)
      const exportButtons = screen.getAllByRole('button', { name: /export/i })
      expect(exportButtons.length).toBeGreaterThan(0)
    })

    it('should show share button for active keys', () => {
      const onShareKey = vi.fn()
      render(<EthereumViewingKeyManager keys={mockKeys} onShareKey={onShareKey} />)
      const shareButtons = screen.getAllByRole('button', { name: /share/i })
      expect(shareButtons.length).toBeGreaterThan(0)
    })

    it('should show revoke button for active keys', () => {
      const onRevokeKey = vi.fn()
      render(<EthereumViewingKeyManager keys={mockKeys} onRevokeKey={onRevokeKey} />)
      const revokeButtons = screen.getAllByRole('button', { name: /revoke/i })
      expect(revokeButtons.length).toBeGreaterThan(0)
    })
  })

  // ─── Modal Interactions ──────────────────────────────────────────────────────

  describe('Modal Interactions', () => {
    it('should open generate modal on button click', () => {
      const onGenerateKey = vi.fn().mockResolvedValue({
        id: 'vk_new',
        publicKey: '0x' + '00'.repeat(32),
        status: 'active',
        createdAt: Date.now(),
        usageHistory: [],
      })
      render(<EthereumViewingKeyManager keys={mockKeys} onGenerateKey={onGenerateKey} />)

      fireEvent.click(screen.getByRole('button', { name: /generate/i }))
      expect(screen.getByTestId('generate-modal')).toBeInTheDocument()
    })

    it('should close modal on cancel', async () => {
      const onGenerateKey = vi.fn().mockResolvedValue({})
      render(<EthereumViewingKeyManager keys={mockKeys} onGenerateKey={onGenerateKey} />)

      fireEvent.click(screen.getByRole('button', { name: /generate/i }))
      expect(screen.getByTestId('generate-modal')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
      await waitFor(() => {
        expect(screen.queryByTestId('generate-modal')).not.toBeInTheDocument()
      })
    })
  })
})

// ─── Hook Tests ──────────────────────────────────────────────────────────────

describe('useEthereumViewingKey', () => {
  it('should initialize with empty keys', () => {
    const { result } = renderHook(() => useEthereumViewingKey())
    expect(result.current.keys).toEqual([])
    expect(result.current.activeKeys).toEqual([])
    expect(result.current.currentChainId).toBe(1)
  })

  it('should initialize with initial keys', () => {
    const { result } = renderHook(() =>
      useEthereumViewingKey({ initialKeys: mockKeys })
    )
    expect(result.current.keys).toEqual(mockKeys)
    expect(result.current.activeKeys).toHaveLength(2)
  })

  it('should generate a new key', async () => {
    const onKeyGenerated = vi.fn()
    const { result } = renderHook(() =>
      useEthereumViewingKey({ onKeyGenerated })
    )

    await act(async () => {
      const key = await result.current.generateKey('Test Key')
      expect(key.label).toBe('Test Key')
      expect(key.status).toBe('active')
      expect(key.chainId).toBe(1)
    })

    expect(result.current.keys).toHaveLength(1)
    expect(onKeyGenerated).toHaveBeenCalled()
  })

  it('should generate key with custom chain ID', async () => {
    const { result } = renderHook(() =>
      useEthereumViewingKey({ chainId: 42161 })
    )

    await act(async () => {
      const key = await result.current.generateKey('Arbitrum Key')
      expect(key.chainId).toBe(42161)
    })
  })

  it('should revoke a key', () => {
    const onKeyRevoked = vi.fn()
    const { result } = renderHook(() =>
      useEthereumViewingKey({
        initialKeys: mockKeys,
        onKeyRevoked,
      })
    )

    act(() => {
      result.current.revokeKey('vk_1')
    })

    const revokedKey = result.current.keys.find((k) => k.id === 'vk_1')
    expect(revokedKey?.status).toBe('revoked')
    expect(onKeyRevoked).toHaveBeenCalledWith('vk_1')
  })

  it('should filter keys by chain', () => {
    const keysMultiChain: EthereumViewingKey[] = [
      { ...mockKeys[0], chainId: 1 },
      { ...mockKeys[1], id: 'vk_arb', chainId: 42161 },
    ]

    const { result } = renderHook(() =>
      useEthereumViewingKey({ initialKeys: keysMultiChain })
    )

    expect(result.current.keysForChain(1)).toHaveLength(1)
    expect(result.current.keysForChain(42161)).toHaveLength(1)
    expect(result.current.keysForChain(10)).toHaveLength(0)
  })

  it('should format viewing key address', () => {
    const { result } = renderHook(() =>
      useEthereumViewingKey({ initialKeys: mockKeys })
    )

    const formatted = result.current.formatViewingKeyAddress(mockKeys[0])
    // The function truncates to first 10 chars and last 8 chars
    expect(formatted).toBe('0xabababab...abababab')
  })

  it('should track active and revoked keys', () => {
    const keysWithRevoked: EthereumViewingKey[] = [
      { ...mockKeys[0], status: 'active' },
      { ...mockKeys[1], status: 'revoked' },
    ]

    const { result } = renderHook(() =>
      useEthereumViewingKey({ initialKeys: keysWithRevoked })
    )

    expect(result.current.activeKeys).toHaveLength(1)
    expect(result.current.revokedKeys).toHaveLength(1)
  })
})
