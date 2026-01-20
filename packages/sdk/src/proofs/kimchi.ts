/**
 * Kimchi Proof Provider Entry Point
 *
 * @module proofs/kimchi
 * @description Separate entry point for Kimchi/Mina provider to enable tree-shaking
 *
 * ## Usage
 *
 * ```typescript
 * import { KimchiProvider, createKimchiProvider } from '@sip-protocol/sdk/proofs/kimchi'
 *
 * const provider = createKimchiProvider({ network: 'mainnet' })
 * await provider.initialize()
 * ```
 *
 * M20-16: Add ProofComposer to SDK exports (#329)
 */

// Kimchi Provider
export {
  KimchiProvider,
  createKimchiProvider,
  createMinaMainnetProvider,
  createZkAppProvider,
} from './providers'

export type {
  KimchiProviderConfig,
  KimchiCircuitConfig,
} from './providers'

// Re-export composer interface for type compatibility
export type { ComposableProofProvider } from './composer'

// Re-export proof types for convenience
export type {
  ProofSystem,
  SingleProof,
  ProofMetadata,
  ProofProviderCapabilities,
  ProofProviderStatus,
} from '@sip-protocol/types'
