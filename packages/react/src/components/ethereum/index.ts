/**
 * Ethereum-specific React Components
 *
 * Presets and utilities for using SIP Protocol components with Ethereum.
 *
 * @module components/ethereum
 */

export {
  EthereumPrivacyToggle,
  useEthereumPrivacyToggle,
  type EthereumPrivacyToggleProps,
  type EthereumPrivacyLevel,
  type EthereumNetworkId,
  type EthereumGasEstimate,
  type NetworkGasConfig,
  type EthereumPrivacyLevelInfo,
} from './privacy-toggle'

export {
  EthereumTransactionTracker,
  useEthereumTransactionTracker,
  ETHEREUM_NETWORKS,
  type EthereumTransactionTrackerProps,
  type EthereumNetwork,
} from './transaction-tracker'

export {
  EthereumViewingKeyManager,
  useEthereumViewingKey,
  type EthereumViewingKeyManagerProps,
} from './viewing-key-manager'

export {
  TransactionHistory,
  useTransactionHistory,
  type TransactionHistoryProps,
  type PrivacyTransactionHistoryItem,
  type TransactionHistoryFilter,
  type TransactionHistorySort,
} from './transaction-history'

export {
  EthereumStealthAddressDisplay,
  useEthereumStealthAddressDisplay,
  ETHEREUM_STEALTH_NETWORKS,
  isValidEthereumAddress,
  isValidEthereumStealthAddress,
  isValidEphemeralPublicKey,
  truncateEthereumAddress,
  type EthereumStealthAddressDisplayProps,
  type EthereumOwnershipStatus,
  type EthereumStealthNetworkId,
  type EthereumStealthNetworkConfig,
} from './stealth-address-display'
