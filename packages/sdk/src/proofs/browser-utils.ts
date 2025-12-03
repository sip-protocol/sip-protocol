/**
 * Browser-compatible utilities for proof generation
 *
 * These utilities replace Node.js-specific functions (like Buffer)
 * with browser-compatible alternatives using Web APIs.
 *
 * Includes mobile browser detection and compatibility checking for:
 * - Safari iOS
 * - Chrome Android
 * - Firefox Mobile
 *
 * @module proofs/browser-utils
 * @see https://github.com/sip-protocol/sip-protocol/issues/142
 */

// ─── Mobile Browser Detection ────────────────────────────────────────────────

/**
 * Mobile platform type
 */
export type MobilePlatform = 'ios' | 'android' | 'other' | 'desktop'

/**
 * Mobile browser type
 */
export type MobileBrowser = 'safari' | 'chrome' | 'firefox' | 'samsung' | 'opera' | 'edge' | 'other'

/**
 * Mobile device information
 */
export interface MobileDeviceInfo {
  /** Whether the device is mobile */
  isMobile: boolean
  /** Mobile platform (ios, android, other, desktop) */
  platform: MobilePlatform
  /** Mobile browser (safari, chrome, firefox, etc.) */
  browser: MobileBrowser
  /** Browser version string */
  browserVersion: string | null
  /** OS version string */
  osVersion: string | null
  /** Whether the device is a tablet */
  isTablet: boolean
  /** Whether the device supports touch */
  supportsTouch: boolean
  /** Estimated device memory in GB (Chrome only) */
  deviceMemoryGB: number | null
  /** Hardware concurrency (CPU cores) */
  hardwareConcurrency: number | null
}

/**
 * Mobile WASM compatibility status
 */
export interface MobileWASMCompatibility {
  /** Whether WebAssembly is supported */
  webAssembly: boolean
  /** Whether SharedArrayBuffer is supported */
  sharedArrayBuffer: boolean
  /** Whether Web Workers are supported */
  webWorkers: boolean
  /** Whether SIMD is supported */
  simd: boolean
  /** Whether bulk memory operations are supported */
  bulkMemory: boolean
  /** Whether BigInt is supported (needed for 64-bit ops) */
  bigInt: boolean
  /** Overall compatibility score (0-100) */
  score: number
  /** Human-readable compatibility summary */
  summary: string
  /** Specific issues detected */
  issues: string[]
  /** Recommended configuration adjustments */
  recommendations: string[]
}

/**
 * Detect mobile platform from user agent
 */
export function detectMobilePlatform(): MobilePlatform {
  if (typeof navigator === 'undefined') return 'desktop'

  const ua = navigator.userAgent.toLowerCase()

  // iOS detection (iPhone, iPad, iPod)
  if (/iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return 'ios'
  }

  // Android detection
  if (/android/.test(ua)) {
    return 'android'
  }

  // Check for other mobile indicators
  if (/mobile|webos|blackberry|opera mini|opera mobi|iemobile|wpdesktop/.test(ua)) {
    return 'other'
  }

  return 'desktop'
}

/**
 * Detect mobile browser from user agent
 */
export function detectMobileBrowser(): MobileBrowser {
  if (typeof navigator === 'undefined') return 'other'

  const ua = navigator.userAgent.toLowerCase()

  // Safari on iOS (must check before Chrome as Chrome iOS reports Safari)
  if (/safari/.test(ua) && /iphone|ipad|ipod/.test(ua) && !/crios|fxios/.test(ua)) {
    return 'safari'
  }

  // Chrome (including Chrome on iOS which is CriOS)
  if (/chrome|crios/.test(ua) && !/edg|opr|samsung/.test(ua)) {
    return 'chrome'
  }

  // Firefox (including Firefox on iOS which is FxiOS)
  if (/firefox|fxios/.test(ua)) {
    return 'firefox'
  }

  // Samsung Internet
  if (/samsung/.test(ua)) {
    return 'samsung'
  }

  // Opera
  if (/opr|opera/.test(ua)) {
    return 'opera'
  }

  // Edge
  if (/edg/.test(ua)) {
    return 'edge'
  }

  return 'other'
}

/**
 * Extract browser version from user agent
 */
export function getBrowserVersion(): string | null {
  if (typeof navigator === 'undefined') return null

  const ua = navigator.userAgent
  const browser = detectMobileBrowser()

  const patterns: Record<string, RegExp> = {
    safari: /version\/(\d+(\.\d+)*)/i,
    chrome: /chrome\/(\d+(\.\d+)*)|crios\/(\d+(\.\d+)*)/i,
    firefox: /firefox\/(\d+(\.\d+)*)|fxios\/(\d+(\.\d+)*)/i,
    samsung: /samsungbrowser\/(\d+(\.\d+)*)/i,
    opera: /opr\/(\d+(\.\d+)*)/i,
    edge: /edg\/(\d+(\.\d+)*)/i,
    other: /version\/(\d+(\.\d+)*)/i,
  }

  const pattern = patterns[browser] || patterns.other
  const match = ua.match(pattern)

  if (match) {
    // Return the first non-undefined captured group
    for (let i = 1; i < match.length; i++) {
      if (match[i]) return match[i]
    }
  }

  return null
}

