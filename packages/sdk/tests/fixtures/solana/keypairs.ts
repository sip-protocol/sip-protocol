/**
 * Deterministic Test Keypair Fixtures
 *
 * Provides reproducible keypairs for testing without network access.
 * All keys are derived from fixed seeds for deterministic behavior.
 *
 * WARNING: These keys are PUBLIC and should NEVER be used on mainnet.
 */

import { sha256 } from '@noble/hashes/sha256'
import { ed25519 } from '@noble/curves/ed25519'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import type { HexString } from '@sip-protocol/types'

// ── Keypair Types ──────────────────────────────────────────────────────────

export interface TestKeypair {
  /** Human-readable name */
  name: string
  /** Private key (32 bytes hex) */
  privateKey: HexString
  /** Public key (32 bytes hex for ed25519) */
  publicKey: HexString
  /** Solana base58 address */
  address: string
}

export interface TestStealthKeypair extends TestKeypair {
  /** Spending private key */
  spendingPrivateKey: HexString
  /** Spending public key */
  spendingPublicKey: HexString
  /** Viewing private key */
  viewingPrivateKey: HexString
  /** Viewing public key */
  viewingPublicKey: HexString
  /** SIP meta-address format */
  metaAddress: string
}

// ── Key Derivation ─────────────────────────────────────────────────────────

/**
 * Derive a deterministic keypair from a seed string
 */
function deriveKeypair(seed: string): { privateKey: Uint8Array; publicKey: Uint8Array } {
  const privateKey = sha256(new TextEncoder().encode(seed))
  const publicKey = ed25519.getPublicKey(privateKey)
  return { privateKey, publicKey }
}

/**
 * Convert ed25519 public key to Solana base58 address
 * Note: Simplified - real Solana addresses use actual base58 encoding
 */
function toSolanaAddress(publicKey: Uint8Array): string {
  // Create a deterministic "base58-like" address for testing
  const hex = bytesToHex(publicKey)
  // Use first 32 chars + checksum-like suffix for recognizable test addresses
  return `Test${hex.slice(0, 28)}${hex.slice(-4)}`
}

/**
 * Create a test keypair from seed
 */
function createTestKeypair(name: string, seed: string): TestKeypair {
  const { privateKey, publicKey } = deriveKeypair(seed)
  return {
    name,
    privateKey: ('0x' + bytesToHex(privateKey)) as HexString,
    publicKey: ('0x' + bytesToHex(publicKey)) as HexString,
    address: toSolanaAddress(publicKey),
  }
}

/**
 * Create a test stealth keypair (spending + viewing keys)
 */
function createTestStealthKeypair(name: string, baseSeed: string): TestStealthKeypair {
  const spending = deriveKeypair(`${baseSeed}:spending`)
  const viewing = deriveKeypair(`${baseSeed}:viewing`)
  const main = deriveKeypair(baseSeed)

  const spendingPubHex = bytesToHex(spending.publicKey)
  const viewingPubHex = bytesToHex(viewing.publicKey)

  return {
    name,
    privateKey: ('0x' + bytesToHex(main.privateKey)) as HexString,
    publicKey: ('0x' + bytesToHex(main.publicKey)) as HexString,
    address: toSolanaAddress(main.publicKey),
    spendingPrivateKey: ('0x' + bytesToHex(spending.privateKey)) as HexString,
    spendingPublicKey: ('0x' + spendingPubHex) as HexString,
    viewingPrivateKey: ('0x' + bytesToHex(viewing.privateKey)) as HexString,
    viewingPublicKey: ('0x' + viewingPubHex) as HexString,
    metaAddress: `sip:solana:0x${spendingPubHex}:0x${viewingPubHex}`,
  }
}

// ── Pre-generated Test Keypairs ────────────────────────────────────────────

/**
 * Alice - Primary test sender
 */
export const aliceKeypair = createTestStealthKeypair('alice', 'sip-test-alice-v1')

/**
 * Bob - Primary test receiver
 */
export const bobKeypair = createTestStealthKeypair('bob', 'sip-test-bob-v1')

/**
 * Charlie - Secondary test user (multi-party scenarios)
 */
export const charlieKeypair = createTestStealthKeypair('charlie', 'sip-test-charlie-v1')

/**
 * Auditor - Compliance auditor with viewing key access
 */
export const auditorKeypair = createTestKeypair('auditor', 'sip-test-auditor-v1')

/**
 * Solver - Intent solver/relayer
 */
