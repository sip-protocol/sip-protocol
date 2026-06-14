import { describe, it, expect } from 'vitest'
import { Transaction, SystemProgram } from '@solana/web3.js'
import { ed25519 } from '@noble/curves/ed25519'
import { hexToBytes, bytesToHex, randomBytes } from '@noble/hashes/utils'
import { sha256 } from '@noble/hashes/sha256'
import type { ChainId, StealthAddress, HexString } from '@sip-protocol/types'
import { bytesToBigIntLE, bytesToBigInt, bigIntToBytesLE, ED25519_ORDER, getEd25519Scalar } from '../../../src/stealth/utils'
import {
  generateEd25519StealthMetaAddress,
  generateEd25519StealthAddress,
  ed25519PublicKeyToSolanaAddress,
} from '../../../src/stealth'
import { signEd25519WithScalar, deriveStealthSigner } from '../../../src/chains/solana/stealth-signer'

/**
 * Generate a SIP:1 (legacy, pre-canonical-flip) ed25519 stealth address.
 *
 * Legacy scheme (swapped ECDH):
 *   S = s_spend * R  (ECDH on the SPENDING key)
 *   P_stealth = P_view + H(S)*G
 *   p_stealth = s_view + H(S) mod L
 */
function generateLegacyV1StealthAddress(
  spendingPrivateKey: HexString,
  viewingPrivateKey: HexString,
): StealthAddress {
  const spendingPrivBytes = hexToBytes(spendingPrivateKey.slice(2))
  const viewingPrivBytes = hexToBytes(viewingPrivateKey.slice(2))

  // Generate ephemeral keypair
  const ephemeralSeed = randomBytes(32)
  const ephemeralPublicKey = ed25519.getPublicKey(ephemeralSeed)
  const rawEphemeralScalar = getEd25519Scalar(ephemeralSeed)
  const ephemeralScalar = rawEphemeralScalar % ED25519_ORDER

  // S = ephemeral_scalar * P_spend  (legacy: ECDH on the spending key)
  const spendingPubBytes = ed25519.getPublicKey(spendingPrivBytes)
  const spendingPubPoint = ed25519.ExtendedPoint.fromHex(spendingPubBytes)
  const sharedSecretPoint = spendingPubPoint.multiply(ephemeralScalar)
  const sharedSecretHash = sha256(sharedSecretPoint.toRawBytes())

  // P_stealth = P_view + H(S)*G
  const viewingPubBytes = ed25519.getPublicKey(viewingPrivBytes)
  const viewingPoint = ed25519.ExtendedPoint.fromHex(viewingPubBytes)
  const hashScalar = bytesToBigInt(sharedSecretHash) % ED25519_ORDER
  const hashTimesG = ed25519.ExtendedPoint.BASE.multiply(hashScalar)
  const stealthPoint = viewingPoint.add(hashTimesG)

  return {
    address: `0x${bytesToHex(stealthPoint.toRawBytes())}` as HexString,
    ephemeralPublicKey: `0x${bytesToHex(ephemeralPublicKey)}` as HexString,
    viewTag: sharedSecretHash[0],
  }
}

function pubFromScalar(scalar: Uint8Array): Uint8Array {
  let a = bytesToBigIntLE(scalar) % ED25519_ORDER
  if (a < 0n) a += ED25519_ORDER
  return ed25519.ExtendedPoint.BASE.multiply(a).toRawBytes()
}

