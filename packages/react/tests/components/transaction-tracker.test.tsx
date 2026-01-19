import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import {
  TransactionTracker,
  useTransactionTracker,
  type PrivacyTransaction,
  type TransactionStatus,
} from '../../src/components/transaction-tracker'

// Helper to create a mock transaction
function createMockTransaction(
  overrides: Partial<PrivacyTransaction> = {}
): PrivacyTransaction {
  return {
    hash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abcd',
    status: 'confirmed',
    confirmations: 1,
    requiredConfirmations: 2,
    timestamp: Date.now(),
    sender: 'alice.near',
    receiver: 'bob.near',
    isStealthReceiver: false,
    actions: [{ type: 'transfer', receiver: 'bob.near', amount: '1 NEAR' }],
    ...overrides,
  }
}

describe('TransactionTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ─── Basic Rendering ────────────────────────────────────────────────────────

  describe('Basic Rendering', () => {
    it('should render the transaction tracker', () => {
      const tx = createMockTransaction()
      render(<TransactionTracker transaction={tx} />)

      expect(screen.getByText('Transaction Confirmed')).toBeTruthy()
    })

    it('should show truncated transaction hash', () => {
      const tx = createMockTransaction()
      render(<TransactionTracker transaction={tx} />)

      // Hash: abc123def456abc123def456abc123def456abc123def456abc123def456abcd
      // Truncated: abc123de...f456abcd
      expect(screen.getByText(/abc123de...f456abcd/)).toBeTruthy()
    })

    it('should show network name', () => {
      const tx = createMockTransaction()
      render(<TransactionTracker transaction={tx} networkName="NEAR Testnet" />)

      expect(screen.getByText(/NEAR Testnet/)).toBeTruthy()
    })

    it('should apply custom className', () => {
      const tx = createMockTransaction()
      const { container } = render(
        <TransactionTracker transaction={tx} className="custom-class" />
      )

      expect(container.querySelector('.custom-class')).toBeTruthy()
    })
  })

  // ─── Status Display ────────────────────────────────────────────────────────

  describe('Status Display', () => {
    const statuses: TransactionStatus[] = [
      'pending',
      'processing',
      'confirmed',
      'finalized',
      'failed',
      'cancelled',
    ]

    statuses.forEach((status) => {
      it(`should display correct title for ${status} status`, () => {
        const tx = createMockTransaction({ status })
        const { container } = render(<TransactionTracker transaction={tx} />)

        const statusIcon = container.querySelector('[data-testid="status-icon"]')
        expect(statusIcon?.getAttribute('data-status')).toBe(status)
      })
    })

    it('should show "Transaction Pending" for pending status', () => {
      const tx = createMockTransaction({ status: 'pending' })
      render(<TransactionTracker transaction={tx} />)

      expect(screen.getByText('Transaction Pending')).toBeTruthy()
    })

    it('should show "Transaction Finalized" for finalized status', () => {
      const tx = createMockTransaction({ status: 'finalized' })
      render(<TransactionTracker transaction={tx} />)

      expect(screen.getByText('Transaction Finalized')).toBeTruthy()
    })

    it('should show "Transaction Failed" for failed status', () => {
      const tx = createMockTransaction({ status: 'failed' })
      render(<TransactionTracker transaction={tx} />)

      expect(screen.getByText('Transaction Failed')).toBeTruthy()
    })
  })

  // ─── Progress Bar ──────────────────────────────────────────────────────────

  describe('Progress Bar', () => {
    it('should show confirmation progress', () => {
      const tx = createMockTransaction({ confirmations: 1, requiredConfirmations: 2 })
      render(<TransactionTracker transaction={tx} />)

      expect(screen.getByText('1/2 confirmations')).toBeTruthy()
    })

    it('should calculate correct progress percentage', () => {
      const tx = createMockTransaction({ confirmations: 1, requiredConfirmations: 2 })
      const { container } = render(<TransactionTracker transaction={tx} />)

      const progressBar = container.querySelector('[data-testid="progress-bar"]')
      expect(progressBar?.getAttribute('aria-valuenow')).toBe('50')
    })

    it('should show 100% for finalized transactions', () => {
      const tx = createMockTransaction({ status: 'finalized', confirmations: 2, requiredConfirmations: 2 })
      const { container } = render(<TransactionTracker transaction={tx} />)

      const progressBar = container.querySelector('[data-testid="progress-bar"]')
      expect(progressBar?.getAttribute('aria-valuenow')).toBe('100')
    })

    it('should not show progress bar for cancelled transactions', () => {
      const tx = createMockTransaction({ status: 'cancelled' })
      const { container } = render(<TransactionTracker transaction={tx} />)

      const progressBar = container.querySelector('[data-testid="progress-bar"]')
      expect(progressBar).toBeNull()
    })
  })

  // ─── ETA Display ───────────────────────────────────────────────────────────

  describe('ETA Display', () => {
    it('should show ETA for pending transactions', () => {
      const tx = createMockTransaction({ status: 'pending', confirmations: 0, requiredConfirmations: 2 })
      const { container } = render(<TransactionTracker transaction={tx} />)

      const eta = container.querySelector('[data-testid="eta"]')
      expect(eta).toBeTruthy()
      expect(eta?.textContent).toContain('to finality')
    })

    it('should not show ETA for finalized transactions', () => {
      const tx = createMockTransaction({ status: 'finalized', confirmations: 2, requiredConfirmations: 2 })
      const { container } = render(<TransactionTracker transaction={tx} />)

      const eta = container.querySelector('[data-testid="eta"]')
      expect(eta).toBeNull()
    })

    it('should not show ETA for failed transactions', () => {
      const tx = createMockTransaction({ status: 'failed' })
      const { container } = render(<TransactionTracker transaction={tx} />)

      const eta = container.querySelector('[data-testid="eta"]')
      expect(eta).toBeNull()
    })
  })

  // ─── Privacy Status ────────────────────────────────────────────────────────

  describe('Privacy Status', () => {
    it('should show privacy verification when enabled', () => {
      const tx = createMockTransaction({
        privacyVerification: {
          stealthAddressResolved: 'verified',
          commitmentVerified: 'pending',
          viewingKeyGenerated: 'verified',
        },
      })
      const { container } = render(<TransactionTracker transaction={tx} />)

      const privacyStatus = container.querySelector('[data-testid="privacy-status"]')
      expect(privacyStatus).toBeTruthy()
    })

    it('should hide privacy verification when showPrivacyStatus is false', () => {
      const tx = createMockTransaction({
        privacyVerification: {
          stealthAddressResolved: 'verified',
          commitmentVerified: 'verified',
          viewingKeyGenerated: 'verified',
        },
      })
      const { container } = render(<TransactionTracker transaction={tx} showPrivacyStatus={false} />)

      const privacyStatus = container.querySelector('[data-testid="privacy-status"]')
      expect(privacyStatus).toBeNull()
    })

    it('should show all three privacy verification items', () => {
      const tx = createMockTransaction({
        privacyVerification: {
          stealthAddressResolved: 'verified',
          commitmentVerified: 'pending',
          viewingKeyGenerated: 'failed',
        },
      })
      render(<TransactionTracker transaction={tx} />)

      expect(screen.getByText('Stealth Address')).toBeTruthy()
      expect(screen.getByText('Commitment')).toBeTruthy()
      expect(screen.getByText('Viewing Key')).toBeTruthy()
    })
  })

  // ─── Error Message ─────────────────────────────────────────────────────────

  describe('Error Message', () => {
    it('should show error message when present', () => {
      const tx = createMockTransaction({
        status: 'failed',
        errorMessage: 'Insufficient funds',
      })
      const { container } = render(<TransactionTracker transaction={tx} />)

      const errorMessage = container.querySelector('[data-testid="error-message"]')
      expect(errorMessage?.textContent).toBe('Insufficient funds')
    })

    it('should not show error section when no error', () => {
      const tx = createMockTransaction({ status: 'confirmed' })
      const { container } = render(<TransactionTracker transaction={tx} />)

      const errorMessage = container.querySelector('[data-testid="error-message"]')
      expect(errorMessage).toBeNull()
    })
  })

  // ─── Details Section ───────────────────────────────────────────────────────

  describe('Details Section', () => {
    it('should be collapsed by default', () => {
      const tx = createMockTransaction()
      const { container } = render(<TransactionTracker transaction={tx} />)

      const details = container.querySelector('[data-testid="details-section"]')
      expect(details).toBeNull()
    })

    it('should expand when clicking Show Details', () => {
      const tx = createMockTransaction()
      const { container } = render(<TransactionTracker transaction={tx} />)

      fireEvent.click(screen.getByText('Show Details'))

      const details = container.querySelector('[data-testid="details-section"]')
      expect(details).toBeTruthy()
    })

    it('should collapse when clicking Hide Details', () => {
      const tx = createMockTransaction()
      const { container } = render(<TransactionTracker transaction={tx} defaultExpanded />)

      fireEvent.click(screen.getByText('Hide Details'))

      const details = container.querySelector('[data-testid="details-section"]')
      expect(details).toBeNull()
    })

    it('should be expanded by default when defaultExpanded is true', () => {
      const tx = createMockTransaction()
      const { container } = render(<TransactionTracker transaction={tx} defaultExpanded />)

      const details = container.querySelector('[data-testid="details-section"]')
      expect(details).toBeTruthy()
    })

    it('should show transaction details', () => {
      const tx = createMockTransaction({
        amount: '10 NEAR',
        gasUsed: '2.5 TGas',
        fee: '0.001 NEAR',
        blockHeight: 12345,
      })
      render(<TransactionTracker transaction={tx} defaultExpanded />)

      expect(screen.getByText('10 NEAR')).toBeTruthy()
      expect(screen.getByText('2.5 TGas')).toBeTruthy()
      expect(screen.getByText('0.001 NEAR')).toBeTruthy()
      expect(screen.getByText('#12345')).toBeTruthy()
    })

    it('should show stealth indicator for stealth receivers', () => {
      const tx = createMockTransaction({ isStealthReceiver: true })
      render(<TransactionTracker transaction={tx} defaultExpanded />)

      expect(screen.getByText(/\(Stealth\)/)).toBeTruthy()
    })
  })

  // ─── Action Buttons ────────────────────────────────────────────────────────

  describe('Action Buttons', () => {
    it('should show Refresh button when onRefresh provided and not finalized', () => {
      const onRefresh = vi.fn()
      const tx = createMockTransaction({ status: 'confirmed' })
      render(<TransactionTracker transaction={tx} onRefresh={onRefresh} />)

      expect(screen.getByText('Refresh')).toBeTruthy()
    })

    it('should not show Refresh button when finalized', () => {
      const onRefresh = vi.fn()
      const tx = createMockTransaction({ status: 'finalized' })
      render(<TransactionTracker transaction={tx} onRefresh={onRefresh} />)

      expect(screen.queryByText('Refresh')).toBeNull()
    })

    it('should call onRefresh when Refresh clicked', () => {
      const onRefresh = vi.fn()
      const tx = createMockTransaction({ status: 'confirmed' })
      render(<TransactionTracker transaction={tx} onRefresh={onRefresh} />)

      fireEvent.click(screen.getByText('Refresh'))

      expect(onRefresh).toHaveBeenCalled()
    })

    it('should show Retry button for failed transactions', () => {
      const onRetry = vi.fn()
      const tx = createMockTransaction({ status: 'failed' })
      render(<TransactionTracker transaction={tx} onRetry={onRetry} />)

      expect(screen.getByText('Retry')).toBeTruthy()
    })

    it('should not show Retry button for non-failed transactions', () => {
      const onRetry = vi.fn()
      const tx = createMockTransaction({ status: 'confirmed' })
      render(<TransactionTracker transaction={tx} onRetry={onRetry} />)

      expect(screen.queryByText('Retry')).toBeNull()
    })

    it('should call onRetry when Retry clicked', () => {
      const onRetry = vi.fn()
      const tx = createMockTransaction({ status: 'failed' })
      render(<TransactionTracker transaction={tx} onRetry={onRetry} />)

      fireEvent.click(screen.getByText('Retry'))

      expect(onRetry).toHaveBeenCalled()
    })

    it('should show Cancel button for pending transactions', () => {
      const onCancel = vi.fn()
      const tx = createMockTransaction({ status: 'pending' })
      render(<TransactionTracker transaction={tx} onCancel={onCancel} />)

      expect(screen.getByText('Cancel')).toBeTruthy()
    })

    it('should not show Cancel button for non-pending transactions', () => {
      const onCancel = vi.fn()
      const tx = createMockTransaction({ status: 'confirmed' })
      render(<TransactionTracker transaction={tx} onCancel={onCancel} />)

      expect(screen.queryByText('Cancel')).toBeNull()
    })

    it('should call onCancel when Cancel clicked', () => {
      const onCancel = vi.fn()
      const tx = createMockTransaction({ status: 'pending' })
      render(<TransactionTracker transaction={tx} onCancel={onCancel} />)

      fireEvent.click(screen.getByText('Cancel'))

      expect(onCancel).toHaveBeenCalled()
    })
  })

  // ─── Polling ───────────────────────────────────────────────────────────────

  describe('Polling', () => {
    it('should poll when pollingInterval is set', async () => {
      const onRefresh = vi.fn()
      const tx = createMockTransaction({ status: 'confirmed' })
      render(<TransactionTracker transaction={tx} onRefresh={onRefresh} pollingInterval={1000} />)

      expect(onRefresh).not.toHaveBeenCalled()

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(onRefresh).toHaveBeenCalledTimes(1)

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(onRefresh).toHaveBeenCalledTimes(2)
    })

    it('should not poll when transaction is finalized', async () => {
      const onRefresh = vi.fn()
      const tx = createMockTransaction({ status: 'finalized' })
      render(<TransactionTracker transaction={tx} onRefresh={onRefresh} pollingInterval={1000} />)

      act(() => {
        vi.advanceTimersByTime(3000)
      })

      expect(onRefresh).not.toHaveBeenCalled()
    })

    it('should not poll when pollingInterval is 0', async () => {
      const onRefresh = vi.fn()
      const tx = createMockTransaction({ status: 'confirmed' })
      render(<TransactionTracker transaction={tx} onRefresh={onRefresh} pollingInterval={0} />)

      act(() => {
        vi.advanceTimersByTime(3000)
      })

      expect(onRefresh).not.toHaveBeenCalled()
    })
  })

  // ─── Size Variants ─────────────────────────────────────────────────────────

  describe('Size Variants', () => {
    it('should apply size attribute', () => {
      const tx = createMockTransaction()
      const { container } = render(<TransactionTracker transaction={tx} size="lg" />)

      const tracker = container.querySelector('.sip-tx-tracker')
      expect(tracker?.getAttribute('data-size')).toBe('lg')
    })
  })

  // ─── Explorer Link ─────────────────────────────────────────────────────────

  describe('Explorer Link', () => {
    it('should use custom explorer URL template', () => {
      const tx = createMockTransaction()
      render(
        <TransactionTracker
          transaction={tx}
          defaultExpanded
          explorerUrlTemplate="https://custom-explorer.com/tx/{hash}"
        />
      )

      const link = screen.getByRole('link')
      expect(link.getAttribute('href')).toContain('custom-explorer.com')
    })
  })
})

