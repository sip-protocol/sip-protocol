/**
 * Browser Noir Provider Tests
 *
 * Tests for the browser-compatible proof provider.
 * Note: Full WASM tests require browser environment.
 *
 * @see https://github.com/sip-protocol/sip-protocol/issues/121
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  isBrowser,
  supportsWebWorkers,
  supportsSharedArrayBuffer,
  getBrowserInfo,
  hexToBytes,
  bytesToHex,
} from '../../src/proofs/browser-utils'

describe('Browser Utils', () => {
  describe('isBrowser', () => {
    it('should return false in Node.js environment', () => {
      expect(isBrowser()).toBe(false)
    })
  })

  describe('supportsWebWorkers', () => {
    it('should check for Worker availability', () => {
      // In Node.js without workers, this should be false
      const result = supportsWebWorkers()
      expect(typeof result).toBe('boolean')
    })
  })

  describe('supportsSharedArrayBuffer', () => {
    it('should check for SharedArrayBuffer availability', () => {
      const result = supportsSharedArrayBuffer()
      expect(typeof result).toBe('boolean')
      // Node.js has SharedArrayBuffer by default
      expect(result).toBe(true)
    })
  })

  describe('getBrowserInfo', () => {
    it('should return environment info object', () => {
      const info = getBrowserInfo()

      expect(info).toHaveProperty('isBrowser')
      expect(info).toHaveProperty('supportsWorkers')
      expect(info).toHaveProperty('supportsSharedArrayBuffer')
      expect(info).toHaveProperty('userAgent')

      expect(info.isBrowser).toBe(false)
      // In Node.js, userAgent will be Node.js/version or null
      expect(typeof info.userAgent === 'string' || info.userAgent === null).toBe(true)
    })
  })

  describe('hexToBytes', () => {
    it('should convert hex string to Uint8Array', () => {
      const hex = '0x1234abcd'
      const bytes = hexToBytes(hex)

      expect(bytes).toBeInstanceOf(Uint8Array)
      expect(bytes.length).toBe(4)
      expect(bytes[0]).toBe(0x12)
      expect(bytes[1]).toBe(0x34)
      expect(bytes[2]).toBe(0xab)
      expect(bytes[3]).toBe(0xcd)
    })

    it('should handle hex string without 0x prefix', () => {
      const hex = 'deadbeef'
      const bytes = hexToBytes(hex)

      expect(bytes.length).toBe(4)
      expect(bytes[0]).toBe(0xde)
      expect(bytes[1]).toBe(0xad)
      expect(bytes[2]).toBe(0xbe)
      expect(bytes[3]).toBe(0xef)
    })

    it('should handle empty string', () => {
      const bytes = hexToBytes('')
      expect(bytes.length).toBe(0)
    })

    it('should throw on odd-length hex string', () => {
      expect(() => hexToBytes('123')).toThrow('Hex string must have even length')
    })
  })

  describe('bytesToHex', () => {
    it('should convert Uint8Array to hex string', () => {
      const bytes = new Uint8Array([0x12, 0x34, 0xab, 0xcd])
      const hex = bytesToHex(bytes)

      expect(hex).toBe('1234abcd')
    })

    it('should handle empty array', () => {
      const bytes = new Uint8Array([])
      const hex = bytesToHex(bytes)

      expect(hex).toBe('')
    })

    it('should pad single-digit hex values', () => {
      const bytes = new Uint8Array([0x01, 0x0a, 0x00])
      const hex = bytesToHex(bytes)

      expect(hex).toBe('010a00')
    })
  })

  describe('roundtrip conversion', () => {
    it('should roundtrip hex -> bytes -> hex', () => {
      const original = 'deadbeef1234567890abcdef'
      const bytes = hexToBytes(original)
      const result = bytesToHex(bytes)

      expect(result).toBe(original)
    })

    it('should roundtrip bytes -> hex -> bytes', () => {
      const original = new Uint8Array([0, 1, 127, 128, 255])
      const hex = bytesToHex(original)
      const result = hexToBytes(hex)

      expect(result).toEqual(original)
    })
  })
})

describe('BrowserNoirProvider', () => {
  // These tests run in Node.js environment
  // Full WASM tests would require browser or jsdom

  describe('static methods', () => {
    it('should export getBrowserInfo', async () => {
      const { BrowserNoirProvider } = await import('../../src/proofs/browser')

      const info = BrowserNoirProvider.getBrowserInfo()
      expect(info).toHaveProperty('isBrowser')
      expect(info.isBrowser).toBe(false)
    })

    it('should check browser support', async () => {
      const { BrowserNoirProvider } = await import('../../src/proofs/browser')

      const support = BrowserNoirProvider.checkBrowserSupport()
      expect(support).toHaveProperty('supported')
      expect(support).toHaveProperty('missing')
      expect(Array.isArray(support.missing)).toBe(true)

      // In Node.js, browser environment is missing
      expect(support.missing).toContain('browser environment')
    })

    it('should derive public key from private key', async () => {
      const { BrowserNoirProvider } = await import('../../src/proofs/browser')

      const privateKey = new Uint8Array(32).fill(1)
      const publicKey = BrowserNoirProvider.derivePublicKey(privateKey)

      expect(publicKey).toHaveProperty('x')
      expect(publicKey).toHaveProperty('y')
      expect(publicKey.x.length).toBe(32)
      expect(publicKey.y.length).toBe(32)
    })
  })

  describe('instance creation', () => {
    it('should create instance with default config', async () => {
      const { BrowserNoirProvider } = await import('../../src/proofs/browser')

      const provider = new BrowserNoirProvider()
      expect(provider.framework).toBe('noir')
      expect(provider.isReady).toBe(false)
    })

    it('should create instance with custom config', async () => {
      const { BrowserNoirProvider } = await import('../../src/proofs/browser')

      const provider = new BrowserNoirProvider({
        useWorker: false,
        verbose: true,
        timeout: 30000,
      })

      expect(provider.framework).toBe('noir')
    })

    it('should warn when not in browser', async () => {
      const { BrowserNoirProvider } = await import('../../src/proofs/browser')
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      new BrowserNoirProvider()

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Not running in browser environment')
      )

      warnSpy.mockRestore()
    })
  })

  describe('initialization', () => {
    it('should fail initialization in non-browser environment', async () => {
      const { BrowserNoirProvider } = await import('../../src/proofs/browser')

      const provider = new BrowserNoirProvider()

      await expect(provider.initialize()).rejects.toThrow(
        /Browser missing required features/
      )
    })
  })

  describe('proof methods require initialization', () => {
    it('should throw if generateFundingProof called without init', async () => {
      const { BrowserNoirProvider } = await import('../../src/proofs/browser')

      const provider = new BrowserNoirProvider()

      await expect(
        provider.generateFundingProof({
          balance: 100n,
          minimumRequired: 50n,
          blindingFactor: new Uint8Array(32),
          assetId: 'ETH',
          userAddress: '0x1234',
          ownershipSignature: new Uint8Array(64),
        })
      ).rejects.toThrow(/not initialized/)
    })

    it('should throw if generateValidityProof called without init', async () => {
      const { BrowserNoirProvider } = await import('../../src/proofs/browser')

      const provider = new BrowserNoirProvider()

      await expect(
        provider.generateValidityProof({
          intentHash: '0x1234',
          senderAddress: '0x5678',
          senderBlinding: new Uint8Array(32),
          senderSecret: new Uint8Array(32),
          authorizationSignature: new Uint8Array(64),
          nonce: new Uint8Array(32),
          timestamp: Date.now(),
          expiry: Date.now() + 3600000,
        })
      ).rejects.toThrow(/not initialized/)
    })

    it('should throw if generateFulfillmentProof called without init', async () => {
      const { BrowserNoirProvider } = await import('../../src/proofs/browser')

      const provider = new BrowserNoirProvider()

      await expect(
        provider.generateFulfillmentProof({
          intentHash: '0x1234',
          outputAmount: 100n,
          outputBlinding: new Uint8Array(32),
          minOutputAmount: 50n,
          recipientStealth: '0x5678',
          solverId: 'solver1',
          solverSecret: new Uint8Array(32),
          oracleAttestation: {
            recipient: '0xabcd',
            amount: 100n,
            txHash: '0xef01',
            blockNumber: 12345n,
            signature: new Uint8Array(64),
          },
          fulfillmentTime: Date.now(),
          expiry: Date.now() + 3600000,
        })
      ).rejects.toThrow(/not initialized/)
    })

    it('should throw if verifyProof called without init', async () => {
      const { BrowserNoirProvider } = await import('../../src/proofs/browser')

      const provider = new BrowserNoirProvider()

      await expect(
        provider.verifyProof({
          type: 'funding',
          proof: '0xdeadbeef',
          publicInputs: [],
        })
      ).rejects.toThrow(/not initialized/)
    })
  })

  describe('destroy', () => {
    it('should handle destroy on uninitialized provider', async () => {
      const { BrowserNoirProvider } = await import('../../src/proofs/browser')

      const provider = new BrowserNoirProvider()

      // Should not throw
      await provider.destroy()
      expect(provider.isReady).toBe(false)
    })
  })
})

describe('Browser Export', () => {
  it('should NOT export NoirProofProvider or BrowserNoirProvider from main entry (to avoid WASM in server builds)', async () => {
    const main = await import('../../src/index')

    // Noir providers are intentionally NOT exported from main entry
    // to prevent WASM from being bundled in server-side builds (e.g., Next.js SSR)
    expect((main as Record<string, unknown>).BrowserNoirProvider).toBeUndefined()
    expect((main as Record<string, unknown>).NoirProofProvider).toBeUndefined()

    // MockProofProvider is still exported (no WASM dependency)
    expect(main.MockProofProvider).toBeDefined()

    // Browser utilities are still exported (they have no WASM dependency)
    expect(main.isBrowser).toBeDefined()
    expect(main.supportsWebWorkers).toBeDefined()
    expect(main.supportsSharedArrayBuffer).toBeDefined()
    expect(main.getBrowserInfo).toBeDefined()
    expect(main.browserHexToBytes).toBeDefined()
    expect(main.browserBytesToHex).toBeDefined()
  })

  it('should export BrowserNoirProvider from browser entry', async () => {
    const browser = await import('../../src/browser')

    // BrowserNoirProvider is ONLY available from /browser subpath
    expect(browser.BrowserNoirProvider).toBeDefined()
    expect(browser.isBrowser).toBeDefined()
    expect(browser.supportsWebWorkers).toBeDefined()
  })

  it('should export NoirProofProvider from proofs/noir entry', async () => {
    const noir = await import('../../src/proofs/noir')

    // NoirProofProvider is ONLY available from /proofs/noir subpath
    expect(noir.NoirProofProvider).toBeDefined()
  })
})

describe('Performance Targets Documentation', () => {
  /**
   * These tests document the expected performance targets from issue #121
   * Actual benchmarks run in browser environment
   */

  it('should document funding proof target: <10s in browser', () => {
    const target = {
      nodeJs: 3000, // 3s
      browserWasm: 10000, // <10s target
      bundleSize: 5 * 1024 * 1024, // <5MB
    }

    expect(target.browserWasm).toBeLessThanOrEqual(10000)
    expect(target.bundleSize).toBeLessThanOrEqual(5 * 1024 * 1024)
  })

  it('should document memory target: <1GB', () => {
    const memoryTargetMB = 1024 // 1GB
    expect(memoryTargetMB).toBeLessThanOrEqual(1024)
  })
})
