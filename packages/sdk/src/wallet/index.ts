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

// Cosmos adapter
export {
  CosmosWalletAdapter,
  createCosmosAdapter,
  MockCosmosAdapter,
  createMockCosmosAdapter,
  createMockCosmosProvider,
  getCosmosProvider,
  detectCosmosWallets,
  cosmosPublicKeyToHex,
  bech32ToHex,
  getDefaultRpcEndpoint as getCosmosDefaultRpcEndpoint,
  getDefaultRestEndpoint,
  CosmosChainId,
} from './cosmos'

export type {
  CosmosAccountData,
  CosmosAlgo,
  Key,
  PubKey,
  StdSignDoc,
  StdFee,
  Coin,
  CosmosMsg,
  AminoSignResponse,
  StdSignature,
  DirectSignDoc,
  DirectSignResponse,
  Keplr,
  KeplrSignOptions,
  OfflineSigner,
  OfflineAminoSigner,
  ChainInfo,
  Currency,
  CosmosWalletName,
  CosmosChainIdType,
  CosmosAdapterConfig,
  CosmosUnsignedTransaction,
  CosmosSignature,
  MockCosmosAdapterConfig,
} from './cosmos'

// Bitcoin adapter
export {
  BitcoinWalletAdapter,
  createBitcoinAdapter,
  MockBitcoinAdapter,
  createMockBitcoinAdapter,
  createMockBitcoinProvider,
  getBitcoinProvider,
  detectBitcoinWallets,
  bitcoinAddressToHex,
  bitcoinPublicKeyToHex,
  isValidTaprootAddress,
} from './bitcoin'

export type {
  BitcoinAddressType,
  BitcoinNetwork,
  BitcoinAddress,
  BitcoinBalance,
  SignPsbtOptions,
  ToSignInput,
  BitcoinWalletName,
  BitcoinAdapterConfig,
  UnisatAPI,
  MockBitcoinAdapterConfig,
} from './bitcoin'

// Aptos adapter
export {
  AptosWalletAdapter,
  createAptosAdapter,
  MockAptosAdapter,
  createMockAptosAdapter,
  createMockAptosProvider,
  getAptosProvider,
  aptosPublicKeyToHex,
  getDefaultAptosRpcEndpoint,
  DEFAULT_APTOS_RPC_ENDPOINTS,
} from './aptos'

export type {
  AptosWalletName,
  AptosNetwork,
  AptosAccountInfo,
  AptosTransactionPayload,
  AptosTransactionOptions,
  AptosTransaction,
  SignedAptosTransaction,
  AptosSignMessagePayload,
  AptosSignMessageResponse,
  PetraAPI,
  MartianAPI,
  AptosWalletProvider,
  AptosAdapterConfig,
  MockAptosAdapterConfig,
} from './aptos'

// Sui adapter
export {
  SuiWalletAdapter,
  createSuiAdapter,
  MockSuiAdapter,
  createMockSuiAdapter,
  createMockSuiProvider,
  getSuiProvider,
  suiPublicKeyToHex,
  getDefaultSuiRpcEndpoint,
  DEFAULT_SUI_RPC_ENDPOINTS,
} from './sui'

export type {
  SuiWalletName,
  SuiAccountInfo,
  SuiTransactionBlock,
  SignedSuiTransaction,
  SuiSignMessageInput,
  SuiSignMessageResponse,
  SuiWalletAPI,
  EthosAPI,
  SuiWalletProvider,
  SuiAdapterConfig,
  MockSuiAdapterConfig,
} from './sui'

// Hardware wallet adapters
export {
  // Types
  type HardwareWalletType,
  type LedgerModel,
  type TrezorModel,
  type HardwareConnectionStatus,
  type TransportType,
  type HardwareDeviceInfo,
  type HardwareWalletConfig,
  type LedgerConfig,
  type TrezorConfig,
  type HardwareSignRequest,
  type HardwareEthereumTx,
  type HardwareSignature,
  type HardwareAccount,
  type HardwareTransport,
  type HardwareErrorCodeType,
  type MockHardwareConfig,
  HardwareErrorCode,
  HardwareWalletError,
  DerivationPath,
  getDerivationPath,
  supportsWebUSB,
  supportsWebHID,
  supportsWebBluetooth,
  getAvailableTransports,
  // Ledger
  LedgerWalletAdapter,
  createLedgerAdapter,
  // Trezor
  TrezorWalletAdapter,
  createTrezorAdapter,
  // Mocks
  MockLedgerAdapter,
  MockTrezorAdapter,
  createMockLedgerAdapter,
  createMockTrezorAdapter,
} from './hardware'

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