/**
 * Extract OS version from user agent
 */
export function getOSVersion(): string | null {
  if (typeof navigator === 'undefined') return null

  const ua = navigator.userAgent
  const platform = detectMobilePlatform()

  if (platform === 'ios') {
    const match = ua.match(/os (\d+[_\d]*)/i)
    return match ? match[1].replace(/_/g, '.') : null
  }

  if (platform === 'android') {
    const match = ua.match(/android (\d+(\.\d+)*)/i)
    return match ? match[1] : null
  }

  return null
}

/**
 * Check if device is a tablet
 */
export function isTablet(): boolean {
  if (typeof navigator === 'undefined') return false

  const ua = navigator.userAgent.toLowerCase()

  // iPad detection
  if (/ipad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return true
  }

  // Android tablet detection (no "mobile" in UA)
  if (/android/.test(ua) && !/mobile/.test(ua)) {
    return true
  }

  return false
}

/**
 * Check if device supports touch
 */
export function supportsTouch(): boolean {
  if (typeof window === 'undefined') return false

  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

/**
 * Get comprehensive mobile device info
 */
export function getMobileDeviceInfo(): MobileDeviceInfo {
  const platform = detectMobilePlatform()

  return {
    isMobile: platform !== 'desktop',
    platform,
    browser: detectMobileBrowser(),
    browserVersion: getBrowserVersion(),
    osVersion: getOSVersion(),
    isTablet: isTablet(),
    supportsTouch: supportsTouch(),
    deviceMemoryGB:
      // @ts-expect-error - deviceMemory is non-standard
      typeof navigator !== 'undefined' && navigator.deviceMemory
        ? // @ts-expect-error - deviceMemory is non-standard
          navigator.deviceMemory
        : null,
    hardwareConcurrency:
      typeof navigator !== 'undefined' && navigator.hardwareConcurrency
        ? navigator.hardwareConcurrency
        : null,
  }
}

// ─── Mobile WASM Compatibility ───────────────────────────────────────────────

/**
 * Check if WebAssembly SIMD is supported
 */
export function supportsWASMSimd(): boolean {
  try {
    // Test for SIMD support using a minimal SIMD module
    return WebAssembly.validate(
      new Uint8Array([
        0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7b,
        0x03, 0x02, 0x01, 0x00, 0x0a, 0x0a, 0x01, 0x08, 0x00, 0x41, 0x00, 0xfd, 0x0f, 0xfd, 0x62,
        0x0b,
      ])
    )
  } catch {
    return false
  }
}

/**
 * Check if WebAssembly bulk memory operations are supported
 */
export function supportsWASMBulkMemory(): boolean {
  try {
    // Test for bulk memory using memory.fill instruction
    return WebAssembly.validate(
      new Uint8Array([
        0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x04, 0x01, 0x60, 0x00, 0x00, 0x03,
        0x02, 0x01, 0x00, 0x05, 0x03, 0x01, 0x00, 0x01, 0x0a, 0x0d, 0x01, 0x0b, 0x00, 0x41, 0x00,
        0x41, 0x00, 0x41, 0x00, 0xfc, 0x0b, 0x00, 0x0b,
      ])
    )
  } catch {
    return false
  }
}

/**
 * Check mobile WASM compatibility
 */
export function checkMobileWASMCompatibility(): MobileWASMCompatibility {
  const issues: string[] = []
  const recommendations: string[] = []
  let score = 100

  // WebAssembly basic support
  const webAssembly = typeof WebAssembly !== 'undefined'
  if (!webAssembly) {
    issues.push('WebAssembly not supported')
    score -= 50
  }

  // SharedArrayBuffer (critical for multi-threaded WASM)
  const sharedArrayBuffer = supportsSharedArrayBuffer()
  if (!sharedArrayBuffer) {
    issues.push('SharedArrayBuffer not available (requires COOP/COEP headers)')
    recommendations.push('Server must send Cross-Origin-Opener-Policy: same-origin')
    recommendations.push('Server must send Cross-Origin-Embedder-Policy: require-corp')
    score -= 20
  }

  // Web Workers
  const webWorkers = supportsWebWorkers()
  if (!webWorkers) {
    issues.push('Web Workers not supported')
    recommendations.push('Consider using a polyfill or fallback to main-thread execution')
    score -= 15
  }

  // WASM SIMD (optional but improves performance)
  const simd = supportsWASMSimd()
  if (!simd) {
    recommendations.push('WASM SIMD not supported - proofs will be slower')
    score -= 5
  }

  // WASM bulk memory
  const bulkMemory = supportsWASMBulkMemory()
  if (!bulkMemory) {
    recommendations.push('WASM bulk memory not supported - may affect performance')
    score -= 5
  }

  // BigInt support
  const bigInt = typeof BigInt !== 'undefined'
  if (!bigInt) {
    issues.push('BigInt not supported (required for 64-bit operations)')
    score -= 10
  }

  // Mobile-specific checks
  const deviceInfo = getMobileDeviceInfo()
  if (deviceInfo.isMobile) {
    // Memory check for mobile
    if (deviceInfo.deviceMemoryGB !== null && deviceInfo.deviceMemoryGB < 2) {
      recommendations.push(`Low device memory (${deviceInfo.deviceMemoryGB}GB) - may experience issues with large proofs`)
      score -= 5
    }

    // iOS Safari specific warnings
    if (deviceInfo.platform === 'ios' && deviceInfo.browser === 'safari') {
      if (!sharedArrayBuffer) {
        recommendations.push('iOS Safari requires iOS 15.2+ for SharedArrayBuffer support')
      }
    }

    // Android Chrome specific
    if (deviceInfo.platform === 'android' && deviceInfo.browser === 'chrome') {
      if (!sharedArrayBuffer) {
        recommendations.push('Ensure COOP/COEP headers are set - Chrome Android requires them')
      }
    }
  }

  // Generate summary
  let summary: string
  if (score >= 90) {
    summary = 'Excellent - Full WASM proof support'
  } else if (score >= 70) {
    summary = 'Good - WASM proofs supported with minor limitations'
  } else if (score >= 50) {
    summary = 'Limited - WASM proofs may work with reduced performance'
  } else {
    summary = 'Poor - WASM proofs not recommended on this device'
  }

  return {
    webAssembly,
    sharedArrayBuffer,
    webWorkers,
    simd,
    bulkMemory,
    bigInt,
    score: Math.max(0, score),
    summary,
    issues,
    recommendations,
  }
}

// ─── Core Browser Utilities ──────────────────────────────────────────────────

/**
 * Convert hex string to Uint8Array (browser-compatible)
 */
export function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex
  if (h.length === 0) return new Uint8Array(0)
  if (h.length % 2 !== 0) {
    throw new Error('Hex string must have even length')
  }
  const bytes = new Uint8Array(h.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

/**
 * Convert Uint8Array to hex string (browser-compatible)
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Check if running in browser environment
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.document !== 'undefined'
}

/**
 * Check if Web Workers are available
 */
export function supportsWebWorkers(): boolean {
  return typeof Worker !== 'undefined'
}

/**
 * Check if SharedArrayBuffer is available (required for some WASM operations)
 */
export function supportsSharedArrayBuffer(): boolean {
  try {
    return typeof SharedArrayBuffer !== 'undefined'
  } catch {
    return false
  }
}

/**
 * Get browser info for diagnostics
 */
export function getBrowserInfo(): {
  isBrowser: boolean
  supportsWorkers: boolean
  supportsSharedArrayBuffer: boolean
  userAgent: string | null
} {
  return {
    isBrowser: isBrowser(),
    supportsWorkers: supportsWebWorkers(),
    supportsSharedArrayBuffer: supportsSharedArrayBuffer(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  }
}

/**
 * Load script dynamically (for WASM loading)
 */
export function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!isBrowser()) {
      reject(new Error('loadScript can only be used in browser'))
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
    document.head.appendChild(script)
  })
}

