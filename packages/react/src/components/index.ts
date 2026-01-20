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
  EthereumPrivacyToggle,
  useEthereumPrivacyToggle,
  type EthereumPrivacyToggleProps,
  type EthereumPrivacyLevel,
  type EthereumNetworkId,
  type EthereumGasEstimate,
  type EthereumPrivacyLevelInfo,
  type NetworkGasConfig,
} from './ethereum/privacy-toggle'

export {
  EthereumTransactionTracker,
  useEthereumTransactionTracker,
  ETHEREUM_NETWORKS,
  getNetworkByChainId,
  type EthereumTransactionTrackerProps,
  type EthereumNetwork,
} from './ethereum/transaction-tracker'

export {
  EthereumViewingKeyManager,
  useEthereumViewingKey,
  type EthereumViewingKeyManagerProps,
  type EthereumViewingKey,
} from './ethereum/viewing-key-manager'

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
} from './ethereum/stealth-address-display'

export {
  TransactionHistory,
  useTransactionHistory as useEthereumTransactionHistory,
  type TransactionHistoryProps,
  type PrivacyTransactionHistoryItem,
  type TransactionHistoryFilter,
  type TransactionHistorySort,
} from './ethereum/transaction-history'

// NEAR Transaction History (M17-NEAR-20)
export {
  TransactionHistoryView as NEARTransactionHistoryView,
  type TransactionHistoryViewProps as NEARTransactionHistoryViewProps,
} from './transaction-history'
