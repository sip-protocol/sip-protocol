/**
 * NEAR Stealth Address Resolver Tests
 *
 * Tests for M17-NEAR-05: NEAR stealth address resolver
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { bytesToHex, randomBytes } from '@noble/hashes/utils'
import {
  NEARStealthScanner,
  createNEARStealthScanner,
  createNEARAnnouncementCache,
  batchScanNEARAnnouncements,
  hasNEARAnnouncementMatch,
  generateNEARStealthMetaAddress,
  generateNEARStealthAddress,
  ed25519PublicKeyToImplicitAccount,
} from '../../../src/chains/near'
import type {
  NEARScanRecipient,
  NEARAnnouncementCache,
} from '../../../src/chains/near'
import type { NEARAnnouncement } from '../../../src/chains/near/types'
import type { HexString } from '@sip-protocol/types'

describe('NEAR Stealth Address Resolver (M17-NEAR-05)', () => {
  // Test fixtures
  let metaAddress: ReturnType<typeof generateNEARStealthMetaAddress>
  let stealthResult: ReturnType<typeof generateNEARStealthAddress>
  let testRecipient: NEARScanRecipient
  let testAnnouncement: NEARAnnouncement

  // Helper to access stealth address components
  const getStealthComponents = (result: typeof stealthResult) => ({
    address: result.stealthAddress.address,
    ephemeralPublicKey: result.stealthAddress.ephemeralPublicKey,
    viewTag: result.stealthAddress.viewTag,
  })

  beforeEach(() => {
    // Generate test meta address
    metaAddress = generateNEARStealthMetaAddress('Test Recipient')

    // Generate a stealth address using meta address from result
    stealthResult = generateNEARStealthAddress(metaAddress.metaAddress)

    // Get stealth components for easy access
    const stealth = getStealthComponents(stealthResult)

    // Set up test recipient using both private keys (required for DKSAP)
    testRecipient = {
      viewingPrivateKey: metaAddress.viewingPrivateKey,
      spendingPrivateKey: metaAddress.spendingPrivateKey,
      label: 'Test Recipient',
    }

    // Set up test announcement
    const stealthAccountId = ed25519PublicKeyToImplicitAccount(stealth.address)
    testAnnouncement = {
      ephemeralPublicKey: stealth.ephemeralPublicKey,
      viewTag: stealth.viewTag,
      stealthAddress: stealth.address,
      stealthAccountId,
    }
  })

  describe('NEARStealthScanner', () => {
    describe('constructor', () => {
      it('should create scanner with default options', () => {
        const scanner = createNEARStealthScanner({
          rpcUrl: 'https://rpc.mainnet.near.org',
        })

        expect(scanner).toBeInstanceOf(NEARStealthScanner)
        expect(scanner.batchSize).toBe(100)
        expect(scanner.getNetwork()).toBe('mainnet')
      })

      it('should accept custom options', () => {
        const scanner = new NEARStealthScanner({
          rpcUrl: 'https://rpc.testnet.near.org',
          network: 'testnet',
          batchSize: 50,
          timeout: 10000,
        })

        expect(scanner.batchSize).toBe(50)
        expect(scanner.getNetwork()).toBe('testnet')
      })
    })

    describe('recipient management', () => {
      let scanner: NEARStealthScanner

      beforeEach(() => {
        scanner = createNEARStealthScanner({
          rpcUrl: 'https://rpc.mainnet.near.org',
        })
      })

      it('should add recipient', () => {
        scanner.addRecipient(testRecipient)
        const recipients = scanner.getRecipients()

        expect(recipients).toHaveLength(1)
        expect(recipients[0].label).toBe('Test Recipient')
      })

      it('should remove recipient by label', () => {
        scanner.addRecipient(testRecipient)
        scanner.removeRecipient('Test Recipient')

        expect(scanner.getRecipients()).toHaveLength(0)
      })

      it('should clear all recipients', () => {
        scanner.addRecipient(testRecipient)
        scanner.addRecipient({
          viewingPrivateKey: `0x${bytesToHex(randomBytes(32))}` as HexString,
          spendingPrivateKey: `0x${bytesToHex(randomBytes(32))}` as HexString,
          label: 'Another',
        })

        scanner.clearRecipients()
        expect(scanner.getRecipients()).toHaveLength(0)
      })

      it('should throw for invalid viewing key', () => {
        expect(() =>
          scanner.addRecipient({
            viewingPrivateKey: 'invalid' as HexString,
            spendingPrivateKey: testRecipient.spendingPrivateKey,
          })
        ).toThrow(/Invalid/)
      })

      it('should throw for invalid spending key', () => {
        expect(() =>
          scanner.addRecipient({
            viewingPrivateKey: testRecipient.viewingPrivateKey,
            spendingPrivateKey: 'invalid' as HexString,
          })
        ).toThrow(/Invalid/)
      })
    })

    describe('scanAnnouncements', () => {
      let scanner: NEARStealthScanner

      beforeEach(() => {
        scanner = createNEARStealthScanner({
          rpcUrl: 'https://rpc.mainnet.near.org',
        })
      })

      it('should return empty array when no recipients configured', async () => {
        const result = await scanner.scanAnnouncements([testAnnouncement])
        expect(result).toHaveLength(0)
      })

      it('should detect payment for matching recipient', async () => {
        scanner.addRecipient(testRecipient)
        const stealth = getStealthComponents(stealthResult)

        const result = await scanner.scanAnnouncements([testAnnouncement], [
          {
            txHash: 'abc123',
            blockHeight: 100,
            timestamp: Date.now(),
            amount: 1_000_000_000_000_000_000_000_000n,
          },
        ])

        expect(result).toHaveLength(1)
        expect(result[0].stealthPublicKey).toBe(stealth.address)
        expect(result[0].ephemeralPublicKey).toBe(stealth.ephemeralPublicKey)
        expect(result[0].viewTag).toBe(stealth.viewTag)
        expect(result[0].recipientLabel).toBe('Test Recipient')
      })

      it('should not detect payment for non-matching recipient', async () => {
        // Different recipient
        const otherMeta = generateNEARStealthMetaAddress('Other')
        scanner.addRecipient({
          viewingPrivateKey: otherMeta.viewingPrivateKey,
          spendingPrivateKey: otherMeta.spendingPrivateKey,
          label: 'Other',
        })

        const result = await scanner.scanAnnouncements([testAnnouncement])
        expect(result).toHaveLength(0)
      })

      it('should skip invalid announcements', async () => {
        scanner.addRecipient(testRecipient)

        const invalidAnnouncement: NEARAnnouncement = {
          ephemeralPublicKey: '0xinvalid' as HexString,
          viewTag: 999, // Invalid view tag
          stealthAddress: '0x' as HexString,
          stealthAccountId: 'invalid',
        }

        const result = await scanner.scanAnnouncements([invalidAnnouncement])
        expect(result).toHaveLength(0)
      })

      it('should handle multiple announcements', async () => {
        scanner.addRecipient(testRecipient)

        // Generate another stealth address for the same recipient
        const stealthResult2 = generateNEARStealthAddress(metaAddress.metaAddress)
        const stealth2 = getStealthComponents(stealthResult2)
        const stealthAccountId2 = ed25519PublicKeyToImplicitAccount(stealth2.address)

        const announcements: NEARAnnouncement[] = [
          testAnnouncement,
          {
            ephemeralPublicKey: stealth2.ephemeralPublicKey,
            viewTag: stealth2.viewTag,
            stealthAddress: stealth2.address,
            stealthAccountId: stealthAccountId2,
          },
        ]

        const result = await scanner.scanAnnouncements(announcements)
        expect(result).toHaveLength(2)
      })
    })

    describe('verifyStealthAddressOwnership', () => {
      let scanner: NEARStealthScanner

      beforeEach(() => {
        scanner = createNEARStealthScanner({
          rpcUrl: 'https://rpc.mainnet.near.org',
        })
      })

      it('should verify correct ownership', () => {
        const stealth = getStealthComponents(stealthResult)
        const isOwner = scanner.verifyStealthAddressOwnership(
          stealth.address,
          stealth.ephemeralPublicKey,
          stealth.viewTag,
          metaAddress.viewingPrivateKey,
          metaAddress.spendingPrivateKey
        )

        expect(isOwner).toBe(true)
      })

      it('should reject wrong viewing key', () => {
        const stealth = getStealthComponents(stealthResult)
        const wrongViewingKey = `0x${bytesToHex(randomBytes(32))}` as HexString

        const isOwner = scanner.verifyStealthAddressOwnership(
          stealth.address,
          stealth.ephemeralPublicKey,
          stealth.viewTag,
          wrongViewingKey,
          metaAddress.spendingPrivateKey
        )

        expect(isOwner).toBe(false)
      })

      it('should reject wrong spending key', () => {
        const stealth = getStealthComponents(stealthResult)
        const wrongSpendingKey = `0x${bytesToHex(randomBytes(32))}` as HexString

        const isOwner = scanner.verifyStealthAddressOwnership(
          stealth.address,
          stealth.ephemeralPublicKey,
          stealth.viewTag,
          metaAddress.viewingPrivateKey,
          wrongSpendingKey
        )

        expect(isOwner).toBe(false)
      })

      it('should work with implicit account format', () => {
        const stealth = getStealthComponents(stealthResult)
        const implicitAccount = ed25519PublicKeyToImplicitAccount(stealth.address)

        const isOwner = scanner.verifyStealthAddressOwnership(
          implicitAccount,
          stealth.ephemeralPublicKey,
          stealth.viewTag,
          metaAddress.viewingPrivateKey,
          metaAddress.spendingPrivateKey
        )

        expect(isOwner).toBe(true)
      })
    })

    describe('batchCheckAnnouncements', () => {
      let scanner: NEARStealthScanner

      beforeEach(() => {
        scanner = createNEARStealthScanner({
          rpcUrl: 'https://rpc.mainnet.near.org',
        })
      })

      it('should batch check multiple announcements', () => {
        scanner.addRecipient(testRecipient)

        // Generate another stealth address
        const stealthResult2 = generateNEARStealthAddress(metaAddress.metaAddress)
        const stealth2 = getStealthComponents(stealthResult2)
        const stealthAccountId2 = ed25519PublicKeyToImplicitAccount(stealth2.address)

        const announcements: NEARAnnouncement[] = [
          testAnnouncement,
          {
            ephemeralPublicKey: stealth2.ephemeralPublicKey,
            viewTag: stealth2.viewTag,
            stealthAddress: stealth2.address,
            stealthAccountId: stealthAccountId2,
          },
        ]

        const matches = scanner.batchCheckAnnouncements(announcements)

        expect(matches.size).toBe(2)
        expect(matches.get(testAnnouncement.stealthAddress)).toBe('Test Recipient')
      })

      it('should return empty map for no matches', () => {
        const otherMeta = generateNEARStealthMetaAddress('Other')
        scanner.addRecipient({
          viewingPrivateKey: otherMeta.viewingPrivateKey,
          spendingPrivateKey: otherMeta.spendingPrivateKey,
        })

        const matches = scanner.batchCheckAnnouncements([testAnnouncement])
        expect(matches.size).toBe(0)
      })
    })

    describe('parseAnnouncementsFromLogs', () => {
      let scanner: NEARStealthScanner

      beforeEach(() => {
        scanner = createNEARStealthScanner({
          rpcUrl: 'https://rpc.mainnet.near.org',
        })
      })

      it('should parse valid SIP announcements from logs', () => {
        const stealth = getStealthComponents(stealthResult)
        const ephemeralKeyHex = stealth.ephemeralPublicKey.slice(2)
        const viewTagHex = stealth.viewTag.toString(16).padStart(2, '0')
        const logs = [
          `SIP:1:${ephemeralKeyHex}:${viewTagHex}`,
          'Some other log',
          'Not a SIP announcement',
        ]

        const announcements = scanner.parseAnnouncementsFromLogs(logs)

        expect(announcements).toHaveLength(1)
        expect(announcements[0].ephemeralPublicKey).toBe(stealth.ephemeralPublicKey)
        expect(announcements[0].viewTag).toBe(stealth.viewTag)
      })

      it('should skip invalid logs', () => {
        const logs = [
          'Not SIP:1:abc:ff',
          'SIP:1:tooshort:ff',
          '',
        ]

        const announcements = scanner.parseAnnouncementsFromLogs(logs)
        expect(announcements).toHaveLength(0)
      })
    })

    describe('cache management', () => {
      let scanner: NEARStealthScanner

      beforeEach(() => {
        scanner = createNEARStealthScanner({
          rpcUrl: 'https://rpc.mainnet.near.org',
        })
      })

      it('should enable and disable cache', () => {
        expect(scanner.getCache()).toBeNull()

        scanner.enableCache()
        expect(scanner.getCache()).not.toBeNull()

        scanner.disableCache()
        expect(scanner.getCache()).toBeNull()
      })

      it('should accept custom cache', () => {
        const customCache = createNEARAnnouncementCache()
        scanner.enableCache(customCache)

        expect(scanner.getCache()).toBe(customCache)
      })
    })
  })

  describe('NEARAnnouncementCache', () => {
    let cache: NEARAnnouncementCache

    beforeEach(() => {
      cache = createNEARAnnouncementCache()
    })

    it('should add and retrieve entries', () => {
      const entry = {
        announcement: testAnnouncement,
        txHash: 'tx123',
        blockHeight: 100,
        timestamp: Date.now(),
      }

      cache.add([entry])
      const retrieved = cache.get(0, 200)

      expect(retrieved).toHaveLength(1)
      expect(retrieved[0].txHash).toBe('tx123')
    })

    it('should filter by block range', () => {
      cache.add([
        { announcement: testAnnouncement, txHash: 'tx1', blockHeight: 50, timestamp: 0 },
        { announcement: testAnnouncement, txHash: 'tx2', blockHeight: 150, timestamp: 0 },
        { announcement: testAnnouncement, txHash: 'tx3', blockHeight: 250, timestamp: 0 },
      ])

      const inRange = cache.get(100, 200)
      expect(inRange).toHaveLength(1)
      expect(inRange[0].txHash).toBe('tx2')
    })

    it('should track highest block', () => {
      expect(cache.getHighestBlock()).toBeNull()

      cache.add([
        { announcement: testAnnouncement, txHash: 'tx1', blockHeight: 100, timestamp: 0 },
        { announcement: testAnnouncement, txHash: 'tx2', blockHeight: 50, timestamp: 0 },
      ])

      expect(cache.getHighestBlock()).toBe(100)
    })

    it('should clear from block height', () => {
      cache.add([
        { announcement: testAnnouncement, txHash: 'tx1', blockHeight: 50, timestamp: 0 },
        { announcement: testAnnouncement, txHash: 'tx2', blockHeight: 100, timestamp: 0 },
        { announcement: testAnnouncement, txHash: 'tx3', blockHeight: 150, timestamp: 0 },
      ])

      cache.clearFrom(100)
      expect(cache.size()).toBe(1)
      expect(cache.getHighestBlock()).toBe(50)
    })

    it('should avoid duplicates', () => {
      const entry = {
        announcement: testAnnouncement,
        txHash: 'tx123',
        blockHeight: 100,
        timestamp: Date.now(),
      }

      cache.add([entry])
      cache.add([entry])

      expect(cache.size()).toBe(1)
    })
  })

  describe('Utility Functions', () => {
    describe('batchScanNEARAnnouncements', () => {
      it('should group payments by recipient', async () => {
        const meta1 = generateNEARStealthMetaAddress('Wallet 1')
        const meta2 = generateNEARStealthMetaAddress('Wallet 2')

        // Create stealth addresses for each
        const stealth1Result = generateNEARStealthAddress(meta1.metaAddress)
        const stealth2Result = generateNEARStealthAddress(meta2.metaAddress)
        const stealth1 = {
          address: stealth1Result.stealthAddress.address,
          ephemeralPublicKey: stealth1Result.stealthAddress.ephemeralPublicKey,
          viewTag: stealth1Result.stealthAddress.viewTag,
        }
        const stealth2 = {
          address: stealth2Result.stealthAddress.address,
          ephemeralPublicKey: stealth2Result.stealthAddress.ephemeralPublicKey,
          viewTag: stealth2Result.stealthAddress.viewTag,
        }

        const recipients: NEARScanRecipient[] = [
          { viewingPrivateKey: meta1.viewingPrivateKey, spendingPrivateKey: meta1.spendingPrivateKey, label: 'Wallet 1' },
          { viewingPrivateKey: meta2.viewingPrivateKey, spendingPrivateKey: meta2.spendingPrivateKey, label: 'Wallet 2' },
        ]

        const announcements: NEARAnnouncement[] = [
          {
            ephemeralPublicKey: stealth1.ephemeralPublicKey,
            viewTag: stealth1.viewTag,
            stealthAddress: stealth1.address,
            stealthAccountId: ed25519PublicKeyToImplicitAccount(stealth1.address),
          },
          {
            ephemeralPublicKey: stealth2.ephemeralPublicKey,
            viewTag: stealth2.viewTag,
            stealthAddress: stealth2.address,
            stealthAccountId: ed25519PublicKeyToImplicitAccount(stealth2.address),
          },
        ]

        const results = await batchScanNEARAnnouncements(
          { rpcUrl: 'https://rpc.mainnet.near.org' },
          recipients,
          announcements
        )

        expect(results['Wallet 1']).toHaveLength(1)
        expect(results['Wallet 2']).toHaveLength(1)
      })
    })

    describe('hasNEARAnnouncementMatch', () => {
      it('should return true for matching announcement', () => {
        const hasMatch = hasNEARAnnouncementMatch(
          [testRecipient],
          [testAnnouncement]
        )

        expect(hasMatch).toBe(true)
      })

      it('should return false for no matches', () => {
        const otherMeta = generateNEARStealthMetaAddress('Other')

        const hasMatch = hasNEARAnnouncementMatch(
          [
            {
              viewingPrivateKey: otherMeta.viewingPrivateKey,
              spendingPrivateKey: otherMeta.spendingPrivateKey,
            },
          ],
          [testAnnouncement]
        )

        expect(hasMatch).toBe(false)
      })

      it('should short-circuit on first match', () => {
        // Generate many announcements
        const announcements: NEARAnnouncement[] = []
        for (let i = 0; i < 10; i++) {
          const stealthRes = generateNEARStealthAddress(metaAddress.metaAddress)
          const stealth = {
            address: stealthRes.stealthAddress.address,
            ephemeralPublicKey: stealthRes.stealthAddress.ephemeralPublicKey,
            viewTag: stealthRes.stealthAddress.viewTag,
          }
          announcements.push({
            ephemeralPublicKey: stealth.ephemeralPublicKey,
            viewTag: stealth.viewTag,
            stealthAddress: stealth.address,
            stealthAccountId: ed25519PublicKeyToImplicitAccount(stealth.address),
          })
        }

        // First announcement matches
        const hasMatch = hasNEARAnnouncementMatch([testRecipient], announcements)
        expect(hasMatch).toBe(true)
      })
    })
  })

  describe('Integration', () => {
    it('should complete full scan workflow', async () => {
      // 1. Create scanner
      const scanner = createNEARStealthScanner({
        rpcUrl: 'https://rpc.mainnet.near.org',
      })

      // 2. Enable caching
      scanner.enableCache()

      // 3. Add recipient
      scanner.addRecipient(testRecipient)

      // 4. Simulate log parsing
      const stealth = getStealthComponents(stealthResult)
      const ephemeralKeyHex = stealth.ephemeralPublicKey.slice(2)
      const viewTagHex = stealth.viewTag.toString(16).padStart(2, '0')
      const logs = [`SIP:1:${ephemeralKeyHex}:${viewTagHex}`]

      const parsedAnnouncements = scanner.parseAnnouncementsFromLogs(logs)
      expect(parsedAnnouncements).toHaveLength(1)

      // 5. Add stealth address info (would come from transaction data)
      const fullAnnouncements: NEARAnnouncement[] = parsedAnnouncements.map((a) => ({
        ...a,
        stealthAddress: stealth.address,
        stealthAccountId: ed25519PublicKeyToImplicitAccount(stealth.address),
      }))

      // 6. Scan for payments
      const payments = await scanner.scanAnnouncements(fullAnnouncements, [
        {
          txHash: 'test-tx-hash',
          blockHeight: 12345,
          timestamp: Date.now(),
          amount: 5_000_000_000_000_000_000_000_000n, // 5 NEAR
        },
      ])

      expect(payments).toHaveLength(1)
      expect(payments[0].amount).toBe(5_000_000_000_000_000_000_000_000n)
      expect(payments[0].recipientLabel).toBe('Test Recipient')

      // 7. Verify ownership directly
      const isOwner = scanner.verifyStealthAddressOwnership(
        payments[0].stealthAddress,
        payments[0].ephemeralPublicKey,
        payments[0].viewTag,
        testRecipient.viewingPrivateKey,
        testRecipient.spendingPrivateKey
      )
      expect(isOwner).toBe(true)
    })
  })
})
