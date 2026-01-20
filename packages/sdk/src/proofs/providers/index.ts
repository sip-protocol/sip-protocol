/**
 * Proof Providers for Composition
 *
 * This module exports proof providers that implement the ComposableProofProvider
 * interface for use with the ProofComposer.
 *
 * @packageDocumentation
 */

// Halo2 Provider
export {
  Halo2Provider,
  createHalo2Provider,
  createOrchardProvider,
} from './halo2'

export type {
  Halo2ProviderConfig,
  Halo2CircuitConfig,
  Halo2ProvingKey,
} from './halo2'
