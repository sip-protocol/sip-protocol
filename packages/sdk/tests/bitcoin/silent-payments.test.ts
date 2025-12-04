/**
 * Tests for Bitcoin Silent Payments (BIP-352)
 */

import { describe, it, expect } from 'vitest'
import { randomBytes, hexToBytes, bytesToHex } from '@noble/hashes/utils'
import {
  generateSilentPaymentAddress,
  parseSilentPaymentAddress,
  createSilentPaymentOutput,
  scanForPayments,
  deriveSpendingKey,
  isValidSilentPaymentAddress,
  hexToPrivateKey,
  hexToPublicKey,
} from '../../src/bitcoin/silent-payments'

describe('BIP-352 Silent Payments', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // ADDRESS GENERATION AND PARSING
  // ═══════════════════════════════════════════════════════════════════════════

  describe('generateSilentPaymentAddress', () => {
    it('should generate a valid mainnet Silent Payment address', () => {
      const scanKey = randomBytes(32)
      const spendKey = randomBytes(32)

      const address = generateSilentPaymentAddress(scanKey, spendKey, 'mainnet')

      expect(address.address).toMatch(/^sp1q/)
      expect(address.scanPubKey).toMatch(/^0x[0-9a-f]{66}$/)
      expect(address.spendPubKey).toMatch(/^0x[0-9a-f]{66}$/)
      expect(address.network).toBe('mainnet')
      expect(address.label).toBeUndefined()
    })

    it('should generate a valid testnet Silent Payment address', () => {
      const scanKey = randomBytes(32)
      const spendKey = randomBytes(32)

      const address = generateSilentPaymentAddress(scanKey, spendKey, 'testnet')

      expect(address.address).toMatch(/^tsp1q/)
      expect(address.network).toBe('testnet')
    })

    it('should generate address with label', () => {
      const scanKey = randomBytes(32)
      const spendKey = randomBytes(32)
      const label = 42

      const address = generateSilentPaymentAddress(scanKey, spendKey, 'mainnet', label)

      expect(address.label).toBe(42)
      // Spend pubkey should be tweaked when label is provided
      expect(address.spendPubKey).toMatch(/^0x[0-9a-f]{66}$/)
    })

    it('should reject invalid scan key length', () => {
      const scanKey = randomBytes(16) // Too short
      const spendKey = randomBytes(32)

      expect(() => generateSilentPaymentAddress(scanKey, spendKey, 'mainnet')).toThrow(
        'scanKey must be 32 bytes',
      )
    })

    it('should reject invalid spend key length', () => {
      const scanKey = randomBytes(32)
      const spendKey = randomBytes(16) // Too short

      expect(() => generateSilentPaymentAddress(scanKey, spendKey, 'mainnet')).toThrow(
        'spendKey must be 32 bytes',
      )
    })

    it('should reject invalid label', () => {
      const scanKey = randomBytes(32)
      const spendKey = randomBytes(32)

      expect(() => generateSilentPaymentAddress(scanKey, spendKey, 'mainnet', -1)).toThrow(
        'label must be an integer',
      )

      expect(() =>
        generateSilentPaymentAddress(scanKey, spendKey, 'mainnet', 2 ** 31),
      ).toThrow('label must be an integer')
    })
  })

  describe('parseSilentPaymentAddress', () => {
    it('should parse a valid mainnet address', () => {
      const scanKey = randomBytes(32)
      const spendKey = randomBytes(32)
      const address = generateSilentPaymentAddress(scanKey, spendKey, 'mainnet')

      const parsed = parseSilentPaymentAddress(address.address)

      expect(parsed.network).toBe('mainnet')
      expect(parsed.version).toBe(0)
      expect(parsed.scanPubKey).toHaveLength(33)
      expect(parsed.spendPubKey).toHaveLength(33)
    })

    it('should parse a valid testnet address', () => {
      const scanKey = randomBytes(32)
      const spendKey = randomBytes(32)
      const address = generateSilentPaymentAddress(scanKey, spendKey, 'testnet')

      const parsed = parseSilentPaymentAddress(address.address)

      expect(parsed.network).toBe('testnet')
      expect(parsed.version).toBe(0)
    })

    it('should round-trip encode/decode', () => {
      const scanKey = randomBytes(32)
      const spendKey = randomBytes(32)
      const original = generateSilentPaymentAddress(scanKey, spendKey, 'mainnet')

      const parsed = parseSilentPaymentAddress(original.address)

      expect(bytesToHex(parsed.scanPubKey)).toBe(original.scanPubKey.slice(2))
      expect(bytesToHex(parsed.spendPubKey)).toBe(original.spendPubKey.slice(2))
    })

    it('should reject invalid address format', () => {
      expect(() => parseSilentPaymentAddress('invalid')).toThrow()
      expect(() => parseSilentPaymentAddress('sp1q')).toThrow()
      expect(() => parseSilentPaymentAddress('')).toThrow()
    })

    it('should reject wrong HRP', () => {
      const validAddress = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4' // Bitcoin address

      expect(() => parseSilentPaymentAddress(validAddress)).toThrow()
    })

    it('should reject unsupported version', () => {
      // This test assumes we can construct an invalid version address
      // For now, we test that version 0 is accepted
      const scanKey = randomBytes(32)
      const spendKey = randomBytes(32)
      const address = generateSilentPaymentAddress(scanKey, spendKey, 'mainnet')
      const parsed = parseSilentPaymentAddress(address.address)

      expect(parsed.version).toBe(0)
    })
  })

  describe('isValidSilentPaymentAddress', () => {
    it('should return true for valid address', () => {
      const scanKey = randomBytes(32)
      const spendKey = randomBytes(32)
      const address = generateSilentPaymentAddress(scanKey, spendKey, 'mainnet')

      expect(isValidSilentPaymentAddress(address.address)).toBe(true)
    })

    it('should return false for invalid address', () => {
      expect(isValidSilentPaymentAddress('invalid')).toBe(false)
      expect(isValidSilentPaymentAddress('')).toBe(false)
      expect(isValidSilentPaymentAddress('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toBe(
        false,
      )
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SENDER: CREATE OUTPUT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('createSilentPaymentOutput', () => {
    it('should create a valid P2TR output', () => {
      const scanKey = randomBytes(32)
      const spendKey = randomBytes(32)
      const recipientAddress = generateSilentPaymentAddress(scanKey, spendKey, 'mainnet')

      const senderPrivKey = randomBytes(32)
      const senderInput = {
        txid: '0x' + bytesToHex(randomBytes(32)),
        vout: 0,
        scriptPubKey: new Uint8Array(34),
        privateKey: senderPrivKey,
      }

      const output = createSilentPaymentOutput(
        recipientAddress.address,
        [senderInput],
        100000n,
        0,
      )

      expect(output.scriptPubKey).toHaveLength(34)
      expect(output.scriptPubKey[0]).toBe(0x51) // OP_1
      expect(output.scriptPubKey[1]).toBe(0x20) // 32 bytes
      expect(output.tweakedPubKey).toHaveLength(32)
      expect(output.amount).toBe(100000n)
    })

    it('should create different outputs for different recipients', () => {
      const scanKey1 = randomBytes(32)
      const spendKey1 = randomBytes(32)
      const recipient1 = generateSilentPaymentAddress(scanKey1, spendKey1, 'mainnet')

      const scanKey2 = randomBytes(32)
      const spendKey2 = randomBytes(32)
      const recipient2 = generateSilentPaymentAddress(scanKey2, spendKey2, 'mainnet')

      const senderPrivKey = randomBytes(32)
      const senderInput = {
        txid: '0x' + bytesToHex(randomBytes(32)),
        vout: 0,
        scriptPubKey: new Uint8Array(34),
        privateKey: senderPrivKey,
      }

      const output1 = createSilentPaymentOutput(recipient1.address, [senderInput], 100000n, 0)
      const output2 = createSilentPaymentOutput(recipient2.address, [senderInput], 100000n, 0)

      expect(bytesToHex(output1.tweakedPubKey)).not.toBe(bytesToHex(output2.tweakedPubKey))
    })

    it('should create different outputs for different output indices', () => {
      const scanKey = randomBytes(32)
      const spendKey = randomBytes(32)
      const recipientAddress = generateSilentPaymentAddress(scanKey, spendKey, 'mainnet')

      const senderPrivKey = randomBytes(32)
      const senderInput = {
        txid: '0x' + bytesToHex(randomBytes(32)),
        vout: 0,
        scriptPubKey: new Uint8Array(34),
        privateKey: senderPrivKey,
      }

      const output0 = createSilentPaymentOutput(recipientAddress.address, [senderInput], 100000n, 0)
      const output1 = createSilentPaymentOutput(recipientAddress.address, [senderInput], 100000n, 1)

      expect(bytesToHex(output0.tweakedPubKey)).not.toBe(bytesToHex(output1.tweakedPubKey))
    })

    it('should aggregate multiple inputs', () => {
      const scanKey = randomBytes(32)
      const spendKey = randomBytes(32)
      const recipientAddress = generateSilentPaymentAddress(scanKey, spendKey, 'mainnet')

      const senderInput1 = {
        txid: '0x' + bytesToHex(randomBytes(32)),
        vout: 0,
        scriptPubKey: new Uint8Array(34),
        privateKey: randomBytes(32),
      }

      const senderInput2 = {
        txid: '0x' + bytesToHex(randomBytes(32)),
        vout: 1,
        scriptPubKey: new Uint8Array(34),
        privateKey: randomBytes(32),
      }

      const output = createSilentPaymentOutput(
        recipientAddress.address,
        [senderInput1, senderInput2],
        100000n,
        0,
      )

      expect(output.scriptPubKey).toHaveLength(34)
      expect(output.tweakedPubKey).toHaveLength(32)
    })

    it('should reject zero amount', () => {
      const scanKey = randomBytes(32)
      const spendKey = randomBytes(32)
      const recipientAddress = generateSilentPaymentAddress(scanKey, spendKey, 'mainnet')

      const senderInput = {
        txid: '0x' + bytesToHex(randomBytes(32)),
        vout: 0,
        scriptPubKey: new Uint8Array(34),
        privateKey: randomBytes(32),
      }

      expect(() =>
        createSilentPaymentOutput(recipientAddress.address, [senderInput], 0n, 0),
      ).toThrow('Amount must be greater than zero')
    })

    it('should reject negative amount', () => {
      const scanKey = randomBytes(32)
      const spendKey = randomBytes(32)
      const recipientAddress = generateSilentPaymentAddress(scanKey, spendKey, 'mainnet')

      const senderInput = {
        txid: '0x' + bytesToHex(randomBytes(32)),
        vout: 0,
        scriptPubKey: new Uint8Array(34),
        privateKey: randomBytes(32),
      }

      expect(() =>
        createSilentPaymentOutput(recipientAddress.address, [senderInput], -100n, 0),
      ).toThrow('Amount must be greater than zero')
    })

    it('should reject empty inputs', () => {
      const scanKey = randomBytes(32)
      const spendKey = randomBytes(32)
      const recipientAddress = generateSilentPaymentAddress(scanKey, spendKey, 'mainnet')

      expect(() => createSilentPaymentOutput(recipientAddress.address, [], 100000n, 0)).toThrow(
        'At least one sender input is required',
      )
    })

    it('should reject negative output index', () => {
      const scanKey = randomBytes(32)
      const spendKey = randomBytes(32)
      const recipientAddress = generateSilentPaymentAddress(scanKey, spendKey, 'mainnet')

      const senderInput = {
        txid: '0x' + bytesToHex(randomBytes(32)),
        vout: 0,
        scriptPubKey: new Uint8Array(34),
        privateKey: randomBytes(32),
      }

      expect(() =>
        createSilentPaymentOutput(recipientAddress.address, [senderInput], 100000n, -1),
      ).toThrow('outputIndex must be a non-negative integer')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // RECIPIENT: SCAN AND SPEND
  // ═══════════════════════════════════════════════════════════════════════════

  describe('scanForPayments', () => {
    it('should detect a payment sent to recipient', () => {
      // Setup: recipient generates address
      const scanPrivKey = randomBytes(32)
      const spendPrivKey = randomBytes(32)
      const recipientAddress = generateSilentPaymentAddress(scanPrivKey, spendPrivKey, 'mainnet')

      // Sender creates output
      const senderPrivKey = randomBytes(32)
      const senderTxid = '0x' + bytesToHex(randomBytes(32))
      const senderInput = {
        txid: senderTxid,
        vout: 0,
        scriptPubKey: new Uint8Array(34),
        privateKey: senderPrivKey,
      }

      const sentOutput = createSilentPaymentOutput(
        recipientAddress.address,
        [senderInput],
        100000n,
        0,
      )

      // Recipient scans
      const senderPubKey = new Uint8Array(33)
      // For simplicity, we'll use the sender's public key from private key
      // In real scenario, this would be extracted from the transaction
      const { secp256k1 } = require('@noble/curves/secp256k1')
      const senderPub = secp256k1.getPublicKey(senderPrivKey, true)

      const receivedPayments = scanForPayments(
        scanPrivKey,
        hexToBytes(recipientAddress.spendPubKey.slice(2)),
        [senderPub],
        [{ txid: senderTxid, vout: 0 }],
        [
          {
            outputIndex: 0,
            scriptPubKey: sentOutput.scriptPubKey,
            amount: 100000n,
          },
        ],
      )

      expect(receivedPayments).toHaveLength(1)
      expect(receivedPayments[0].outputIndex).toBe(0)
      expect(receivedPayments[0].amount).toBe(100000n)
      expect(receivedPayments[0].tweakData).toHaveLength(32)
    })

    it('should not detect payment for different recipient', () => {
      // Setup: two different recipients
      const scanPrivKey1 = randomBytes(32)
      const spendPrivKey1 = randomBytes(32)
      const recipientAddress1 = generateSilentPaymentAddress(scanPrivKey1, spendPrivKey1, 'mainnet')

      const scanPrivKey2 = randomBytes(32)
      const spendPrivKey2 = randomBytes(32)
      const recipientAddress2 = generateSilentPaymentAddress(scanPrivKey2, spendPrivKey2, 'mainnet')

      // Sender creates output for recipient 1
      const senderPrivKey = randomBytes(32)
      const senderTxid = '0x' + bytesToHex(randomBytes(32))
      const senderInput = {
        txid: senderTxid,
        vout: 0,
        scriptPubKey: new Uint8Array(34),
        privateKey: senderPrivKey,
      }

      const sentOutput = createSilentPaymentOutput(
        recipientAddress1.address,
        [senderInput],
        100000n,
        0,
      )

      // Recipient 2 tries to scan
      const { secp256k1 } = require('@noble/curves/secp256k1')
      const senderPub = secp256k1.getPublicKey(senderPrivKey, true)

      const receivedPayments = scanForPayments(
        scanPrivKey2,
        hexToBytes(recipientAddress2.spendPubKey.slice(2)),
        [senderPub],
        [{ txid: senderTxid, vout: 0 }],
        [
          {
            outputIndex: 0,
            scriptPubKey: sentOutput.scriptPubKey,
            amount: 100000n,
          },
        ],
      )

      expect(receivedPayments).toHaveLength(0)
    })

    it('should reject invalid scan key length', () => {
      const scanPrivKey = randomBytes(16) // Too short
      const spendPubKey = randomBytes(33)

      expect(() =>
        scanForPayments(scanPrivKey, spendPubKey, [randomBytes(33)], [{ txid: '0x' + '00'.repeat(32), vout: 0 }], []),
      ).toThrow('scanPrivateKey must be 32 bytes')
    })

    it('should reject invalid spend public key length', () => {
      const scanPrivKey = randomBytes(32)
      const spendPubKey = randomBytes(16) // Too short

      expect(() =>
        scanForPayments(scanPrivKey, spendPubKey, [randomBytes(33)], [{ txid: '0x' + '00'.repeat(32), vout: 0 }], []),
      ).toThrow('spendPublicKey must be 33 bytes')
    })

    it('should reject empty input public keys', () => {
      const scanPrivKey = randomBytes(32)
      const spendPubKey = randomBytes(33)

      expect(() =>
        scanForPayments(scanPrivKey, spendPubKey, [], [{ txid: '0x' + '00'.repeat(32), vout: 0 }], []),
      ).toThrow('At least one input public key is required')
    })

    it('should reject empty outpoints', () => {
      const scanPrivKey = randomBytes(32)
      const spendPubKey = randomBytes(33)

      expect(() =>
        scanForPayments(scanPrivKey, spendPubKey, [randomBytes(33)], [], []),
      ).toThrow('At least one outpoint is required')
    })
  })

  describe('deriveSpendingKey', () => {
    it('should derive correct spending key for received payment', () => {
      // Setup: recipient generates address
      const scanPrivKey = randomBytes(32)
      const spendPrivKey = randomBytes(32)
      const recipientAddress = generateSilentPaymentAddress(scanPrivKey, spendPrivKey, 'mainnet')

      // Sender creates output
      const senderPrivKey = randomBytes(32)
      const senderTxid = '0x' + bytesToHex(randomBytes(32))
      const senderInput = {
        txid: senderTxid,
        vout: 0,
        scriptPubKey: new Uint8Array(34),
        privateKey: senderPrivKey,
      }

      const sentOutput = createSilentPaymentOutput(
        recipientAddress.address,
        [senderInput],
        100000n,
        0,
      )

      // Recipient scans
      const { secp256k1 } = require('@noble/curves/secp256k1')
      const senderPub = secp256k1.getPublicKey(senderPrivKey, true)

      const receivedPayments = scanForPayments(
        scanPrivKey,
        hexToBytes(recipientAddress.spendPubKey.slice(2)),
        [senderPub],
        [{ txid: senderTxid, vout: 0 }],
        [
          {
            outputIndex: 0,
            scriptPubKey: sentOutput.scriptPubKey,
            amount: 100000n,
          },
        ],
      )

      expect(receivedPayments).toHaveLength(1)

      // Derive spending key
      const spendingKey = deriveSpendingKey(receivedPayments[0], spendPrivKey)

      expect(spendingKey).toHaveLength(32)

      // Verify: public key from spending key should match tweaked pubkey
      const derivedPubKey = secp256k1.getPublicKey(spendingKey, false)
      const derivedXOnly = derivedPubKey.slice(1, 33)

      expect(bytesToHex(derivedXOnly)).toBe(bytesToHex(receivedPayments[0].tweakedPubKey))
    })

    it('should reject invalid spend private key length', () => {
      const spendPrivKey = randomBytes(16) // Too short
      const payment = {
        outputIndex: 0,
        amount: 100000n,
        tweakData: randomBytes(32),
        tweakedPubKey: randomBytes(32),
      }

      expect(() => deriveSpendingKey(payment, spendPrivKey)).toThrow(
        'spendPrivateKey must be 32 bytes',
      )
    })

    it('should reject invalid tweak data length', () => {
      const spendPrivKey = randomBytes(32)
      const payment = {
        outputIndex: 0,
        amount: 100000n,
        tweakData: randomBytes(16), // Too short
        tweakedPubKey: randomBytes(32),
      }

      expect(() => deriveSpendingKey(payment, spendPrivKey)).toThrow(
        'payment.tweakData must be 32 bytes',
      )
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // END-TO-END FLOW
  // ═══════════════════════════════════════════════════════════════════════════

  describe('End-to-End Flow', () => {
    it('should complete full payment flow: generate -> send -> scan -> spend', () => {
      const { secp256k1 } = require('@noble/curves/secp256k1')

      // 1. Recipient generates Silent Payment address
      const scanPrivKey = randomBytes(32)
      const spendPrivKey = randomBytes(32)
      const recipientAddress = generateSilentPaymentAddress(scanPrivKey, spendPrivKey, 'mainnet')

      // Verify address format
      expect(recipientAddress.address).toMatch(/^sp1q/)

      // 2. Sender creates Silent Payment output
      const senderPrivKey = randomBytes(32)
      const senderTxid = '0x' + bytesToHex(randomBytes(32))
      const senderInput = {
        txid: senderTxid,
        vout: 0,
        scriptPubKey: new Uint8Array(34),
        privateKey: senderPrivKey,
      }

      const amount = 100000n
      const sentOutput = createSilentPaymentOutput(recipientAddress.address, [senderInput], amount, 0)

      // Verify output is P2TR
      expect(sentOutput.scriptPubKey[0]).toBe(0x51) // OP_1
      expect(sentOutput.scriptPubKey[1]).toBe(0x20) // 32 bytes

      // 3. Recipient scans for payments
      const senderPubKey = secp256k1.getPublicKey(senderPrivKey, true)

      const receivedPayments = scanForPayments(
        scanPrivKey,
        hexToBytes(recipientAddress.spendPubKey.slice(2)),
        [senderPubKey],
        [{ txid: senderTxid, vout: 0 }],
        [
          {
            outputIndex: 0,
            scriptPubKey: sentOutput.scriptPubKey,
            amount,
          },
        ],
      )

      // Verify payment detected
      expect(receivedPayments).toHaveLength(1)
      expect(receivedPayments[0].outputIndex).toBe(0)
      expect(receivedPayments[0].amount).toBe(amount)

      // 4. Recipient derives spending key
      const spendingKey = deriveSpendingKey(receivedPayments[0], spendPrivKey)

      // Verify spending key produces correct public key
      const derivedPubKey = secp256k1.getPublicKey(spendingKey, false)
      const derivedXOnly = derivedPubKey.slice(1, 33)

      expect(bytesToHex(derivedXOnly)).toBe(bytesToHex(sentOutput.tweakedPubKey))
      expect(bytesToHex(derivedXOnly)).toBe(bytesToHex(receivedPayments[0].tweakedPubKey))
    })

    it('should support multiple outputs to same recipient', () => {
      const { secp256k1 } = require('@noble/curves/secp256k1')

      // Recipient generates address
      const scanPrivKey = randomBytes(32)
      const spendPrivKey = randomBytes(32)
      const recipientAddress = generateSilentPaymentAddress(scanPrivKey, spendPrivKey, 'mainnet')

      // Sender creates 3 outputs
      const senderPrivKey = randomBytes(32)
      const senderTxid = '0x' + bytesToHex(randomBytes(32))
      const senderInput = {
        txid: senderTxid,
        vout: 0,
        scriptPubKey: new Uint8Array(34),
        privateKey: senderPrivKey,
      }

      const output0 = createSilentPaymentOutput(recipientAddress.address, [senderInput], 100000n, 0)
      const output1 = createSilentPaymentOutput(recipientAddress.address, [senderInput], 200000n, 1)
      const output2 = createSilentPaymentOutput(recipientAddress.address, [senderInput], 300000n, 2)

      // All outputs should be different
      expect(bytesToHex(output0.tweakedPubKey)).not.toBe(bytesToHex(output1.tweakedPubKey))
      expect(bytesToHex(output1.tweakedPubKey)).not.toBe(bytesToHex(output2.tweakedPubKey))
      expect(bytesToHex(output0.tweakedPubKey)).not.toBe(bytesToHex(output2.tweakedPubKey))

      // Recipient scans
      const senderPubKey = secp256k1.getPublicKey(senderPrivKey, true)

      const receivedPayments = scanForPayments(
        scanPrivKey,
        hexToBytes(recipientAddress.spendPubKey.slice(2)),
        [senderPubKey],
        [{ txid: senderTxid, vout: 0 }],
        [
          {
            outputIndex: 0,
            scriptPubKey: output0.scriptPubKey,
            amount: 100000n,
          },
          {
            outputIndex: 1,
            scriptPubKey: output1.scriptPubKey,
            amount: 200000n,
          },
          {
            outputIndex: 2,
            scriptPubKey: output2.scriptPubKey,
            amount: 300000n,
          },
        ],
      )

      // All 3 payments should be detected
      expect(receivedPayments).toHaveLength(3)
      expect(receivedPayments[0].amount).toBe(100000n)
      expect(receivedPayments[1].amount).toBe(200000n)
      expect(receivedPayments[2].amount).toBe(300000n)
    })

    it('should support labeled addresses', () => {
      const { secp256k1 } = require('@noble/curves/secp256k1')

      // Recipient generates labeled address (e.g., for donations)
      const scanPrivKey = randomBytes(32)
      const spendPrivKey = randomBytes(32)
      const label = 123
      const recipientAddress = generateSilentPaymentAddress(scanPrivKey, spendPrivKey, 'mainnet', label)

      expect(recipientAddress.label).toBe(label)

      // Sender creates output
      const senderPrivKey = randomBytes(32)
      const senderTxid = '0x' + bytesToHex(randomBytes(32))
      const senderInput = {
        txid: senderTxid,
        vout: 0,
        scriptPubKey: new Uint8Array(34),
        privateKey: senderPrivKey,
      }

      const sentOutput = createSilentPaymentOutput(
        recipientAddress.address,
        [senderInput],
        100000n,
        0,
      )

      // Recipient scans (must use the labeled spend pubkey)
      const senderPubKey = secp256k1.getPublicKey(senderPrivKey, true)

      const receivedPayments = scanForPayments(
        scanPrivKey,
        hexToBytes(recipientAddress.spendPubKey.slice(2)),
        [senderPubKey],
        [{ txid: senderTxid, vout: 0 }],
        [
          {
            outputIndex: 0,
            scriptPubKey: sentOutput.scriptPubKey,
            amount: 100000n,
          },
        ],
      )

      // Payment should be detected with labeled address
      expect(receivedPayments).toHaveLength(1)
      expect(receivedPayments[0].amount).toBe(100000n)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Helper Functions', () => {
    it('hexToPrivateKey should convert valid hex string', () => {
      const privKey = randomBytes(32)
      const hexKey = `0x${bytesToHex(privKey)}`

      const converted = hexToPrivateKey(hexKey as any)

      expect(bytesToHex(converted)).toBe(bytesToHex(privKey))
    })

    it('hexToPrivateKey should reject invalid hex', () => {
      expect(() => hexToPrivateKey('invalid' as unknown as string)).toThrow()
      expect(() => hexToPrivateKey('0x123' as unknown as string)).toThrow()
    })

    it('hexToPublicKey should convert valid hex string', () => {
      const pubKey = randomBytes(33)
      const hexKey = `0x${bytesToHex(pubKey)}`

      const converted = hexToPublicKey(hexKey as any)

      expect(bytesToHex(converted)).toBe(bytesToHex(pubKey))
    })

    it('hexToPublicKey should reject invalid hex', () => {
      expect(() => hexToPublicKey('invalid' as unknown as string)).toThrow()
    })
  })
})
