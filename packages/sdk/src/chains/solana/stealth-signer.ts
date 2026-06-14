/**
 * Stealth address signing for Solana.
 *
 * SIP's ed25519 stealth derivation yields a RAW SCALAR (s = s_spend + H(S) mod L),
 * not a standard ed25519 seed. Solana's `Keypair` (tweetnacl) signs by treating the
 * first 32 bytes as a seed (SHA-512 + clamp), so it cannot sign for a stealth address
 * whose private key is a raw scalar. This module signs directly with the scalar using
 * RFC 8032 Ed25519 — producing signatures any standard verifier and the Solana runtime
 * accept — and attaches them to a transaction via `Transaction.addSignature`.
 */

import { PublicKey, Transaction } from '@solana/web3.js'
import { ed25519 } from '@noble/curves/ed25519'
import { sha512 } from '@noble/hashes/sha512'
import { hexToBytes } from '@noble/hashes/utils'
import type { StealthAddress, HexString } from '@sip-protocol/types'
import {
  deriveEd25519StealthPrivateKey,
  deriveEd25519StealthPrivateKeyV1,
  solanaAddressToEd25519PublicKey,
} from '../../stealth'
import { bytesToBigIntLE, bigIntToBytesLE, ED25519_ORDER } from '../../stealth/utils'

/** Reduce a bigint into [0, L). */
function modL(value: bigint): bigint {
  const reduced = value % ED25519_ORDER
  return reduced >= 0n ? reduced : reduced + ED25519_ORDER
}

/**
 * Produce an RFC 8032 Ed25519 signature from a raw little-endian scalar.
 *
 * Unlike `Keypair`/tweetnacl signing (which expects a 32-byte seed and re-derives the
 * scalar via SHA-512 + clamp), this signs directly with the provided scalar `a` whose
 * public key is `A = a·G`. The per-signature nonce is derived deterministically from a
 * hash of the scalar and the message (RFC 8032 structure): unique per message, never
 * reused across distinct messages.
 *
 * @param message - Exact bytes to sign (e.g. a compiled transaction message)
 * @param scalar - 32-byte little-endian ed25519 scalar (the stealth private key)
 * @param publicKeyBytes - Optional 32-byte compressed public key `A = a·G`. When supplied,
 *   it is used directly as `A` to skip one scalar multiplication per signature — a pure
 *   performance shortcut for callers that already hold the public key (e.g.
 *   {@link deriveStealthSigner}, which proves `A` equals the stealth address before signing).
 *   It is NOT a second independent input: it MUST equal `a·G`. Supplying a wrong value does
 *   not raise an error — it silently produces an invalid signature (`A` feeds the challenge
 *   `k = H(R‖A‖message)`). When omitted, `A` is computed from `a`. Must be exactly 32 bytes.
 * @returns 64-byte signature (R ‖ S)
 * @throws If the scalar reduces to zero, or if `publicKeyBytes` is supplied but not 32 bytes
 */
export function signEd25519WithScalar(
  message: Uint8Array,
  scalar: Uint8Array,
  publicKeyBytes?: Uint8Array,
): Uint8Array {
  if (publicKeyBytes !== undefined && publicKeyBytes.length !== 32) {
    throw new Error('publicKeyBytes must be 32 bytes')
  }
  const a = modL(bytesToBigIntLE(scalar))
  if (a === 0n) {
    throw new Error('Invalid stealth scalar: reduces to zero')
  }
  const A = publicKeyBytes ?? ed25519.ExtendedPoint.BASE.multiply(a).toRawBytes()

  const prefix = sha512(scalar).slice(32, 64)
  const r = modL(bytesToBigIntLE(sha512(new Uint8Array([...prefix, ...message]))))
  if (r === 0n) {
    throw new Error('Invalid nonce: reduces to zero')
  }
  const R = ed25519.ExtendedPoint.BASE.multiply(r).toRawBytes()

  const k = modL(bytesToBigIntLE(sha512(new Uint8Array([...R, ...A, ...message]))))
  const S = modL(r + k * a)

  return new Uint8Array([...R, ...bigIntToBytesLE(S, 32)])
}

/** Parameters needed to derive a stealth address's signer. */
export interface DeriveStealthSignerParams {
  /** Stealth address (base58) */
  stealthAddress: string
  /** Ephemeral public key from the payment (base58) */
  ephemeralPublicKey: string
  /** Recipient's viewing private key (hex) */
  viewingPrivateKey: HexString
  /** Recipient's spending private key (hex) */
  spendingPrivateKey: HexString
  /** Announcement scheme version: '2' canonical (default) | '1' legacy */
  version?: '1' | '2'
}

/** Signs transactions/messages as a stealth address using its raw ed25519 scalar. */
export interface StealthSigner {
  /** The stealth address this signer controls */
  readonly publicKey: PublicKey
  /** Sign arbitrary bytes, returning a 64-byte ed25519 signature */
  signMessage(message: Uint8Array): Uint8Array
  /** Attach this stealth address's signature to a transaction. Call LAST — after feePayer, recentBlockhash, and all instructions are finalized (the signature covers the serialized message at call time). */
  signTransaction(transaction: Transaction): void
}

/**
 * Re-derive the signer that controls a stealth address.
 *
 * Routes derivation by announcement version (canonical SIP:2 vs legacy SIP:1) and
 * validates the derived scalar reproduces the on-chain stealth public key before
 * returning a signer. The signer signs with the raw scalar (see
 * {@link signEd25519WithScalar}); it does NOT construct a `Keypair`, which cannot sign
 * for a scalar-derived stealth address.
 *
 * @throws If the derived scalar does not produce the expected stealth public key
 */
export function deriveStealthSigner(params: DeriveStealthSignerParams): StealthSigner {
  const {
    stealthAddress,
    ephemeralPublicKey,
    viewingPrivateKey,
    spendingPrivateKey,
    version = '2',
  } = params

  const stealthAddressHex = solanaAddressToEd25519PublicKey(stealthAddress)
  const ephemeralPubKeyHex = solanaAddressToEd25519PublicKey(ephemeralPublicKey)

  const stealthAddressObj: StealthAddress = {
    address: stealthAddressHex,
    ephemeralPublicKey: ephemeralPubKeyHex,
    viewTag: 0,
  }

  const recovery = version === '1'
    ? deriveEd25519StealthPrivateKeyV1(stealthAddressObj, spendingPrivateKey, viewingPrivateKey)
    : deriveEd25519StealthPrivateKey(stealthAddressObj, spendingPrivateKey, viewingPrivateKey)

  const scalar = hexToBytes(recovery.privateKey.slice(2))

  const publicKey = new PublicKey(stealthAddress)
  const expectedPubKeyBytes = publicKey.toBytes()
  const derivedPubKeyBytes = ed25519.ExtendedPoint.BASE.multiply(modL(bytesToBigIntLE(scalar))).toRawBytes()

  if (!derivedPubKeyBytes.every((b, i) => b === expectedPubKeyBytes[i])) {
    throw new Error(
      'Stealth key derivation failed: derived scalar does not produce expected public key. ' +
      'This may indicate incorrect spending/viewing keys or corrupted announcement data.'
    )
  }

  return {
    publicKey,
    signMessage(message: Uint8Array): Uint8Array {
      return signEd25519WithScalar(message, scalar, derivedPubKeyBytes)
    },
    signTransaction(transaction: Transaction): void {
      const message = transaction.serializeMessage()
      const signature = signEd25519WithScalar(message, scalar, derivedPubKeyBytes)
      transaction.addSignature(publicKey, Buffer.from(signature))
    },
  }
}
