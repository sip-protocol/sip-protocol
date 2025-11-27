/**
 * Cryptographic Operations Benchmarks
 *
 * Measures performance of core crypto operations:
 * - Stealth address generation: Target <10ms
 * - Pedersen commitment creation: Target <5ms
 * - Key derivation: Target <5ms
 */

import { describe, bench } from 'vitest'
import {
  generateStealthMetaAddress,
  generateStealthAddress,
  deriveStealthPrivateKey,
  checkStealthAddress,
  encodeStealthMetaAddress,
  decodeStealthMetaAddress,
} from '../src/stealth'
import {
  commit,
  verifyOpening,
  addCommitments,
  subtractCommitments,
  addBlindings,
  generateBlinding,
  getGenerators,
} from '../src/commitment'
import {
  generateViewingKey,
  deriveViewingKey,
  encryptForViewing,
  decryptWithViewing,
} from '../src/privacy'
import type { HexString } from '@sip-protocol/types'

// ─── Stealth Address Benchmarks ───────────────────────────────────────────────

describe('Stealth Address Operations', () => {
  // Pre-generate test data
  const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
    generateStealthMetaAddress('near')
  const { stealthAddress } = generateStealthAddress(metaAddress)
  const encoded = encodeStealthMetaAddress(metaAddress)

  bench(
    'generateStealthMetaAddress',
    () => {
      generateStealthMetaAddress('near')
    },
    { time: 1000 }
  )

  bench(
    'generateStealthAddress',
    () => {
      generateStealthAddress(metaAddress)
    },
    { time: 1000 }
  )

  bench(
    'deriveStealthPrivateKey',
    () => {
      deriveStealthPrivateKey(stealthAddress, spendingPrivateKey, viewingPrivateKey)
    },
    { time: 1000 }
  )

  bench(
    'checkStealthAddress',
    () => {
      checkStealthAddress(stealthAddress, spendingPrivateKey, viewingPrivateKey)
    },
    { time: 1000 }
  )

  bench(
    'encodeStealthMetaAddress',
    () => {
      encodeStealthMetaAddress(metaAddress)
    },
    { time: 1000 }
  )

  bench(
    'decodeStealthMetaAddress',
    () => {
      decodeStealthMetaAddress(encoded)
    },
    { time: 1000 }
  )
})

// ─── Pedersen Commitment Benchmarks ───────────────────────────────────────────

describe('Pedersen Commitment Operations', () => {
  // Pre-generate test data
  const value = 1000000000000000000n // 1 token in wei
  const { commitment, blinding } = commit(value)
  const { commitment: commitment2, blinding: blinding2 } = commit(500n)

  bench(
    'commit (random blinding)',
    () => {
      commit(value)
    },
    { time: 1000 }
  )

  bench(
    'commit (zero value)',
    () => {
      commit(0n)
    },
    { time: 1000 }
  )

  bench(
    'verifyOpening',
    () => {
      verifyOpening(commitment, value, blinding)
    },
    { time: 1000 }
  )

  bench(
    'addCommitments',
    () => {
      addCommitments(commitment, commitment2)
    },
    { time: 1000 }
  )

  bench(
    'subtractCommitments',
    () => {
      subtractCommitments(commitment, commitment2)
    },
    { time: 1000 }
  )

  bench(
    'addBlindings',
    () => {
      addBlindings(blinding, blinding2)
    },
    { time: 1000 }
  )

  bench(
    'generateBlinding',
    () => {
      generateBlinding()
    },
    { time: 1000 }
  )

  bench(
    'getGenerators',
    () => {
      getGenerators()
    },
    { time: 1000 }
  )
})

// ─── Viewing Key & Encryption Benchmarks ──────────────────────────────────────

describe('Viewing Key & Encryption Operations', () => {
  // Pre-generate test data
  const viewingKey = generateViewingKey('m/0')
  const transactionData = {
    sender: '0x1234567890abcdef1234567890abcdef12345678',
    recipient: '0xabcdef1234567890abcdef1234567890abcdef12',
    amount: '1000000000000000000',
    timestamp: Date.now(),
  }
  const encrypted = encryptForViewing(transactionData, viewingKey)

  bench(
    'generateViewingKey',
    () => {
      generateViewingKey('m/0')
    },
    { time: 1000 }
  )

  bench(
    'deriveViewingKey',
    () => {
      deriveViewingKey(viewingKey, 'audit')
    },
    { time: 1000 }
  )

  bench(
    'encryptForViewing',
    () => {
      encryptForViewing(transactionData, viewingKey)
    },
    { time: 1000 }
  )

  bench(
    'decryptWithViewing',
    () => {
      decryptWithViewing(encrypted, viewingKey)
    },
    { time: 1000 }
  )
})

// ─── Batch Operations ─────────────────────────────────────────────────────────

describe('Batch Operations (Throughput)', () => {
  const BATCH_SIZE = 100

  bench(
    `${BATCH_SIZE}x stealth address generation`,
    () => {
      for (let i = 0; i < BATCH_SIZE; i++) {
        generateStealthMetaAddress('near')
      }
    },
    { time: 5000 }
  )

  bench(
    `${BATCH_SIZE}x commitment creation`,
    () => {
      for (let i = 0; i < BATCH_SIZE; i++) {
        commit(BigInt(i * 1000000))
      }
    },
    { time: 5000 }
  )

  bench(
    `${BATCH_SIZE}x viewing key generation`,
    () => {
      for (let i = 0; i < BATCH_SIZE; i++) {
        generateViewingKey(`m/${i}`)
      }
    },
    { time: 5000 }
  )
})
