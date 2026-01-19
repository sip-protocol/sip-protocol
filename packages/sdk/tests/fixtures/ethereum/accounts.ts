/**
 * Ethereum Test Accounts and Keypairs
 *
 * Pre-generated secp256k1 keypairs for deterministic Ethereum testing.
 * Uses EIP-5564 stealth address format (secp256k1 + keccak256).
 *
 * WARNING: These keys are PUBLIC and should NEVER be used on mainnet.
 */

import { sha256 } from '@noble/hashes/sha256'
import { keccak_256 } from '@noble/hashes/sha3'
import { secp256k1 } from '@noble/curves/secp256k1'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import type { HexString } from '@sip-protocol/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EthereumTestAccount {
  /** Human-readable name */
  name: string
  /** Private key (32 bytes hex with 0x prefix) */
  privateKey: HexString
  /** Public key (33 bytes compressed hex with 0x prefix) */
  publicKey: HexString
  /** Uncompressed public key (65 bytes hex with 0x prefix) */
  publicKeyUncompressed: HexString
  /** Ethereum address (20 bytes hex with 0x prefix) */
  address: HexString
  /** Balance in wei (for local testing) */
  balance: bigint
}

export interface EthereumStealthTestAccount extends EthereumTestAccount {
  /** Spending private key */
  spendingPrivateKey: HexString
  /** Spending public key (compressed) */
  spendingPublicKey: HexString
  /** Viewing private key */
  viewingPrivateKey: HexString
  /** Viewing public key (compressed) */
  viewingPublicKey: HexString
  /** SIP meta-address format */
  metaAddress: string
  /** EIP-5564 scheme ID (always 1 for secp256k1) */
  schemeId: number
}

// ─── Key Derivation ───────────────────────────────────────────────────────────

/**
 * Derive a deterministic secp256k1 keypair from a seed string
 */
function deriveKeypair(seed: string): {
  privateKey: Uint8Array
  publicKey: Uint8Array
  publicKeyUncompressed: Uint8Array
} {
  const privateKey = sha256(new TextEncoder().encode(seed))
  const publicKey = secp256k1.getPublicKey(privateKey, true) // compressed
  const publicKeyUncompressed = secp256k1.getPublicKey(privateKey, false) // uncompressed

  return { privateKey, publicKey, publicKeyUncompressed }
}

/**
 * Derive Ethereum address from uncompressed public key
 * address = keccak256(pubKey[1:65])[12:32]
 */
function toEthereumAddress(publicKeyUncompressed: Uint8Array): HexString {
  // Remove the 0x04 prefix (uncompressed marker)
  const pubKeyNoPrefix = publicKeyUncompressed.slice(1)
  const hash = keccak_256(pubKeyNoPrefix)
  const addressBytes = hash.slice(12)
  return ('0x' + bytesToHex(addressBytes)) as HexString
}

/**
 * Create a test keypair from seed
 */
function createTestAccount(name: string, seed: string, balance: bigint): EthereumTestAccount {
  const { privateKey, publicKey, publicKeyUncompressed } = deriveKeypair(seed)
  return {
    name,
    privateKey: ('0x' + bytesToHex(privateKey)) as HexString,
    publicKey: ('0x' + bytesToHex(publicKey)) as HexString,
    publicKeyUncompressed: ('0x' + bytesToHex(publicKeyUncompressed)) as HexString,
    address: toEthereumAddress(publicKeyUncompressed),
    balance,
  }
}

/**
 * Create a test stealth keypair (spending + viewing keys)
 */
function createStealthTestAccount(name: string, baseSeed: string, balance: bigint): EthereumStealthTestAccount {
  const spending = deriveKeypair(`${baseSeed}:spending`)
  const viewing = deriveKeypair(`${baseSeed}:viewing`)
  const main = deriveKeypair(baseSeed)

  const spendingPubHex = bytesToHex(spending.publicKey)
  const viewingPubHex = bytesToHex(viewing.publicKey)

  return {
    name,
    privateKey: ('0x' + bytesToHex(main.privateKey)) as HexString,
    publicKey: ('0x' + bytesToHex(main.publicKey)) as HexString,
    publicKeyUncompressed: ('0x' + bytesToHex(main.publicKeyUncompressed)) as HexString,
    address: toEthereumAddress(main.publicKeyUncompressed),
    balance,
    spendingPrivateKey: ('0x' + bytesToHex(spending.privateKey)) as HexString,
    spendingPublicKey: ('0x' + spendingPubHex) as HexString,
    viewingPrivateKey: ('0x' + bytesToHex(viewing.privateKey)) as HexString,
    viewingPublicKey: ('0x' + viewingPubHex) as HexString,
    metaAddress: `sip:ethereum:0x${spendingPubHex}:0x${viewingPubHex}`,
    schemeId: 1, // secp256k1
  }
}

