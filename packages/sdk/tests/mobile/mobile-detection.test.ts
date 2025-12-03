/**
 * Mobile Browser Detection Tests
 *
 * Tests for mobile device detection, browser identification,
 * and WASM compatibility checking utilities.
 *
 * @see https://github.com/sip-protocol/sip-protocol/issues/142
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  detectMobilePlatform,
  detectMobileBrowser,
  getBrowserVersion,
  getOSVersion,
  isTablet,
  supportsTouch,
  getMobileDeviceInfo,
  supportsWASMSimd,
  supportsWASMBulkMemory,
  checkMobileWASMCompatibility,
} from '../../src/proofs/browser-utils'

// Test user agent strings
const USER_AGENTS = {
  // iOS Safari
  iPhoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  iPadSafari:
    'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',

  // iOS Chrome (CriOS)
  iPhoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1',

  // iOS Firefox (FxiOS)
  iPhoneFirefox:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/120.0 Mobile/15E148 Safari/605.1.15',

  // Android Chrome
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36',
  androidTabletChrome:
    'Mozilla/5.0 (Linux; Android 14; SM-T870) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Safari/537.36',

  // Android Firefox
  androidFirefox:
    'Mozilla/5.0 (Android 14; Mobile; rv:121.0) Gecko/121.0 Firefox/121.0',

  // Samsung Internet
  samsungInternet:
    'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',

  // Desktop Chrome
  desktopChrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',

  // Desktop Safari
  desktopSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',

  // Desktop Firefox
  desktopFirefox:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',

  // Edge Mobile
  edgeMobile:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36 EdgA/120.0.2210.91',

  // Opera Mobile
  operaMobile:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36 OPR/79.0.4195.76',
}

/**
 * Helper to mock navigator
 * Note: platform defaults vary by test case
 */
function mockNavigator(userAgent: string, overrides: Partial<Navigator> = {}): void {
  // Determine platform from userAgent if not specified
  let defaultPlatform = 'MacIntel'
  if (userAgent.toLowerCase().includes('android')) {
    defaultPlatform = 'Linux armv8l'
  } else if (userAgent.toLowerCase().includes('iphone')) {
    defaultPlatform = 'iPhone'
  } else if (userAgent.toLowerCase().includes('ipad')) {
    defaultPlatform = 'iPad'
  }

  const mockNav = {
    userAgent,
    platform: overrides.platform ?? defaultPlatform,
    maxTouchPoints: overrides.maxTouchPoints ?? 0,
    hardwareConcurrency: overrides.hardwareConcurrency ?? 4,
    deviceMemory: overrides.deviceMemory ?? undefined,
  }

  vi.stubGlobal('navigator', mockNav)
}

/**
 * Helper to mock window
 */
function mockWindow(hasTouch = false): void {
  if (hasTouch) {
    vi.stubGlobal('window', { ontouchstart: () => {} })
  } else {
    vi.stubGlobal('window', {})
  }
}