// ─── useTransactionTracker Hook ──────────────────────────────────────────────

describe('useTransactionTracker', () => {
  it('should initialize with null transaction', () => {
    const { result } = renderHook(() => useTransactionTracker())

    expect(result.current.transaction).toBeNull()
  })

  it('should initialize with provided transaction', () => {
    const initialTx = createMockTransaction()
    const { result } = renderHook(() => useTransactionTracker(initialTx))

    expect(result.current.transaction).toEqual(initialTx)
  })

  it('should update transaction', () => {
    const initialTx = createMockTransaction()
    const { result } = renderHook(() => useTransactionTracker(initialTx))

    act(() => {
      result.current.updateTransaction({ status: 'finalized', confirmations: 2 })
    })

    expect(result.current.transaction?.status).toBe('finalized')
    expect(result.current.transaction?.confirmations).toBe(2)
  })

  it('should call onStatusChange when status changes', () => {
    const onStatusChange = vi.fn()
    const initialTx = createMockTransaction({ status: 'confirmed' })
    const { result } = renderHook(() =>
      useTransactionTracker(initialTx, { onStatusChange })
    )

    act(() => {
      result.current.updateTransaction({ status: 'finalized' })
    })

    expect(onStatusChange).toHaveBeenCalledWith('finalized')
  })

  it('should not call onStatusChange when status is same', () => {
    const onStatusChange = vi.fn()
    const initialTx = createMockTransaction({ status: 'confirmed' })
    const { result } = renderHook(() =>
      useTransactionTracker(initialTx, { onStatusChange })
    )

    act(() => {
      result.current.updateTransaction({ confirmations: 2 })
    })

    expect(onStatusChange).not.toHaveBeenCalled()
  })

  it('should set transaction directly', () => {
    const { result } = renderHook(() => useTransactionTracker())

    const newTx = createMockTransaction()
    act(() => {
      result.current.setTransaction(newTx)
    })

    expect(result.current.transaction).toEqual(newTx)
  })

  it('should track isFinal correctly', () => {
    const initialTx = createMockTransaction({ status: 'confirmed' })
    const { result } = renderHook(() => useTransactionTracker(initialTx))

    expect(result.current.isFinal).toBe(false)

    act(() => {
      result.current.updateTransaction({ status: 'finalized' })
    })

    expect(result.current.isFinal).toBe(true)
  })

  it('should manage polling state', () => {
    const { result } = renderHook(() => useTransactionTracker(undefined, { pollingInterval: 1000 }))

    expect(result.current.isPolling).toBe(true)

    act(() => {
      result.current.stopPolling()
    })

    expect(result.current.isPolling).toBe(false)

    act(() => {
      result.current.startPolling()
    })

    expect(result.current.isPolling).toBe(true)
  })
})
