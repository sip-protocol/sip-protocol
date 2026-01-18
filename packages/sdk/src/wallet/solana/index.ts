/**
 * Solana Wallet Module
 *
 * Provides Solana-specific wallet adapter for SIP Protocol.
 */

// Main adapter
export { SolanaWalletAdapter, createSolanaAdapter } from './adapter'

// Mock adapter for testing
export {
  MockSolanaAdapter,
  createMockSolanaAdapter,
  createMockSolanaProvider,
  createMockSolanaConnection,
} from './mock'

export type { MockSolanaAdapterConfig } from './mock'

// Privacy-enabled adapter (Issue #304)
export {
  PrivacySolanaWalletAdapter,
  createPrivacySolanaAdapter,
} from './privacy-adapter'

export type {
  PrivacySolanaAdapterConfig,
  StealthKeyMaterial,
  ScannedPayment,
  ClaimResult,
} from './privacy-adapter'

// Types
export {
  getSolanaProvider,
  detectSolanaWallets,
  solanaPublicKeyToHex,
  base58ToHex,
} from './types'

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
} from './types'
