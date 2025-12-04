/**
 * Bitcoin Wallet Module
 *
 * Bitcoin wallet adapter for SIP Protocol.
 * Supports Unisat, Xverse, Leather, and OKX wallets.
 */

// Adapter
export { BitcoinWalletAdapter, createBitcoinAdapter } from './adapter'

// Mock adapter
export {
  MockBitcoinAdapter,
  createMockBitcoinAdapter,
  createMockBitcoinProvider,
  type MockBitcoinAdapterConfig,
} from './mock'

// Types and utilities
export {
  getBitcoinProvider,
  detectBitcoinWallets,
  bitcoinAddressToHex,
  bitcoinPublicKeyToHex,
  isValidTaprootAddress,
} from './types'

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
} from './types'
