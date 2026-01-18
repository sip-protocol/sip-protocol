/**
 * Solana Same-Chain Privacy Benchmarks
 *
 * Measures performance of Solana-specific privacy operations:
 * - ed25519 stealth address generation: Target <10ms
 * - SPL token transfer building: Target <50ms
 * - Payment scanning: Target <1ms per tx
 * - Transaction serialization: Target <5ms
 *
 * Run with: pnpm vitest bench benchmarks/solana.bench.ts
 *
 * @module benchmarks/solana
 */

import { describe, bench } from 'vitest'
import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js'
import {
  generateEd25519StealthMetaAddress,
  generateEd25519StealthAddress,
  deriveEd25519StealthPrivateKey,
  checkEd25519StealthAddress,
  ed25519PublicKeyToSolanaAddress,
  encodeStealthMetaAddress,
  decodeStealthMetaAddress,
} from '../src/stealth'
import {
  createTransactionBuilder,
  estimateComputeUnits,
  calculatePriorityFee,
} from '../src/chains/solana/transaction-builder'
import {
  resolveTokenMetadata,
  validateTransfer,
  formatTokenAmount,
  parseTokenAmount,
} from '../src/chains/solana/spl-transfer'
import {
  validateSOLTransfer,
  formatLamports,
  parseSOLToLamports,
} from '../src/chains/solana/sol-transfer'
import { createAnnouncementMemo, parseAnnouncement } from '../src/chains/solana/types'

// ─── Test Fixtures ──────────────────────────────────────────────────────────

// Pre-generate Solana meta-address for benchmarks
const { metaAddress: solanaMetaAddress, spendingPrivateKey, viewingPrivateKey } =
  generateEd25519StealthMetaAddress('solana')

const { stealthAddress: solanaStealthAddress } =
  generateEd25519StealthAddress(solanaMetaAddress)

const encodedSolanaMeta = encodeStealthMetaAddress(solanaMetaAddress)

// Mock connection (no actual RPC calls in benchmarks)
const mockConnection = {
  getAccountInfo: async () => null,
  getLatestBlockhash: async () => ({
    blockhash: 'GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi',
    lastValidBlockHeight: 1000,
  }),
  rpcEndpoint: 'https://api.mainnet-beta.solana.com',
  getBalance: async () => 5 * LAMPORTS_PER_SOL,
  getMinimumBalanceForRentExemption: async () => 890880,
} as unknown as Connection

const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
const testKeypair = Keypair.generate()

// ─── ed25519 Stealth Address Benchmarks ─────────────────────────────────────

describe('Solana: ed25519 Stealth Address Operations', () => {
  bench(
    'generateEd25519StealthMetaAddress',
    () => {
      generateEd25519StealthMetaAddress('solana')
    },
    { time: 1000 }
  )

  bench(
    'generateEd25519StealthAddress',
    () => {
      generateEd25519StealthAddress(solanaMetaAddress)
    },
    { time: 1000 }
  )

  bench(
    'deriveEd25519StealthPrivateKey',
    () => {
      deriveEd25519StealthPrivateKey(
        solanaStealthAddress,
        spendingPrivateKey,
        viewingPrivateKey
      )
    },
    { time: 1000 }
  )

  bench(
    'checkEd25519StealthAddress (scan)',
    () => {
      checkEd25519StealthAddress(
        solanaStealthAddress,
        solanaMetaAddress.spendingKey,
        viewingPrivateKey
      )
    },
    { time: 1000 }
  )

  bench(
    'ed25519PublicKeyToSolanaAddress',
    () => {
      ed25519PublicKeyToSolanaAddress(solanaStealthAddress.address)
    },
    { time: 1000 }
  )

  bench(
    'encodeStealthMetaAddress (solana)',
    () => {
      encodeStealthMetaAddress(solanaMetaAddress)
    },
    { time: 1000 }
  )

  bench(
    'decodeStealthMetaAddress (solana)',
    () => {
      decodeStealthMetaAddress(encodedSolanaMeta)
    },
    { time: 1000 }
  )
})

// ─── Transaction Builder Benchmarks ─────────────────────────────────────────

describe('Solana: Transaction Building', () => {
  const builder = createTransactionBuilder({
    connection: mockConnection,
    feePayer: testKeypair.publicKey,
  })

  bench(
    'createTransactionBuilder',
    () => {
      createTransactionBuilder({
        connection: mockConnection,
        feePayer: testKeypair.publicKey,
      })
    },
    { time: 1000 }
  )

  bench(
    'buildSOLTransfer',
    async () => {
      await builder.buildSOLTransfer({
        sender: testKeypair.publicKey,
        recipientMetaAddress: solanaMetaAddress,
        amount: BigInt(LAMPORTS_PER_SOL),
      })
    },
    { time: 2000 }
  )

  bench(
    'buildSPLTransfer',
    async () => {
      await builder.buildSPLTransfer({
        mint: USDC_MINT,
        sourceAccount: testKeypair.publicKey,
        owner: testKeypair.publicKey,
        recipientMetaAddress: solanaMetaAddress,
        amount: 1_000_000n,
      })
    },
    { time: 2000 }
  )

  bench(
    'estimateComputeUnits',
    () => {
      estimateComputeUnits([
        { programId: USDC_MINT, keys: [], data: Buffer.from([]) },
        { programId: USDC_MINT, keys: [], data: Buffer.from([]) },
      ])
    },
    { time: 1000 }
  )

  bench(
    'calculatePriorityFee',
    () => {
      calculatePriorityFee('high')
    },
    { time: 1000 }
  )
})

// ─── Token Operations Benchmarks ────────────────────────────────────────────