describe('Mobile Platform Detection', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('detectMobilePlatform', () => {
    it('detects iOS from iPhone user agent', () => {
      mockNavigator(USER_AGENTS.iPhoneSafari)
      expect(detectMobilePlatform()).toBe('ios')
    })

    it('detects iOS from iPad user agent', () => {
      mockNavigator(USER_AGENTS.iPadSafari)
      expect(detectMobilePlatform()).toBe('ios')
    })

    it('detects iOS from iPad with macOS user agent (iPadOS 13+)', () => {
      mockNavigator(USER_AGENTS.desktopSafari, {
        platform: 'MacIntel',
        maxTouchPoints: 5, // iPad reports maxTouchPoints > 1
      })
      expect(detectMobilePlatform()).toBe('ios')
    })

    it('detects Android from Chrome user agent', () => {
      mockNavigator(USER_AGENTS.androidChrome)
      expect(detectMobilePlatform()).toBe('android')
    })

    it('detects Android from Firefox user agent', () => {
      mockNavigator(USER_AGENTS.androidFirefox)
      expect(detectMobilePlatform()).toBe('android')
    })

    it('detects desktop from macOS Chrome', () => {
      mockNavigator(USER_AGENTS.desktopChrome, { maxTouchPoints: 0 })
      expect(detectMobilePlatform()).toBe('desktop')
    })

    it('detects desktop from macOS Safari', () => {
      mockNavigator(USER_AGENTS.desktopSafari, { maxTouchPoints: 0 })
      expect(detectMobilePlatform()).toBe('desktop')
    })

    it('returns desktop when navigator is undefined', () => {
      vi.stubGlobal('navigator', undefined)
      expect(detectMobilePlatform()).toBe('desktop')
    })
  })

  describe('detectMobileBrowser', () => {
    it('detects Safari on iOS', () => {
      mockNavigator(USER_AGENTS.iPhoneSafari)
      expect(detectMobileBrowser()).toBe('safari')
    })

    it('detects Chrome on iOS (CriOS)', () => {
      mockNavigator(USER_AGENTS.iPhoneChrome)
      expect(detectMobileBrowser()).toBe('chrome')
    })

    it('detects Firefox on iOS (FxiOS)', () => {
      mockNavigator(USER_AGENTS.iPhoneFirefox)
      expect(detectMobileBrowser()).toBe('firefox')
    })

    it('detects Chrome on Android', () => {
      mockNavigator(USER_AGENTS.androidChrome)
      expect(detectMobileBrowser()).toBe('chrome')
    })

    it('detects Firefox on Android', () => {
      mockNavigator(USER_AGENTS.androidFirefox)
      expect(detectMobileBrowser()).toBe('firefox')
    })

    it('detects Samsung Internet', () => {
      mockNavigator(USER_AGENTS.samsungInternet)
      expect(detectMobileBrowser()).toBe('samsung')
    })

    it('detects Edge on mobile', () => {
      mockNavigator(USER_AGENTS.edgeMobile)
      expect(detectMobileBrowser()).toBe('edge')
    })

    it('detects Opera on mobile', () => {
      mockNavigator(USER_AGENTS.operaMobile)
      expect(detectMobileBrowser()).toBe('opera')
    })

    it('returns other when navigator is undefined', () => {
      vi.stubGlobal('navigator', undefined)
      expect(detectMobileBrowser()).toBe('other')
    })
  })

  describe('getBrowserVersion', () => {
    it('extracts Safari version', () => {
      mockNavigator(USER_AGENTS.iPhoneSafari)
      expect(getBrowserVersion()).toBe('17.0')
    })

    it('extracts Chrome version on Android', () => {
      mockNavigator(USER_AGENTS.androidChrome)
      expect(getBrowserVersion()).toBe('120.0.6099.144')
    })

    it('extracts CriOS version on iOS', () => {
      mockNavigator(USER_AGENTS.iPhoneChrome)
      expect(getBrowserVersion()).toBe('120.0.6099.119')
    })

    it('extracts Firefox version', () => {
      mockNavigator(USER_AGENTS.androidFirefox)
      expect(getBrowserVersion()).toBe('121.0')
    })

    it('extracts Samsung Browser version', () => {
      mockNavigator(USER_AGENTS.samsungInternet)
      expect(getBrowserVersion()).toBe('23.0')
    })

    it('returns null when navigator is undefined', () => {
      vi.stubGlobal('navigator', undefined)
      expect(getBrowserVersion()).toBeNull()
    })
  })

  describe('getOSVersion', () => {
    it('extracts iOS version from iPhone', () => {
      mockNavigator(USER_AGENTS.iPhoneSafari)
      expect(getOSVersion()).toBe('17.0')
    })

    it('extracts Android version', () => {
      mockNavigator(USER_AGENTS.androidChrome)
      expect(getOSVersion()).toBe('14')
    })

    it('returns null for desktop', () => {
      mockNavigator(USER_AGENTS.desktopChrome, { maxTouchPoints: 0 })
      expect(getOSVersion()).toBeNull()
    })

    it('returns null when navigator is undefined', () => {
      vi.stubGlobal('navigator', undefined)
      expect(getOSVersion()).toBeNull()
    })
  })

  describe('isTablet', () => {
    it('detects iPad', () => {
      mockNavigator(USER_AGENTS.iPadSafari)
      expect(isTablet()).toBe(true)
    })

    it('detects iPad in desktop mode (iPadOS 13+)', () => {
      mockNavigator(USER_AGENTS.desktopSafari, {
        platform: 'MacIntel',
        maxTouchPoints: 5,
      })
      expect(isTablet()).toBe(true)
    })

    it('detects Android tablet (no mobile in UA)', () => {
      mockNavigator(USER_AGENTS.androidTabletChrome)
      expect(isTablet()).toBe(true)
    })

    it('returns false for iPhone', () => {
      mockNavigator(USER_AGENTS.iPhoneSafari)
      expect(isTablet()).toBe(false)
    })

    it('returns false for Android phone', () => {
      mockNavigator(USER_AGENTS.androidChrome)
      expect(isTablet()).toBe(false)
    })

    it('returns false for desktop', () => {
      mockNavigator(USER_AGENTS.desktopChrome, { maxTouchPoints: 0 })
      expect(isTablet()).toBe(false)
    })
  })

  describe('supportsTouch', () => {
    it('returns true when ontouchstart exists', () => {
      mockNavigator(USER_AGENTS.iPhoneSafari, { maxTouchPoints: 5 })
      mockWindow(true)
      expect(supportsTouch()).toBe(true)
    })

    it('returns true when maxTouchPoints > 0', () => {
      mockNavigator(USER_AGENTS.iPhoneSafari, { maxTouchPoints: 5 })
      mockWindow(false)
      expect(supportsTouch()).toBe(true)
    })

    it('returns false for non-touch desktop', () => {
      mockNavigator(USER_AGENTS.desktopChrome, { maxTouchPoints: 0 })
      mockWindow(false)
      expect(supportsTouch()).toBe(false)
    })

    it('returns false when window is undefined', () => {
      vi.stubGlobal('window', undefined)
      expect(supportsTouch()).toBe(false)
    })
  })

  describe('getMobileDeviceInfo', () => {
    it('returns complete info for iPhone Safari', () => {
      mockNavigator(USER_AGENTS.iPhoneSafari, {
        maxTouchPoints: 5,
        hardwareConcurrency: 6,
      })
      mockWindow(true)

      const info = getMobileDeviceInfo()
      expect(info).toMatchObject({
        isMobile: true,
        platform: 'ios',
        browser: 'safari',
        browserVersion: '17.0',
        osVersion: '17.0',
        isTablet: false,
        supportsTouch: true,
        hardwareConcurrency: 6,
      })
    })

    it('returns complete info for Android Chrome', () => {
      mockNavigator(USER_AGENTS.androidChrome, {
        maxTouchPoints: 5,
        hardwareConcurrency: 8,
        deviceMemory: 6,
      })
      mockWindow(true)

      const info = getMobileDeviceInfo()
      expect(info).toMatchObject({
        isMobile: true,
        platform: 'android',
        browser: 'chrome',
        osVersion: '14',
        isTablet: false,
        supportsTouch: true,
        deviceMemoryGB: 6,
        hardwareConcurrency: 8,
      })
    })

    it('returns complete info for desktop', () => {
      mockNavigator(USER_AGENTS.desktopChrome, {
        maxTouchPoints: 0,
        hardwareConcurrency: 10,
      })
      mockWindow(false)

      const info = getMobileDeviceInfo()
      expect(info).toMatchObject({
        isMobile: false,
        platform: 'desktop',
        browser: 'chrome',
        isTablet: false,
        supportsTouch: false,
        hardwareConcurrency: 10,
      })
    })
  })
})

