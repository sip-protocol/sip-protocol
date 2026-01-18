/**
 * NEAR Wallet Adapter with Privacy Support
 *
 * Provides wallet connection and privacy operations for NEAR.
 *
 * @packageDocumentation
 */

export {
  NEARWalletAdapter,
  type NEARWalletAdapterConfig,
  type NEARConnectOptions,
  type NEARPrivacyKeyPair,
  type NEARStealthAddressWithKeys,
  type NEARPrivacyTransaction,
  type NEARSignedPrivacyTransaction,
  type NEARViewingKeyExport,
} from './adapter'

// Wallet Selector integration
export {
  PrivacyWalletSelector,
  createPrivacyWalletSelector,
  createMainnetPrivacySelector,
  createTestnetPrivacySelector,
  type WalletSelector,
  type WalletSelectorState,
  type Wallet,
  type WalletAction,
  type WalletTransactionResult,
  type SignAndSendTransactionParams,
  type SignAndSendTransactionsParams,
  type SignMessageParams,
  type SignedMessage,
  type PrivacyWalletSelectorConfig,
  type PrivacyKeyPair,
  type StealthAddressResult,
  type PrivateTransferParams,
  type PrivateTransferResult,
  type WalletPrivacyCapabilities,
  type ViewingKeyExport,
} from './wallet-selector'

// MyNearWallet integration
export {
  MyNearWalletPrivacy,
  createMyNearWalletPrivacy,
  createMainnetMyNearWallet,
  createTestnetMyNearWallet,
  parseMyNearWalletCallback,
  MY_NEAR_WALLET_MAINNET,
  MY_NEAR_WALLET_TESTNET,
  type MyNearWalletConfig,
  type MyNearWalletConnectionState,
  type MyNearWalletPrivacyKeys,
  type MyNearWalletStealthAddress,
  type MyNearWalletPrivateTransferParams,
  type TransactionPreview,
  type MyNearWalletCallbackResult,
  type MyNearWalletViewingKeyExport,
  type LedgerStatus,
} from './my-near-wallet'

// Meteor Wallet integration
export {
  MeteorWalletPrivacy,
  createMeteorWalletPrivacy,
  createMainnetMeteorWallet,
  createTestnetMeteorWallet,
  isMeteorWalletAvailable,
  MeteorWalletError,
  MeteorErrorCode,
  METEOR_DEEP_LINK_SCHEME,
  METEOR_APP_LINK_MAINNET,
  METEOR_APP_LINK_TESTNET,
  METEOR_PROVIDER_KEY,
  type MeteorWalletProvider,
  type MeteorWalletConfig,
  type MeteorConnectionState,
  type MeteorSigningMode,
  type MeteorPrivacyKeys,
  type MeteorPrivateTransferParams,
  type TransactionSimulation,
  type MeteorTransactionResult,
  type MeteorAccountInfo,
} from './meteor-wallet'