describe('Solana: Token Operations', () => {
  bench(
    'resolveTokenMetadata (known token)',
    async () => {
      await resolveTokenMetadata(mockConnection, USDC_MINT)
    },
    { time: 1000 }
  )

  bench(
    'formatTokenAmount',
    () => {
      formatTokenAmount(1_000_000n, 6)
    },
    { time: 1000 }
  )

  bench(
    'parseTokenAmount',
    () => {
      parseTokenAmount('1.0', 6)
    },
    { time: 1000 }
  )

  bench(
    'formatLamports',
    () => {
      formatLamports(BigInt(LAMPORTS_PER_SOL))
    },
    { time: 1000 }
  )

  bench(
    'parseSOLToLamports',
    () => {
      parseSOLToLamports('1.5')
    },
    { time: 1000 }
  )
})

// ─── Validation Benchmarks ──────────────────────────────────────────────────

describe('Solana: Validation', () => {
  bench(
    'validateSOLTransfer',
    async () => {
      await validateSOLTransfer({
        connection: mockConnection,
        sender: testKeypair.publicKey,
        recipientMetaAddress: solanaMetaAddress,
        amount: BigInt(LAMPORTS_PER_SOL),
      })
    },
    { time: 2000 }
  )

  bench(
    'validateTransfer (SPL)',
    async () => {
      await validateTransfer({
        connection: mockConnection,
        mint: USDC_MINT,
        sender: testKeypair.publicKey,
        recipientMetaAddress: solanaMetaAddress,
        amount: 1_000_000n,
      })
    },
    { time: 2000 }
  )
})

// ─── Announcement Memo Benchmarks ───────────────────────────────────────────

describe('Solana: Announcement Operations', () => {
  // Convert viewTag number to hex string as expected by createAnnouncementMemo
  const viewTagHex = solanaStealthAddress.viewTag.toString(16).padStart(2, '0')
  const testMemo = createAnnouncementMemo(
    solanaStealthAddress.ephemeralPublicKey,
    viewTagHex,
    USDC_MINT.toBase58()
  )

  bench(
    'createAnnouncementMemo',
    () => {
      createAnnouncementMemo(
        solanaStealthAddress.ephemeralPublicKey,
        viewTagHex,
        USDC_MINT.toBase58()
      )
    },
    { time: 1000 }
  )

  bench(
    'parseAnnouncement',
    () => {
      parseAnnouncement(testMemo)
    },
    { time: 1000 }
  )
})

// ─── Payment Scanning Benchmarks ────────────────────────────────────────────

describe('Solana: Payment Scanning (Target: <1ms per tx)', () => {
  // Generate batch of stealth addresses for scanning
  const BATCH_SIZE = 100
  const testAnnouncements = Array.from({ length: BATCH_SIZE }, () => {
    const { stealthAddress } = generateEd25519StealthAddress(solanaMetaAddress)
    return stealthAddress
  })

  // Also include some that don't belong to us
  const otherMeta = generateEd25519StealthMetaAddress('solana').metaAddress
  const mixedAnnouncements = [
    ...testAnnouncements.slice(0, 50),
    ...Array.from({ length: 50 }, () =>
      generateEd25519StealthAddress(otherMeta).stealthAddress
    ),
  ]

  bench(
    'scan single announcement (owned)',
    () => {
      checkEd25519StealthAddress(
        testAnnouncements[0],
        solanaMetaAddress.spendingKey,
        viewingPrivateKey
      )
    },
    { time: 1000 }
  )

  bench(
    'scan single announcement (not owned)',
    () => {
      const other = generateEd25519StealthAddress(otherMeta).stealthAddress
      checkEd25519StealthAddress(
        other,
        solanaMetaAddress.spendingKey,
        viewingPrivateKey
      )
    },
    { time: 1000 }
  )

  bench(
    `scan ${BATCH_SIZE} announcements (all owned)`,
    () => {
      for (const ann of testAnnouncements) {
        checkEd25519StealthAddress(
          ann,
          solanaMetaAddress.spendingKey,
          viewingPrivateKey
        )
      }
    },
    { time: 5000 }
  )

  bench(
    `scan ${BATCH_SIZE} announcements (50% owned)`,
    () => {
      for (const ann of mixedAnnouncements) {
        checkEd25519StealthAddress(
          ann,
          solanaMetaAddress.spendingKey,
          viewingPrivateKey
        )
      }
    },
    { time: 5000 }
  )
})

// ─── Throughput Benchmarks ──────────────────────────────────────────────────

describe('Solana: Throughput', () => {
  const BATCH_SIZE = 100

  bench(
    `${BATCH_SIZE}x stealth address generation`,
    () => {
      for (let i = 0; i < BATCH_SIZE; i++) {
        generateEd25519StealthMetaAddress('solana')
      }
    },
    { time: 5000 }
  )

  bench(
    `${BATCH_SIZE}x one-time address generation`,
    () => {
      for (let i = 0; i < BATCH_SIZE; i++) {
        generateEd25519StealthAddress(solanaMetaAddress)
      }
    },
    { time: 5000 }
  )

  bench(
    `${BATCH_SIZE}x Solana address conversion`,
    () => {
      for (let i = 0; i < BATCH_SIZE; i++) {
        ed25519PublicKeyToSolanaAddress(solanaStealthAddress.address)
      }
    },
    { time: 5000 }
  )

  bench(
    `${BATCH_SIZE}x private key derivation`,
    () => {
      for (let i = 0; i < BATCH_SIZE; i++) {
        deriveEd25519StealthPrivateKey(
          solanaStealthAddress,
          spendingPrivateKey,
          viewingPrivateKey
        )
      }
    },
    { time: 5000 }
  )
})
