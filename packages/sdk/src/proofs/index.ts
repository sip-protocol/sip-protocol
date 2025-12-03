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
export type { MockProofProviderOptions } from './mock'

// NOTE: NoirProofProvider is NOT exported from main entry to avoid bundling WASM
// in server-side builds (e.g., Next.js SSR). Import directly if needed:
//
//   import { NoirProofProvider } from '@sip-protocol/sdk/proofs/noir'
//
// Types are safe to export (no runtime WASM dependency)
export type { NoirProviderConfig } from './noir'

// Browser utilities (no WASM dependencies - safe for all environments)
export {
  isBrowser,
  supportsWebWorkers,
  supportsSharedArrayBuffer,
  getBrowserInfo,
  hexToBytes as browserHexToBytes,
  bytesToHex as browserBytesToHex,
} from './browser-utils'

// NOTE: BrowserNoirProvider is NOT exported from main entry to avoid bundling WASM
// in server-side builds. Import from '@sip-protocol/sdk/browser' instead:
//
//   import { BrowserNoirProvider } from '@sip-protocol/sdk/browser'
//
// Types are safe to export (no runtime WASM dependency)
export type { BrowserNoirProviderConfig, ProofProgressCallback } from './browser'
