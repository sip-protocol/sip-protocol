/**
 * Wallet Module
 *
 * Chain-agnostic wallet adapter interface for SIP Protocol.
 */

// Base adapter class
export { BaseWalletAdapter, MockWalletAdapter } from './base-adapter'

// Wallet errors
export { WalletError, notConnectedError, featureNotSupportedError } from './errors'

// Registry
export {
  walletRegistry,
  registerWallet,
  createWalletFactory,
  isPrivateWalletAdapter,
} from './registry'

// Solana adapter
export {
  SolanaWalletAdapter,
  createSolanaAdapter,
  MockSolanaAdapter,
  createMockSolanaAdapter,
  createMockSolanaProvider,
  createMockSolanaConnection,
  getSolanaProvider,
  detectSolanaWallets,
  solanaPublicKeyToHex,
  base58ToHex,
} from './solana'

export type {
  SolanaPublicKey,
  SolanaTransaction,
  SolanaVersionedTransaction,
  SolanaWalletProvider,
  SolanaWalletName,
  SolanaCluster,
  SolanaAdapterConfig,
  SolanaConnection,
  SolanaSendOptions,
  SolanaUnsignedTransaction,
  SolanaSignature,
  MockSolanaAdapterConfig,
} from './solana'

// Ethereum adapter
export {
  EthereumWalletAdapter,
  createEthereumAdapter,
  MockEthereumAdapter,
  createMockEthereumAdapter,
  createMockEthereumProvider,
  getEthereumProvider,
  detectEthereumWallets,
  toHex,
  fromHex,
  hexToNumber,
  normalizeAddress,
  getDefaultRpcEndpoint,
  EthereumChainId,
} from './ethereum'

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
  MockEthereumAdapterConfig,
} from './ethereum'

// Re-export types from types package for convenience
export type {
  // Core types
  WalletConnectionState,
  Signature,
  UnsignedTransaction,
  SignedTransaction,
  TransactionReceipt,
  // Events
  WalletEventType,
  WalletEvent,
  WalletEventHandler,
  WalletConnectEvent,
  WalletDisconnectEvent,
  WalletAccountChangedEvent,
  WalletChainChangedEvent,
  WalletErrorEvent,
  // Adapter interfaces
  WalletAdapter,
  PrivateWalletAdapter,
  // Privacy types
  WalletShieldedSendParams,
  WalletShieldedSendResult,
  // Registry types
  WalletInfo,
  WalletAdapterFactory,
  WalletRegistryEntry,
} from '@sip-protocol/types'

export { WalletErrorCode } from '@sip-protocol/types'
