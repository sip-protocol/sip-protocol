/**
 * Cosmos Wallet Module
 *
 * Exports for Cosmos ecosystem wallet adapters (Keplr, Leap, etc.)
 */

// Adapter
export { CosmosWalletAdapter, createCosmosAdapter } from './adapter'

// Mock adapter
export {
  MockCosmosAdapter,
  createMockCosmosAdapter,
  createMockCosmosProvider,
  type MockCosmosAdapterConfig,
} from './mock'

// Types
export type {
  // Account & Key types
  CosmosAccountData,
  CosmosAlgo,
  Key,
  PubKey,

  // Signing types
  StdSignDoc,
  StdFee,
  Coin,
  CosmosMsg,
  AminoSignResponse,
  StdSignature,
  DirectSignDoc,
  DirectSignResponse,

  // Wallet types
  Keplr,
  KeplrSignOptions,
  OfflineSigner,
  OfflineAminoSigner,

  // Chain types
  ChainInfo,
  Currency,
  CosmosWalletName,
  CosmosChainIdType,

  // Configuration
  CosmosAdapterConfig,
  CosmosUnsignedTransaction,
  CosmosSignature,
} from './types'

// Utilities
export {
  getCosmosProvider,
  detectCosmosWallets,
  cosmosPublicKeyToHex,
  bech32ToHex,
  getDefaultRpcEndpoint,
  getDefaultRestEndpoint,
  CosmosChainId,
} from './types'
