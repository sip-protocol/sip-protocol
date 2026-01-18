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
