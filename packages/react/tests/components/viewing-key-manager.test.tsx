import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import {
  ViewingKeyManager,
  useViewingKeyManager,
  type ViewingKey,
} from '../../src/components/viewing-key-manager'

// Helper to create a mock viewing key
function createMockKey(overrides: Partial<ViewingKey> = {}): ViewingKey {
  const id = overrides.id || `key-${Date.now()}`
  return {
    id,
    publicKey: '0x' + '1234567890abcdef'.repeat(4),
    status: 'active',
    createdAt: Date.now() - 86400000, // 1 day ago
    usageHistory: [{ timestamp: Date.now() - 86400000, action: 'created' }],
    ...overrides,
  }
}

describe('ViewingKeyManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── Basic Rendering ────────────────────────────────────────────────────────

  describe('Basic Rendering', () => {
    it('should render the viewing key manager', () => {
      render(<ViewingKeyManager keys={[]} />)

      expect(screen.getByText('Viewing Keys')).toBeTruthy()
    })

    it('should show empty state when no keys', () => {
      const { container } = render(<ViewingKeyManager keys={[]} />)

      expect(container.querySelector('[data-testid="empty-state"]')).toBeTruthy()
      expect(screen.getByText('No viewing keys yet')).toBeTruthy()
    })

    it('should show key list when keys exist', () => {
      const keys = [createMockKey({ id: 'key-1', label: 'Test Key' })]
      const { container } = render(<ViewingKeyManager keys={keys} />)

      expect(container.querySelector('[data-testid="key-list"]')).toBeTruthy()
      expect(screen.getByText('Test Key')).toBeTruthy()
    })

    it('should show truncated public key', () => {
      const keys = [createMockKey({ id: 'key-1', publicKey: '0x1234567890abcdef1234567890abcdef' })]
      render(<ViewingKeyManager keys={keys} />)

      expect(screen.getByText(/0x123456...90abcdef/)).toBeTruthy()
    })

    it('should show key status badge', () => {
      const keys = [createMockKey({ id: 'key-1', status: 'active' })]
      const { container } = render(<ViewingKeyManager keys={keys} />)

      const badge = container.querySelector('[data-status="active"]')
      expect(badge).toBeTruthy()
      expect(badge?.textContent).toBe('active')
    })

    it('should apply custom className', () => {
      const { container } = render(<ViewingKeyManager keys={[]} className="custom-class" />)

      expect(container.querySelector('.custom-class')).toBeTruthy()
    })
  })

  // ─── Generate Key ──────────────────────────────────────────────────────────

  describe('Generate Key', () => {
    it('should show Generate button when onGenerateKey provided', () => {
      const onGenerateKey = vi.fn()
      render(<ViewingKeyManager keys={[]} onGenerateKey={onGenerateKey} />)

      expect(screen.getByText('Generate')).toBeTruthy()
    })

    it('should not show Generate button when onGenerateKey not provided', () => {
      render(<ViewingKeyManager keys={[]} />)

      expect(screen.queryByText('Generate')).toBeNull()
    })

    it('should open generate modal when Generate clicked', () => {
      const onGenerateKey = vi.fn()
      render(<ViewingKeyManager keys={[]} onGenerateKey={onGenerateKey} />)

      fireEvent.click(screen.getByText('Generate'))

      expect(screen.getByTestId('generate-modal')).toBeTruthy()
      expect(screen.getByText('Generate Viewing Key')).toBeTruthy()
    })

    it('should show warning about key sharing', () => {
      const onGenerateKey = vi.fn()
      render(<ViewingKeyManager keys={[]} onGenerateKey={onGenerateKey} />)

      fireEvent.click(screen.getByText('Generate'))

      expect(screen.getByText(/Only share with trusted parties/)).toBeTruthy()
    })

    it('should call onGenerateKey with label', async () => {
      const onGenerateKey = vi.fn().mockResolvedValue(createMockKey())
      render(<ViewingKeyManager keys={[]} onGenerateKey={onGenerateKey} />)

      fireEvent.click(screen.getByText('Generate'))

      const input = screen.getByPlaceholderText(/Auditor Key/)
      fireEvent.change(input, { target: { value: 'My Test Key' } })

      fireEvent.click(screen.getByText('Generate Key'))

      await waitFor(() => {
        expect(onGenerateKey).toHaveBeenCalledWith('My Test Key')
      })
    })

    it('should close modal after successful generation', async () => {
      const onGenerateKey = vi.fn().mockResolvedValue(createMockKey())
      render(<ViewingKeyManager keys={[]} onGenerateKey={onGenerateKey} />)

      fireEvent.click(screen.getByText('Generate'))
      fireEvent.click(screen.getByText('Generate Key'))

      await waitFor(() => {
        expect(screen.queryByTestId('generate-modal')).toBeNull()
      })
    })
  })

  // ─── Export Key ────────────────────────────────────────────────────────────

  describe('Export Key', () => {
    it('should show export button for active keys', () => {
      const keys = [createMockKey({ id: 'key-1' })]
      const onExportKey = vi.fn()
      render(<ViewingKeyManager keys={keys} onExportKey={onExportKey} />)

      expect(screen.getByLabelText('Export key')).toBeTruthy()
    })

    it('should not show export button for revoked keys', () => {
      const keys = [createMockKey({ id: 'key-1', status: 'revoked' })]
      const onExportKey = vi.fn()
      render(<ViewingKeyManager keys={keys} onExportKey={onExportKey} />)

      expect(screen.queryByLabelText('Export key')).toBeNull()
    })

    it('should open export modal when export button clicked', () => {
      const keys = [createMockKey({ id: 'key-1' })]
      const onExportKey = vi.fn()
      render(<ViewingKeyManager keys={keys} onExportKey={onExportKey} />)

      fireEvent.click(screen.getByLabelText('Export key'))

      expect(screen.getByTestId('export-modal')).toBeTruthy()
      expect(screen.getByText('Export Viewing Key')).toBeTruthy()
    })

    it('should show format selection in export modal', () => {
      const keys = [createMockKey({ id: 'key-1' })]
      const onExportKey = vi.fn()
      render(<ViewingKeyManager keys={keys} onExportKey={onExportKey} />)

      fireEvent.click(screen.getByLabelText('Export key'))

      expect(screen.getByText('Export Format')).toBeTruthy()
      expect(screen.getByText('Encrypted File (Recommended)')).toBeTruthy()
    })

    it('should show password field for encrypted export', () => {
      const keys = [createMockKey({ id: 'key-1' })]
      const onExportKey = vi.fn()
      render(<ViewingKeyManager keys={keys} onExportKey={onExportKey} />)

      fireEvent.click(screen.getByLabelText('Export key'))

      expect(screen.getByPlaceholderText('Enter a strong password')).toBeTruthy()
    })

    it('should show QR code placeholder when QR format selected', () => {
      const keys = [createMockKey({ id: 'key-1' })]
      const onExportKey = vi.fn()
      render(<ViewingKeyManager keys={keys} onExportKey={onExportKey} />)

      fireEvent.click(screen.getByLabelText('Export key'))

      const select = screen.getByLabelText('Export Format')
      fireEvent.change(select, { target: { value: 'qr_code' } })

      expect(screen.getByTestId('qr-placeholder')).toBeTruthy()
    })

    it('should show warning for plaintext export', () => {
      const keys = [createMockKey({ id: 'key-1' })]
      const onExportKey = vi.fn()
      render(<ViewingKeyManager keys={keys} onExportKey={onExportKey} />)

      fireEvent.click(screen.getByLabelText('Export key'))

      const select = screen.getByLabelText('Export Format')
      fireEvent.change(select, { target: { value: 'plaintext' } })

      expect(screen.getByText(/not secure/)).toBeTruthy()
    })
  })

  // ─── Import Key ────────────────────────────────────────────────────────────

  describe('Import Key', () => {
    it('should show Import button when onImportKey provided', () => {
      const onImportKey = vi.fn()
      render(<ViewingKeyManager keys={[]} onImportKey={onImportKey} />)

      expect(screen.getByText('Import')).toBeTruthy()
    })

    it('should open import modal when Import clicked', () => {
      const onImportKey = vi.fn()
      render(<ViewingKeyManager keys={[]} onImportKey={onImportKey} />)

      fireEvent.click(screen.getByText('Import'))

      expect(screen.getByTestId('import-modal')).toBeTruthy()
      expect(screen.getByText('Import Viewing Key')).toBeTruthy()
    })

    it('should show import source selection', () => {
      const onImportKey = vi.fn()
      render(<ViewingKeyManager keys={[]} onImportKey={onImportKey} />)

      fireEvent.click(screen.getByText('Import'))

      expect(screen.getByText('Import From')).toBeTruthy()
      expect(screen.getByText('Encrypted File')).toBeTruthy()
    })

    it('should show file upload for file import', () => {
      const onImportKey = vi.fn()
      render(<ViewingKeyManager keys={[]} onImportKey={onImportKey} />)

      fireEvent.click(screen.getByText('Import'))

      expect(screen.getByTestId('file-upload')).toBeTruthy()
    })

    it('should show text area for text import', () => {
      const onImportKey = vi.fn()
      render(<ViewingKeyManager keys={[]} onImportKey={onImportKey} />)

      fireEvent.click(screen.getByText('Import'))

      const select = screen.getByLabelText('Import From')
      fireEvent.change(select, { target: { value: 'text' } })

      expect(screen.getByPlaceholderText('Paste your viewing key here...')).toBeTruthy()
    })

    it('should show QR scanner for QR import', () => {
      const onImportKey = vi.fn()
      render(<ViewingKeyManager keys={[]} onImportKey={onImportKey} />)

      fireEvent.click(screen.getByText('Import'))

      const select = screen.getByLabelText('Import From')
      fireEvent.change(select, { target: { value: 'qr_code' } })

      expect(screen.getByTestId('qr-scanner')).toBeTruthy()
    })
  })

  // ─── Share Key ─────────────────────────────────────────────────────────────

  describe('Share Key', () => {
    it('should show share button for active keys', () => {
      const keys = [createMockKey({ id: 'key-1' })]
      const onShareKey = vi.fn()
      render(<ViewingKeyManager keys={keys} onShareKey={onShareKey} />)

      expect(screen.getByLabelText('Share key')).toBeTruthy()
    })

    it('should open share modal when share button clicked', () => {
      const keys = [createMockKey({ id: 'key-1' })]
      const onShareKey = vi.fn()
      render(<ViewingKeyManager keys={keys} onShareKey={onShareKey} />)

      fireEvent.click(screen.getByLabelText('Share key'))

      expect(screen.getByTestId('share-modal')).toBeTruthy()
      expect(screen.getByText('Share Viewing Key')).toBeTruthy()
    })

    it('should show warning about key sharing', () => {
      const keys = [createMockKey({ id: 'key-1' })]
      const onShareKey = vi.fn()
      render(<ViewingKeyManager keys={keys} onShareKey={onShareKey} />)

      fireEvent.click(screen.getByLabelText('Share key'))

      expect(screen.getByText(/allow the recipient to see all transactions/)).toBeTruthy()
    })

    it('should show recipient input', () => {
      const keys = [createMockKey({ id: 'key-1' })]
      const onShareKey = vi.fn()
      render(<ViewingKeyManager keys={keys} onShareKey={onShareKey} />)

      fireEvent.click(screen.getByLabelText('Share key'))

      expect(screen.getByPlaceholderText(/auditor.near/)).toBeTruthy()
    })

    it('should call onShareKey with recipient', async () => {
      const keys = [createMockKey({ id: 'key-1' })]
      const onShareKey = vi.fn().mockResolvedValue(undefined)
      render(<ViewingKeyManager keys={keys} onShareKey={onShareKey} />)

      fireEvent.click(screen.getByLabelText('Share key'))

      const input = screen.getByPlaceholderText(/auditor.near/)
      fireEvent.change(input, { target: { value: 'auditor.near' } })

      fireEvent.click(screen.getByText('Share Key'))

      await waitFor(() => {
        expect(onShareKey).toHaveBeenCalledWith('key-1', 'auditor.near')
      })
    })
  })

  // ─── Revoke Key ────────────────────────────────────────────────────────────

  describe('Revoke Key', () => {
    it('should show revoke button for active keys', () => {
      const keys = [createMockKey({ id: 'key-1' })]
      const onRevokeKey = vi.fn()
      render(<ViewingKeyManager keys={keys} onRevokeKey={onRevokeKey} />)

      expect(screen.getByLabelText('Revoke key')).toBeTruthy()
    })

    it('should not show revoke button for revoked keys', () => {
      const keys = [createMockKey({ id: 'key-1', status: 'revoked' })]
      const onRevokeKey = vi.fn()
      render(<ViewingKeyManager keys={keys} onRevokeKey={onRevokeKey} />)

      expect(screen.queryByLabelText('Revoke key')).toBeNull()
    })

    it('should open revoke modal when revoke button clicked', () => {
      const keys = [createMockKey({ id: 'key-1' })]
      const onRevokeKey = vi.fn()
      render(<ViewingKeyManager keys={keys} onRevokeKey={onRevokeKey} />)

      fireEvent.click(screen.getByLabelText('Revoke key'))

      expect(screen.getByTestId('revoke-modal')).toBeTruthy()
      expect(screen.getByText('Revoke Viewing Key')).toBeTruthy()
    })

    it('should show warning about revocation', () => {
      const keys = [createMockKey({ id: 'key-1' })]
      const onRevokeKey = vi.fn()
      render(<ViewingKeyManager keys={keys} onRevokeKey={onRevokeKey} />)

      fireEvent.click(screen.getByLabelText('Revoke key'))

      expect(screen.getByText(/cannot be undone/)).toBeTruthy()
    })

    it('should show shared count if key was shared', () => {
      const keys = [createMockKey({ id: 'key-1', sharedWith: ['user1.near', 'user2.near'] })]
      const onRevokeKey = vi.fn()
      render(<ViewingKeyManager keys={keys} onRevokeKey={onRevokeKey} />)

      fireEvent.click(screen.getByLabelText('Revoke key'))

      expect(screen.getByText(/2 recipient/)).toBeTruthy()
    })

    it('should call onRevokeKey', async () => {
      const keys = [createMockKey({ id: 'key-1' })]
      const onRevokeKey = vi.fn().mockResolvedValue(undefined)
      render(<ViewingKeyManager keys={keys} onRevokeKey={onRevokeKey} />)

      fireEvent.click(screen.getByLabelText('Revoke key'))
      fireEvent.click(screen.getByText('Revoke Key'))

      await waitFor(() => {
        expect(onRevokeKey).toHaveBeenCalledWith('key-1')
      })
    })
  })

  // ─── Backup Reminder ───────────────────────────────────────────────────────

  describe('Backup Reminder', () => {
    it('should show backup reminder for keys without export history', () => {
      const keys = [createMockKey({ id: 'key-1' })]
      const { container } = render(<ViewingKeyManager keys={keys} />)

      expect(container.querySelector('[data-testid="backup-reminder"]')).toBeTruthy()
      expect(screen.getByText(/not backed up/)).toBeTruthy()
    })

    it('should not show backup reminder for exported keys', () => {
      const keys = [
        createMockKey({
          id: 'key-1',
          usageHistory: [
            { timestamp: Date.now(), action: 'created' },
            { timestamp: Date.now(), action: 'exported' },
          ],
        }),
      ]
      const { container } = render(<ViewingKeyManager keys={keys} />)

      expect(container.querySelector('[data-testid="backup-reminder"]')).toBeNull()
    })

    it('should hide backup reminder when showBackupReminder is false', () => {
      const keys = [createMockKey({ id: 'key-1' })]
      const { container } = render(<ViewingKeyManager keys={keys} showBackupReminder={false} />)

      expect(container.querySelector('[data-testid="backup-reminder"]')).toBeNull()
    })

    it('should show Backup Now button', () => {
      const keys = [createMockKey({ id: 'key-1' })]
      const onExportKey = vi.fn()
      render(<ViewingKeyManager keys={keys} onExportKey={onExportKey} />)

      expect(screen.getByText('Backup Now')).toBeTruthy()
    })
  })

  // ─── Size Variants ─────────────────────────────────────────────────────────

  describe('Size Variants', () => {
    it('should apply size attribute', () => {
      const { container } = render(<ViewingKeyManager keys={[]} size="lg" />)

      const manager = container.querySelector('.sip-vk-manager')
      expect(manager?.getAttribute('data-size')).toBe('lg')
    })
  })

  // ─── Multiple Keys ─────────────────────────────────────────────────────────

  describe('Multiple Keys', () => {
    it('should show all keys', () => {
      const keys = [
        createMockKey({ id: 'key-1', label: 'Key 1' }),
        createMockKey({ id: 'key-2', label: 'Key 2' }),
        createMockKey({ id: 'key-3', label: 'Key 3' }),
      ]
      render(<ViewingKeyManager keys={keys} />)

      expect(screen.getByText('Key 1')).toBeTruthy()
      expect(screen.getByText('Key 2')).toBeTruthy()
      expect(screen.getByText('Key 3')).toBeTruthy()
    })

    it('should show mixed status keys', () => {
      const keys = [
        createMockKey({ id: 'key-1', label: 'Active Key', status: 'active' }),
        createMockKey({ id: 'key-2', label: 'Revoked Key', status: 'revoked' }),
      ]
      const { container } = render(<ViewingKeyManager keys={keys} />)

      expect(container.querySelector('[data-status="active"]')).toBeTruthy()
      expect(container.querySelector('[data-status="revoked"]')).toBeTruthy()
    })
  })
})

