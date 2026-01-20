/**
 * Proof Composer Module
 *
 * Exports for the proof composition system.
 *
 * @packageDocumentation
 */

// Types
export * from './types'

// Interfaces
export {
  type ComposableProofProvider,
  type ProofComposer,
  type ProofProviderFactory,
  type ProofProviderRegistry,
  ProofCompositionError,
  ProviderNotFoundError,
  CompositionTimeoutError,
  IncompatibleSystemsError,
} from './interface'

// Implementation
export { BaseProofComposer } from './base'
