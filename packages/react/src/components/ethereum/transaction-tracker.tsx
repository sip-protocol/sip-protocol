/**
 * Ethereum Transaction Tracker
 *
 * Preset configuration for tracking Ethereum privacy transactions.
 *
 * @module components/ethereum/transaction-tracker
 */

import React, { useMemo } from 'react'
import {
  TransactionTracker,
  useTransactionTracker,
  type TransactionTrackerProps,
  type PrivacyTransaction,
  type TransactionStatus,
} from '../transaction-tracker'

/**
 * Ethereum network configuration
 */
export interface EthereumNetwork {
  name: string
  chainId: number
  explorerUrl: string
  /** Average block time in seconds */
  blockTime: number
  /** Confirmations required for finality */
  requiredConfirmations: number
}

/**
 * Predefined Ethereum networks
 */
export const ETHEREUM_NETWORKS: Record<string, EthereumNetwork> = {
  mainnet: {
    name: 'Ethereum',
    chainId: 1,
    explorerUrl: 'https://etherscan.io',
    blockTime: 12,
    requiredConfirmations: 12,
  },
  sepolia: {
    name: 'Sepolia',
    chainId: 11155111,
    explorerUrl: 'https://sepolia.etherscan.io',
    blockTime: 12,
    requiredConfirmations: 6,
  },
  goerli: {
    name: 'Goerli',
    chainId: 5,
    explorerUrl: 'https://goerli.etherscan.io',
    blockTime: 12,
    requiredConfirmations: 6,
  },
  arbitrum: {
    name: 'Arbitrum One',
    chainId: 42161,
    explorerUrl: 'https://arbiscan.io',
    blockTime: 0.3,
    requiredConfirmations: 1,
  },
  arbitrumSepolia: {
    name: 'Arbitrum Sepolia',
    chainId: 421614,
    explorerUrl: 'https://sepolia.arbiscan.io',
    blockTime: 0.3,
    requiredConfirmations: 1,
  },
  optimism: {
    name: 'Optimism',
    chainId: 10,
    explorerUrl: 'https://optimistic.etherscan.io',
    blockTime: 2,
    requiredConfirmations: 1,
  },
  optimismSepolia: {
    name: 'Optimism Sepolia',
    chainId: 11155420,
    explorerUrl: 'https://sepolia-optimism.etherscan.io',
    blockTime: 2,
    requiredConfirmations: 1,
  },
  base: {
    name: 'Base',
    chainId: 8453,
    explorerUrl: 'https://basescan.org',
    blockTime: 2,
    requiredConfirmations: 1,
  },
  baseSepolia: {
    name: 'Base Sepolia',
    chainId: 84532,
    explorerUrl: 'https://sepolia.basescan.org',
    blockTime: 2,
    requiredConfirmations: 1,
  },
  polygon: {
    name: 'Polygon',
    chainId: 137,
    explorerUrl: 'https://polygonscan.com',
    blockTime: 2,
    requiredConfirmations: 128,
  },
  polygonMumbai: {
    name: 'Polygon Mumbai',
    chainId: 80001,
    explorerUrl: 'https://mumbai.polygonscan.com',
    blockTime: 2,
    requiredConfirmations: 32,
  },
}

/**
 * Get network by chain ID
 */
export function getNetworkByChainId(chainId: number): EthereumNetwork | undefined {
  return Object.values(ETHEREUM_NETWORKS).find((n) => n.chainId === chainId)
}

/**
 * EthereumTransactionTracker props
 */
export interface EthereumTransactionTrackerProps
  extends Omit<TransactionTrackerProps, 'networkName' | 'explorerUrlTemplate'> {
  /** Network name or chain ID */
  network?: string | number
  /** Custom network configuration */
  customNetwork?: EthereumNetwork
}

/**
 * EthereumTransactionTracker - Ethereum-configured transaction tracker
 *
 * @example Basic usage
 * ```tsx
 * import { EthereumTransactionTracker } from '@sip-protocol/react'
 *
 * function TransactionView({ tx }) {
 *   return (
 *     <EthereumTransactionTracker
 *       transaction={tx}
 *       network="mainnet"
 *     />
 *   )
 * }
 * ```
 *
 * @example With L2 network
 * ```tsx
 * <EthereumTransactionTracker
 *   transaction={tx}
 *   network="arbitrum"
 *   showPrivacyStatus
 * />
 * ```
 */
