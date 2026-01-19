/**
 * Ethereum Transaction History Tests
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { renderHook, act } from '@testing-library/react'
import {
  TransactionHistory,
  useTransactionHistory,
  type PrivacyTransactionHistoryItem,
} from '../../../src/components/ethereum/transaction-history'

// Mock transactions
const mockTransactions: PrivacyTransactionHistoryItem[] = [
  {
    hash: '0x1111111111111111111111111111111111111111111111111111111111111111',
    direction: 'sent',
    type: 'stealth_transfer',
    timestamp: Date.now() - 3600000,
    blockNumber: 12345678,
    from: '0x1234567890123456789012345678901234567890',
    to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    isStealthAddress: true,
    amount: '1500000000000000000', // 1.5 ETH
    tokenSymbol: 'ETH',
    tokenDecimals: 18,
    usdValue: '3750.00',
    gasUsed: '65000',
    gasPrice: '20',
    fee: '0.0013',
    status: 'confirmed',
    ephemeralPublicKey: '0x' + 'aa'.repeat(33),
    viewTag: 42,
  },
  {
    hash: '0x2222222222222222222222222222222222222222222222222222222222222222',
    direction: 'received',
    type: 'stealth_transfer',
    timestamp: Date.now() - 7200000,
    blockNumber: 12345600,
    from: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    to: '0x1234567890123456789012345678901234567890',
    isStealthAddress: true,
    amount: '500000000000000000', // 0.5 ETH
    tokenSymbol: 'ETH',
    tokenDecimals: 18,
    usdValue: '1250.00',
    status: 'confirmed',
  },
  {
    hash: '0x3333333333333333333333333333333333333333333333333333333333333333',
    direction: 'claimed',
    type: 'claim',
    timestamp: Date.now() - 86400000,
    blockNumber: 12340000,
    from: '0x0000000000000000000000000000000000000000',
    to: '0x1234567890123456789012345678901234567890',
    isStealthAddress: false,
    amount: '2000000000000000000', // 2 ETH
    tokenSymbol: 'ETH',
    tokenDecimals: 18,
    usdValue: '5000.00',
    status: 'confirmed',
    claimKey: '0x' + 'bb'.repeat(32),
  },
]

describe('TransactionHistory', () => {
  // ─── Component Rendering ─────────────────────────────────────────────────────

  describe('Component Rendering', () => {
    it('should render empty state', () => {
      render(<TransactionHistory transactions={[]} />)
      expect(screen.getByTestId('empty')).toBeInTheDocument()
      expect(screen.getByText(/No transactions yet/)).toBeInTheDocument()
    })

    it('should render transaction list', () => {
      render(<TransactionHistory transactions={mockTransactions} />)
      expect(screen.getByTestId('transaction-list')).toBeInTheDocument()
    })

    it('should render all transactions', () => {
      render(<TransactionHistory transactions={mockTransactions} />)
      expect(screen.getByTestId('tx-item-0x111111')).toBeInTheDocument()
      expect(screen.getByTestId('tx-item-0x222222')).toBeInTheDocument()
      expect(screen.getByTestId('tx-item-0x333333')).toBeInTheDocument()
    })

    it('should show stealth badge for stealth transactions', () => {
      render(<TransactionHistory transactions={mockTransactions} />)
      const stealthBadges = screen.getAllByText('Stealth')
      expect(stealthBadges.length).toBe(2) // First two are stealth
    })

    it('should show direction correctly', () => {
      render(<TransactionHistory transactions={mockTransactions} showFilters={false} />)
      // Use getAllByText since there might be multiple instances in filters
      expect(screen.getAllByText('Sent').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Received').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Claimed').length).toBeGreaterThanOrEqual(1)
    })

    it('should format amounts correctly', () => {
      render(<TransactionHistory transactions={mockTransactions} />)
      expect(screen.getByText(/-1\.5 ETH/)).toBeInTheDocument()
      expect(screen.getByText(/\+0\.5 ETH/)).toBeInTheDocument()
      expect(screen.getByText(/\+2 ETH/)).toBeInTheDocument()
    })

    it('should show USD values when enabled', () => {
      render(<TransactionHistory transactions={mockTransactions} showUsdValues />)
      expect(screen.getByText('$3,750.00')).toBeInTheDocument()
      expect(screen.getByText('$1,250.00')).toBeInTheDocument()
    })

    it('should hide USD values when disabled', () => {
      render(<TransactionHistory transactions={mockTransactions} showUsdValues={false} />)
      expect(screen.queryByText('$3,750.00')).not.toBeInTheDocument()
    })

    it('should show loading state', () => {
      render(<TransactionHistory transactions={[]} isLoading />)
      expect(screen.getByTestId('loading')).toBeInTheDocument()
      expect(screen.getByText(/Loading transactions/)).toBeInTheDocument()
    })

    it('should show error state', () => {
      render(<TransactionHistory transactions={[]} error="Failed to load" />)
      expect(screen.getByTestId('error')).toBeInTheDocument()
      expect(screen.getByText('Failed to load')).toBeInTheDocument()
    })
  })

  // ─── Filtering ───────────────────────────────────────────────────────────────

  describe('Filtering', () => {
    it('should show filters when enabled', () => {
      render(<TransactionHistory transactions={mockTransactions} showFilters />)
      // Use text content to find filter labels
      expect(screen.getByText('Direction:')).toBeInTheDocument()
      expect(screen.getByText('Status:')).toBeInTheDocument()
    })

    it('should hide filters when disabled', () => {
      render(<TransactionHistory transactions={mockTransactions} showFilters={false} />)
      expect(screen.queryByText('Direction:')).not.toBeInTheDocument()
    })

    it('should call onFilterChange when filter changes', () => {
      const onFilterChange = vi.fn()
      render(
        <TransactionHistory
          transactions={mockTransactions}
          showFilters
          onFilterChange={onFilterChange}
        />
      )

      // Get the select elements by their class
      const selects = document.querySelectorAll('.sip-tx-history-select')
      expect(selects.length).toBeGreaterThan(0)

      // Change the direction filter (first select)
      fireEvent.change(selects[0], {
        target: { value: 'sent' },
      })

      expect(onFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({ direction: 'sent' })
      )
    })
  })

  // ─── Sorting ─────────────────────────────────────────────────────────────────

  describe('Sorting', () => {
    it('should call onSortChange when sort changes', () => {
      const onSortChange = vi.fn()
      render(
        <TransactionHistory
          transactions={mockTransactions}
          showFilters
          onSortChange={onSortChange}
        />
      )

      // Get the sort select (third select)
      const selects = document.querySelectorAll('.sip-tx-history-select')
      const sortSelect = selects[2]

      fireEvent.change(sortSelect, {
        target: { value: 'amount-desc' },
      })

      expect(onSortChange).toHaveBeenCalledWith({
        field: 'amount',
        direction: 'desc',
      })
    })
  })

  // ─── Export ──────────────────────────────────────────────────────────────────

  describe('Export', () => {
    it('should show export button when callback provided', () => {
      const onExport = vi.fn()
      render(
        <TransactionHistory transactions={mockTransactions} showExport onExport={onExport} />
      )
      expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
    })

    it('should call onExport when button clicked', () => {
      const onExport = vi.fn()
      render(
        <TransactionHistory transactions={mockTransactions} showExport onExport={onExport} />
      )

      fireEvent.click(screen.getByRole('button', { name: /export/i }))
      expect(onExport).toHaveBeenCalledWith('csv')
    })

    it('should disable export when no transactions', () => {
      const onExport = vi.fn()
      render(<TransactionHistory transactions={[]} showExport onExport={onExport} />)
      expect(screen.getByRole('button', { name: /export/i })).toBeDisabled()
    })
  })

  // ─── Transaction Selection ───────────────────────────────────────────────────

  describe('Transaction Selection', () => {
    it('should call onTransactionSelect when clicking transaction', () => {
      const onTransactionSelect = vi.fn()
      render(
        <TransactionHistory
          transactions={mockTransactions}
          onTransactionSelect={onTransactionSelect}
        />
      )

      fireEvent.click(screen.getByTestId('tx-item-0x111111'))
      expect(onTransactionSelect).toHaveBeenCalledWith(mockTransactions[0])
    })
  })

  // ─── Load More ───────────────────────────────────────────────────────────────

  describe('Load More', () => {
    it('should show load more button when hasMore is true', () => {
      render(<TransactionHistory transactions={mockTransactions} hasMore />)
      expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument()
    })

    it('should call onLoadMore when button clicked', () => {
      const onLoadMore = vi.fn()
      render(
        <TransactionHistory
          transactions={mockTransactions}
          hasMore
          onLoadMore={onLoadMore}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /load more/i }))
      expect(onLoadMore).toHaveBeenCalled()
    })
  })

  // ─── Network Configuration ───────────────────────────────────────────────────

  describe('Network Configuration', () => {
    it('should use custom network for explorer links', () => {
      render(
        <TransactionHistory transactions={mockTransactions} network="arbitrum" />
      )
      const explorerLinks = screen.getAllByText(/View on Explorer/)
      expect(explorerLinks[0].closest('a')).toHaveAttribute(
        'href',
        expect.stringContaining('arbiscan.io')
      )
    })
  })
})

// ─── Hook Tests ──────────────────────────────────────────────────────────────

describe('useTransactionHistory', () => {
  it('should initialize with empty transactions', () => {
    const { result } = renderHook(() => useTransactionHistory())
    expect(result.current.transactions).toEqual([])
    expect(result.current.isLoading).toBe(false)
  })

  it('should initialize with initial transactions', () => {
    const { result } = renderHook(() =>
      useTransactionHistory({ initialTransactions: mockTransactions })
    )
    expect(result.current.transactions).toEqual(mockTransactions)
  })

  it('should add transaction', () => {
    const { result } = renderHook(() => useTransactionHistory())

    act(() => {
      result.current.addTransaction(mockTransactions[0])
    })

    expect(result.current.transactions).toHaveLength(1)
    expect(result.current.transactions[0]).toEqual(mockTransactions[0])
  })

  it('should update transaction', () => {
    const { result } = renderHook(() =>
      useTransactionHistory({ initialTransactions: mockTransactions })
    )

    act(() => {
      result.current.updateTransaction(mockTransactions[0].hash, { status: 'failed' })
    })

    expect(result.current.transactions[0].status).toBe('failed')
  })

  it('should have exportHistory function', () => {
    const { result } = renderHook(() =>
      useTransactionHistory({ initialTransactions: mockTransactions })
    )

    // Just check the function exists and is callable
    expect(result.current.exportHistory).toBeDefined()
    expect(typeof result.current.exportHistory).toBe('function')
  })

  it('should calculate summary statistics', () => {
    const { result } = renderHook(() =>
      useTransactionHistory({ initialTransactions: mockTransactions })
    )

    expect(result.current.summary.total).toBe(3)
    expect(result.current.summary.sent).toBe(1)
    expect(result.current.summary.received).toBe(1)
    expect(result.current.summary.claimed).toBe(1)
    expect(result.current.summary.stealthCount).toBe(2)
    expect(result.current.summary.stealthPercentage).toBe(67) // 2/3
  })

  it('should manage filter state', () => {
    const { result } = renderHook(() => useTransactionHistory())

    expect(result.current.filter.direction).toBe('all')

    act(() => {
      result.current.setFilter({ direction: 'sent' })
    })

    expect(result.current.filter.direction).toBe('sent')
  })

  it('should manage sort state', () => {
    const { result } = renderHook(() => useTransactionHistory())

    expect(result.current.sort.field).toBe('timestamp')
    expect(result.current.sort.direction).toBe('desc')

    act(() => {
      result.current.setSort({ field: 'amount', direction: 'asc' })
    })

    expect(result.current.sort.field).toBe('amount')
    expect(result.current.sort.direction).toBe('asc')
  })

  it('should load transactions manually', async () => {
    const fetchTransactions = vi.fn().mockResolvedValue(mockTransactions)

    const { result } = renderHook(() =>
      useTransactionHistory({
        fetchTransactions,
        initialTransactions: [], // Don't auto-fetch on mount
      })
    )

    // Manually trigger load
    await act(async () => {
      await result.current.loadTransactions()
    })

    expect(result.current.transactions).toHaveLength(3)
    expect(fetchTransactions).toHaveBeenCalled()
  })

  it('should handle fetch error', async () => {
    const fetchTransactions = vi.fn().mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() =>
      useTransactionHistory({
        fetchTransactions,
        initialTransactions: [], // Don't auto-fetch on mount
      })
    )

    // Manually trigger load
    await act(async () => {
      await result.current.loadTransactions()
    })

    expect(result.current.error).toBe('Network error')
  })
})
