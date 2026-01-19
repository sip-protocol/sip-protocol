/**
 * SIP Protocol React Components
 *
 * UI components for privacy-enabled transactions.
 *
 * @packageDocumentation
 */

export {
  PrivacyToggle,
  usePrivacyToggle,
  type PrivacyLevel,
  type PrivacyToggleProps,
  type GasEstimate,
  type PrivacyLevelInfo,
} from './privacy-toggle'

export {
  StealthAddressDisplay,
  useStealthAddressDisplay,
  isValidStealthAddress,
  truncateAddress,
  NEAR_NETWORKS,
  type StealthAddressDisplayProps,
  type OwnershipStatus,
  type NetworkConfig,
} from './stealth-address-display'

export {
  TransactionTracker,
  useTransactionTracker,
  type TransactionTrackerProps,
  type TransactionStatus,
  type PrivacyVerificationStatus,
  type TransactionActionType,
  type TransactionAction,
  type PrivacyVerification,
  type PrivacyTransaction,
} from './transaction-tracker'

export {
  ViewingKeyManager,
  useViewingKeyManager,
  type ViewingKeyManagerProps,
  type ViewingKey,
  type ViewingKeyStatus,
  type ViewingKeyUsage,
  type KeyExportFormat,
  type KeyImportSource,
} from './viewing-key-manager'

// Ethereum-specific components
export {
  EthereumTransactionTracker,
  useEthereumTransactionTracker,
  ETHEREUM_NETWORKS,
  type EthereumTransactionTrackerProps,
  type EthereumNetwork,
} from './ethereum/transaction-tracker'

export {
  EthereumViewingKeyManager,
  useEthereumViewingKey,
  type EthereumViewingKeyManagerProps,
} from './ethereum/viewing-key-manager'

export {
  TransactionHistory,
  useTransactionHistory,
  type TransactionHistoryProps,
  type PrivacyTransactionHistoryItem,
  type TransactionHistoryFilter,
  type TransactionHistorySort,
} from './ethereum/transaction-history'
