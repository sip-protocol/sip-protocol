/**
 * Cosmos IBC Stealth Transfer Tests
 *
 * Comprehensive tests for IBC stealth transfers with privacy across Cosmos chains.
 */

import { describe, it, expect } from 'vitest'
import { hexToBytes, bytesToHex } from '@noble/hashes/utils'
import { secp256k1 } from '@noble/curves/secp256k1'
import {
  CosmosIBCStealthService,
  createStealthIBCTransfer,
  buildIBCMsgTransfer,
  scanIBCTransfers,
  getIBCChannel,
  IBC_CHANNELS,
  type CosmosChainId,
  type StealthIBCTransferParams,
  type IncomingIBCTransfer,
} from '../../src/cosmos/ibc-stealth'
import { CosmosStealthService } from '../../src/cosmos/stealth'
import type { HexString } from '@sip-protocol/types'

describe('Cosmos IBC Stealth Transfers', () => {
  const ibcService = new CosmosIBCStealthService()
  const stealthService = new CosmosStealthService()

  // Test chain pairs
  const chainPairs: Array<[CosmosChainId, CosmosChainId]> = [
    ['cosmos', 'osmosis'],
    ['osmosis', 'cosmos'],
    ['cosmos', 'injective'],
    ['osmosis', 'injective'],
    ['cosmos', 'celestia'],
    ['osmosis', 'celestia'],
    ['injective', 'celestia'],
  ]

  describe('CosmosIBCStealthService - createStealthIBCTransfer()', () => {
    it('should create stealth IBC transfer between chains', () => {
      for (const [sourceChain, destChain] of chainPairs) {
        // Generate recipient meta-address
        const recipient = stealthService.generateStealthMetaAddress(destChain)

        // Create stealth IBC transfer
        const transfer = ibcService.createStealthIBCTransfer({
          sourceChain,
          destChain,
          recipientMetaAddress: recipient.metaAddress,
          amount: 1000000n,
          denom: 'uatom',
        })

        expect(transfer.sourceChain).toBe(sourceChain)
        expect(transfer.destChain).toBe(destChain)
        expect(transfer.stealthAddress).toBeDefined()
        expect(transfer.stealthPublicKey).toBeDefined()
        expect(transfer.ephemeralPublicKey).toBeDefined()
        expect(transfer.viewTag).toBeGreaterThanOrEqual(0)
        expect(transfer.viewTag).toBeLessThanOrEqual(255)
        expect(transfer.amount).toBe(1000000n)
        expect(transfer.denom).toBe('uatom')
        expect(transfer.ibcChannel).toBeDefined()
        expect(transfer.memo).toBeDefined()

        // Verify memo contains SIP metadata
        expect(transfer.memo).toContain('"sip"')
        expect(transfer.memo).toContain('"ephemeralKey"')
        expect(transfer.memo).toContain('"viewTag"')
      }
    })

    it('should generate different stealth addresses each time', () => {
      const recipient = stealthService.generateStealthMetaAddress('cosmos')

      const transfer1 = ibcService.createStealthIBCTransfer({
        sourceChain: 'cosmos',
        destChain: 'osmosis',
        recipientMetaAddress: recipient.metaAddress,
        amount: 1000000n,
        denom: 'uatom',
      })

      const transfer2 = ibcService.createStealthIBCTransfer({
        sourceChain: 'cosmos',
        destChain: 'osmosis',
        recipientMetaAddress: recipient.metaAddress,
        amount: 1000000n,
        denom: 'uatom',
      })

      expect(transfer1.stealthAddress).not.toBe(transfer2.stealthAddress)
      expect(transfer1.ephemeralPublicKey).not.toBe(transfer2.ephemeralPublicKey)
    })

    it('should accept meta-address as string format', () => {
      const recipient = stealthService.generateStealthMetaAddress('cosmos')

      // Format: sip:chain:spendingKey:viewingKey
      const metaAddressString = `sip:cosmos:${recipient.metaAddress.spendingKey}:${recipient.metaAddress.viewingKey}`

      const transfer = ibcService.createStealthIBCTransfer({
        sourceChain: 'cosmos',
        destChain: 'osmosis',
        recipientMetaAddress: metaAddressString,
        amount: 1000000n,
        denom: 'uatom',
      })

      expect(transfer.stealthAddress).toBeDefined()
      expect(transfer.stealthAddress.startsWith('osmo1')).toBe(true)
    })

    it('should include custom memo in transfer', () => {
      const recipient = stealthService.generateStealthMetaAddress('cosmos')

      const transfer = ibcService.createStealthIBCTransfer({
        sourceChain: 'cosmos',
        destChain: 'osmosis',
        recipientMetaAddress: recipient.metaAddress,
        amount: 1000000n,
        denom: 'uatom',
        memo: 'Payment for services',
      })

      expect(transfer.memo).toContain('"note"')
      expect(transfer.memo).toContain('Payment for services')
      expect(transfer.memo).toContain('"sip"')
    })

    it('should throw error for same source and dest chains', () => {
      const recipient = stealthService.generateStealthMetaAddress('cosmos')

      expect(() => {
        ibcService.createStealthIBCTransfer({
          sourceChain: 'cosmos',
          destChain: 'cosmos',
          recipientMetaAddress: recipient.metaAddress,
          amount: 1000000n,
          denom: 'uatom',
        })
      }).toThrow(/source and destination chains must be different/)
    })

    it('should throw error for invalid amount', () => {
      const recipient = stealthService.generateStealthMetaAddress('cosmos')

      expect(() => {
        ibcService.createStealthIBCTransfer({
          sourceChain: 'cosmos',
          destChain: 'osmosis',
          recipientMetaAddress: recipient.metaAddress,
          amount: 0n,
          denom: 'uatom',
        })
      }).toThrow(/amount must be positive/)

      expect(() => {
        ibcService.createStealthIBCTransfer({
          sourceChain: 'cosmos',
          destChain: 'osmosis',
          recipientMetaAddress: recipient.metaAddress,
          amount: -1000n,
          denom: 'uatom',
        })
      }).toThrow(/amount must be positive/)
    })

    it('should throw error for empty denom', () => {
      const recipient = stealthService.generateStealthMetaAddress('cosmos')

      expect(() => {
        ibcService.createStealthIBCTransfer({
          sourceChain: 'cosmos',
          destChain: 'osmosis',
          recipientMetaAddress: recipient.metaAddress,
          amount: 1000000n,
          denom: '',
        })
      }).toThrow(/denom cannot be empty/)
    })

    it('should throw error for invalid chain', () => {
      const recipient = stealthService.generateStealthMetaAddress('cosmos')

      expect(() => {
        ibcService.createStealthIBCTransfer({
          sourceChain: 'invalid-chain' as unknown as string,
          destChain: 'osmosis',
          recipientMetaAddress: recipient.metaAddress,
          amount: 1000000n,
          denom: 'uatom',
        })
      }).toThrow(/invalid Cosmos chain/)
    })

    it('should throw error for invalid meta-address string format', () => {
      expect(() => {
        ibcService.createStealthIBCTransfer({
          sourceChain: 'cosmos',
          destChain: 'osmosis',
          recipientMetaAddress: 'invalid-format',
          amount: 1000000n,
          denom: 'uatom',
        })
      }).toThrow(/invalid meta-address format/)
    })
  })

  describe('CosmosIBCStealthService - buildIBCMsgTransfer()', () => {
    it('should build valid IBC MsgTransfer', () => {
      const recipient = stealthService.generateStealthMetaAddress('osmosis')
      // Generate a real Cosmos sender address
      const senderMeta = stealthService.generateStealthMetaAddress('cosmos')
      const senderResult = stealthService.generateStealthAddressFromMeta(senderMeta.metaAddress, 'cosmos')
      const senderAddr = senderResult.stealthAddress

      const transfer = ibcService.createStealthIBCTransfer({
        sourceChain: 'cosmos',
        destChain: 'osmosis',
        recipientMetaAddress: recipient.metaAddress,
        amount: 5000000n,
        denom: 'uatom',
      })

      const msg = ibcService.buildIBCMsgTransfer(transfer, senderAddr)

      expect(msg.typeUrl).toBe('/ibc.applications.transfer.v1.MsgTransfer')
      expect(msg.value.sourcePort).toBe('transfer')
      expect(msg.value.sourceChannel).toBe('channel-141')
      expect(msg.value.token.denom).toBe('uatom')
      expect(msg.value.token.amount).toBe('5000000')
      expect(msg.value.sender).toBe(senderAddr)
      expect(msg.value.receiver).toBe(transfer.stealthAddress)
      expect(msg.value.memo).toBe(transfer.memo)
    })

    it('should include timeout height when provided', () => {
      const recipient = stealthService.generateStealthMetaAddress('osmosis')
      const senderMeta = stealthService.generateStealthMetaAddress('cosmos')
      const senderAddr = stealthService.generateStealthAddressFromMeta(senderMeta.metaAddress, 'cosmos').stealthAddress

      const transfer = ibcService.createStealthIBCTransfer({
        sourceChain: 'cosmos',
        destChain: 'osmosis',
        recipientMetaAddress: recipient.metaAddress,
        amount: 1000000n,
        denom: 'uatom',
      })

      const msg = ibcService.buildIBCMsgTransfer(
        transfer,
        senderAddr,
        { revisionNumber: 1n, revisionHeight: 1000000n }
      )

      expect(msg.value.timeoutHeight).toBeDefined()
      expect(msg.value.timeoutHeight?.revisionNumber).toBe('1')
      expect(msg.value.timeoutHeight?.revisionHeight).toBe('1000000')
    })

    it('should include timeout timestamp when provided', () => {
      const recipient = stealthService.generateStealthMetaAddress('osmosis')
      const senderMeta = stealthService.generateStealthMetaAddress('cosmos')
      const senderAddr = stealthService.generateStealthAddressFromMeta(senderMeta.metaAddress, 'cosmos').stealthAddress

      const transfer = ibcService.createStealthIBCTransfer({
        sourceChain: 'cosmos',
        destChain: 'osmosis',
        recipientMetaAddress: recipient.metaAddress,
        amount: 1000000n,
        denom: 'uatom',
      })

      const timeoutNanos = BigInt(Date.now() + 600000) * 1_000_000n // 10 min from now

      const msg = ibcService.buildIBCMsgTransfer(
        transfer,
        senderAddr,
        undefined,
        timeoutNanos
      )

      expect(msg.value.timeoutTimestamp).toBeDefined()
      expect(msg.value.timeoutTimestamp).toBe(timeoutNanos.toString())
    })

    it('should throw error for invalid sender address', () => {
      const recipient = stealthService.generateStealthMetaAddress('osmosis')
      const transfer = ibcService.createStealthIBCTransfer({
        sourceChain: 'cosmos',
        destChain: 'osmosis',
        recipientMetaAddress: recipient.metaAddress,
        amount: 1000000n,
        denom: 'uatom',
      })

      expect(() => {
        ibcService.buildIBCMsgTransfer(transfer, 'invalid-address')
      }).toThrow(/invalid sender address/)

      expect(() => {
        ibcService.buildIBCMsgTransfer(transfer, 'osmo1wrongchain')
      }).toThrow(/invalid sender address/)
    })
  })

  describe('CosmosIBCStealthService - scanIBCTransfers()', () => {
    it('should detect stealth transfers for recipient', () => {
      // 1. Recipient generates meta-address
      const recipient = stealthService.generateStealthMetaAddress('osmosis')

      // 2. Sender creates stealth transfer
      const transfer = ibcService.createStealthIBCTransfer({
        sourceChain: 'cosmos',
        destChain: 'osmosis',
        recipientMetaAddress: recipient.metaAddress,
        amount: 1000000n,
        denom: 'uatom',
      })

      // 3. Simulate incoming IBC transfer
      const incomingTransfer: IncomingIBCTransfer = {
        id: 'ibc-tx-1',
        sender: 'cosmos1sender',
        receiver: transfer.stealthAddress,
        amount: 1000000n,
        denom: 'uatom',
        memo: transfer.memo,
        sourceChain: 'cosmos',
        destChain: 'osmosis',
        height: 12345n,
        timestamp: BigInt(Date.now()),
      }

      // 4. Recipient scans for transfers
      const viewingKey = hexToBytes(recipient.viewingPrivateKey.slice(2))
      const spendingPubKey = hexToBytes(recipient.metaAddress.spendingKey.slice(2))

      const received = ibcService.scanIBCTransfers(
        viewingKey,
        spendingPubKey,
        recipient.spendingPrivateKey,
        [incomingTransfer]
      )

      expect(received.length).toBe(1)
      expect(received[0].id).toBe('ibc-tx-1')
      expect(received[0].sourceChain).toBe('cosmos')
      expect(received[0].destChain).toBe('osmosis')
      expect(received[0].stealthAddress).toBe(transfer.stealthAddress)
      expect(received[0].amount).toBe(1000000n)
      expect(received[0].denom).toBe('uatom')
      expect(received[0].ephemeralPublicKey).toBe(transfer.ephemeralPublicKey)
      expect(received[0].viewTag).toBe(transfer.viewTag)
      expect(received[0].privateKey).toBeDefined()

      // 5. Verify derived private key is correct
      const derivedPubKey = secp256k1.getPublicKey(
        hexToBytes(received[0].privateKey.slice(2)),
        true
      )
      expect(`0x${bytesToHex(derivedPubKey)}`).toBe(transfer.stealthPublicKey)
    })

    it('should scan multiple transfers and find matches', () => {
      const recipient = stealthService.generateStealthMetaAddress('osmosis')

      // Create 3 transfers, 2 for recipient, 1 for someone else
      const transfer1 = ibcService.createStealthIBCTransfer({
        sourceChain: 'cosmos',
        destChain: 'osmosis',
        recipientMetaAddress: recipient.metaAddress,
        amount: 1000000n,
        denom: 'uatom',
      })

      const transfer2 = ibcService.createStealthIBCTransfer({
        sourceChain: 'cosmos',
        destChain: 'osmosis',
        recipientMetaAddress: recipient.metaAddress,
        amount: 2000000n,
        denom: 'uosmo',
      })

      // Different recipient
      const otherRecipient = stealthService.generateStealthMetaAddress('osmosis')
      const transfer3 = ibcService.createStealthIBCTransfer({
        sourceChain: 'cosmos',
        destChain: 'osmosis',
        recipientMetaAddress: otherRecipient.metaAddress,
        amount: 3000000n,
        denom: 'uatom',
      })

      const incomingTransfers: IncomingIBCTransfer[] = [
        {
          id: 'ibc-tx-1',
          sender: 'cosmos1sender',
          receiver: transfer1.stealthAddress,
          amount: 1000000n,
          denom: 'uatom',
          memo: transfer1.memo,
          sourceChain: 'cosmos',
          destChain: 'osmosis',
          height: 12345n,
          timestamp: BigInt(Date.now()),
        },
        {
          id: 'ibc-tx-2',
          sender: 'cosmos1sender',
          receiver: transfer2.stealthAddress,
          amount: 2000000n,
          denom: 'uosmo',
          memo: transfer2.memo,
          sourceChain: 'cosmos',
          destChain: 'osmosis',
          height: 12346n,
          timestamp: BigInt(Date.now()),
        },
        {
          id: 'ibc-tx-3',
          sender: 'cosmos1sender',
          receiver: transfer3.stealthAddress,
          amount: 3000000n,
          denom: 'uatom',
          memo: transfer3.memo,
          sourceChain: 'cosmos',
          destChain: 'osmosis',
          height: 12347n,
          timestamp: BigInt(Date.now()),
        },
      ]

      const viewingKey = hexToBytes(recipient.viewingPrivateKey.slice(2))
      const spendingPubKey = hexToBytes(recipient.metaAddress.spendingKey.slice(2))

      const received = ibcService.scanIBCTransfers(
        viewingKey,
        spendingPubKey,
        recipient.spendingPrivateKey,
        incomingTransfers
      )

      // Should find only 2 transfers for recipient
      expect(received.length).toBe(2)
      expect(received.map(r => r.id).sort()).toEqual(['ibc-tx-1', 'ibc-tx-2'])
    })

    it('should skip non-SIP transfers', () => {
      const recipient = stealthService.generateStealthMetaAddress('osmosis')

      const incomingTransfers: IncomingIBCTransfer[] = [
        {
          id: 'normal-tx-1',
          sender: 'cosmos1sender',
          receiver: 'osmo1receiver',
          amount: 1000000n,
          denom: 'uatom',
          memo: 'Regular transfer', // No SIP metadata
          sourceChain: 'cosmos',
          destChain: 'osmosis',
          height: 12345n,
          timestamp: BigInt(Date.now()),
        },
        {
          id: 'normal-tx-2',
          sender: 'cosmos1sender',
          receiver: 'osmo1receiver2',
          amount: 2000000n,
          denom: 'uosmo',
          memo: '', // Empty memo
          sourceChain: 'cosmos',
          destChain: 'osmosis',
          height: 12346n,
          timestamp: BigInt(Date.now()),
        },
      ]

      const viewingKey = hexToBytes(recipient.viewingPrivateKey.slice(2))
      const spendingPubKey = hexToBytes(recipient.metaAddress.spendingKey.slice(2))

      const received = ibcService.scanIBCTransfers(
        viewingKey,
        spendingPubKey,
        recipient.spendingPrivateKey,
        incomingTransfers
      )

      expect(received.length).toBe(0)
    })

    it('should skip transfers with invalid SIP memo', () => {
      const recipient = stealthService.generateStealthMetaAddress('osmosis')

      const incomingTransfers: IncomingIBCTransfer[] = [
        {
          id: 'invalid-tx-1',
          sender: 'cosmos1sender',
          receiver: 'osmo1receiver',
          amount: 1000000n,
          denom: 'uatom',
          memo: '{"sip": "invalid"}', // Invalid SIP structure
          sourceChain: 'cosmos',
          destChain: 'osmosis',
          height: 12345n,
          timestamp: BigInt(Date.now()),
        },
        {
          id: 'invalid-tx-2',
          sender: 'cosmos1sender',
          receiver: 'osmo1receiver2',
          amount: 2000000n,
          denom: 'uosmo',
          memo: '{"sip": {"version": 1}}', // Missing fields
          sourceChain: 'cosmos',
          destChain: 'osmosis',
          height: 12346n,
          timestamp: BigInt(Date.now()),
        },
      ]

      const viewingKey = hexToBytes(recipient.viewingPrivateKey.slice(2))
      const spendingPubKey = hexToBytes(recipient.metaAddress.spendingKey.slice(2))

      const received = ibcService.scanIBCTransfers(
        viewingKey,
        spendingPubKey,
        recipient.spendingPrivateKey,
        incomingTransfers
      )

      expect(received.length).toBe(0)
    })
  })

  describe('CosmosIBCStealthService - getIBCChannel()', () => {
    it('should return correct channel for all supported chain pairs', () => {
      for (const [sourceChain, destChain] of chainPairs) {
        const channel = ibcService.getIBCChannel(sourceChain, destChain)

        expect(channel).toBeDefined()
        expect(channel.sourceChannel).toBeDefined()
        expect(channel.destChannel).toBeDefined()
        expect(channel.portId).toBe('transfer')
      }
    })

    it('should return correct Cosmos→Osmosis channel', () => {
      const channel = ibcService.getIBCChannel('cosmos', 'osmosis')

      expect(channel.sourceChannel).toBe('channel-141')
      expect(channel.destChannel).toBe('channel-0')
      expect(channel.portId).toBe('transfer')
    })

    it('should return correct Osmosis→Cosmos channel (reverse)', () => {
      const channel = ibcService.getIBCChannel('osmosis', 'cosmos')

      expect(channel.sourceChannel).toBe('channel-0')
      expect(channel.destChannel).toBe('channel-141')
      expect(channel.portId).toBe('transfer')
    })

    it('should throw error for unsupported chain pair', () => {
      expect(() => {
        ibcService.getIBCChannel('sei', 'dydx' as unknown as string)
      }).toThrow(/no IBC channel configured/)
    })
  })

  describe('CosmosIBCStealthService - memo utilities', () => {
    it('should validate SIP memo', () => {
      const validMemo = JSON.stringify({
        sip: {
          version: 1,
          ephemeralKey: '0x02abc123def456789abc123def456789abc123def456789abc123def456789abc1',
          viewTag: 42,
        },
      })

      expect(ibcService.isSIPMemo(validMemo)).toBe(true)
    })

    it('should reject invalid SIP memos', () => {
      const invalidMemos = [
        'Regular memo',
        '{}',
        '{"sip": "invalid"}',
        '{"sip": {"version": 1}}', // Missing fields
        JSON.stringify({ sip: { version: 1, ephemeralKey: 'invalid', viewTag: 42 } }), // Invalid key format
        JSON.stringify({ sip: { version: 1, ephemeralKey: '0x02abc', viewTag: 300 } }), // View tag out of range
      ]

      for (const memo of invalidMemos) {
        expect(ibcService.isSIPMemo(memo)).toBe(false)
      }
    })

    it('should extract custom note from memo', () => {
      const memoWithNote = JSON.stringify({
        sip: {
          version: 1,
          ephemeralKey: '0x02abc123def456789abc123def456789abc123def456789abc123def456789abc1',
          viewTag: 42,
        },
        note: 'Payment for services',
      })

      const note = ibcService.extractCustomNote(memoWithNote)
      expect(note).toBe('Payment for services')
    })

    it('should return undefined for memo without custom note', () => {
      const memoWithoutNote = JSON.stringify({
        sip: {
          version: 1,
          ephemeralKey: '0x02abc123def456789abc123def456789abc123def456789abc123def456789abc1',
          viewTag: 42,
        },
      })

      const note = ibcService.extractCustomNote(memoWithoutNote)
      expect(note).toBeUndefined()
    })
  })

  describe('IBC_CHANNELS constant', () => {
    it('should have all required chain pairs', () => {
      const requiredPairs = [
        'cosmos-osmosis',
        'osmosis-cosmos',
        'cosmos-injective',
        'injective-cosmos',
        'cosmos-celestia',
        'celestia-cosmos',
        'osmosis-injective',
        'injective-osmosis',
        'osmosis-celestia',
        'celestia-osmosis',
        'injective-celestia',
        'celestia-injective',
      ]

      for (const pair of requiredPairs) {
        expect(IBC_CHANNELS[pair]).toBeDefined()
      }
    })

    it('should have valid channel IDs', () => {
      for (const [key, channel] of Object.entries(IBC_CHANNELS)) {
        expect(channel.sourceChannel).toMatch(/^channel-\d+$/)
        expect(channel.destChannel).toMatch(/^channel-\d+$/)
        expect(channel.portId).toBe('transfer')
      }
    })
  })

  describe('Standalone Functions', () => {
    it('createStealthIBCTransfer() should work', () => {
      const recipient = stealthService.generateStealthMetaAddress('osmosis')

      const transfer = createStealthIBCTransfer({
        sourceChain: 'cosmos',
        destChain: 'osmosis',
        recipientMetaAddress: recipient.metaAddress,
        amount: 1000000n,
        denom: 'uatom',
      })

      expect(transfer.stealthAddress).toBeDefined()
      expect(transfer.stealthAddress.startsWith('osmo1')).toBe(true)
    })

    it('buildIBCMsgTransfer() should work', () => {
      const recipient = stealthService.generateStealthMetaAddress('osmosis')
      const senderMeta = stealthService.generateStealthMetaAddress('cosmos')
      const senderAddr = stealthService.generateStealthAddressFromMeta(senderMeta.metaAddress, 'cosmos').stealthAddress

      const transfer = createStealthIBCTransfer({
        sourceChain: 'cosmos',
        destChain: 'osmosis',
        recipientMetaAddress: recipient.metaAddress,
        amount: 1000000n,
        denom: 'uatom',
      })

      const msg = buildIBCMsgTransfer(transfer, senderAddr)

      expect(msg.typeUrl).toBe('/ibc.applications.transfer.v1.MsgTransfer')
      expect(msg.value.sender).toBe(senderAddr)
      expect(msg.value.receiver).toBe(transfer.stealthAddress)
    })

    it('scanIBCTransfers() should work', () => {
      const recipient = stealthService.generateStealthMetaAddress('osmosis')
      const transfer = createStealthIBCTransfer({
        sourceChain: 'cosmos',
        destChain: 'osmosis',
        recipientMetaAddress: recipient.metaAddress,
        amount: 1000000n,
        denom: 'uatom',
      })

      const incomingTransfers: IncomingIBCTransfer[] = [
        {
          id: 'ibc-tx-1',
          sender: 'cosmos1sender',
          receiver: transfer.stealthAddress,
          amount: 1000000n,
          denom: 'uatom',
          memo: transfer.memo,
          sourceChain: 'cosmos',
          destChain: 'osmosis',
          height: 12345n,
          timestamp: BigInt(Date.now()),
        },
      ]

      const viewingKey = hexToBytes(recipient.viewingPrivateKey.slice(2))
      const spendingPubKey = hexToBytes(recipient.metaAddress.spendingKey.slice(2))

      const received = scanIBCTransfers(
        viewingKey,
        spendingPubKey,
        recipient.spendingPrivateKey,
        incomingTransfers
      )

      expect(received.length).toBe(1)
      expect(received[0].stealthAddress).toBe(transfer.stealthAddress)
    })

    it('getIBCChannel() should work', () => {
      const channel = getIBCChannel('cosmos', 'osmosis')

      expect(channel.sourceChannel).toBe('channel-141')
      expect(channel.destChannel).toBe('channel-0')
    })
  })

  describe('End-to-end IBC stealth flow', () => {
    it('should complete full cross-chain stealth transfer', () => {
      // 1. Recipient generates meta-address for Osmosis
      const recipient = stealthService.generateStealthMetaAddress('osmosis', 'Recipient Wallet')

      // 2. Sender creates stealth IBC transfer from Cosmos to Osmosis
      const transfer = ibcService.createStealthIBCTransfer({
        sourceChain: 'cosmos',
        destChain: 'osmosis',
        recipientMetaAddress: recipient.metaAddress,
        amount: 5000000n, // 5 ATOM
        denom: 'uatom',
        memo: 'Payment for consulting services',
      })

      expect(transfer.stealthAddress.startsWith('osmo1')).toBe(true)
      expect(transfer.memo).toContain('Payment for consulting services')

      // 3. Sender builds and broadcasts IBC MsgTransfer
      const senderMeta = stealthService.generateStealthMetaAddress('cosmos')
      const senderAddr = stealthService.generateStealthAddressFromMeta(senderMeta.metaAddress, 'cosmos').stealthAddress

      const msg = ibcService.buildIBCMsgTransfer(
        transfer,
        senderAddr,
        undefined,
        BigInt(Date.now() + 600000) * 1_000_000n // 10 min timeout
      )

      expect(msg.typeUrl).toBe('/ibc.applications.transfer.v1.MsgTransfer')
      expect(msg.value.token.amount).toBe('5000000')
      expect(msg.value.receiver).toBe(transfer.stealthAddress)

      // 4. Transfer completes, recipient scans for incoming transfers
      const incomingTransfer: IncomingIBCTransfer = {
        id: 'ibc-tx-abc123',
        sender: senderAddr,
        receiver: transfer.stealthAddress,
        amount: 5000000n,
        denom: 'uatom',
        memo: transfer.memo,
        sourceChain: 'cosmos',
        destChain: 'osmosis',
        height: 123456n,
        timestamp: BigInt(Date.now()),
      }

      const viewingKey = hexToBytes(recipient.viewingPrivateKey.slice(2))
      const spendingPubKey = hexToBytes(recipient.metaAddress.spendingKey.slice(2))

      const received = ibcService.scanIBCTransfers(
        viewingKey,
        spendingPubKey,
        recipient.spendingPrivateKey,
        [incomingTransfer]
      )

      expect(received.length).toBe(1)
      expect(received[0].amount).toBe(5000000n)
      expect(received[0].denom).toBe('uatom')

      // 5. Recipient uses derived private key to claim funds
      const derivedPubKey = secp256k1.getPublicKey(
        hexToBytes(received[0].privateKey.slice(2)),
        true
      )

      const claimAddress = stealthService.stealthKeyToCosmosAddress(derivedPubKey, 'osmo')

      expect(claimAddress).toBe(transfer.stealthAddress)
      expect(claimAddress).toBe(received[0].stealthAddress)

      // 6. Extract custom note
      const customNote = ibcService.extractCustomNote(transfer.memo)
      expect(customNote).toBe('Payment for consulting services')
    })

    it('should work for multiple chain pairs', () => {
      const testChains: Array<[CosmosChainId, CosmosChainId, string]> = [
        ['cosmos', 'osmosis', 'osmo1'],
        ['osmosis', 'injective', 'inj1'],
        ['cosmos', 'celestia', 'celestia1'],
        ['injective', 'osmosis', 'osmo1'],
      ]

      for (const [sourceChain, destChain, expectedPrefix] of testChains) {
        const recipient = stealthService.generateStealthMetaAddress(destChain)
        const senderMeta = stealthService.generateStealthMetaAddress(sourceChain)
        const senderAddr = stealthService.generateStealthAddressFromMeta(senderMeta.metaAddress, sourceChain).stealthAddress

        const transfer = ibcService.createStealthIBCTransfer({
          sourceChain,
          destChain,
          recipientMetaAddress: recipient.metaAddress,
          amount: 1000000n,
          denom: 'test',
        })

        expect(transfer.stealthAddress.startsWith(expectedPrefix)).toBe(true)

        const msg = ibcService.buildIBCMsgTransfer(
          transfer,
          senderAddr,
        )

        expect(msg.value.receiver).toBe(transfer.stealthAddress)

        // Verify scanning works
        const incomingTransfer: IncomingIBCTransfer = {
          id: `tx-${sourceChain}-${destChain}`,
          sender: senderAddr,
          receiver: transfer.stealthAddress,
          amount: 1000000n,
          denom: 'test',
          memo: transfer.memo,
          sourceChain,
          destChain,
          height: 12345n,
          timestamp: BigInt(Date.now()),
        }

        const viewingKey = hexToBytes(recipient.viewingPrivateKey.slice(2))
        const spendingPubKey = hexToBytes(recipient.metaAddress.spendingKey.slice(2))

        const received = ibcService.scanIBCTransfers(
          viewingKey,
          spendingPubKey,
          recipient.spendingPrivateKey,
          [incomingTransfer]
        )

        expect(received.length).toBe(1)
        expect(received[0].sourceChain).toBe(sourceChain)
        expect(received[0].destChain).toBe(destChain)
      }
    })
  })
})