// ─── useViewingKeyManager Hook ───────────────────────────────────────────────

describe('useViewingKeyManager', () => {
  it('should initialize with empty array', () => {
    const { result } = renderHook(() => useViewingKeyManager())

    expect(result.current.keys).toEqual([])
  })

  it('should initialize with provided keys', () => {
    const initialKeys = [createMockKey({ id: 'key-1' })]
    const { result } = renderHook(() => useViewingKeyManager(initialKeys))

    expect(result.current.keys.length).toBe(1)
    expect(result.current.keys[0].id).toBe('key-1')
  })

  it('should add key', () => {
    const { result } = renderHook(() => useViewingKeyManager())

    act(() => {
      result.current.addKey(createMockKey({ id: 'new-key' }))
    })

    expect(result.current.keys.length).toBe(1)
    expect(result.current.keys[0].id).toBe('new-key')
  })

  it('should remove key', () => {
    const initialKeys = [createMockKey({ id: 'key-1' }), createMockKey({ id: 'key-2' })]
    const { result } = renderHook(() => useViewingKeyManager(initialKeys))

    act(() => {
      result.current.removeKey('key-1')
    })

    expect(result.current.keys.length).toBe(1)
    expect(result.current.keys[0].id).toBe('key-2')
  })

  it('should update key', () => {
    const initialKeys = [createMockKey({ id: 'key-1', label: 'Old Label' })]
    const { result } = renderHook(() => useViewingKeyManager(initialKeys))

    act(() => {
      result.current.updateKey('key-1', { label: 'New Label' })
    })

    expect(result.current.keys[0].label).toBe('New Label')
  })

  it('should revoke key', () => {
    const initialKeys = [createMockKey({ id: 'key-1', status: 'active' })]
    const { result } = renderHook(() => useViewingKeyManager(initialKeys))

    act(() => {
      result.current.revokeKey('key-1')
    })

    expect(result.current.keys[0].status).toBe('revoked')
    expect(result.current.keys[0].usageHistory.some((h) => h.action === 'revoked')).toBe(true)
  })

  it('should return active keys', () => {
    const initialKeys = [
      createMockKey({ id: 'key-1', status: 'active' }),
      createMockKey({ id: 'key-2', status: 'revoked' }),
      createMockKey({ id: 'key-3', status: 'active' }),
    ]
    const { result } = renderHook(() => useViewingKeyManager(initialKeys))

    expect(result.current.activeKeys.length).toBe(2)
  })

  it('should return revoked keys', () => {
    const initialKeys = [
      createMockKey({ id: 'key-1', status: 'active' }),
      createMockKey({ id: 'key-2', status: 'revoked' }),
    ]
    const { result } = renderHook(() => useViewingKeyManager(initialKeys))

    expect(result.current.revokedKeys.length).toBe(1)
    expect(result.current.revokedKeys[0].id).toBe('key-2')
  })
})
