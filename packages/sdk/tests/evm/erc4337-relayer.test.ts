/**
 * ERC-4337 Relayer Tests
 *
 * Tests for the ERC-4337 Account Abstraction relayer.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  ERC4337Relayer,
  ERC4337RelayerError,
  ERC4337RelayerErrorCode,
  createPimlicoRelayer,
  createStackupRelayer,
  createBiconomyRelayer,
  EVM_CHAIN_IDS,
  ENTRY_POINT_V07,
  BUNDLER_ENDPOINTS,
} from '../../src/evm'

describe('ERC4337Relayer', () => {
  const mockApiKey = 'test-api-key-12345'

  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constants', () => {
    it('should export supported chain IDs', () => {
      expect(EVM_CHAIN_IDS.ethereum).toBe(1)
      expect(EVM_CHAIN_IDS.base).toBe(8453)
      expect(EVM_CHAIN_IDS.arbitrum).toBe(42161)
      expect(EVM_CHAIN_IDS.optimism).toBe(10)
      expect(EVM_CHAIN_IDS.polygon).toBe(137)
      expect(EVM_CHAIN_IDS.sepolia).toBe(11155111)
      expect(EVM_CHAIN_IDS['base-sepolia']).toBe(84532)
    })

    it('should export entry point v0.7 address', () => {
      expect(ENTRY_POINT_V07).toBe('0x0000000071727De22E5E9d8BAf0edAc6f37da032')
    })

    it('should export bundler endpoints', () => {
      expect(BUNDLER_ENDPOINTS.pimlico).toBeDefined()
      expect(BUNDLER_ENDPOINTS.stackup).toBeDefined()
      expect(BUNDLER_ENDPOINTS.biconomy).toBeDefined()
      expect(BUNDLER_ENDPOINTS.alchemy).toBeDefined()
    })
  })

  describe('constructor', () => {
    it('should create relayer with bundler URL', () => {
      const relayer = new ERC4337Relayer({
        bundlerUrl: 'https://custom-bundler.example.com/rpc',
        apiKey: mockApiKey,
        chain: 'base',
      })

      expect(relayer).toBeInstanceOf(ERC4337Relayer)
    })

    it('should create relayer with Pimlico provider', () => {
      const relayer = new ERC4337Relayer({
        bundlerProvider: 'pimlico',
        apiKey: mockApiKey,
        chain: 'base',
      })

      expect(relayer).toBeInstanceOf(ERC4337Relayer)
    })

    it('should create relayer with Stackup provider', () => {
      const relayer = new ERC4337Relayer({
        bundlerProvider: 'stackup',
        apiKey: mockApiKey,
        chain: 'arbitrum',
      })

      expect(relayer).toBeInstanceOf(ERC4337Relayer)
    })

    it('should create relayer with Biconomy provider', () => {
      const relayer = new ERC4337Relayer({
        bundlerProvider: 'biconomy',
        apiKey: mockApiKey,
        chain: 'optimism',
      })

      expect(relayer).toBeInstanceOf(ERC4337Relayer)
    })

    it('should throw on unsupported chain', () => {
      expect(
        () =>
          new ERC4337Relayer({
            bundlerProvider: 'pimlico',
            apiKey: mockApiKey,
            // @ts-expect-error testing invalid chain
            chain: 'invalid-chain',
          })
      ).toThrow(ERC4337RelayerError)
    })

    it('should throw when neither bundlerUrl nor bundlerProvider specified', () => {
      expect(
        () =>
          new ERC4337Relayer({
            apiKey: mockApiKey,
            chain: 'base',
          })
      ).toThrow('Either bundlerUrl or bundlerProvider must be specified')
    })

    it('should accept custom gas price multiplier', () => {
      const relayer = new ERC4337Relayer({
        bundlerProvider: 'pimlico',
        apiKey: mockApiKey,
        chain: 'base',
        gasPriceMultiplier: 1.5,
      })

      expect(relayer).toBeInstanceOf(ERC4337Relayer)
    })

    it('should accept custom paymaster URL', () => {
      const relayer = new ERC4337Relayer({
        bundlerUrl: 'https://bundler.example.com',
        apiKey: mockApiKey,
        chain: 'base',
        paymasterUrl: 'https://paymaster.example.com',
      })

      expect(relayer).toBeInstanceOf(ERC4337Relayer)
    })
  })

  describe('factory functions', () => {
    it('createPimlicoRelayer should create Pimlico relayer', () => {
      const relayer = createPimlicoRelayer({
        apiKey: mockApiKey,
        chain: 'base',
      })

      expect(relayer).toBeInstanceOf(ERC4337Relayer)
    })

    it('createStackupRelayer should create Stackup relayer', () => {
      const relayer = createStackupRelayer({
        apiKey: mockApiKey,
        chain: 'arbitrum',
      })

      expect(relayer).toBeInstanceOf(ERC4337Relayer)
    })

    it('createBiconomyRelayer should create Biconomy relayer', () => {
      const relayer = createBiconomyRelayer({
        apiKey: mockApiKey,
        chain: 'polygon',
      })

      expect(relayer).toBeInstanceOf(ERC4337Relayer)
    })
  })

  describe('isAvailable', () => {
    it('should return true when bundler responds with entry points', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            result: [ENTRY_POINT_V07],
          }),
      })

      const relayer = createPimlicoRelayer({
        apiKey: mockApiKey,
        chain: 'base',
      })

      const available = await relayer.isAvailable()
      expect(available).toBe(true)
    })

    it('should return false when bundler request fails', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
      })

      const relayer = createPimlicoRelayer({
        apiKey: mockApiKey,
        chain: 'base',
      })

      const available = await relayer.isAvailable()
      expect(available).toBe(false)
    })

    it('should return false when bundler returns empty array', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ result: [] }),
      })

      const relayer = createPimlicoRelayer({
        apiKey: mockApiKey,
        chain: 'base',
      })

      const available = await relayer.isAvailable()
      expect(available).toBe(false)
    })

    it('should return false on network error', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'))

      const relayer = createPimlicoRelayer({
        apiKey: mockApiKey,
        chain: 'base',
      })

      const available = await relayer.isAvailable()
      expect(available).toBe(false)
    })
  })

  describe('getSupportedEntryPoints', () => {
    it('should return entry points from bundler', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            result: [ENTRY_POINT_V07, '0x0000000000000000000000000000000000000001'],
          }),
      })

      const relayer = createPimlicoRelayer({
        apiKey: mockApiKey,
        chain: 'base',
      })

      const entryPoints = await relayer.getSupportedEntryPoints()
      expect(entryPoints).toHaveLength(2)
      expect(entryPoints[0]).toBe(ENTRY_POINT_V07)
    })

    it('should return empty array on error', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Failed'))

      const relayer = createPimlicoRelayer({
        apiKey: mockApiKey,
        chain: 'base',
      })

      const entryPoints = await relayer.getSupportedEntryPoints()
      expect(entryPoints).toEqual([])
    })
  })

  describe('relayTransaction', () => {
    const mockSigner = {
      address: '0x1234567890123456789012345678901234567890',
      signMessage: vi.fn().mockResolvedValue('0x' + 'ab'.repeat(65)),
    }

    const mockRequest = {
      to: '0xabcdef1234567890abcdef1234567890abcdef12',
      data: '0xa9059cbb0000000000000000000000001234567890123456789012345678901234567890000000000000000000000000000000000000000000000000000000000000000a',
      value: 0n,
      signer: mockSigner,
    }

    it('should relay transaction successfully', async () => {
      // Mock gas prices
      const gasPriceMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            result: {
              standard: {
                maxFeePerGas: '0x1dcd65000',
                maxPriorityFeePerGas: '0x3b9aca00',
              },
            },
          }),
      })

      // Mock gas estimation
      const estimateMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            result: {
              preVerificationGas: '0x5208',
              verificationGasLimit: '0x186a0',
              callGasLimit: '0x493e0',
            },
          }),
      })

      // Mock nonce
      const nonceMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ result: '0x0' }),
      })

      // Mock paymaster (no sponsorship)
      const paymasterMock = vi.fn().mockResolvedValueOnce({
        ok: false,
      })

      // Mock send
      const sendMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            result: '0x' + 'cd'.repeat(32),
          }),
      })

      global.fetch = vi
        .fn()
        .mockImplementationOnce(gasPriceMock)
        .mockImplementationOnce(nonceMock)
        .mockImplementationOnce(estimateMock)
        .mockImplementationOnce(paymasterMock)
        .mockImplementationOnce(sendMock)

      const relayer = createPimlicoRelayer({
        apiKey: mockApiKey,
        chain: 'base',
      })

      const result = await relayer.relayTransaction(mockRequest)

      expect(result.success).toBe(true)
      expect(result.userOpHash).toBeDefined()
    })

    it('should return error when bundler fails', async () => {
      // Mock fetch to fail on gas price request
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const relayer = createPimlicoRelayer({
        apiKey: mockApiKey,
        chain: 'base',
      })

      const result = await relayer.relayTransaction(mockRequest)

      expect(result.success).toBe(false)
      expect(result.error).toBeInstanceOf(Error)
    })

    it('should wait for confirmation when requested', async () => {
      // Mock all the required calls
      const fetchMocks = [
        // Gas prices
        {
          ok: true,
          json: () =>
            Promise.resolve({
              result: {
                standard: {
                  maxFeePerGas: '0x1dcd65000',
                  maxPriorityFeePerGas: '0x3b9aca00',
                },
              },
            }),
        },
        // Nonce
        { ok: true, json: () => Promise.resolve({ result: '0x0' }) },
        // Gas estimation
        {
          ok: true,
          json: () =>
            Promise.resolve({
              result: {
                preVerificationGas: '0x5208',
                verificationGasLimit: '0x186a0',
                callGasLimit: '0x493e0',
              },
            }),
        },
        // Paymaster
        { ok: false },
        // Send
        { ok: true, json: () => Promise.resolve({ result: '0x' + 'cd'.repeat(32) }) },
        // Receipt (found immediately)
        {
          ok: true,
          json: () =>
            Promise.resolve({
              result: {
                userOpHash: '0x' + 'cd'.repeat(32),
                entryPoint: ENTRY_POINT_V07,
                sender: mockSigner.address,
                nonce: '0x0',
                success: true,
                actualGasUsed: '0x10000',
                actualGasCost: '0x100000000',
                receipt: {
                  transactionHash: '0x' + 'ef'.repeat(32),
                  blockNumber: '0x100',
                  gasUsed: '0x10000',
                },
              },
            }),
        },
      ]

      let callIndex = 0
      global.fetch = vi.fn().mockImplementation(() => {
        const mock = fetchMocks[callIndex]
        callIndex++
        return Promise.resolve(mock)
      })

      const relayer = createPimlicoRelayer({
        apiKey: mockApiKey,
        chain: 'base',
      })

      const result = await relayer.relayTransaction({
        ...mockRequest,
        waitForConfirmation: true,
      })

      expect(result.success).toBe(true)
      expect(result.transactionHash).toBeDefined()
      expect(result.gasUsed).toBeDefined()
    })
  })

  describe('ERC4337RelayerError', () => {
    it('should create error with code and details', () => {
      const error = new ERC4337RelayerError(
        'Test error',
        ERC4337RelayerErrorCode.BUNDLER_ERROR,
        { extra: 'info' }
      )

      expect(error.message).toBe('Test error')
      expect(error.code).toBe(ERC4337RelayerErrorCode.BUNDLER_ERROR)
      expect(error.details).toEqual({ extra: 'info' })
      expect(error.name).toBe('ERC4337RelayerError')
    })

    it('should have all error codes', () => {
      expect(ERC4337RelayerErrorCode.BUNDLER_ERROR).toBeDefined()
      expect(ERC4337RelayerErrorCode.PAYMASTER_ERROR).toBeDefined()
      expect(ERC4337RelayerErrorCode.SIGNATURE_ERROR).toBeDefined()
      expect(ERC4337RelayerErrorCode.GAS_ESTIMATION_ERROR).toBeDefined()
      expect(ERC4337RelayerErrorCode.TIMEOUT).toBeDefined()
      expect(ERC4337RelayerErrorCode.INVALID_CHAIN).toBeDefined()
    })
  })

  describe('testnet support', () => {
    it('should support Sepolia testnet', () => {
      const relayer = createPimlicoRelayer({
        apiKey: mockApiKey,
        chain: 'sepolia',
      })

      expect(relayer).toBeInstanceOf(ERC4337Relayer)
    })

    it('should support Base Sepolia testnet', () => {
      const relayer = createPimlicoRelayer({
        apiKey: mockApiKey,
        chain: 'base-sepolia',
      })

      expect(relayer).toBeInstanceOf(ERC4337Relayer)
    })
  })
})