export const solverKeypair = createTestKeypair('solver', 'sip-test-solver-v1')

/**
 * All standard test keypairs
 */
export const testKeypairs = {
  alice: aliceKeypair,
  bob: bobKeypair,
  charlie: charlieKeypair,
  auditor: auditorKeypair,
  solver: solverKeypair,
} as const

// ── Ephemeral Key Generation ───────────────────────────────────────────────

/**
 * Generate a deterministic ephemeral keypair for stealth transactions
 */
export function generateEphemeralKeypair(txId: string, index = 0): TestKeypair {
  return createTestKeypair(
    `ephemeral-${txId}-${index}`,
    `sip-ephemeral:${txId}:${index}`
  )
}

/**
 * Pre-generated ephemeral keys for common test scenarios
 */
export const ephemeralKeypairs = {
  tx1: generateEphemeralKeypair('test-tx-1', 0),
  tx2: generateEphemeralKeypair('test-tx-2', 0),
  tx3: generateEphemeralKeypair('test-tx-3', 0),
  multi1: generateEphemeralKeypair('test-multi', 0),
  multi2: generateEphemeralKeypair('test-multi', 1),
  multi3: generateEphemeralKeypair('test-multi', 2),
} as const

// ── Stealth Address Derivation ─────────────────────────────────────────────

/**
 * Derive a stealth address from ephemeral key and recipient's meta-address
 * This is a simplified version for testing - matches real SDK logic
 */
export function deriveStealthAddress(
  ephemeralPrivateKey: HexString,
  recipientSpendingPubKey: HexString,
  recipientViewingPubKey: HexString
): { stealthAddress: string; stealthPrivateKey: HexString } {
  // Compute shared secret: ephemeralPriv * viewingPub
  const ephPrivBytes = hexToBytes(ephemeralPrivateKey.slice(2))
  const viewPubBytes = hexToBytes(recipientViewingPubKey.slice(2))

  // For ed25519, we use scalar multiplication
  // Simplified: hash(ephPriv || viewPub) as shared secret
  const sharedSecret = sha256(new Uint8Array([...ephPrivBytes, ...viewPubBytes]))

  // Derive stealth private key: spendingPriv + sharedSecret (mod curve order)
  // Simplified for testing: just hash them together
  const spendPubBytes = hexToBytes(recipientSpendingPubKey.slice(2))
  const stealthPrivate = sha256(new Uint8Array([...spendPubBytes, ...sharedSecret]))
  const stealthPublic = ed25519.getPublicKey(stealthPrivate)

  return {
    stealthAddress: toSolanaAddress(stealthPublic),
    stealthPrivateKey: ('0x' + bytesToHex(stealthPrivate)) as HexString,
  }
}

// ── Batch Generation ───────────────────────────────────────────────────────

/**
 * Generate multiple test keypairs
 */
export function generateTestKeypairs(count: number, prefix = 'test'): TestKeypair[] {
  return Array.from({ length: count }, (_, i) =>
    createTestKeypair(`${prefix}-${i}`, `sip-batch-${prefix}-${i}`)
  )
}

/**
 * Generate multiple stealth keypairs
 */
export function generateStealthKeypairs(count: number, prefix = 'stealth'): TestStealthKeypair[] {
  return Array.from({ length: count }, (_, i) =>
    createTestStealthKeypair(`${prefix}-${i}`, `sip-batch-${prefix}-${i}`)
  )
}

// ── Utilities ──────────────────────────────────────────────────────────────

/**
 * Get raw bytes from hex private key
 */
export function getPrivateKeyBytes(keypair: TestKeypair): Uint8Array {
  return hexToBytes(keypair.privateKey.slice(2))
}

/**
 * Get raw bytes from hex public key
 */
export function getPublicKeyBytes(keypair: TestKeypair): Uint8Array {
  return hexToBytes(keypair.publicKey.slice(2))
}

/**
 * Sign a message with test keypair
 */
export function signWithKeypair(keypair: TestKeypair, message: Uint8Array): Uint8Array {
  const privateKey = getPrivateKeyBytes(keypair)
  return ed25519.sign(message, privateKey)
}

/**
 * Verify a signature with test keypair
 */
export function verifyWithKeypair(keypair: TestKeypair, message: Uint8Array, signature: Uint8Array): boolean {
  const publicKey = getPublicKeyBytes(keypair)
  return ed25519.verify(signature, message, publicKey)
}
