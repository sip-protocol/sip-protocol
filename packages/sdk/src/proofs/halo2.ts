/**
 * Halo2 Proof Provider Entry Point
 *
 * @module proofs/halo2
 * @description Separate entry point for Halo2 provider to enable tree-shaking
 *
 * ## Usage
 *
 * ```typescript
 * import { Halo2Provider, createHalo2Provider } from '@sip-protocol/sdk/proofs/halo2'
 *
 * const provider = createHalo2Provider({ backend: 'pse' })
 * await provider.initialize()
 * ```
 *
 * M20-16: Add ProofComposer to SDK exports (#329)
 */

// Halo2 Provider
export {
  Halo2Provider,
  createHalo2Provider,
  createOrchardProvider,
} from './providers'

export type {
  Halo2ProviderConfig,
  Halo2CircuitConfig,
  Halo2ProvingKey,
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