// ─── Pre-generated Test Accounts ──────────────────────────────────────────────

/** Default test balance: 100 ETH in wei */
const DEFAULT_BALANCE = 100n * 10n ** 18n

/**
 * Alice - Primary test sender
 */
export const aliceAccount = createStealthTestAccount('alice', 'sip-eth-alice-v1', DEFAULT_BALANCE)

/**
 * Bob - Primary test receiver
 */
export const bobAccount = createStealthTestAccount('bob', 'sip-eth-bob-v1', 50n * 10n ** 18n)

/**
 * Charlie - Secondary test user (multi-party scenarios)
 */
export const charlieAccount = createStealthTestAccount('charlie', 'sip-eth-charlie-v1', 10n * 10n ** 18n)

/**
 * Auditor - Compliance auditor with viewing key access
 */
export const auditorAccount = createTestAccount('auditor', 'sip-eth-auditor-v1', 5n * 10n ** 18n)

/**
 * Solver - Intent solver/relayer
 */
export const solverAccount = createTestAccount('solver', 'sip-eth-solver-v1', 1000n * 10n ** 18n)

/**
 * Deployer - Contract deployment account
 */
export const deployerAccount = createTestAccount('deployer', 'sip-eth-deployer-v1', 1000n * 10n ** 18n)

/**
 * All standard test accounts
 */
export const testAccounts = {
  alice: aliceAccount,
  bob: bobAccount,
  charlie: charlieAccount,
  auditor: auditorAccount,
  solver: solverAccount,
  deployer: deployerAccount,
} as const

/**
 * Stealth-enabled accounts only
 */
export const stealthAccounts = {
  alice: aliceAccount,
  bob: bobAccount,
  charlie: charlieAccount,
} as const

// ─── Ephemeral Key Generation ─────────────────────────────────────────────────

export interface EphemeralKeypair {
  /** Unique identifier */
  id: string
  /** Private key */
  privateKey: HexString
  /** Compressed public key */
  publicKey: HexString
  /** Uncompressed public key */
  publicKeyUncompressed: HexString
}

/**
 * Generate a deterministic ephemeral keypair for stealth transactions
 */