describe('WASM Compatibility Detection', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('supportsWASMSimd', () => {
    it('returns boolean without throwing', () => {
      const result = supportsWASMSimd()
      expect(typeof result).toBe('boolean')
    })

    it('returns false when WebAssembly is undefined', () => {
      vi.stubGlobal('WebAssembly', undefined)
      expect(supportsWASMSimd()).toBe(false)
    })
  })

  describe('supportsWASMBulkMemory', () => {
    it('returns boolean without throwing', () => {
      const result = supportsWASMBulkMemory()
      expect(typeof result).toBe('boolean')
    })

    it('returns false when WebAssembly is undefined', () => {
      vi.stubGlobal('WebAssembly', undefined)
      expect(supportsWASMBulkMemory()).toBe(false)
    })
  })

  describe('checkMobileWASMCompatibility', () => {
    it('returns compatibility object with required fields', () => {
      mockNavigator(USER_AGENTS.desktopChrome, { maxTouchPoints: 0 })
      mockWindow(false)

      const compat = checkMobileWASMCompatibility()

      expect(compat).toHaveProperty('webAssembly')
      expect(compat).toHaveProperty('sharedArrayBuffer')
      expect(compat).toHaveProperty('webWorkers')
      expect(compat).toHaveProperty('simd')
      expect(compat).toHaveProperty('bulkMemory')
      expect(compat).toHaveProperty('bigInt')
      expect(compat).toHaveProperty('score')
      expect(compat).toHaveProperty('summary')
      expect(compat).toHaveProperty('issues')
      expect(compat).toHaveProperty('recommendations')
    })

    it('score is between 0 and 100', () => {
      mockNavigator(USER_AGENTS.desktopChrome, { maxTouchPoints: 0 })
      mockWindow(false)

      const compat = checkMobileWASMCompatibility()
      expect(compat.score).toBeGreaterThanOrEqual(0)
      expect(compat.score).toBeLessThanOrEqual(100)
    })

    it('issues array contains strings', () => {
      mockNavigator(USER_AGENTS.desktopChrome, { maxTouchPoints: 0 })
      mockWindow(false)

      const compat = checkMobileWASMCompatibility()
      expect(Array.isArray(compat.issues)).toBe(true)
      compat.issues.forEach((issue) => {
        expect(typeof issue).toBe('string')
      })
    })

    it('recommendations array contains strings', () => {
      mockNavigator(USER_AGENTS.desktopChrome, { maxTouchPoints: 0 })
      mockWindow(false)

      const compat = checkMobileWASMCompatibility()
      expect(Array.isArray(compat.recommendations)).toBe(true)
      compat.recommendations.forEach((rec) => {
        expect(typeof rec).toBe('string')
      })
    })

    it('detects missing WebAssembly', () => {
      vi.stubGlobal('WebAssembly', undefined)
      mockNavigator(USER_AGENTS.desktopChrome, { maxTouchPoints: 0 })
      mockWindow(false)

      const compat = checkMobileWASMCompatibility()
      expect(compat.webAssembly).toBe(false)
      expect(compat.issues).toContain('WebAssembly not supported')
      expect(compat.score).toBeLessThan(100)
    })

    it('detects missing BigInt', () => {
      vi.stubGlobal('BigInt', undefined)
      mockNavigator(USER_AGENTS.desktopChrome, { maxTouchPoints: 0 })
      mockWindow(false)

      const compat = checkMobileWASMCompatibility()
      expect(compat.bigInt).toBe(false)
      expect(compat.issues).toContain('BigInt not supported (required for 64-bit operations)')
    })

    it('adds mobile-specific recommendations for low memory devices', () => {
      mockNavigator(USER_AGENTS.androidChrome, {
        maxTouchPoints: 5,
        deviceMemory: 1, // 1GB - low memory
      })
      mockWindow(true)

      const compat = checkMobileWASMCompatibility()
      expect(compat.recommendations.some((r) => r.includes('Low device memory'))).toBe(true)
    })

    it('provides iOS Safari specific recommendations', () => {
      mockNavigator(USER_AGENTS.iPhoneSafari, { maxTouchPoints: 5 })
      mockWindow(true)
      // Mock SharedArrayBuffer as unavailable
      vi.stubGlobal('SharedArrayBuffer', undefined)

      const compat = checkMobileWASMCompatibility()
      expect(compat.recommendations.some((r) => r.includes('iOS'))).toBe(true)
    })

    it('provides Android Chrome specific recommendations', () => {
      mockNavigator(USER_AGENTS.androidChrome, { maxTouchPoints: 5 })
      mockWindow(true)
      // Mock SharedArrayBuffer as unavailable
      vi.stubGlobal('SharedArrayBuffer', undefined)

      const compat = checkMobileWASMCompatibility()
      // Should have COOP/COEP recommendations since SharedArrayBuffer is unavailable
      expect(compat.recommendations.some((r) => r.includes('COOP') || r.includes('COEP') || r.includes('same-origin'))).toBe(true)
    })
  })
})

describe('Edge Cases', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('handles empty user agent string', () => {
    mockNavigator('')
    expect(detectMobilePlatform()).toBe('desktop')
    expect(detectMobileBrowser()).toBe('other')
  })

  it('handles malformed user agent string', () => {
    mockNavigator('garbage/123 weird UA string %@#$')
    expect(detectMobilePlatform()).toBe('desktop')
    expect(detectMobileBrowser()).toBe('other')
  })

  it('handles very long user agent string', () => {
    const longUA = USER_AGENTS.androidChrome + ' '.repeat(10000) + 'extra'
    mockNavigator(longUA)
    expect(detectMobilePlatform()).toBe('android')
  })

  it('handles special characters in user agent', () => {
    mockNavigator('Mozilla/5.0 (Linux; Android 14; 日本語) Chrome/120.0.0.0 Mobile Safari/537.36')
    expect(detectMobilePlatform()).toBe('android')
    expect(detectMobileBrowser()).toBe('chrome')
  })
})
