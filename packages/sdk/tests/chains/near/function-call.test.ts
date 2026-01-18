/**
 * Tests for NEAR Function Call Privacy Wrapper
 *
 * @module tests/chains/near/function-call
 */

import { describe, it, expect } from 'vitest'
import {
  // Private function calls
  buildPrivateFunctionCall,
  buildBatchPrivateFunctionCalls,
  buildMultiStepPrivateTransaction,
  // Access key management
  buildFunctionCallAccessKey,
  // NFT privacy
  buildPrivateNFTMint,
  buildPrivateNFTTransfer,
  // DeFi privacy
  buildPrivateDeFiSwap,
  // Gas estimation
  estimateFunctionCallGas,
  estimateMultiStepGas,
  // Constants
  FUNCTION_CALL_DEFAULT_GAS,
  NFT_MINT_GAS,
  NFT_STORAGE_DEPOSIT,
  DEX_SWAP_GAS,
  // Dependencies
  generateNEARStealthMetaAddress,
  ONE_NEAR,
  verifyOpeningNEAR,
} from '../../../src/chains/near'

describe('NEAR Function Call Privacy Wrapper', () => {
  const { metaAddress } = generateNEARStealthMetaAddress()

  describe('buildPrivateFunctionCall', () => {
    it('should build basic function call', () => {
      const result = buildPrivateFunctionCall({
        contractId: 'contract.near',
        methodName: 'my_method',
        args: { param1: 'value1' },
      })

      expect(result.actions.length).toBe(1)
      expect(result.actions[0].type).toBe('FunctionCall')
      expect(result.receiverId).toBe('contract.near')
      expect(result.gasAttached).toBe(FUNCTION_CALL_DEFAULT_GAS)
      expect(result.depositAttached).toBe(0n)
    })

    it('should build function call with deposit', () => {
      const result = buildPrivateFunctionCall({
        contractId: 'contract.near',
        methodName: 'payable_method',
        deposit: ONE_NEAR,
      })

      expect(result.depositAttached).toBe(ONE_NEAR)

      const params = result.actions[0].params as { deposit: bigint }
      expect(params.deposit).toBe(ONE_NEAR)
    })

    it('should hide deposit with commitment', () => {
      const result = buildPrivateFunctionCall({
        contractId: 'contract.near',
        methodName: 'payable_method',
        deposit: ONE_NEAR,
        hideDeposit: true,
      })

      expect(result.depositCommitment).toBeDefined()
      expect(
        verifyOpeningNEAR(
          result.depositCommitment!.commitment,
          ONE_NEAR,
          result.depositCommitment!.blinding
        )
      ).toBe(true)
    })

    it('should use custom gas', () => {
      const customGas = 50_000_000_000_000n

      const result = buildPrivateFunctionCall({
        contractId: 'contract.near',
        methodName: 'my_method',
        gas: customGas,
      })

      expect(result.gasAttached).toBe(customGas)
    })

    it('should throw for invalid contract', () => {
      expect(() =>
        buildPrivateFunctionCall({
          contractId: 'X',
          methodName: 'my_method',
        })
      ).toThrow('Invalid contractId')
    })

    it('should throw for empty method name', () => {
      expect(() =>
        buildPrivateFunctionCall({
          contractId: 'contract.near',
          methodName: '',
        })
      ).toThrow('methodName is required')
    })
  })

  describe('buildBatchPrivateFunctionCalls', () => {
    it('should build batch function calls', () => {
      const result = buildBatchPrivateFunctionCalls('contract.near', [
        { methodName: 'method1', args: { a: 1 } },
        { methodName: 'method2', args: { b: 2 } },
        { methodName: 'method3', deposit: ONE_NEAR },
      ])

      expect(result.actions.length).toBe(3)
      expect(result.receiverId).toBe('contract.near')
      expect(result.depositAttached).toBe(ONE_NEAR)
      expect(result.gasAttached).toBe(3n * FUNCTION_CALL_DEFAULT_GAS)
    })

    it('should throw for empty calls', () => {
      expect(() =>
        buildBatchPrivateFunctionCalls('contract.near', [])
      ).toThrow('At least one call is required')
    })

    it('should throw for too many calls', () => {
      const calls = Array(11).fill({ methodName: 'test' })

      expect(() =>
        buildBatchPrivateFunctionCalls('contract.near', calls)
      ).toThrow('Maximum 10 calls per batch')
    })
  })

  describe('buildMultiStepPrivateTransaction', () => {
    it('should build multi-step transaction', () => {
      const result = buildMultiStepPrivateTransaction({
        steps: [
          { contractId: 'token.near', methodName: 'ft_transfer', deposit: 1n },
          { contractId: 'dex.near', methodName: 'swap' },
        ],
      })

      expect(result.steps.length).toBe(2)
      expect(result.steps[0].receiverId).toBe('token.near')
      expect(result.steps[1].receiverId).toBe('dex.near')
      expect(result.totalDeposit).toBe(1n)
    })

    it('should distribute gas across steps', () => {
      const totalGas = 200_000_000_000_000n

      const result = buildMultiStepPrivateTransaction({
        steps: [
          { contractId: 'a.near', methodName: 'method1' },
          { contractId: 'b.near', methodName: 'method2' },
        ],
        totalGas,
      })

      expect(result.steps[0].gas).toBe(totalGas / 2n)
      expect(result.steps[1].gas).toBe(totalGas / 2n)
    })

    it('should throw for too many steps', () => {
      const steps = Array(11).fill({
        contractId: 'a.near',
        methodName: 'test',
      })

      expect(() =>
        buildMultiStepPrivateTransaction({ steps })
      ).toThrow('Maximum 10 steps per transaction')
    })
  })

  describe('buildFunctionCallAccessKey', () => {
    it('should build function call access key', () => {
      const action = buildFunctionCallAccessKey({
        publicKey: 'ed25519:test123',
        receiverId: 'contract.near',
        methodNames: ['method1', 'method2'],
        allowance: ONE_NEAR,
      })

      expect(action.type).toBe('AddKey')

      const params = action.params as {
        publicKey: string
        accessKey: {
          permission: {
            FunctionCall: {
              receiverId: string
              methodNames: string[]
              allowance?: bigint
            }
          }
        }
      }

      expect(params.publicKey).toBe('ed25519:test123')
      expect(params.accessKey.permission.FunctionCall.receiverId).toBe('contract.near')
      expect(params.accessKey.permission.FunctionCall.methodNames).toEqual(['method1', 'method2'])
      expect(params.accessKey.permission.FunctionCall.allowance).toBe(ONE_NEAR)
    })

    it('should build access key for all methods', () => {
      const action = buildFunctionCallAccessKey({
        publicKey: 'ed25519:test123',
        receiverId: 'contract.near',
        methodNames: [],
      })

      const params = action.params as {
        accessKey: {
          permission: {
            FunctionCall: {
              methodNames: string[]
            }
          }
        }
      }

      expect(params.accessKey.permission.FunctionCall.methodNames).toEqual([])
    })

    it('should throw for invalid public key format', () => {
      expect(() =>
        buildFunctionCallAccessKey({
          publicKey: 'invalid-format',
          receiverId: 'contract.near',
          methodNames: [],
        })
      ).toThrow('publicKey must be in ed25519:base58 format')
    })
  })

  describe('buildPrivateNFTMint', () => {
    it('should build private NFT mint', () => {
      const result = buildPrivateNFTMint({
        contractId: 'nft.near',
        receiverMetaAddress: metaAddress,
        tokenId: 'token-1',
        metadata: {
          title: 'My NFT',
          description: 'A private NFT',
        },
      })

      expect(result.actions.length).toBe(1)
      expect(result.receiverId).toBe('nft.near')
      expect(result.stealthAddress).toBeDefined()
      expect(result.stealthAccountId).toMatch(/^[a-f0-9]{64}$/)
      expect(result.announcementMemo).toBeDefined()

      // Verify action
      const action = result.actions[0]
      expect(action.type).toBe('FunctionCall')

      const params = action.params as { methodName: string; args: string }
      expect(params.methodName).toBe('nft_mint')

      const args = JSON.parse(params.args)
      expect(args.token_id).toBe('token-1')
      expect(args.receiver_id).toBe(result.stealthAccountId)
      expect(args.token_metadata.title).toBe('My NFT')
    })

    it('should use default storage deposit', () => {
      const result = buildPrivateNFTMint({
        contractId: 'nft.near',
        receiverMetaAddress: metaAddress,
        tokenId: 'token-1',
      })

      const params = result.actions[0].params as { deposit: bigint }
      expect(params.deposit).toBe(NFT_STORAGE_DEPOSIT)
    })

    it('should use custom deposit', () => {
      const customDeposit = 200_000_000_000_000_000_000_000n

      const result = buildPrivateNFTMint({
        contractId: 'nft.near',
        receiverMetaAddress: metaAddress,
        tokenId: 'token-1',
        deposit: customDeposit,
      })

      const params = result.actions[0].params as { deposit: bigint }
      expect(params.deposit).toBe(customDeposit)
    })
  })

  describe('buildPrivateNFTTransfer', () => {
    it('should build private NFT transfer', () => {
      const result = buildPrivateNFTTransfer(
        'nft.near',
        'token-1',
        metaAddress
      )

      expect(result.receiverId).toBe('nft.near')
      expect(result.stealthAddress).toBeDefined()
      expect(result.stealthAccountId).toMatch(/^[a-f0-9]{64}$/)

      const params = result.actions[0].params as { methodName: string; args: string }
      expect(params.methodName).toBe('nft_transfer')

      const args = JSON.parse(params.args)
      expect(args.token_id).toBe('token-1')
      expect(args.receiver_id).toBe(result.stealthAccountId)
    })

    it('should require 1 yoctoNEAR deposit', () => {
      const result = buildPrivateNFTTransfer(
        'nft.near',
        'token-1',
        metaAddress
      )

      const params = result.actions[0].params as { deposit: bigint }
      expect(params.deposit).toBe(1n)
    })
  })

  describe('buildPrivateDeFiSwap', () => {
    it('should build private DeFi swap', () => {
      const result = buildPrivateDeFiSwap({
        dexContract: 'ref-finance.near',
        tokenIn: 'usdc.near',
        tokenOut: 'wrap.near',
        amountIn: 1000_000_000n,
        minAmountOut: 900_000_000_000_000_000_000_000n,
        receiverMetaAddress: metaAddress,
      })

      expect(result.receiverId).toBe('usdc.near') // Call goes to token contract
      expect(result.stealthAddress).toBeDefined()
      expect(result.stealthAccountId).toMatch(/^[a-f0-9]{64}$/)
      expect(result.expectedOutput).toBeGreaterThan(0n)

      const params = result.actions[0].params as { methodName: string }
      expect(params.methodName).toBe('ft_transfer_call')
    })

    it('should calculate expected output with slippage', () => {
      const minOut = 1_000_000_000_000_000_000_000_000n // 1 NEAR

      const result = buildPrivateDeFiSwap({
        dexContract: 'dex.near',
        tokenIn: 'token.near',
        tokenOut: 'wrap.near',
        amountIn: 100n,
        minAmountOut: minOut,
        receiverMetaAddress: metaAddress,
        slippageBps: 100, // 1%
      })

      // Expected should be higher than min due to slippage
      expect(result.expectedOutput).toBeGreaterThan(minOut)
    })

    it('should throw for invalid amounts', () => {
      expect(() =>
        buildPrivateDeFiSwap({
          dexContract: 'dex.near',
          tokenIn: 'token.near',
          tokenOut: 'wrap.near',
          amountIn: 0n,
          minAmountOut: 100n,
          receiverMetaAddress: metaAddress,
        })
      ).toThrow('amountIn must be greater than 0')
    })
  })

  describe('estimateFunctionCallGas', () => {
    it('should estimate basic function call gas', () => {
      const gas = estimateFunctionCallGas('my_method')

      expect(gas).toBeGreaterThan(0n)
      expect(gas).toBeLessThan(300_000_000_000_000n) // Below max
    })

    it('should add extra gas for ft_transfer', () => {
      const basicGas = estimateFunctionCallGas('basic')
      const ftGas = estimateFunctionCallGas('ft_transfer')

      expect(ftGas).toBeGreaterThan(basicGas)
    })

    it('should add extra gas for NFT operations', () => {
      const basicGas = estimateFunctionCallGas('basic')
      const nftGas = estimateFunctionCallGas('nft_mint')

      expect(nftGas).toBeGreaterThan(basicGas)
    })

    it('should add extra gas for swaps', () => {
      const basicGas = estimateFunctionCallGas('basic')
      const swapGas = estimateFunctionCallGas('swap_tokens')

      expect(swapGas).toBeGreaterThan(basicGas)
    })

    it('should account for args size', () => {
      const smallArgs = estimateFunctionCallGas('method', 10)
      const largeArgs = estimateFunctionCallGas('method', 1000)

      expect(largeArgs).toBeGreaterThan(smallArgs)
    })
  })

  describe('estimateMultiStepGas', () => {
    it('should estimate multi-step gas', () => {
      const gas = estimateMultiStepGas([
        { methodName: 'ft_transfer' },
        { methodName: 'swap' },
        { methodName: 'nft_mint' },
      ])

      const singleFt = estimateFunctionCallGas('ft_transfer')
      const singleSwap = estimateFunctionCallGas('swap')
      const singleNft = estimateFunctionCallGas('nft_mint')

      expect(gas).toBe(singleFt + singleSwap + singleNft)
    })
  })

  describe('constants', () => {
    it('should have expected values', () => {
      expect(FUNCTION_CALL_DEFAULT_GAS).toBe(30_000_000_000_000n)
      expect(NFT_MINT_GAS).toBe(50_000_000_000_000n)
      expect(NFT_STORAGE_DEPOSIT).toBe(100_000_000_000_000_000_000_000n)
      expect(DEX_SWAP_GAS).toBe(100_000_000_000_000n)
    })
  })

  describe('integration: private NFT flow', () => {
    it('should complete private NFT mint flow', () => {
      // 1. Recipient generates meta-address
      const recipient = generateNEARStealthMetaAddress('NFT Collector')

      // 2. Minter builds private NFT mint
      const result = buildPrivateNFTMint({
        contractId: 'nft-collection.near',
        receiverMetaAddress: recipient.metaAddress,
        tokenId: 'unique-nft-123',
        metadata: {
          title: 'Exclusive NFT',
          description: 'A privately minted NFT',
          media: 'ipfs://...',
        },
      })

      // 3. Verify build
      expect(result.stealthAccountId).toMatch(/^[a-f0-9]{64}$/)
      expect(result.announcementMemo).toBeDefined()

      // 4. Verify action structure
      const args = JSON.parse(
        (result.actions[0].params as { args: string }).args
      )
      expect(args.receiver_id).toBe(result.stealthAccountId)
      expect(args.memo).toBe(result.announcementMemo)
    })
  })

  describe('integration: private DeFi flow', () => {
    it('should complete private swap flow', () => {
      // 1. User generates stealth address for swap output
      const user = generateNEARStealthMetaAddress('DeFi User')

      // 2. Build private swap
      const result = buildPrivateDeFiSwap({
        dexContract: 'ref-finance.near',
        tokenIn: 'usdc.near',
        tokenOut: 'wrap.near',
        amountIn: 1000_000_000n, // 1000 USDC
        minAmountOut: 900_000_000_000_000_000_000_000n, // Min 0.9 NEAR
        receiverMetaAddress: user.metaAddress,
      })

      // 3. Verify build
      expect(result.stealthAccountId).toMatch(/^[a-f0-9]{64}$/)
      expect(result.expectedOutput).toBeGreaterThan(0n)

      // 4. Verify ft_transfer_call structure
      const params = result.actions[0].params as { methodName: string; args: string }
      expect(params.methodName).toBe('ft_transfer_call')

      const args = JSON.parse(params.args)
      expect(args.receiver_id).toBe('ref-finance.near') // DEX
      expect(args.memo).toBe(result.announcementMemo)
    })
  })
})
