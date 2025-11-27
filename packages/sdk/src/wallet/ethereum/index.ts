/**
 * Ethereum Wallet Module
 *
 * Exports for Ethereum wallet integration.
 */

// Adapter
export { EthereumWalletAdapter, createEthereumAdapter } from './adapter'

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