export function generateEphemeralKeypair(txId: string, index = 0): EphemeralKeypair {
  const seed = `sip-eth-ephemeral:${txId}:${index}`
  const { privateKey, publicKey, publicKeyUncompressed } = deriveKeypair(seed)

  return {
    id: `${txId}-${index}`,
    privateKey: ('0x' + bytesToHex(privateKey)) as HexString,
    publicKey: ('0x' + bytesToHex(publicKey)) as HexString,
    publicKeyUncompressed: ('0x' + bytesToHex(publicKeyUncompressed)) as HexString,
  }
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

// ─── Stealth Address Derivation ───────────────────────────────────────────────

export interface DerivedStealthAddress {
  /** The stealth address */
  stealthAddress: HexString
  /** Private key that controls the stealth address */
  stealthPrivateKey: HexString
  /** The ephemeral public key to publish */
  ephemeralPublicKey: HexString
  /** View tag for filtering (first byte of shared secret hash) */
  viewTag: number
}

/**
 * Derive an EIP-5564 compliant stealth address
 *
 * @param ephemeralPrivateKey - Sender's ephemeral private key
 * @param recipientSpendingPubKey - Recipient's spending public key (compressed)
 * @param recipientViewingPubKey - Recipient's viewing public key (compressed)
 */
export function deriveStealthAddress(
  ephemeralPrivateKey: HexString,
  recipientSpendingPubKey: HexString,
  recipientViewingPubKey: HexString
): DerivedStealthAddress {
  const ephPrivBytes = hexToBytes(ephemeralPrivateKey.slice(2))
  const viewPubBytes = hexToBytes(recipientViewingPubKey.slice(2))
  const spendPubBytes = hexToBytes(recipientSpendingPubKey.slice(2))

  // Get ephemeral public key
  const ephemeralPublicKey = secp256k1.getPublicKey(ephPrivBytes, true)

  // Compute shared secret: ECDH(ephPriv, viewPub)
  const viewPubPoint = secp256k1.ProjectivePoint.fromHex(viewPubBytes)
  const sharedSecretPoint = viewPubPoint.multiply(BigInt('0x' + bytesToHex(ephPrivBytes)))
  const sharedSecretBytes = sharedSecretPoint.toRawBytes(true)

  // Hash the shared secret
  const sharedSecretHash = keccak_256(sharedSecretBytes)

  // View tag is first byte
  const viewTag = sharedSecretHash[0]

  // Derive stealth private key: spendingPriv + hash(sharedSecret) mod n
  // For this fixture, we compute the public key addition directly
  const spendPubPoint = secp256k1.ProjectivePoint.fromHex(spendPubBytes)
  const hashScalar = BigInt('0x' + bytesToHex(sharedSecretHash)) % secp256k1.CURVE.n
  const hashPoint = secp256k1.ProjectivePoint.BASE.multiply(hashScalar)
  const stealthPubPoint = spendPubPoint.add(hashPoint)
  const stealthPubUncompressed = stealthPubPoint.toRawBytes(false)

  // Derive stealth address
  const stealthAddress = toEthereumAddress(stealthPubUncompressed)

  // Note: In real usage, only the recipient can derive the stealth private key
  // because they know spendingPrivateKey. Here we just return a placeholder.
  const stealthPrivateKey = ('0x' + bytesToHex(sharedSecretHash)) as HexString

  return {
    stealthAddress,
    stealthPrivateKey,
    ephemeralPublicKey: ('0x' + bytesToHex(ephemeralPublicKey)) as HexString,
    viewTag,
  }
}

/**
 * Compute view tag from shared secret
 */
export function computeViewTag(sharedSecretHash: Uint8Array): number {
  return sharedSecretHash[0]
}

// ─── Batch Generation ─────────────────────────────────────────────────────────

/**
 * Generate multiple test accounts
 */
export function generateTestAccounts(count: number, prefix = 'test'): EthereumTestAccount[] {
  return Array.from({ length: count }, (_, i) =>
    createTestAccount(`${prefix}-${i}`, `sip-eth-batch-${prefix}-${i}`, DEFAULT_BALANCE)
  )
}

/**
 * Generate multiple stealth accounts
 */
export function generateStealthAccounts(count: number, prefix = 'stealth'): EthereumStealthTestAccount[] {
  return Array.from({ length: count }, (_, i) =>
    createStealthTestAccount(`${prefix}-${i}`, `sip-eth-batch-${prefix}-${i}`, DEFAULT_BALANCE)
  )
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Get raw bytes from hex private key
 */
export function getPrivateKeyBytes(account: EthereumTestAccount): Uint8Array {
  return hexToBytes(account.privateKey.slice(2))
}

/**
 * Get raw bytes from hex public key (compressed)
 */
export function getPublicKeyBytes(account: EthereumTestAccount): Uint8Array {
  return hexToBytes(account.publicKey.slice(2))
}

/**
 * Sign a message hash with test account (returns r, s, v)
 */
export function signWithAccount(
  account: EthereumTestAccount,
  messageHash: Uint8Array
): { r: HexString; s: HexString; v: number } {
  const privateKey = getPrivateKeyBytes(account)
  const signature = secp256k1.sign(messageHash, privateKey)

  return {
    r: ('0x' + signature.r.toString(16).padStart(64, '0')) as HexString,
    s: ('0x' + signature.s.toString(16).padStart(64, '0')) as HexString,
    v: signature.recovery! + 27,
  }
}

/**
 * Verify a signature with test account
 */
export function verifyWithAccount(
  account: EthereumTestAccount,
  messageHash: Uint8Array,
  signature: { r: HexString; s: HexString }
): boolean {
  const publicKey = getPublicKeyBytes(account)
  const r = BigInt(signature.r)
  const s = BigInt(signature.s)
  const sig = new secp256k1.Signature(r, s)

  return secp256k1.verify(sig.toCompactRawBytes(), messageHash, publicKey)
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** One wei */
export const WEI = 1n

/** One gwei in wei */
export const GWEI = 10n ** 9n

/** One ETH in wei */
export const ETH = 10n ** 18n

/** Minimum account balance for transactions */
export const MIN_BALANCE = GWEI * 21000n // ~21000 gwei for basic tx

/** Standard gas price (in gwei) */
export const STANDARD_GAS_PRICE = 20n * GWEI

/** Standard gas limit for ETH transfer */
export const ETH_TRANSFER_GAS = 21000n

/** Standard gas limit for ERC-20 transfer */
export const ERC20_TRANSFER_GAS = 65000n

/** Standard gas limit for stealth address announcement */
export const STEALTH_ANNOUNCE_GAS = 100000n