describe('signEd25519WithScalar', () => {
  it('produces a signature that verifies against the scalar public key', () => {
    const scalar = hexToBytes('0a'.repeat(32))
    const msg = new Uint8Array([1, 2, 3, 4, 5])
    const sig = signEd25519WithScalar(msg, scalar)
    expect(sig.length).toBe(64)
    expect(ed25519.verify(sig, msg, pubFromScalar(scalar))).toBe(true)
  })

  it('is deterministic per message but derives a distinct nonce per message (no nonce reuse)', () => {
    const scalar = hexToBytes('0a'.repeat(32))
    const msg1 = new Uint8Array([1, 2, 3])
    const msg2 = new Uint8Array([1, 2, 4])
    const sigA = signEd25519WithScalar(msg1, scalar)
    const sigB = signEd25519WithScalar(msg1, scalar)
    const sigC = signEd25519WithScalar(msg2, scalar)
    // Deterministic: same (scalar, message) -> identical signature (safe retries).
    expect(bytesToHex(sigA)).toBe(bytesToHex(sigB))
    // Distinct messages -> distinct nonce R (first 32 bytes). Equal R across different
    // messages would leak the scalar (catastrophic ed25519 nonce reuse).
    expect(bytesToHex(sigC.slice(0, 32))).not.toBe(bytesToHex(sigA.slice(0, 32)))
  })

  it('does not verify against a tampered message', () => {
    const scalar = hexToBytes('0a'.repeat(32))
    const sig = signEd25519WithScalar(new Uint8Array([1, 2, 3]), scalar)
    expect(ed25519.verify(sig, new Uint8Array([1, 2, 4]), pubFromScalar(scalar))).toBe(false)
  })

  it('throws on a zero scalar', () => {
    expect(() => signEd25519WithScalar(new Uint8Array([1]), new Uint8Array(32))).toThrow('reduces to zero')
  })

  it('with a supplied (correct) public key produces a byte-identical signature to the 2-arg form', () => {
    const scalar = hexToBytes('0a'.repeat(32))
    const msg = new Uint8Array([1, 2, 3, 4, 5])
    const A = pubFromScalar(scalar)
    const sigDefault = signEd25519WithScalar(msg, scalar)
    const sigSupplied = signEd25519WithScalar(msg, scalar, A)
    // The third arg is a pure performance shortcut: with the correct A, R/k/S are
    // unchanged, so the output MUST be byte-for-byte identical.
    expect(bytesToHex(sigSupplied)).toBe(bytesToHex(sigDefault))
  })

  it('consumes the supplied public key: a WRONG A yields a signature that fails verification', () => {
    const scalar = hexToBytes('0a'.repeat(32))
    const msg = new Uint8Array([9, 8, 7])
    // A valid-but-wrong 32-byte point (public key of a different scalar).
    const wrongA = pubFromScalar(hexToBytes('0b'.repeat(32)))
    const sig = signEd25519WithScalar(msg, scalar, wrongA)
    // The param is genuinely fed into the k = H(R‖A‖msg) hash, so a wrong A corrupts S
    // and the signature cannot verify against the real public key.
    expect(ed25519.verify(sig, msg, pubFromScalar(scalar))).toBe(false)
  })

  it('throws when the supplied public key is not exactly 32 bytes', () => {
    const scalar = hexToBytes('0a'.repeat(32))
    const msg = new Uint8Array([1, 2, 3])
    expect(() => signEd25519WithScalar(msg, scalar, new Uint8Array(31))).toThrow('publicKeyBytes must be 32 bytes')
    expect(() => signEd25519WithScalar(msg, scalar, new Uint8Array(33))).toThrow('publicKeyBytes must be 32 bytes')
  })
})

