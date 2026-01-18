/**
 * Mock Transaction Fixtures
 *
 * Pre-built transaction templates for testing stealth transfers.
 * Includes SOL transfers, SPL token transfers, and stealth-specific transactions.
 */

import type { HexString } from '@sip-protocol/types'
import { aliceKeypair, bobKeypair, ephemeralKeypairs } from './keypairs'

// ── Transaction Types ──────────────────────────────────────────────────────

export interface MockTransactionData {
  /** Transaction type identifier */
  type: 'sol-transfer' | 'spl-transfer' | 'stealth-transfer' | 'stealth-announcement'
  /** Sender address */
  from: string
  /** Recipient address */
  to: string
  /** Amount in base units (lamports for SOL, raw amount for SPL) */
  amount: bigint
  /** Token mint address (for SPL transfers) */
  mint?: string
  /** Mock transaction signature */
  signature: string
  /** Block slot */
  slot: number
  /** Block timestamp */
  timestamp: number
  /** Transaction fee in lamports */
  fee: number
}

export interface MockStealthTransactionData extends MockTransactionData {
  type: 'stealth-transfer'
  /** Ephemeral public key */
  ephemeralPubKey: HexString
  /** Stealth address (one-time recipient) */
  stealthAddress: string
  /** Encrypted memo/metadata */
  encryptedMemo: HexString
  /** Pedersen commitment to amount */
  commitment: HexString
  /** Viewing key hash for detection */
  viewingKeyHash: HexString
}

export interface MockStealthAnnouncementData extends MockTransactionData {
  type: 'stealth-announcement'
  /** Spending public key */
  spendingPubKey: HexString
  /** Viewing public key */
  viewingPubKey: HexString
  /** Meta-address (sip:chain:spending:viewing) */
  metaAddress: string
}

// ── Pre-built Transactions ─────────────────────────────────────────────────

const baseTimestamp = Math.floor(Date.now() / 1000)
const baseSlot = 200_000_000

/**
 * Standard SOL transfer from Alice to Bob
 */
export const solTransferAliceToBob: MockTransactionData = {
  type: 'sol-transfer',
  from: aliceKeypair.address,
  to: bobKeypair.address,
  amount: 1_000_000_000n, // 1 SOL
  signature: 'SolTx1AliceBob111111111111111111111111111111111111111111111111111111',
  slot: baseSlot,
  timestamp: baseTimestamp,
  fee: 5000,
}

/**
 * SPL token transfer (USDC) from Alice to Bob
 */
export const splTransferAliceToBob: MockTransactionData = {
  type: 'spl-transfer',
  from: aliceKeypair.address,
  to: bobKeypair.address,
  amount: 100_000_000n, // 100 USDC (6 decimals)
  mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  signature: 'SplTx1AliceBob111111111111111111111111111111111111111111111111111111',
  slot: baseSlot + 1,
  timestamp: baseTimestamp + 10,
  fee: 5000,
}

/**
 * Stealth SOL transfer from Alice to Bob's stealth address
 */
export const stealthSolTransfer: MockStealthTransactionData = {
  type: 'stealth-transfer',
  from: aliceKeypair.address,
  to: 'StealthBob11111111111111111111111111111111111', // Derived stealth address
  amount: 500_000_000n, // 0.5 SOL
  signature: 'StealthTx1111111111111111111111111111111111111111111111111111111111',
  slot: baseSlot + 2,
  timestamp: baseTimestamp + 20,
  fee: 5000,
  ephemeralPubKey: ephemeralKeypairs.tx1.publicKey,
  stealthAddress: 'StealthBob11111111111111111111111111111111111',
  encryptedMemo: '0x' + 'ab'.repeat(64) as HexString,
  commitment: '0x' + 'cd'.repeat(32) as HexString,
  viewingKeyHash: '0x' + 'ef'.repeat(32) as HexString,
}

/**
 * Stealth SPL transfer (USDC) from Alice to Bob's stealth address
 */
export const stealthSplTransfer: MockStealthTransactionData = {
  type: 'stealth-transfer',
  from: aliceKeypair.address,
  to: 'StealthBobSPL111111111111111111111111111111111',
  amount: 50_000_000n, // 50 USDC
  mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  signature: 'StealthSplTx11111111111111111111111111111111111111111111111111111111',
  slot: baseSlot + 3,
  timestamp: baseTimestamp + 30,
  fee: 5000,
  ephemeralPubKey: ephemeralKeypairs.tx2.publicKey,
  stealthAddress: 'StealthBobSPL111111111111111111111111111111111',
  encryptedMemo: '0x' + '12'.repeat(64) as HexString,
  commitment: '0x' + '34'.repeat(32) as HexString,
  viewingKeyHash: '0x' + '56'.repeat(32) as HexString,
}

/**
 * Bob's stealth meta-address announcement
 */
export const bobMetaAddressAnnouncement: MockStealthAnnouncementData = {
  type: 'stealth-announcement',
  from: bobKeypair.address,
  to: 'AnnouncementRegistry1111111111111111111111111',
  amount: 0n,
  signature: 'AnnounceTx1111111111111111111111111111111111111111111111111111111111',
  slot: baseSlot - 100,
  timestamp: baseTimestamp - 1000,
  fee: 5000,
  spendingPubKey: bobKeypair.spendingPublicKey,
  viewingPubKey: bobKeypair.viewingPublicKey,
  metaAddress: bobKeypair.metaAddress,
}

// ── Transaction Sequences ──────────────────────────────────────────────────

/**
 * Complete send flow sequence:
 * 1. Alice generates stealth address for Bob
 * 2. Alice sends to stealth address
 * 3. Bob detects payment
 */
