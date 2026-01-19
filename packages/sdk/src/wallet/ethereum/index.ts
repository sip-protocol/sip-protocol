/**
 * Ethereum Wallet Module
 *
 * Exports for Ethereum wallet integration.
 */

// Adapter
export { EthereumWalletAdapter, createEthereumAdapter } from './adapter'

// Privacy Adapter
export {
  PrivacyEthereumWalletAdapter,
  createPrivacyEthereumAdapter,
  type PrivacyEthereumAdapterConfig,
  type EthereumStealthKeyMaterial,
  type EthereumScannedPayment,
  type EthereumClaimResult,
  type PrivacyContext,
} from './privacy-adapter'

// Multi-Wallet Privacy Adapter (Rabby, Rainbow, etc.)
export {
  MultiWalletPrivacyAdapter,
  createMultiWalletAdapter,
  createRabbyPrivacyAdapter,
  createRainbowPrivacyAdapter,
  detectWallets,
  isWalletInstalled,
  getWalletProvider,
  type WalletType,
  type DetectedWallet,
  type MultiWalletConfig,
  type WalletConnectionOptions,
  type EIP1193Provider as MultiWalletEIP1193Provider,
} from './multi-wallet'

// WalletConnect Privacy Adapter
export {
  WalletConnectPrivacyAdapter,
  createWalletConnectPrivacyAdapter,
  type WalletConnectAdapterConfig,
  type WalletConnectSession,
  type WalletConnectResult,
  type PairingUri,
} from './walletconnect-adapter'

// MetaMask Privacy Utilities
export {
  // Factory
  createMetaMaskPrivacyAdapter,
  isMetaMaskAdapter,
  // Detection
  isMetaMaskInstalled,
  isMetaMaskFlaskInstalled,
  getMetaMaskVersion,
  // Message building
  buildKeyDerivationMessage,
  buildKeyDerivationTypedData,
  buildViewKeyShareTypedData,
  createSigningContext,
  // Signature parsing
  parseSignature,
  toCompactSignature,
  // Constants
  DEFAULT_SIP_DOMAIN,
  PRIVACY_OPERATION_DESCRIPTIONS,
  KEY_DERIVATION_TYPES,
  STEALTH_TRANSFER_TYPES,
  VIEW_KEY_SHARE_TYPES,
  // Types
  type MetaMaskSigningMethod,
  type PrivacyOperationType,
  type PrivacySigningContext,
  type MetaMaskSigningRequest,
  type SIPDomainConfig,
} from './metamask-privacy'

// Mock adapter for testing
export {
  MockEthereumAdapter,
  createMockEthereumAdapter,
  createMockEthereumProvider,
} from './mock'
export type { MockEthereumAdapterConfig } from './mock'

// Types
export type {
  EIP1193Provider,
  EIP1193RequestArguments,
  EIP1193Event,
  EIP1193ConnectInfo,
  EIP1193ProviderRpcError,
  EIP712Domain,
  EIP712TypeDefinition,
  EIP712Types,
  EIP712TypedData,
  EthereumTransactionRequest,
  EthereumTransactionReceipt,
  EthereumTokenMetadata,
  EthereumChainMetadata,
  EthereumWalletName,
  EthereumAdapterConfig,
  EthereumChainIdType,
} from './types'

// Utilities
export {
  getEthereumProvider,
  detectEthereumWallets,
  toHex,
  fromHex,
  hexToNumber,
  normalizeAddress,
  getDefaultRpcEndpoint,
  EthereumChainId,
} from './types'
