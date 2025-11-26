/**
 * Proof Providers for SIP Protocol
 *
 * This module provides a pluggable interface for ZK proof generation.
 *
 * ## Available Providers
 *
 * - **MockProofProvider**: For testing only - provides NO cryptographic security
 * - **NoirProofProvider**: Production provider using Noir circuits (coming in #14, #15, #16)
 *
 * ## Usage
 *
 * ```typescript
 * import { MockProofProvider, NoirProofProvider } from '@sip-protocol/sdk'
 *
 * // For testing
 * const mockProvider = new MockProofProvider()
 * await mockProvider.initialize()
 *
 * // For production (when available)
 * const noirProvider = new NoirProofProvider()
 * await noirProvider.initialize()
 *
 * // Use with SIP client
 * const sip = new SIP({
 *   network: 'testnet',
 *   proofProvider: noirProvider,
 * })
 * ```
 *
 * @module proofs
 */

// Interface and types
export type {
  ProofProvider,
  ProofFramework,
  FundingProofParams,
  ValidityProofParams,
  FulfillmentProofParams,
  OracleAttestation,
  ProofResult,
} from './interface'

export { ProofGenerationError } from './interface'

// Mock provider (testing only)
export { MockProofProvider } from './mock'

// Noir provider (production)
export { NoirProofProvider } from './noir'
export type { NoirProviderConfig } from './noir'