/**
 * Estimate available memory (approximate, browser-specific)
 */
export async function estimateAvailableMemory(): Promise<number | null> {
  if (!isBrowser()) return null

  // Use Performance API if available (Chrome)
  // @ts-expect-error - Performance.measureUserAgentSpecificMemory is Chrome-specific
  if (typeof performance !== 'undefined' && performance.measureUserAgentSpecificMemory) {
    try {
      // @ts-expect-error - Chrome-specific API
      const result = await performance.measureUserAgentSpecificMemory()
      return result.bytes
    } catch {
      // API not available or permission denied
    }
  }

  // Use navigator.deviceMemory if available (Chrome, Opera)
  // @ts-expect-error - deviceMemory is non-standard
  if (typeof navigator !== 'undefined' && navigator.deviceMemory) {
    // Returns approximate device memory in GB
    // @ts-expect-error - deviceMemory is non-standard
    return navigator.deviceMemory * 1024 * 1024 * 1024
  }

  return null
}

/**
 * Create a blob URL for worker code (inline worker support)
 */
export function createWorkerBlobUrl(code: string): string {
  if (!isBrowser()) {
    throw new Error('createWorkerBlobUrl can only be used in browser')
  }
  const blob = new Blob([code], { type: 'application/javascript' })
  return URL.createObjectURL(blob)
}

/**
 * Revoke a blob URL to free memory
 */
export function revokeWorkerBlobUrl(url: string): void {
  if (isBrowser() && url.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}