export function EthereumTransactionTracker({
  network = 'mainnet',
  customNetwork,
  transaction,
  ...props
}: EthereumTransactionTrackerProps) {
  // Resolve network configuration
  const networkConfig = useMemo(() => {
    if (customNetwork) return customNetwork

    if (typeof network === 'number') {
      return getNetworkByChainId(network) ?? ETHEREUM_NETWORKS.mainnet
    }

    return ETHEREUM_NETWORKS[network] ?? ETHEREUM_NETWORKS.mainnet
  }, [network, customNetwork])

  // Build explorer URL template
  const explorerUrlTemplate = useMemo(() => {
    return `${networkConfig.explorerUrl}/tx/{hash}`
  }, [networkConfig])

  // Adjust required confirmations if not set
  const adjustedTransaction = useMemo(() => {
    if (transaction.requiredConfirmations > 0) {
      return transaction
    }
    return {
      ...transaction,
      requiredConfirmations: networkConfig.requiredConfirmations,
    }
  }, [transaction, networkConfig])

  return (
    <TransactionTracker
      transaction={adjustedTransaction}
      networkName={networkConfig.name}
      explorerUrlTemplate={explorerUrlTemplate}
      {...props}
    />
  )
}

/**
 * Hook for managing Ethereum transaction tracking
 *
 * @example
 * ```tsx
 * const {
 *   transaction,
 *   updateTransaction,
 *   startPolling,
 *   stopPolling,
 *   estimatedTimeToFinality,
 * } = useEthereumTransactionTracker(tx, {
 *   network: 'mainnet',
 *   pollingInterval: 3000,
 *   onConfirmed: (tx) => console.log('Confirmed!', tx),
 * })
 * ```
 */
export function useEthereumTransactionTracker(
  initialTransaction?: PrivacyTransaction,
  options: {
    network?: string | number
    pollingInterval?: number
    onStatusChange?: (status: TransactionStatus) => void
    onConfirmed?: (tx: PrivacyTransaction) => void
    onFinalized?: (tx: PrivacyTransaction) => void
    onFailed?: (tx: PrivacyTransaction) => void
  } = {}
) {
  const {
    network = 'mainnet',
    pollingInterval = 3000,
    onStatusChange,
    onConfirmed,
    onFinalized,
    onFailed,
  } = options

  // Get base hook
  const baseHook = useTransactionTracker(initialTransaction, {
    pollingInterval,
    onStatusChange: (status) => {
      onStatusChange?.(status)

      // Check for specific status callbacks
      if (baseHook.transaction) {
        if (status === 'confirmed') {
          onConfirmed?.(baseHook.transaction)
        } else if (status === 'finalized') {
          onFinalized?.(baseHook.transaction)
        } else if (status === 'failed') {
          onFailed?.(baseHook.transaction)
        }
      }
    },
  })

  // Get network config
  const networkConfig = useMemo(() => {
    if (typeof network === 'number') {
      return getNetworkByChainId(network) ?? ETHEREUM_NETWORKS.mainnet
    }
    return ETHEREUM_NETWORKS[network] ?? ETHEREUM_NETWORKS.mainnet
  }, [network])

  // Calculate estimated time to finality
  const estimatedTimeToFinality = useMemo(() => {
    if (!baseHook.transaction) return null
    if (baseHook.isFinal) return 0

    const remaining =
      networkConfig.requiredConfirmations - baseHook.transaction.confirmations
    return Math.max(remaining, 0) * networkConfig.blockTime
  }, [baseHook.transaction, baseHook.isFinal, networkConfig])

  // Format time
  const formattedTimeToFinality = useMemo(() => {
    if (estimatedTimeToFinality === null) return null
    if (estimatedTimeToFinality === 0) return 'Finalized'

    if (estimatedTimeToFinality < 60) {
      return `~${Math.ceil(estimatedTimeToFinality)}s`
    }
    return `~${Math.ceil(estimatedTimeToFinality / 60)}m`
  }, [estimatedTimeToFinality])

  // Get explorer URL
  const explorerUrl = useMemo(() => {
    if (!baseHook.transaction) return null
    return `${networkConfig.explorerUrl}/tx/${baseHook.transaction.hash}`
  }, [baseHook.transaction, networkConfig])

  return {
    ...baseHook,
    networkConfig,
    estimatedTimeToFinality,
    formattedTimeToFinality,
    explorerUrl,
  }
}

export default EthereumTransactionTracker