export const sendFlowSequence = {
  step1_generateStealth: {
    recipientMetaAddress: bobKeypair.metaAddress,
    ephemeralKeypair: ephemeralKeypairs.tx1,
    derivedStealthAddress: 'StealthBob11111111111111111111111111111111111',
  },
  step2_sendTransaction: stealthSolTransfer,
  step3_detectPayment: {
    scannedBy: bobKeypair.address,
    found: true,
    stealthAddress: stealthSolTransfer.stealthAddress,
    amount: stealthSolTransfer.amount,
  },
}

/**
 * Complete receive flow sequence:
 * 1. Bob publishes meta-address
 * 2. Alice sends stealth payment
 * 3. Bob scans and detects
 * 4. Bob spends from stealth address
 */
export const receiveFlowSequence = {
  step1_publishMeta: bobMetaAddressAnnouncement,
  step2_receivePayment: stealthSolTransfer,
  step3_scanAndDetect: {
    viewingKey: bobKeypair.viewingPrivateKey,
    foundPayments: [stealthSolTransfer],
  },
  step4_spend: {
    from: stealthSolTransfer.stealthAddress,
    to: bobKeypair.address,
    amount: stealthSolTransfer.amount - 5000n, // minus fee
    signature: 'SpendTx111111111111111111111111111111111111111111111111111111111111',
  },
}

/**
 * Viewing key disclosure flow:
 * 1. Bob grants viewing key to Auditor
 * 2. Auditor scans and finds Bob's payments
 */
export const viewingKeyDisclosureSequence = {
  step1_grantAccess: {
    grantor: bobKeypair.address,
    grantee: 'AuditorPubkey11111111111111111111111111111111',
    viewingKey: bobKeypair.viewingPublicKey,
    scope: 'read-only' as const,
  },
  step2_auditorScan: {
    auditor: 'AuditorPubkey11111111111111111111111111111111',
    viewingKey: bobKeypair.viewingPublicKey,
    foundPayments: [stealthSolTransfer, stealthSplTransfer],
  },
}

// ── Factory Functions ──────────────────────────────────────────────────────

/**
 * Create a mock SOL transfer transaction
 */
export function createSolTransfer(
  from: string,
  to: string,
  amount: bigint,
  options: { slot?: number; timestamp?: number } = {}
): MockTransactionData {
  const slot = options.slot ?? baseSlot + Math.floor(Math.random() * 1000)
  return {
    type: 'sol-transfer',
    from,
    to,
    amount,
    signature: `MockSolTx${Date.now()}${Math.random().toString(36).slice(2)}`.slice(0, 64),
    slot,
    timestamp: options.timestamp ?? Math.floor(Date.now() / 1000),
    fee: 5000,
  }
}

/**
 * Create a mock SPL token transfer transaction
 */
export function createSplTransfer(
  from: string,
  to: string,
  amount: bigint,
  mint: string,
  options: { slot?: number; timestamp?: number } = {}
): MockTransactionData {
  const slot = options.slot ?? baseSlot + Math.floor(Math.random() * 1000)
  return {
    type: 'spl-transfer',
    from,
    to,
    amount,
    mint,
    signature: `MockSplTx${Date.now()}${Math.random().toString(36).slice(2)}`.slice(0, 64),
    slot,
    timestamp: options.timestamp ?? Math.floor(Date.now() / 1000),
    fee: 5000,
  }
}

/**
 * Create a mock stealth transfer transaction
 */
export function createStealthTransfer(
  from: string,
  stealthAddress: string,
  amount: bigint,
  ephemeralPubKey: HexString,
  options: {
    mint?: string
    slot?: number
    timestamp?: number
    commitment?: HexString
    viewingKeyHash?: HexString
  } = {}
): MockStealthTransactionData {
  const slot = options.slot ?? baseSlot + Math.floor(Math.random() * 1000)
  return {
    type: 'stealth-transfer',
    from,
    to: stealthAddress,
    amount,
    mint: options.mint,
    signature: `MockStealthTx${Date.now()}${Math.random().toString(36).slice(2)}`.slice(0, 64),
    slot,
    timestamp: options.timestamp ?? Math.floor(Date.now() / 1000),
    fee: 5000,
    ephemeralPubKey,
    stealthAddress,
    encryptedMemo: '0x' + '00'.repeat(64) as HexString,
    commitment: options.commitment ?? ('0x' + '00'.repeat(32) as HexString),
    viewingKeyHash: options.viewingKeyHash ?? ('0x' + '00'.repeat(32) as HexString),
  }
}

/**
 * Generate a batch of mock transactions
 */
export function generateTransactionBatch(
  count: number,
  type: 'sol' | 'spl' | 'stealth' = 'sol'
): MockTransactionData[] {
  return Array.from({ length: count }, (_, i) => {
    const slot = baseSlot + i
    const timestamp = baseTimestamp + i * 10

    switch (type) {
      case 'spl':
        return createSplTransfer(
          aliceKeypair.address,
          bobKeypair.address,
          BigInt((i + 1) * 1_000_000),
          'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          { slot, timestamp }
        )
      case 'stealth':
        return createStealthTransfer(
          aliceKeypair.address,
          `StealthAddr${i.toString().padStart(32, '0')}`,
          BigInt((i + 1) * 100_000_000),
          ephemeralKeypairs.tx1.publicKey,
          { slot, timestamp }
        )
      default:
        return createSolTransfer(
          aliceKeypair.address,
          bobKeypair.address,
          BigInt((i + 1) * 100_000_000),
          { slot, timestamp }
        )
    }
  })
}
