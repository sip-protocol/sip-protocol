/**
 * NEARIntentsAdapter unit tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  NEARIntentsAdapter,
  createNEARIntentsAdapter,
  type SwapRequest,
} from '../../src/adapters/near-intents'
import { OneClickClient } from '../../src/adapters/oneclick-client'
import {
  generateStealthMetaAddress,
  generateEd25519StealthMetaAddress,
  isValidSolanaAddress,
  isValidNearImplicitAddress,
} from '../../src/stealth'
import { PrivacyLevel, OneClickSwapType, OneClickSwapStatus, NATIVE_TOKENS } from '@sip-protocol/types'
import { ValidationError } from '../../src/errors'

// Mock OneClickClient
vi.mock('../../src/adapters/oneclick-client', () => ({
  OneClickClient: vi.fn().mockImplementation(() => ({
    quote: vi.fn().mockResolvedValue({
      quoteId: 'quote_123',
      depositAddress: '0xdeposit',
      amountIn: '1000000000000000000000000',
      amountInFormatted: '1.0',
      amountOut: '300000000000000000',
      amountOutFormatted: '0.3',
      deadline: '2024-12-01T00:00:00.000Z',
      timeEstimate: 120,
      signature: '0xsig',
    }),
    dryQuote: vi.fn().mockResolvedValue({
      quoteId: 'dry_quote_123',
      amountIn: '1000000000000000000000000',
      amountOut: '300000000000000000',
    }),
    getStatus: vi.fn().mockResolvedValue({
      status: OneClickSwapStatus.SUCCESS,
    }),
    submitDeposit: vi.fn().mockResolvedValue({}),
    waitForStatus: vi.fn().mockResolvedValue({
      status: OneClickSwapStatus.SUCCESS,
      settlementTxHash: '0xsettlement',
    }),
  })),
}))

describe('NEARIntentsAdapter', () => {
  let adapter: NEARIntentsAdapter
  let mockClient: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    adapter = new NEARIntentsAdapter()
    mockClient = (adapter.getClient() as unknown as ReturnType<typeof vi.fn>)
  })

  // ─── Constructor ─────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should create adapter with default config', () => {
      const defaultAdapter = new NEARIntentsAdapter()
      expect(defaultAdapter).toBeInstanceOf(NEARIntentsAdapter)
    })

    it('should accept custom config', () => {
      const customAdapter = new NEARIntentsAdapter({
        baseUrl: 'https://custom.api.com',
        jwtToken: 'test-jwt',
        defaultSlippage: 50,
        defaultDeadlineOffset: 7200,
      })
      expect(customAdapter).toBeInstanceOf(NEARIntentsAdapter)
    })

    it('should accept pre-configured client', () => {
      const mockClient = new OneClickClient()
      const adapterWithClient = new NEARIntentsAdapter({ client: mockClient })
      expect(adapterWithClient.getClient()).toBe(mockClient)
    })

    it('should accept custom asset mappings', () => {
      const customAdapter = new NEARIntentsAdapter({
        assetMappings: {
          'near:testUSDC': 'near:testnet:usdc.test',
          'ethereum:testDAI': 'eth:11155111:0xtest',
        },
      })
      expect(customAdapter).toBeInstanceOf(NEARIntentsAdapter)

      // Custom mapping should work
      expect(customAdapter.mapAsset('near', 'testUSDC')).toBe('near:testnet:usdc.test')

      // Default mappings should still work (NEP-141 format)
      expect(customAdapter.mapAsset('near', 'NEAR')).toBe('nep141:wrap.near')
    })

    it('should allow custom mappings to override defaults', () => {
      const customAdapter = new NEARIntentsAdapter({
        assetMappings: {
          'near:NEAR': 'near:testnet:native', // Override default
        },
      })

      // Custom mapping should override default
      expect(customAdapter.mapAsset('near', 'NEAR')).toBe('near:testnet:native')
    })
  })

  // ─── createNEARIntentsAdapter ────────────────────────────────────────────────

  describe('createNEARIntentsAdapter', () => {
    it('should create adapter instance', () => {
      const adapter = createNEARIntentsAdapter()
      expect(adapter).toBeInstanceOf(NEARIntentsAdapter)
    })

    it('should pass config to constructor', () => {
      const adapter = createNEARIntentsAdapter({
        defaultSlippage: 200,
      })
      expect(adapter).toBeInstanceOf(NEARIntentsAdapter)
    })
  })

  // ─── mapAsset ────────────────────────────────────────────────────────────────

  describe('mapAsset', () => {
    it('should map NEAR native token', () => {
      const result = adapter.mapAsset('near', 'NEAR')
      expect(result).toBe('nep141:wrap.near')
    })

    it('should map wNEAR', () => {
      const result = adapter.mapAsset('near', 'wNEAR')
      expect(result).toBe('nep141:wrap.near')
    })

    it('should map ETH', () => {
      const result = adapter.mapAsset('ethereum', 'ETH')
      expect(result).toBe('nep141:eth.omft.near')
    })

    it('should map SOL', () => {
      const result = adapter.mapAsset('solana', 'SOL')
      expect(result).toBe('nep141:sol.omft.near')
    })

    it('should map ZEC', () => {
      const result = adapter.mapAsset('zcash', 'ZEC')
      expect(result).toBe('nep141:zec.omft.near')
    })

    it('should throw for unknown asset', () => {
      expect(() => adapter.mapAsset('bitcoin' as any, 'BTC'))
        .toThrow(ValidationError)
    })
  })

  // ─── mapChainType ────────────────────────────────────────────────────────────

  describe('mapChainType', () => {
    it('should map chain IDs to blockchain types', () => {
      // mapChainType now returns blockchain types for address format validation
      expect(adapter.mapChainType('near')).toBe('near')
      expect(adapter.mapChainType('ethereum')).toBe('evm')
      expect(adapter.mapChainType('solana')).toBe('solana')
      expect(adapter.mapChainType('zcash')).toBe('zcash')
      expect(adapter.mapChainType('polygon')).toBe('evm')
      expect(adapter.mapChainType('arbitrum')).toBe('evm')
    })

    it('should throw for unknown chain', () => {
      expect(() => adapter.mapChainType('unknown_chain' as any))
        .toThrow(ValidationError)
    })

    it('should map bitcoin to bitcoin', () => {
      expect(adapter.mapChainType('bitcoin')).toBe('bitcoin')
    })
  })

  // ─── prepareSwap ─────────────────────────────────────────────────────────────

  describe('prepareSwap', () => {
    // Use EVM chain as input for stealth address tests (stealth requires EVM)
    const evmShieldedRequest: SwapRequest = {
      requestId: 'req_123',
      privacyLevel: PrivacyLevel.SHIELDED,
      inputAsset: NATIVE_TOKENS.ethereum,
      inputAmount: 1000000000000000000n, // 1 ETH (18 decimals)
      outputAsset: NATIVE_TOKENS.arbitrum,
    }

    it('should prepare swap with stealth address for shielded mode', async () => {
      const { metaAddress } = generateStealthMetaAddress('arbitrum')

      const prepared = await adapter.prepareSwap(evmShieldedRequest, metaAddress)

      expect(prepared.request).toBe(evmShieldedRequest)
      expect(prepared.stealthAddress).toBeDefined()
      expect(prepared.stealthAddress?.address).toMatch(/^0x/)
      expect(prepared.stealthAddress?.ephemeralPublicKey).toMatch(/^0x/)
      expect(prepared.sharedSecret).toMatch(/^0x/)
      expect(prepared.quoteRequest.swapType).toBe(OneClickSwapType.EXACT_INPUT)
      // NEP-141 format asset IDs
      expect(prepared.quoteRequest.originAsset).toBe('nep141:eth.omft.near')
      expect(prepared.quoteRequest.destinationAsset).toBe('nep141:arb.omft.near')
    })

    it('should accept encoded stealth meta-address string', async () => {
      const { metaAddress } = generateStealthMetaAddress('arbitrum')
      const encoded = `sip:${metaAddress.chain}:${metaAddress.spendingKey}:${metaAddress.viewingKey}`

      const prepared = await adapter.prepareSwap(evmShieldedRequest, encoded)

      expect(prepared.stealthAddress).toBeDefined()
    })

    // NEAR-based request for transparent mode tests (no stealth needed)
    const nearTransparentRequest: SwapRequest = {
      requestId: 'req_123',
      privacyLevel: PrivacyLevel.TRANSPARENT,
      inputAsset: NATIVE_TOKENS.near,
      inputAmount: 1000000000000000000000000n, // 1 NEAR (24 decimals)
      outputAsset: NATIVE_TOKENS.ethereum,
    }

    it('should prepare swap for transparent mode without stealth', async () => {
      const prepared = await adapter.prepareSwap(
        nearTransparentRequest,
        undefined,
        'user.near'
      )

      expect(prepared.stealthAddress).toBeUndefined()
      expect(prepared.sharedSecret).toBeUndefined()
      expect(prepared.quoteRequest.recipient).toBe('user.near')
    })

    it('should throw if stealth meta-address missing for shielded mode', async () => {
      await expect(adapter.prepareSwap(evmShieldedRequest))
        .rejects.toThrow('recipientMetaAddress is required')
    })

    it('should throw if sender address missing for transparent mode', async () => {
      await expect(adapter.prepareSwap(nearTransparentRequest))
        .rejects.toThrow('senderAddress is required')
    })

    it('should validate request fields', async () => {
      await expect(adapter.prepareSwap({} as any))
        .rejects.toThrow('requestId is required')

      await expect(adapter.prepareSwap({ requestId: 'req' } as any))
        .rejects.toThrow('inputAsset is required')
    })
  })

  // ─── getQuote ────────────────────────────────────────────────────────────────

  describe('getQuote', () => {
    it('should call client.quote with prepared request', async () => {
      const { metaAddress } = generateStealthMetaAddress('arbitrum')
      // Use EVM chain as input for stealth address tests
      const request: SwapRequest = {
        requestId: 'req_123',
        privacyLevel: PrivacyLevel.SHIELDED,
        inputAsset: NATIVE_TOKENS.ethereum,
        inputAmount: 1000000000000000000n, // 1 ETH (18 decimals)
        outputAsset: NATIVE_TOKENS.arbitrum,
      }

      const prepared = await adapter.prepareSwap(request, metaAddress)
      const quote = await adapter.getQuote(prepared)

      expect(mockClient.quote).toHaveBeenCalledWith(prepared.quoteRequest)
      expect(quote.quoteId).toBe('quote_123')
    })
  })

  // ─── getDryQuote ─────────────────────────────────────────────────────────────

  describe('getDryQuote', () => {
    it('should call client.dryQuote', async () => {
      const { metaAddress } = generateStealthMetaAddress('arbitrum')
      // Use EVM chain as input for stealth address tests
      const request: SwapRequest = {
        requestId: 'req_123',
        privacyLevel: PrivacyLevel.SHIELDED,
        inputAsset: NATIVE_TOKENS.ethereum,
        inputAmount: 1000000000000000000n, // 1 ETH (18 decimals)
        outputAsset: NATIVE_TOKENS.arbitrum,
      }

      const prepared = await adapter.prepareSwap(request, metaAddress)
      const quote = await adapter.getDryQuote(prepared)

      expect(mockClient.dryQuote).toHaveBeenCalledWith(prepared.quoteRequest)
      expect(quote.quoteId).toBe('dry_quote_123')
    })
  })

  // ─── initiateSwap ────────────────────────────────────────────────────────────

  describe('initiateSwap', () => {
    it('should return full swap result with stealth data', async () => {
      const { metaAddress } = generateStealthMetaAddress('arbitrum')
      // Use EVM chain as input for stealth address tests
      const request: SwapRequest = {
        requestId: 'req_123',
        privacyLevel: PrivacyLevel.SHIELDED,
        inputAsset: NATIVE_TOKENS.ethereum,
        inputAmount: 1000000000000000000n, // 1 ETH (18 decimals)
        outputAsset: NATIVE_TOKENS.arbitrum,
      }

      const result = await adapter.initiateSwap(request, metaAddress)

      expect(result.requestId).toBe('req_123')
      expect(result.quoteId).toBe('quote_123')
      expect(result.depositAddress).toBe('0xdeposit')
      // Mock returns hardcoded values from the mock setup
      expect(result.amountIn).toBe('1000000000000000000000000')
      expect(result.amountOut).toBe('300000000000000000')
      expect(result.status).toBe(OneClickSwapStatus.PENDING_DEPOSIT)
      expect(result.stealthRecipient).toMatch(/^0x/)
      expect(result.ephemeralPublicKey).toMatch(/^0x/)
    })
  })

  // ─── notifyDeposit ───────────────────────────────────────────────────────────

  describe('notifyDeposit', () => {
    it('should call client.submitDeposit', async () => {
      await adapter.notifyDeposit('0xdeposit', '0xtxhash', 'user.near')

      expect(mockClient.submitDeposit).toHaveBeenCalledWith({
        depositAddress: '0xdeposit',
        txHash: '0xtxhash',
        nearSenderAccount: 'user.near',
      })
    })
  })

  // ─── getStatus ───────────────────────────────────────────────────────────────

  describe('getStatus', () => {
    it('should call client.getStatus', async () => {
      const status = await adapter.getStatus('0xdeposit')

      expect(mockClient.getStatus).toHaveBeenCalledWith('0xdeposit')
      expect(status.status).toBe(OneClickSwapStatus.SUCCESS)
    })
  })

  // ─── waitForCompletion ───────────────────────────────────────────────────────

  describe('waitForCompletion', () => {
    it('should call client.waitForStatus', async () => {
      const options = { interval: 1000, timeout: 60000 }

      const result = await adapter.waitForCompletion('0xdeposit', options)

      expect(mockClient.waitForStatus).toHaveBeenCalledWith('0xdeposit', options)
      expect(result.status).toBe(OneClickSwapStatus.SUCCESS)
    })
  })

  // ─── Multi-Curve Cross-Chain Tests ────────────────────────────────────────────

  describe('Multi-Curve Stealth Addresses', () => {
    // Solana output with ed25519 stealth address
    describe('Solana output (ed25519)', () => {
      const ethToSolRequest: SwapRequest = {
        requestId: 'req_eth_to_sol',
        privacyLevel: PrivacyLevel.SHIELDED,
        inputAsset: NATIVE_TOKENS.ethereum,
        inputAmount: 1000000000000000000n, // 1 ETH
        outputAsset: NATIVE_TOKENS.solana,
      }

      it('should generate ed25519 stealth address for Solana output', async () => {
        const { metaAddress } = generateEd25519StealthMetaAddress('solana')

        const prepared = await adapter.prepareSwap(
          ethToSolRequest,
          metaAddress,
          '0x1234567890123456789012345678901234567890' // sender for refunds
        )

        expect(prepared.curve).toBe('ed25519')
        expect(prepared.nativeRecipientAddress).toBeDefined()
        // Solana addresses are base58 encoded, typically 32-44 chars
        expect(isValidSolanaAddress(prepared.nativeRecipientAddress!)).toBe(true)
        expect(prepared.stealthAddress).toBeDefined()
      })

      it('should reject secp256k1 meta-address for Solana output', async () => {
        const { metaAddress } = generateStealthMetaAddress('ethereum') // secp256k1

        await expect(
          adapter.prepareSwap(
            ethToSolRequest,
            metaAddress,
            '0x1234567890123456789012345678901234567890'
          )
        ).rejects.toThrow('ed25519')
      })
    })

    // NEAR output with ed25519 stealth address
    describe('NEAR output (ed25519)', () => {
      const ethToNearRequest: SwapRequest = {
        requestId: 'req_eth_to_near',
        privacyLevel: PrivacyLevel.SHIELDED,
        inputAsset: NATIVE_TOKENS.ethereum,
        inputAmount: 1000000000000000000n, // 1 ETH
        outputAsset: NATIVE_TOKENS.near,
      }

      it('should generate ed25519 stealth address for NEAR output', async () => {
        const { metaAddress } = generateEd25519StealthMetaAddress('near')

        const prepared = await adapter.prepareSwap(
          ethToNearRequest,
          metaAddress,
          '0x1234567890123456789012345678901234567890' // sender for refunds
        )

        expect(prepared.curve).toBe('ed25519')
        expect(prepared.nativeRecipientAddress).toBeDefined()
        // NEAR implicit addresses are 64 hex chars
        expect(isValidNearImplicitAddress(prepared.nativeRecipientAddress!)).toBe(true)
        expect(prepared.stealthAddress).toBeDefined()
      })

      it('should reject secp256k1 meta-address for NEAR output', async () => {
        const { metaAddress } = generateStealthMetaAddress('ethereum') // secp256k1

        await expect(
          adapter.prepareSwap(
            ethToNearRequest,
            metaAddress,
            '0x1234567890123456789012345678901234567890'
          )
        ).rejects.toThrow('ed25519')
      })
    })

    // EVM output with secp256k1 stealth address
    describe('EVM output (secp256k1)', () => {
      const solToEthRequest: SwapRequest = {
        requestId: 'req_sol_to_eth',
        privacyLevel: PrivacyLevel.SHIELDED,
        inputAsset: NATIVE_TOKENS.solana,
        inputAmount: 1000000000n, // 1 SOL (9 decimals)
        outputAsset: NATIVE_TOKENS.ethereum,
      }

      it('should generate secp256k1 stealth address for EVM output', async () => {
        const { metaAddress } = generateStealthMetaAddress('ethereum')

        const prepared = await adapter.prepareSwap(
          solToEthRequest,
          metaAddress,
          'So11111111111111111111111111111111111111111' // sender for refunds
        )

        expect(prepared.curve).toBe('secp256k1')
        expect(prepared.nativeRecipientAddress).toBeDefined()
        // ETH addresses are 0x + 40 hex chars
        expect(prepared.nativeRecipientAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
        expect(prepared.stealthAddress).toBeDefined()
      })

      it('should reject ed25519 meta-address for EVM output', async () => {
        const { metaAddress } = generateEd25519StealthMetaAddress('solana') // ed25519

        await expect(
          adapter.prepareSwap(
            solToEthRequest,
            metaAddress,
            'So11111111111111111111111111111111111111111'
          )
        ).rejects.toThrow('secp256k1')
      })
    })

    // Cross-curve refund scenarios
    describe('Cross-curve refund handling', () => {
      it('should require sender address for cross-curve refunds (EVM input, ed25519 meta)', async () => {
        const request: SwapRequest = {
          requestId: 'req_cross_curve',
          privacyLevel: PrivacyLevel.SHIELDED,
          inputAsset: NATIVE_TOKENS.ethereum, // EVM input
          inputAmount: 1000000000000000000n,
          outputAsset: NATIVE_TOKENS.solana, // ed25519 output
        }
        const { metaAddress } = generateEd25519StealthMetaAddress('solana')

        // Without sender address, should fail for cross-curve refunds
        await expect(
          adapter.prepareSwap(request, metaAddress)
        ).rejects.toThrow('Cross-curve refunds not supported')
      })

      it('should work with matching curve for input and output', async () => {
        // Solana to NEAR (both ed25519)
        const request: SwapRequest = {
          requestId: 'req_same_curve',
          privacyLevel: PrivacyLevel.SHIELDED,
          inputAsset: NATIVE_TOKENS.solana,
          inputAmount: 1000000000n,
          outputAsset: NATIVE_TOKENS.near, // Both are ed25519
        }
        const { metaAddress } = generateEd25519StealthMetaAddress('near')

        const prepared = await adapter.prepareSwap(request, metaAddress)

        expect(prepared.curve).toBe('ed25519')
        expect(prepared.nativeRecipientAddress).toBeDefined()
        // Refund address should be auto-generated (no error)
        expect(prepared.quoteRequest.refundTo).toBeDefined()
      })

      it('should work with matching curve for EVM chains', async () => {
        // Ethereum to Arbitrum (both secp256k1)
        const request: SwapRequest = {
          requestId: 'req_evm_to_evm',
          privacyLevel: PrivacyLevel.SHIELDED,
          inputAsset: NATIVE_TOKENS.ethereum,
          inputAmount: 1000000000000000000n,
          outputAsset: NATIVE_TOKENS.arbitrum, // Both are secp256k1
        }
        const { metaAddress } = generateStealthMetaAddress('arbitrum')

        const prepared = await adapter.prepareSwap(request, metaAddress)

        expect(prepared.curve).toBe('secp256k1')
        expect(prepared.nativeRecipientAddress).toBeDefined()
        // Refund address should be auto-generated
        expect(prepared.quoteRequest.refundTo).toBeDefined()
      })
    })

    // Curve metadata in PreparedSwap
    describe('Curve metadata', () => {
      it('should include curve metadata for ed25519 chains', async () => {
        const request: SwapRequest = {
          requestId: 'req_meta',
          privacyLevel: PrivacyLevel.SHIELDED,
          inputAsset: NATIVE_TOKENS.ethereum,
          inputAmount: 1000000000000000000n,
          outputAsset: NATIVE_TOKENS.solana,
        }
        const { metaAddress } = generateEd25519StealthMetaAddress('solana')

        const prepared = await adapter.prepareSwap(
          request,
          metaAddress,
          '0x1234567890123456789012345678901234567890'
        )

        expect(prepared.curve).toBe('ed25519')
        expect(prepared.nativeRecipientAddress).toBeDefined()
      })

      it('should include curve metadata for secp256k1 chains', async () => {
        const request: SwapRequest = {
          requestId: 'req_meta_evm',
          privacyLevel: PrivacyLevel.SHIELDED,
          inputAsset: NATIVE_TOKENS.ethereum,
          inputAmount: 1000000000000000000n,
          outputAsset: NATIVE_TOKENS.arbitrum,
        }
        const { metaAddress } = generateStealthMetaAddress('arbitrum')

        const prepared = await adapter.prepareSwap(request, metaAddress)

        expect(prepared.curve).toBe('secp256k1')
        expect(prepared.nativeRecipientAddress).toBeDefined()
      })

      it('should not include curve metadata for transparent mode', async () => {
        const request: SwapRequest = {
          requestId: 'req_transparent',
          privacyLevel: PrivacyLevel.TRANSPARENT,
          inputAsset: NATIVE_TOKENS.ethereum,
          inputAmount: 1000000000000000000n,
          outputAsset: NATIVE_TOKENS.arbitrum,
        }

        const prepared = await adapter.prepareSwap(
          request,
          undefined,
          '0x1234567890123456789012345678901234567890'
        )

        expect(prepared.curve).toBeUndefined()
        expect(prepared.nativeRecipientAddress).toBeUndefined()
      })
    })
  })
})
