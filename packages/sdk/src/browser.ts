/**
 * @sip-protocol/sdk/browser
 *
 * Browser-optimized entry point for SIP Protocol SDK.
 * Use this import when building for browser environments.
 *
 * @example
 * ```typescript
 * // Browser-specific import
 * import { BrowserNoirProvider } from '@sip-protocol/sdk/browser'
 *
 * const provider = new BrowserNoirProvider()
 * await provider.initialize()
 * ```
 *
 * @see https://github.com/sip-protocol/sip-protocol/issues/121
 */

// Re-export everything from main entry
export * from './index'

// Browser-specific exports (import directly from browser module to get WASM support)
export { BrowserNoirProvider } from './proofs/browser'
export { ProofWorker, createWorkerBlobURL } from './proofs/worker'
export type { WorkerRequest, WorkerResponse, WorkerMessageType } from './proofs/worker'

// Re-export utilities that are already in main (for convenience)
export {
  isBrowser,
  supportsWebWorkers,
  supportsSharedArrayBuffer,
  getBrowserInfo,
  browserHexToBytes,
  browserBytesToHex,
} from './proofs'

// Mobile browser detection utilities
export {
  detectMobilePlatform,
  detectMobileBrowser,
  getMobileDeviceInfo,
  checkMobileWASMCompatibility,
  getBrowserVersion,
  getOSVersion,
  isTablet,
  supportsTouch,
  supportsWASMSimd,
  supportsWASMBulkMemory,
} from './proofs/browser-utils'

export type {
  MobilePlatform,
  MobileBrowser,
  MobileDeviceInfo,
  MobileWASMCompatibility,
} from './proofs/browser-utils'

export type { BrowserNoirProviderConfig, ProofProgressCallback } from './proofs'
