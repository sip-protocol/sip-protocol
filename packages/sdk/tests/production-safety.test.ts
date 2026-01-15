import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  isProductionEnvironment,
  isLocalhostAllowed,
  isLocalhostUrl,
  validateProductionConfig,
  assertNoLocalhost,
  getProductionUrl,
  createProductionConfig,
  ProductionSafetyError,
} from '../src/production-safety'

describe('production-safety', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset process.env before each test
    process.env = { ...originalEnv }
    delete process.env.NODE_ENV
    delete process.env.SIP_ENV
    delete process.env.SIP_ALLOW_LOCALHOST_IN_PROD
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('isProductionEnvironment', () => {
    it('returns false when NODE_ENV is not set', () => {
      expect(isProductionEnvironment()).toBe(false)
    })

    it('returns false when NODE_ENV is development', () => {
      process.env.NODE_ENV = 'development'
      expect(isProductionEnvironment()).toBe(false)
    })

    it('returns false when NODE_ENV is test', () => {
      process.env.NODE_ENV = 'test'
      expect(isProductionEnvironment()).toBe(false)
    })

    it('returns true when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production'
      expect(isProductionEnvironment()).toBe(true)
    })

    it('returns true when NODE_ENV is PRODUCTION (case-insensitive)', () => {
      process.env.NODE_ENV = 'PRODUCTION'
      expect(isProductionEnvironment()).toBe(true)
    })

    it('returns true when SIP_ENV is production', () => {
      process.env.SIP_ENV = 'production'
      expect(isProductionEnvironment()).toBe(true)
    })

    it('prefers SIP_ENV over NODE_ENV', () => {
      process.env.NODE_ENV = 'development'
      process.env.SIP_ENV = 'production'
      expect(isProductionEnvironment()).toBe(true)
    })
  })

  describe('isLocalhostAllowed', () => {
    it('returns false when not set', () => {
      expect(isLocalhostAllowed()).toBe(false)
    })

    it('returns false when set to false', () => {
      process.env.SIP_ALLOW_LOCALHOST_IN_PROD = 'false'
      expect(isLocalhostAllowed()).toBe(false)
    })

    it('returns true when set to true', () => {
      process.env.SIP_ALLOW_LOCALHOST_IN_PROD = 'true'
      expect(isLocalhostAllowed()).toBe(true)
    })

    it('returns false for other values', () => {
      process.env.SIP_ALLOW_LOCALHOST_IN_PROD = '1'
      expect(isLocalhostAllowed()).toBe(false)
    })
  })

  describe('isLocalhostUrl', () => {
    it('detects http://localhost', () => {
      expect(isLocalhostUrl('http://localhost')).toBe(true)
      expect(isLocalhostUrl('http://localhost/')).toBe(true)
      expect(isLocalhostUrl('http://localhost:8899')).toBe(true)
      expect(isLocalhostUrl('http://localhost:3000/api')).toBe(true)
    })

    it('detects https://localhost', () => {
      expect(isLocalhostUrl('https://localhost')).toBe(true)
      expect(isLocalhostUrl('https://localhost:443')).toBe(true)
    })

    it('detects 127.0.0.1', () => {
      expect(isLocalhostUrl('http://127.0.0.1')).toBe(true)
      expect(isLocalhostUrl('http://127.0.0.1:8545')).toBe(true)
      expect(isLocalhostUrl('https://127.0.0.1:8232')).toBe(true)
    })

    it('detects 0.0.0.0', () => {
      expect(isLocalhostUrl('http://0.0.0.0')).toBe(true)
      expect(isLocalhostUrl('http://0.0.0.0:9000')).toBe(true)
    })

    it('detects IPv6 localhost', () => {
      expect(isLocalhostUrl('http://[::1]')).toBe(true)
      expect(isLocalhostUrl('http://[::1]:8080')).toBe(true)
    })

    it('detects host.docker.internal', () => {
      expect(isLocalhostUrl('http://host.docker.internal')).toBe(true)
      expect(isLocalhostUrl('http://host.docker.internal:8899')).toBe(true)
    })

    it('returns false for production URLs', () => {
      expect(isLocalhostUrl('https://api.mainnet-beta.solana.com')).toBe(false)
      expect(isLocalhostUrl('https://api.devnet.solana.com')).toBe(false)
      expect(isLocalhostUrl('https://example.com')).toBe(false)
      expect(isLocalhostUrl('https://rpc.helius.xyz?api-key=xxx')).toBe(false)
    })

    it('returns false for localhost in path/query (not host)', () => {
      expect(isLocalhostUrl('https://example.com/localhost')).toBe(false)
      expect(isLocalhostUrl('https://example.com?host=localhost')).toBe(false)
    })
  })

  describe('validateProductionConfig', () => {
    describe('in development mode', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'development'
      })

      it('allows localhost URLs without errors', () => {
        const result = validateProductionConfig({
          rpcEndpoint: 'http://localhost:8899',
          apiUrl: 'http://127.0.0.1:3000',
        })

        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('skips non-URL values', () => {
        const result = validateProductionConfig({
          name: 'my-app',
          port: 3000,
          enabled: true,
          config: { nested: 'value' },
        })

        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })
    })

    describe('in production mode', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'production'
      })

      it('throws for localhost URLs', () => {
        expect(() => {
          validateProductionConfig({
            rpcEndpoint: 'http://localhost:8899',
          })
        }).toThrow(ProductionSafetyError)
      })

      it('includes key name in error message', () => {
        expect(() => {
          validateProductionConfig({
            rpcEndpoint: 'http://localhost:8899',
          })
        }).toThrow(/rpcEndpoint/)
      })

      it('allows production URLs', () => {
        const result = validateProductionConfig({
          rpcEndpoint: 'https://api.mainnet-beta.solana.com',
          apiUrl: 'https://api.sip-protocol.org',
        })

        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('collects multiple errors', () => {
        try {
          validateProductionConfig({
            rpc1: 'http://localhost:8899',
            rpc2: 'http://127.0.0.1:8545',
            validUrl: 'https://api.example.com',
          })
          expect.fail('Should have thrown')
        } catch (error) {
          expect(error).toBeInstanceOf(ProductionSafetyError)
          const prodError = error as ProductionSafetyError
          expect(prodError.errors).toHaveLength(2)
          expect(prodError.errors.map((e) => e.key)).toContain('rpc1')
          expect(prodError.errors.map((e) => e.key)).toContain('rpc2')
        }
      })

      it('allows localhost when SIP_ALLOW_LOCALHOST_IN_PROD=true', () => {
        process.env.SIP_ALLOW_LOCALHOST_IN_PROD = 'true'

        const result = validateProductionConfig({
          rpcEndpoint: 'http://localhost:8899',
        })

        expect(result.valid).toBe(true)
        expect(result.warnings).toHaveLength(1)
        expect(result.warnings[0].key).toBe('rpcEndpoint')
      })

      it('still fails with strict=true even when localhost allowed', () => {
        process.env.SIP_ALLOW_LOCALHOST_IN_PROD = 'true'

        expect(() => {
          validateProductionConfig(
            { rpcEndpoint: 'http://localhost:8899' },
            { strict: true }
          )
        }).toThrow(ProductionSafetyError)
      })

      it('only validates specified keys', () => {
        const result = validateProductionConfig(
          {
            rpcEndpoint: 'http://localhost:8899',
            validUrl: 'https://api.example.com',
          },
          { keys: ['validUrl'] }
        )

        expect(result.valid).toBe(true)
      })
    })
  })

  describe('assertNoLocalhost', () => {
    it('returns URL in development', () => {
      process.env.NODE_ENV = 'development'
      const url = assertNoLocalhost('http://localhost:8899', 'RPC_ENDPOINT')
      expect(url).toBe('http://localhost:8899')
    })

    it('returns production URL in production', () => {
      process.env.NODE_ENV = 'production'
      const url = assertNoLocalhost('https://api.mainnet.solana.com', 'RPC_ENDPOINT')
      expect(url).toBe('https://api.mainnet.solana.com')
    })

    it('throws for localhost in production', () => {
      process.env.NODE_ENV = 'production'
      expect(() => {
        assertNoLocalhost('http://localhost:8899', 'RPC_ENDPOINT')
      }).toThrow(ProductionSafetyError)
    })
  })

  describe('getProductionUrl', () => {
    it('returns localhost in development', () => {
      process.env.NODE_ENV = 'development'
      const url = getProductionUrl('http://localhost:8899', 'RPC_ENDPOINT')
      expect(url).toBe('http://localhost:8899')
    })

    it('throws for localhost in production', () => {
      process.env.NODE_ENV = 'production'
      expect(() => {
        getProductionUrl('http://localhost:8899', 'RPC_ENDPOINT')
      }).toThrow(ProductionSafetyError)
    })

    it('returns localhost in production when allowed', () => {
      process.env.NODE_ENV = 'production'
      process.env.SIP_ALLOW_LOCALHOST_IN_PROD = 'true'
      const url = getProductionUrl('http://localhost:8899', 'RPC_ENDPOINT')
      expect(url).toBe('http://localhost:8899')
    })
  })

  describe('createProductionConfig', () => {
    it('returns defaults in development', () => {
      process.env.NODE_ENV = 'development'

      const getConfig = createProductionConfig({
        rpcEndpoint: 'http://localhost:8899',
        apiUrl: 'http://localhost:3000',
      })

      expect(getConfig('rpcEndpoint')).toBe('http://localhost:8899')
      expect(getConfig('apiUrl')).toBe('http://localhost:3000')
    })

    it('uses env value when provided', () => {
      process.env.NODE_ENV = 'development'

      const getConfig = createProductionConfig({
        rpcEndpoint: 'http://localhost:8899',
      })

      expect(getConfig('rpcEndpoint', 'https://custom-rpc.com')).toBe('https://custom-rpc.com')
    })

    it('throws in production without env value', () => {
      process.env.NODE_ENV = 'production'

      const getConfig = createProductionConfig({
        rpcEndpoint: 'http://localhost:8899',
      })

      expect(() => {
        getConfig('rpcEndpoint')
      }).toThrow(ProductionSafetyError)
    })

    it('returns env value in production', () => {
      process.env.NODE_ENV = 'production'

      const getConfig = createProductionConfig({
        rpcEndpoint: 'http://localhost:8899',
      })

      expect(getConfig('rpcEndpoint', 'https://api.mainnet.solana.com'))
        .toBe('https://api.mainnet.solana.com')
    })
  })

  describe('ProductionSafetyError', () => {
    it('has correct name', () => {
      const error = new ProductionSafetyError('Test error', [])
      expect(error.name).toBe('ProductionSafetyError')
    })

    it('includes errors array', () => {
      const errors = [
        { key: 'rpc', value: 'http://localhost', message: 'Localhost detected' },
      ]
      const error = new ProductionSafetyError('Test error', errors)
      expect(error.errors).toEqual(errors)
    })

    it('is an instance of Error', () => {
      const error = new ProductionSafetyError('Test error', [])
      expect(error).toBeInstanceOf(Error)
    })
  })
})