describe('deriveStealthSigner', () => {
  it('derives a signer whose publicKey matches the canonical (SIP:2) stealth address', () => {
    const recipient = generateEd25519StealthMetaAddress('solana' as ChainId)
    const { stealthAddress } = generateEd25519StealthAddress(recipient.metaAddress)
    const stealthB58 = ed25519PublicKeyToSolanaAddress(stealthAddress.address)
    const ephemeralB58 = ed25519PublicKeyToSolanaAddress(stealthAddress.ephemeralPublicKey)

    const signer = deriveStealthSigner({
      stealthAddress: stealthB58,
      ephemeralPublicKey: ephemeralB58,
      viewingPrivateKey: recipient.viewingPrivateKey,
      spendingPrivateKey: recipient.spendingPrivateKey,
      version: '2',
    })

    expect(signer.publicKey.toBase58()).toBe(stealthB58)
  })

  it('signs a transaction so verifySignatures() passes (a Keypair could NOT sign this)', () => {
    const recipient = generateEd25519StealthMetaAddress('solana' as ChainId)
    const { stealthAddress } = generateEd25519StealthAddress(recipient.metaAddress)
    const stealthB58 = ed25519PublicKeyToSolanaAddress(stealthAddress.address)
    const ephemeralB58 = ed25519PublicKeyToSolanaAddress(stealthAddress.ephemeralPublicKey)

    const signer = deriveStealthSigner({
      stealthAddress: stealthB58,
      ephemeralPublicKey: ephemeralB58,
      viewingPrivateKey: recipient.viewingPrivateKey,
      spendingPrivateKey: recipient.spendingPrivateKey,
    })

    const tx = new Transaction()
    tx.add(SystemProgram.transfer({ fromPubkey: signer.publicKey, toPubkey: signer.publicKey, lamports: 1 }))
    tx.recentBlockhash = '11111111111111111111111111111111'
    tx.feePayer = signer.publicKey
    signer.signTransaction(tx)

    expect(tx.verifySignatures()).toBe(true)
  })

  it('signMessage produces a signature that verifies against the stealth pubkey', () => {
    const recipient = generateEd25519StealthMetaAddress('solana' as ChainId)
    const { stealthAddress } = generateEd25519StealthAddress(recipient.metaAddress)
    const stealthB58 = ed25519PublicKeyToSolanaAddress(stealthAddress.address)
    const ephemeralB58 = ed25519PublicKeyToSolanaAddress(stealthAddress.ephemeralPublicKey)
    const signer = deriveStealthSigner({
      stealthAddress: stealthB58,
      ephemeralPublicKey: ephemeralB58,
      viewingPrivateKey: recipient.viewingPrivateKey,
      spendingPrivateKey: recipient.spendingPrivateKey,
    })
    const message = new Uint8Array([10, 20, 30, 40])
    const sig = signer.signMessage(message)
    expect(ed25519.verify(sig, message, signer.publicKey.toBytes())).toBe(true)
  })

  it('version "1" (SIP:1 legacy): derives signer, publicKey matches, signTransaction passes', () => {
    const recipient = generateEd25519StealthMetaAddress('solana' as ChainId)
    const stealthAddress = generateLegacyV1StealthAddress(
      recipient.spendingPrivateKey,
      recipient.viewingPrivateKey,
    )
    const stealthB58 = ed25519PublicKeyToSolanaAddress(stealthAddress.address)
    const ephemeralB58 = ed25519PublicKeyToSolanaAddress(stealthAddress.ephemeralPublicKey)

    const signer = deriveStealthSigner({
      stealthAddress: stealthB58,
      ephemeralPublicKey: ephemeralB58,
      viewingPrivateKey: recipient.viewingPrivateKey,
      spendingPrivateKey: recipient.spendingPrivateKey,
      version: '1',
    })

    expect(signer.publicKey.toBase58()).toBe(stealthB58)

    const tx = new Transaction()
    tx.add(SystemProgram.transfer({ fromPubkey: signer.publicKey, toPubkey: signer.publicKey, lamports: 1 }))
    tx.recentBlockhash = '11111111111111111111111111111111'
    tx.feePayer = signer.publicKey
    signer.signTransaction(tx)

    expect(tx.verifySignatures()).toBe(true)
  })

  it('throws on mismatched keys (wrong spending key cannot derive the address)', () => {
    const recipient = generateEd25519StealthMetaAddress('solana' as ChainId)
    const other = generateEd25519StealthMetaAddress('solana' as ChainId)
    const { stealthAddress } = generateEd25519StealthAddress(recipient.metaAddress)
    const stealthB58 = ed25519PublicKeyToSolanaAddress(stealthAddress.address)
    const ephemeralB58 = ed25519PublicKeyToSolanaAddress(stealthAddress.ephemeralPublicKey)

    expect(() =>
      deriveStealthSigner({
        stealthAddress: stealthB58,
        ephemeralPublicKey: ephemeralB58,
        viewingPrivateKey: recipient.viewingPrivateKey,
        spendingPrivateKey: other.spendingPrivateKey,
      })
    ).toThrow('Stealth key derivation failed')
  })
})
