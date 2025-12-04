/**
 * Type declarations for non-standard browser APIs
 *
 * These declarations extend the standard DOM types to include
 * browser-specific APIs used for device capability detection.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/deviceMemory
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Performance/measureUserAgentSpecificMemory
 */

/**
 * Extend Navigator interface with non-standard properties
 */
interface Navigator {
  /**
   * Device memory in gigabytes (rounded to preserve privacy)
   *
   * Only available in Chrome, Edge, Opera (Chromium-based browsers)
   * Returns values like: 0.25, 0.5, 1, 2, 4, 8
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/deviceMemory
   */
  readonly deviceMemory?: number
}

/**
 * Memory measurement result from Chrome-specific API
 */
interface MemoryMeasurement {
  /** Total bytes used */
  bytes: number
  /** Breakdown of memory usage by type */
  breakdown: Array<{
    bytes: number
    types: string[]
    attribution?: Array<{
      url: string
      scope: string
    }>
  }>
}

/**
 * Extend Performance interface with Chrome-specific APIs
 */
interface Performance {
  /**
   * Measures memory usage with breakdown by type
   *
   * Chrome-specific API for detailed memory profiling
   * Requires cross-origin isolation headers in some contexts
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Performance/measureUserAgentSpecificMemory
   */
  measureUserAgentSpecificMemory?(): Promise<MemoryMeasurement>
}

/**
 * Extend Window interface with vendor-prefixed APIs
 */
interface Window {
  /**
   * Safari's webkit-prefixed AudioContext
   * Used for audio fingerprinting fallback
   */
  webkitAudioContext?: typeof AudioContext
}
