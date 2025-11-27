/**
 * Intent Operations Benchmarks
 *
 * Measures performance of intent creation and management:
 * - Intent creation (various privacy levels)
 * - Intent builder pattern
 * - Serialization/deserialization
 */

import { describe, bench, beforeAll } from 'vitest'
import {
  createShieldedIntent,
  IntentBuilder,
  trackIntent,
  isExpired,
  getTimeRemaining,
  serializeIntent,
  deserializeIntent,
  getIntentSummary,
} from '../src/intent'
import { generateStealthMetaAddress, encodeStealthMetaAddress } from '../src/stealth'
import { MockProofProvider } from '../src/proofs/mock'
import type { CreateIntentParams, ShieldedIntent } from '@sip-protocol/types'

// ─── Test Fixtures ────────────────────────────────────────────────────────────

const { metaAddress } = generateStealthMetaAddress('zcash')
const recipientMetaAddress = encodeStealthMetaAddress(metaAddress)

const baseParams: CreateIntentParams = {
  input: {
    asset: {
      chain: 'near',
      symbol: 'NEAR',
      address: null,
      decimals: 24,
    },
    amount: 100_000000000000000000000000n, // 100 NEAR
  },
  output: {
    asset: {
      chain: 'zcash',
      symbol: 'ZEC',
      address: null,
      decimals: 8,
    },
    minAmount: 1_00000000n, // 1 ZEC
    maxSlippage: 0.01,
  },
  privacy: 'transparent',
  recipientMetaAddress,
  ttl: 300,
}

let mockProvider: MockProofProvider
let sampleIntent: ShieldedIntent

// ─── Intent Creation Benchmarks ───────────────────────────────────────────────

describe('Intent Creation', () => {
  beforeAll(async () => {
    mockProvider = new MockProofProvider()
    await mockProvider.initialize()
    sampleIntent = await createShieldedIntent(baseParams)
  })

  bench(
    'createShieldedIntent (transparent)',
    async () => {
      await createShieldedIntent({ ...baseParams, privacy: 'transparent' })
    },
    { time: 1000 }
  )

  bench(
    'createShieldedIntent (shielded, no proofs)',
    async () => {
      await createShieldedIntent({ ...baseParams, privacy: 'shielded' })
    },
    { time: 1000 }
  )

  bench(
    'createShieldedIntent (shielded, with mock proofs)',
    async () => {
      await createShieldedIntent(
        { ...baseParams, privacy: 'shielded' },
        { senderAddress: '0x1234', proofProvider: mockProvider }
      )
    },
    { time: 1000 }
  )

  bench(
    'createShieldedIntent (compliant)',
    async () => {
      await createShieldedIntent({
        ...baseParams,
        privacy: 'compliant',
        viewingKey: '0x' + '0'.repeat(64),
      })
    },
    { time: 1000 }
  )
})

// ─── IntentBuilder Benchmarks ─────────────────────────────────────────────────

describe('IntentBuilder Pattern', () => {
  beforeAll(async () => {
    mockProvider = new MockProofProvider()
    await mockProvider.initialize()
  })

  bench(
    'IntentBuilder.build() (transparent)',
    async () => {
      await new IntentBuilder()
        .input('near', 'NEAR', 100n)
        .output('zcash', 'ZEC', 1n)
        .privacy('transparent')
        .recipient(recipientMetaAddress)
        .ttl(300)
        .build()
    },
    { time: 1000 }
  )

  bench(
    'IntentBuilder.build() (shielded)',
    async () => {
      await new IntentBuilder()
        .input('near', 'NEAR', 100n)
        .output('zcash', 'ZEC', 1n)
        .privacy('shielded')
        .recipient(recipientMetaAddress)
        .ttl(300)
        .build()
    },
    { time: 1000 }
  )

  bench(
    'IntentBuilder with provider',
    async () => {
      await new IntentBuilder()
        .input('near', 'NEAR', 100n)
        .output('zcash', 'ZEC', 1n)
        .privacy('shielded')
        .recipient(recipientMetaAddress)
        .withProvider(mockProvider)
        .build()
    },
    { time: 1000 }
  )

  bench(
    'IntentBuilder chain methods (no build)',
    () => {
      new IntentBuilder()
        .input('near', 'NEAR', 100n)
        .output('zcash', 'ZEC', 1n)
        .privacy('shielded')
        .recipient(recipientMetaAddress)
        .slippage(1)
        .ttl(300)
    },
    { time: 1000 }
  )
})

// ─── Intent Utility Benchmarks ────────────────────────────────────────────────

describe('Intent Utilities', () => {
  beforeAll(async () => {
    sampleIntent = await createShieldedIntent(baseParams)
  })

  bench(
    'trackIntent',
    () => {
      trackIntent(sampleIntent)
    },
    { time: 1000 }
  )

  bench(
    'isExpired',
    () => {
      isExpired(sampleIntent)
    },
    { time: 1000 }
  )

  bench(
    'getTimeRemaining',
    () => {
      getTimeRemaining(sampleIntent)
    },
    { time: 1000 }
  )

  bench(
    'getIntentSummary',
    () => {
      getIntentSummary(sampleIntent)
    },
    { time: 1000 }
  )
})

// ─── Serialization Benchmarks ─────────────────────────────────────────────────

describe('Intent Serialization', () => {
  let serialized: string

  beforeAll(async () => {
    sampleIntent = await createShieldedIntent(baseParams)
    serialized = serializeIntent(sampleIntent)
  })

  bench(
    'serializeIntent',
    () => {
      serializeIntent(sampleIntent)
    },
    { time: 1000 }
  )

  bench(
    'deserializeIntent',
    () => {
      deserializeIntent(serialized)
    },
    { time: 1000 }
  )

  bench(
    'roundtrip (serialize + deserialize)',
    () => {
      const json = serializeIntent(sampleIntent)
      deserializeIntent(json)
    },
    { time: 1000 }
  )
})

// ─── Throughput Benchmarks ────────────────────────────────────────────────────

describe('Intent Throughput', () => {
  const BATCH_SIZE = 50

  bench(
    `${BATCH_SIZE}x intent creation (transparent)`,
    async () => {
      const promises = Array(BATCH_SIZE)
        .fill(null)
        .map(() => createShieldedIntent({ ...baseParams, privacy: 'transparent' }))
      await Promise.all(promises)
    },
    { time: 5000 }
  )

  bench(
    `${BATCH_SIZE}x serialization roundtrip`,
    () => {
      for (let i = 0; i < BATCH_SIZE; i++) {
        const json = serializeIntent(sampleIntent)
        deserializeIntent(json)
      }
    },
    { time: 5000 }
  )
})
