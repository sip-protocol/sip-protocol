/**
 * Ethereum Transaction Tracker Tests
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  EthereumTransactionTracker,
  useEthereumTransactionTracker,
  ETHEREUM_NETWORKS,
  getNetworkByChainId,
} from '../../../src/components/ethereum/transaction-tracker'
import type { PrivacyTransaction } from '../../../src/components/transaction-tracker'
import { renderHook, act } from '@testing-library/react'

// Mock transaction
const mockTransaction: PrivacyTransaction = {
  hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  status: 'confirmed',
  blockHeight: 12345678,
  confirmations: 5,
  requiredConfirmations: 12,
  timestamp: Date.now() - 60000,
  sender: '0x1234567890123456789012345678901234567890',
  receiver: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
  isStealthReceiver: true,
  amount: '1.5 ETH',
  gasUsed: '21000',
  fee: '0.001 ETH',
  actions: [],
  privacyVerification: {
    stealthAddressResolved: 'verified',
    commitmentVerified: 'verified',
    viewingKeyGenerated: 'verified',
  },
}

describe('EthereumTransactionTracker', () => {
  // ─── Network Configuration ───────────────────────────────────────────────────

  describe('Network Configuration', () => {
    it('should have predefined networks', () => {
      expect(ETHEREUM_NETWORKS.mainnet).toBeDefined()
      expect(ETHEREUM_NETWORKS.sepolia).toBeDefined()
      expect(ETHEREUM_NETWORKS.arbitrum).toBeDefined()
      expect(ETHEREUM_NETWORKS.optimism).toBeDefined()
      expect(ETHEREUM_NETWORKS.base).toBeDefined()
      expect(ETHEREUM_NETWORKS.polygon).toBeDefined()
    })

    it('should have correct mainnet config', () => {
      const mainnet = ETHEREUM_NETWORKS.mainnet
      expect(mainnet.name).toBe('Ethereum')
      expect(mainnet.chainId).toBe(1)
      expect(mainnet.explorerUrl).toBe('https://etherscan.io')
      expect(mainnet.blockTime).toBe(12)
      expect(mainnet.requiredConfirmations).toBe(12)
    })

    it('should have correct L2 configs', () => {
      const arbitrum = ETHEREUM_NETWORKS.arbitrum
      expect(arbitrum.name).toBe('Arbitrum One')
      expect(arbitrum.chainId).toBe(42161)
      expect(arbitrum.requiredConfirmations).toBe(1) // L2s have instant finality

      const optimism = ETHEREUM_NETWORKS.optimism
      expect(optimism.name).toBe('Optimism')
      expect(optimism.chainId).toBe(10)
    })

    it('should get network by chain ID', () => {
      expect(getNetworkByChainId(1)?.name).toBe('Ethereum')
      expect(getNetworkByChainId(42161)?.name).toBe('Arbitrum One')
      expect(getNetworkByChainId(10)?.name).toBe('Optimism')
      expect(getNetworkByChainId(999999)).toBeUndefined()
    })
  })

  // ─── Component Rendering ─────────────────────────────────────────────────────

  describe('Component Rendering', () => {
    it('should render with default mainnet config', () => {
      render(<EthereumTransactionTracker transaction={mockTransaction} />)
      expect(screen.getByText(/Ethereum/)).toBeInTheDocument()
    })

    it('should render with network name', () => {
      render(<EthereumTransactionTracker transaction={mockTransaction} network="arbitrum" />)
      expect(screen.getByText(/Arbitrum One/)).toBeInTheDocument()
    })

    it('should render with chain ID', () => {
      render(<EthereumTransactionTracker transaction={mockTransaction} network={10} />)
      expect(screen.getByText(/Optimism/)).toBeInTheDocument()
    })

    it('should render with custom network', () => {
      const customNetwork = {
        name: 'Custom Chain',
        chainId: 12345,
        explorerUrl: 'https://custom.io',
        blockTime: 5,
        requiredConfirmations: 3,
      }
      render(
        <EthereumTransactionTracker
          transaction={mockTransaction}
          customNetwork={customNetwork}
        />
      )
      expect(screen.getByText(/Custom Chain/)).toBeInTheDocument()
    })

    it('should show transaction hash', () => {
      render(<EthereumTransactionTracker transaction={mockTransaction} />)
      expect(screen.getByText(/0x123456.*abcdef/)).toBeInTheDocument()
    })

    it('should show confirmations', () => {
      render(<EthereumTransactionTracker transaction={mockTransaction} />)
      expect(screen.getByText(/5\/12 confirmations/)).toBeInTheDocument()
    })

    it('should show privacy status when enabled', () => {
      render(<EthereumTransactionTracker transaction={mockTransaction} showPrivacyStatus />)
      expect(screen.getByTestId('privacy-status')).toBeInTheDocument()
    })

    it('should handle pending status', () => {
      const pendingTx = { ...mockTransaction, status: 'pending' as const, confirmations: 0 }
      render(<EthereumTransactionTracker transaction={pendingTx} />)
      expect(screen.getByText(/Pending/i)).toBeInTheDocument()
    })

    it('should handle failed status', () => {
      const failedTx = {
        ...mockTransaction,
        status: 'failed' as const,
        errorMessage: 'Out of gas',
      }
      render(<EthereumTransactionTracker transaction={failedTx} />)
      expect(screen.getByText(/Failed/i)).toBeInTheDocument()
      expect(screen.getByTestId('error-message')).toBeInTheDocument()
    })
  })

  // ─── Explorer Links ──────────────────────────────────────────────────────────

  describe('Explorer Links', () => {
    it('should link to etherscan on mainnet', () => {
      render(<EthereumTransactionTracker transaction={mockTransaction} defaultExpanded />)
      const link = screen.getByRole('link', { name: /0x123456/ })
      expect(link).toHaveAttribute('href', expect.stringContaining('etherscan.io'))
    })

    it('should link to arbiscan on arbitrum', () => {
      render(
        <EthereumTransactionTracker
          transaction={mockTransaction}
          network="arbitrum"
          defaultExpanded
        />
      )
      const link = screen.getByRole('link', { name: /0x123456/ })
      expect(link).toHaveAttribute('href', expect.stringContaining('arbiscan.io'))
    })
  })
})

// ─── Hook Tests ──────────────────────────────────────────────────────────────

describe('useEthereumTransactionTracker', () => {
  it('should initialize with transaction', () => {
    const { result } = renderHook(() =>
      useEthereumTransactionTracker(mockTransaction)
    )

    expect(result.current.transaction).toEqual(mockTransaction)
    expect(result.current.isFinal).toBe(false)
  })

  it('should calculate time to finality', () => {
    const { result } = renderHook(() =>
      useEthereumTransactionTracker(mockTransaction, { network: 'mainnet' })
    )

    // 12 confirmations needed, 5 confirmed, 12s block time
    // (12 - 5) * 12 = 84 seconds
    expect(result.current.estimatedTimeToFinality).toBe(84)
    expect(result.current.formattedTimeToFinality).toBe('~2m')
  })

  it('should return 0 for finalized transaction', () => {
    const finalizedTx = { ...mockTransaction, status: 'finalized' as const }
    const { result } = renderHook(() =>
      useEthereumTransactionTracker(finalizedTx)
    )

    expect(result.current.estimatedTimeToFinality).toBe(0)
    expect(result.current.formattedTimeToFinality).toBe('Finalized')
    expect(result.current.isFinal).toBe(true)
  })

  it('should provide explorer URL', () => {
    const { result } = renderHook(() =>
      useEthereumTransactionTracker(mockTransaction, { network: 'mainnet' })
    )

    expect(result.current.explorerUrl).toBe(
      `https://etherscan.io/tx/${mockTransaction.hash}`
    )
  })

  it('should use network config for L2', () => {
    const { result } = renderHook(() =>
      useEthereumTransactionTracker(mockTransaction, { network: 'arbitrum' })
    )

    expect(result.current.networkConfig.name).toBe('Arbitrum One')
    expect(result.current.explorerUrl).toContain('arbiscan.io')
  })

  it('should update transaction state', () => {
    const { result } = renderHook(() =>
      useEthereumTransactionTracker(mockTransaction)
    )

    act(() => {
      result.current.updateTransaction({ confirmations: 10 })
    })

    expect(result.current.transaction?.confirmations).toBe(10)
  })

  it('should call callbacks on status change', () => {
    const onConfirmed = vi.fn()
    const onFinalized = vi.fn()

    const { result } = renderHook(() =>
      useEthereumTransactionTracker(mockTransaction, {
        onConfirmed,
        onFinalized,
      })
    )

    // Update to finalized
    act(() => {
      result.current.updateTransaction({ status: 'finalized' })
    })

    expect(onFinalized).toHaveBeenCalled()
  })
})
