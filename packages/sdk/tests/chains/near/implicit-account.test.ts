/**
 * NEAR Implicit Account Privacy Tests
 *
 * Tests for M17-NEAR-06: NEAR implicit account privacy support
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  // Private transfer building
  buildPrivateTransfer,
  buildPrivateTokenTransfer,
  buildStorageDeposit,
  // Key derivation
  deriveStealthAccountKeyPair,
  // Claim transactions
  buildClaimTransaction,
  buildDeleteStealthAccount,
  // Access key management
  buildAddAccessKey,
  buildKeyRotation,
  // Account utilities
  isStealthCompatibleAccount,
  getImplicitAccountPublicKey,
  verifyImplicitAccountMatch,
  // Stealth functions
  generateNEARStealthMetaAddress,
  generateNEARStealthAddress,
  ed25519PublicKeyToImplicitAccount,
  // Constants
  ONE_NEAR,
  ONE_YOCTO,
  DEFAULT_GAS,
} from '../../../src/chains/near'
import type { HexString } from '@sip-protocol/types'

describe('NEAR Implicit Account Privacy (M17-NEAR-06)', () => {
  // Test fixtures
  let metaAddress: ReturnType<typeof generateNEARStealthMetaAddress>
  let stealthResult: ReturnType<typeof generateNEARStealthAddress>

  beforeEach(() => {
    metaAddress = generateNEARStealthMetaAddress('Test Wallet')
    stealthResult = generateNEARStealthAddress(metaAddress.metaAddress)
  })

  describe('buildPrivateTransfer', () => {
    it('should build a private native NEAR transfer', () => {
      const result = buildPrivateTransfer(
        metaAddress.metaAddress,
        ONE_NEAR
      )

      expect(result.stealthAddress).toBeDefined()
      expect(result.stealthAddress.address).toMatch(/^0x[0-9a-f]{64}$/i)
      expect(result.stealthAddress.ephemeralPublicKey).toMatch(/^0x[0-9a-f]{64}$/i)
      expect(result.stealthAddress.viewTag).toBeGreaterThanOrEqual(0)
      expect(result.stealthAddress.viewTag).toBeLessThanOrEqual(255)

      expect(result.stealthAccountId).toMatch(/^[0-9a-f]{64}$/)
      expect(result.announcementMemo).toMatch(/^SIP:1:/)
      expect(result.receiverId).toBe(result.stealthAccountId)

      expect(result.actions).toHaveLength(1)
      expect(result.actions[0].type).toBe('Transfer')
      expect((result.actions[0].params as { deposit: bigint }).deposit).toBe(ONE_NEAR)
    })

    it('should accept meta-address as string', () => {
      const encoded = `sip:near:${metaAddress.metaAddress.spendingKey}:${metaAddress.metaAddress.viewingKey}`
      const result = buildPrivateTransfer(encoded, ONE_NEAR)

      expect(result.stealthAccountId).toMatch(/^[0-9a-f]{64}$/)
    })

    it('should throw for non-NEAR meta-address', () => {
      const invalidMeta = {
        ...metaAddress.metaAddress,
        chain: 'solana' as const,
      }

      expect(() => buildPrivateTransfer(invalidMeta, ONE_NEAR))
        .toThrow(/Expected NEAR/)
    })

    it('should throw for zero amount', () => {
      expect(() => buildPrivateTransfer(metaAddress.metaAddress, 0n))
        .toThrow(/greater than 0/)
    })

    it('should throw for negative amount', () => {
      expect(() => buildPrivateTransfer(metaAddress.metaAddress, -1n))
        .toThrow(/greater than 0/)
    })

    it('should generate unique stealth addresses for each transfer', () => {
      const result1 = buildPrivateTransfer(metaAddress.metaAddress, ONE_NEAR)
      const result2 = buildPrivateTransfer(metaAddress.metaAddress, ONE_NEAR)

      expect(result1.stealthAccountId).not.toBe(result2.stealthAccountId)
      expect(result1.stealthAddress.ephemeralPublicKey).not.toBe(
        result2.stealthAddress.ephemeralPublicKey
      )
    })
  })

  describe('buildPrivateTokenTransfer', () => {
    const TOKEN_CONTRACT = 'usdt.tether-token.near'
    const TOKEN_AMOUNT = 1_000_000n // 1 USDT (6 decimals)

    it('should build a private NEP-141 token transfer', () => {
      const result = buildPrivateTokenTransfer(
        metaAddress.metaAddress,
        TOKEN_CONTRACT,
        TOKEN_AMOUNT
      )

      expect(result.stealthAddress).toBeDefined()
      expect(result.stealthAccountId).toMatch(/^[0-9a-f]{64}$/)
      expect(result.announcementMemo).toMatch(/^SIP:1:/)
      expect(result.receiverId).toBe(TOKEN_CONTRACT)

      expect(result.actions).toHaveLength(1)
      expect(result.actions[0].type).toBe('FunctionCall')

      const params = result.actions[0].params as {
        methodName: string
        args: string
        gas: bigint
        deposit: bigint
      }
      expect(params.methodName).toBe('ft_transfer')
      expect(params.deposit).toBe(ONE_YOCTO)
      expect(params.gas).toBe(DEFAULT_GAS)

      const args = JSON.parse(params.args)
      expect(args.receiver_id).toBe(result.stealthAccountId)
      expect(args.amount).toBe(TOKEN_AMOUNT.toString())
      expect(args.memo).toContain('SIP:1:')
    })

    it('should include custom memo in transfer', () => {
      const customMemo = 'Payment for services'
      const result = buildPrivateTokenTransfer(
        metaAddress.metaAddress,
        TOKEN_CONTRACT,
        TOKEN_AMOUNT,
        customMemo
      )

      const params = result.actions[0].params as { args: string }
      const args = JSON.parse(params.args)
      expect(args.memo).toContain(customMemo)
      expect(args.memo).toContain('SIP:1:')
    })

    it('should throw for invalid token contract', () => {
      expect(() => buildPrivateTokenTransfer(
        metaAddress.metaAddress,
        'X', // Single character - too short for NEAR account ID
        TOKEN_AMOUNT
      )).toThrow(/Invalid token contract/)
    })
  })

  describe('buildStorageDeposit', () => {
    const TOKEN_CONTRACT = 'usdt.tether-token.near'

    it('should build storage deposit action', () => {
      const stealthAccountId = ed25519PublicKeyToImplicitAccount(
        stealthResult.stealthAddress.address
      )

      const actions = buildStorageDeposit(stealthAccountId, TOKEN_CONTRACT)

      expect(actions).toHaveLength(1)
      expect(actions[0].type).toBe('FunctionCall')

      const params = actions[0].params as {
        methodName: string
        args: string
        deposit: bigint
      }
      expect(params.methodName).toBe('storage_deposit')

      const args = JSON.parse(params.args)
      expect(args.account_id).toBe(stealthAccountId)
    })

    it('should accept custom deposit amount', () => {
      const stealthAccountId = ed25519PublicKeyToImplicitAccount(
        stealthResult.stealthAddress.address
      )
      const customAmount = 1_000_000_000_000_000_000_000_000n

      const actions = buildStorageDeposit(stealthAccountId, TOKEN_CONTRACT, customAmount)

      const params = actions[0].params as { deposit: bigint }
      expect(params.deposit).toBe(customAmount)
    })

    it('should throw for invalid stealth account', () => {
      expect(() => buildStorageDeposit('alice.near', TOKEN_CONTRACT))
        .toThrow(/must be a valid implicit account/)
    })
  })

  describe('deriveStealthAccountKeyPair', () => {
    it('should derive keypair from stealth address', () => {
      const keypair = deriveStealthAccountKeyPair({
        stealthAddress: stealthResult.stealthAddress,
        spendingPrivateKey: metaAddress.spendingPrivateKey,
        viewingPrivateKey: metaAddress.viewingPrivateKey,
      })

      expect(keypair.publicKey).toMatch(/^0x[0-9a-f]{64}$/i)
      expect(keypair.privateKey).toMatch(/^0x[0-9a-f]{64}$/i)
      expect(keypair.accountId).toMatch(/^[0-9a-f]{64}$/)
      expect(keypair.nearPublicKey).toMatch(/^ed25519:[A-Za-z0-9]+$/)
      expect(keypair.publicKeyBytes).toHaveLength(32)
    })

    it('should derive matching account ID', () => {
      const keypair = deriveStealthAccountKeyPair({
        stealthAddress: stealthResult.stealthAddress,
        spendingPrivateKey: metaAddress.spendingPrivateKey,
        viewingPrivateKey: metaAddress.viewingPrivateKey,
      })

      // The derived public key should match the stealth address
      expect(keypair.publicKey.toLowerCase()).toBe(
        stealthResult.stealthAddress.address.toLowerCase()
      )
      expect(keypair.accountId).toBe(stealthResult.implicitAccountId)
    })

    it('should throw for invalid spending key', () => {
      expect(() => deriveStealthAccountKeyPair({
        stealthAddress: stealthResult.stealthAddress,
        spendingPrivateKey: 'invalid' as HexString,
        viewingPrivateKey: metaAddress.viewingPrivateKey,
      })).toThrow(/Invalid spendingPrivateKey/)
    })

    it('should throw for invalid viewing key', () => {
      expect(() => deriveStealthAccountKeyPair({
        stealthAddress: stealthResult.stealthAddress,
        spendingPrivateKey: metaAddress.spendingPrivateKey,
        viewingPrivateKey: 'invalid' as HexString,
      })).toThrow(/Invalid viewingPrivateKey/)
    })

    it('should produce different keypairs for different stealth addresses', () => {
      const stealth1 = generateNEARStealthAddress(metaAddress.metaAddress)
      const stealth2 = generateNEARStealthAddress(metaAddress.metaAddress)

      const keypair1 = deriveStealthAccountKeyPair({
        stealthAddress: stealth1.stealthAddress,
        spendingPrivateKey: metaAddress.spendingPrivateKey,
        viewingPrivateKey: metaAddress.viewingPrivateKey,
      })

      const keypair2 = deriveStealthAccountKeyPair({
        stealthAddress: stealth2.stealthAddress,
        spendingPrivateKey: metaAddress.spendingPrivateKey,
        viewingPrivateKey: metaAddress.viewingPrivateKey,
      })

      expect(keypair1.privateKey).not.toBe(keypair2.privateKey)
      expect(keypair1.accountId).not.toBe(keypair2.accountId)
    })
  })

  describe('buildClaimTransaction', () => {
    it('should build native NEAR claim transaction', () => {
      const stealthAccountId = stealthResult.implicitAccountId

      const result = buildClaimTransaction({
        stealthAccountId,
        destinationAccountId: 'alice.near',
        amount: ONE_NEAR,
      })

      expect(result.isTokenTransfer).toBe(false)
      expect(result.receiverId).toBe('alice.near')
      expect(result.actions).toHaveLength(1)
      expect(result.actions[0].type).toBe('Transfer')

      const params = result.actions[0].params as { deposit: bigint }
      expect(params.deposit).toBe(ONE_NEAR)
    })

    it('should build token claim transaction', () => {
      const stealthAccountId = stealthResult.implicitAccountId
      const tokenContract = 'usdt.tether-token.near'

      const result = buildClaimTransaction({
        stealthAccountId,
        destinationAccountId: 'alice.near',
        amount: 1_000_000n,
        tokenContract,
      })

      expect(result.isTokenTransfer).toBe(true)
      expect(result.receiverId).toBe(tokenContract)
      expect(result.actions).toHaveLength(1)
      expect(result.actions[0].type).toBe('FunctionCall')

      const params = result.actions[0].params as {
        methodName: string
        args: string
        deposit: bigint
      }
      expect(params.methodName).toBe('ft_transfer')
      expect(params.deposit).toBe(ONE_YOCTO)

      const args = JSON.parse(params.args)
      expect(args.receiver_id).toBe('alice.near')
    })

    it('should throw for invalid stealth account', () => {
      expect(() => buildClaimTransaction({
        stealthAccountId: 'alice.near',
        destinationAccountId: 'bob.near',
      })).toThrow(/must be a valid implicit account/)
    })

    it('should throw for invalid destination', () => {
      expect(() => buildClaimTransaction({
        stealthAccountId: stealthResult.implicitAccountId,
        destinationAccountId: 'x', // Too short
      })).toThrow(/Invalid destinationAccountId/)
    })
  })

  describe('buildDeleteStealthAccount', () => {
    it('should build delete account action', () => {
      const stealthAccountId = stealthResult.implicitAccountId

      const actions = buildDeleteStealthAccount(stealthAccountId, 'alice.near')

      expect(actions).toHaveLength(1)
      expect(actions[0].type).toBe('DeleteAccount')

      const params = actions[0].params as { beneficiaryId: string }
      expect(params.beneficiaryId).toBe('alice.near')
    })

    it('should throw for non-implicit account', () => {
      expect(() => buildDeleteStealthAccount('alice.near', 'bob.near'))
        .toThrow(/must be a valid implicit account/)
    })

    it('should throw for invalid beneficiary', () => {
      expect(() => buildDeleteStealthAccount(
        stealthResult.implicitAccountId,
        'x' // Too short
      )).toThrow(/Invalid beneficiaryId/)
    })
  })

  describe('buildAddAccessKey', () => {
    it('should build full access key action', () => {
      const newPublicKey = 'ed25519:6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp'

      const actions = buildAddAccessKey({
        newPublicKey,
        permission: 'FullAccess',
      })

      expect(actions).toHaveLength(1)
      expect(actions[0].type).toBe('AddKey')

      const params = actions[0].params as {
        publicKey: string
        accessKey: { permission: string }
      }
      expect(params.publicKey).toBe(newPublicKey)
      expect(params.accessKey.permission).toBe('FullAccess')
    })

    it('should build function call access key action', () => {
      const newPublicKey = 'ed25519:6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp'

      const actions = buildAddAccessKey({
        newPublicKey,
        permission: {
          allowance: 1_000_000_000_000_000_000_000_000n,
          receiverId: 'contract.near',
          methodNames: ['transfer', 'approve'],
        },
      })

      expect(actions).toHaveLength(1)
      expect(actions[0].type).toBe('AddKey')

      const params = actions[0].params as {
        accessKey: {
          permission: {
            FunctionCall: {
              allowance: bigint
              receiverId: string
              methodNames: string[]
            }
          }
        }
      }
      expect(params.accessKey.permission.FunctionCall.receiverId).toBe('contract.near')
      expect(params.accessKey.permission.FunctionCall.methodNames).toEqual(['transfer', 'approve'])
    })

    it('should throw for invalid public key format', () => {
      expect(() => buildAddAccessKey({
        newPublicKey: '6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp', // Missing ed25519:
        permission: 'FullAccess',
      })).toThrow(/must be in ed25519:base58 format/)
    })
  })

  describe('buildKeyRotation', () => {
    const oldPublicKey = 'ed25519:6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp'
    const newPublicKey = 'ed25519:9GTSuKGdvhZXqFnDfXZaT4j2Qf8LJe6uyMwVDYLCfyZh'

    it('should build key rotation actions', () => {
      const actions = buildKeyRotation({
        stealthAccountId: stealthResult.implicitAccountId,
        newPublicKey,
        oldPublicKey,
      })

      expect(actions).toHaveLength(2)
      expect(actions[0].type).toBe('AddKey')
      expect(actions[1].type).toBe('DeleteKey')

      const addParams = actions[0].params as { publicKey: string }
      const deleteParams = actions[1].params as { publicKey: string }

      expect(addParams.publicKey).toBe(newPublicKey)
      expect(deleteParams.publicKey).toBe(oldPublicKey)
    })

    it('should support custom permissions for new key', () => {
      const actions = buildKeyRotation({
        stealthAccountId: stealthResult.implicitAccountId,
        newPublicKey,
        oldPublicKey,
        permission: {
          receiverId: 'contract.near',
          methodNames: ['call'],
        },
      })

      const addParams = actions[0].params as {
        accessKey: {
          permission: {
            FunctionCall: { receiverId: string }
          }
        }
      }
      expect(addParams.accessKey.permission.FunctionCall.receiverId).toBe('contract.near')
    })

    it('should throw for invalid new public key', () => {
      expect(() => buildKeyRotation({
        stealthAccountId: stealthResult.implicitAccountId,
        newPublicKey: 'invalid',
        oldPublicKey,
      })).toThrow(/newPublicKey must be in ed25519:base58 format/)
    })

    it('should throw for invalid old public key', () => {
      expect(() => buildKeyRotation({
        stealthAccountId: stealthResult.implicitAccountId,
        newPublicKey,
        oldPublicKey: 'invalid',
      })).toThrow(/oldPublicKey must be in ed25519:base58 format/)
    })
  })

  describe('Account Utility Functions', () => {
    describe('isStealthCompatibleAccount', () => {
      it('should return true for valid implicit account', () => {
        expect(isStealthCompatibleAccount(stealthResult.implicitAccountId)).toBe(true)
      })

      it('should return false for named account', () => {
        expect(isStealthCompatibleAccount('alice.near')).toBe(false)
      })

      it('should return false for invalid hex', () => {
        expect(isStealthCompatibleAccount('zzzz' + '0'.repeat(60))).toBe(false)
      })
    })

    describe('getImplicitAccountPublicKey', () => {
      it('should return NEAR-formatted public key', () => {
        const publicKey = getImplicitAccountPublicKey(stealthResult.implicitAccountId)

        expect(publicKey).toMatch(/^ed25519:[A-Za-z0-9]+$/)
      })

      it('should throw for non-implicit account', () => {
        expect(() => getImplicitAccountPublicKey('alice.near'))
          .toThrow(/must be a valid implicit account/)
      })
    })

    describe('verifyImplicitAccountMatch', () => {
      it('should return true for matching account and stealth address', () => {
        const matches = verifyImplicitAccountMatch(
          stealthResult.implicitAccountId,
          stealthResult.stealthAddress
        )

        expect(matches).toBe(true)
      })

      it('should return false for non-matching account', () => {
        const otherStealth = generateNEARStealthAddress(metaAddress.metaAddress)

        const matches = verifyImplicitAccountMatch(
          stealthResult.implicitAccountId,
          otherStealth.stealthAddress
        )

        expect(matches).toBe(false)
      })

      it('should return false for named account', () => {
        const matches = verifyImplicitAccountMatch(
          'alice.near',
          stealthResult.stealthAddress
        )

        expect(matches).toBe(false)
      })
    })
  })

  describe('Integration: Full Private Transfer Flow', () => {
    it('should complete sender -> receiver flow', () => {
      // 1. Sender builds private transfer
      const transferBuild = buildPrivateTransfer(
        metaAddress.metaAddress,
        ONE_NEAR * 5n // 5 NEAR
      )

      expect(transferBuild.stealthAccountId).toBeDefined()
      expect(transferBuild.actions).toHaveLength(1)

      // 2. Recipient derives keypair from received announcement
      const keypair = deriveStealthAccountKeyPair({
        stealthAddress: transferBuild.stealthAddress,
        spendingPrivateKey: metaAddress.spendingPrivateKey,
        viewingPrivateKey: metaAddress.viewingPrivateKey,
      })

      // 3. Verify keypair matches stealth account
      expect(keypair.accountId).toBe(transferBuild.stealthAccountId)

      // 4. Recipient builds claim transaction
      const claimBuild = buildClaimTransaction({
        stealthAccountId: transferBuild.stealthAccountId,
        destinationAccountId: 'alice.near',
        amount: ONE_NEAR * 5n - ONE_NEAR / 10n, // Leave some for gas
      })

      expect(claimBuild.receiverId).toBe('alice.near')
      expect(claimBuild.isTokenTransfer).toBe(false)

      // 5. Optionally, add a hardware wallet key before claiming
      const addKeyActions = buildAddAccessKey({
        newPublicKey: 'ed25519:6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp',
        permission: 'FullAccess',
      })

      expect(addKeyActions).toHaveLength(1)
    })

    it('should support token transfer flow', () => {
      const tokenContract = 'usdt.tether-token.near'
      const tokenAmount = 100_000_000n // 100 USDT

      // 1. Build storage deposit (may be needed before first token transfer)
      const storageActions = buildStorageDeposit(
        stealthResult.implicitAccountId,
        tokenContract
      )
      expect(storageActions).toHaveLength(1)

      // 2. Build private token transfer
      const transferBuild = buildPrivateTokenTransfer(
        metaAddress.metaAddress,
        tokenContract,
        tokenAmount
      )

      expect(transferBuild.receiverId).toBe(tokenContract)

      // 3. Derive keypair for claiming
      const keypair = deriveStealthAccountKeyPair({
        stealthAddress: transferBuild.stealthAddress,
        spendingPrivateKey: metaAddress.spendingPrivateKey,
        viewingPrivateKey: metaAddress.viewingPrivateKey,
      })

      expect(keypair.accountId).toBe(transferBuild.stealthAccountId)

      // 4. Build token claim
      const claimBuild = buildClaimTransaction({
        stealthAccountId: transferBuild.stealthAccountId,
        destinationAccountId: 'alice.near',
        amount: tokenAmount,
        tokenContract,
      })

      expect(claimBuild.isTokenTransfer).toBe(true)
      expect(claimBuild.receiverId).toBe(tokenContract)
    })
  })
})
