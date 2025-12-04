/**
 * Bitcoin Taproot (BIP-340/341) Implementation
 *
 * Implements Schnorr signatures (BIP-340) and Taproot outputs (BIP-341)
 * for Silent Payments support.
 *
 * References:
 * - BIP-340: https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki
 * - BIP-341: https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki
 * - BIP-350: https://github.com/bitcoin/bips/blob/master/bip-0350.mediawiki (Bech32m)
 */

import { secp256k1, schnorr } from '@noble/curves/secp256k1'
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import type { HexString } from '@sip-protocol/types'
import { ValidationError } from '../errors'
import { isValidHex, isValidPrivateKey } from '../validation'

/**
 * Taproot output structure
 */
export interface TaprootOutput {
  /** Tweaked public key (32 bytes x-only) */
  tweakedKey: HexString
  /** Original internal key (32 bytes x-only) */
  internalKey: HexString
  /** Merkle root of tapscript tree (if any) */
  merkleRoot?: HexString
  /** Parity bit for the tweaked key (0 or 1) */
  parity: number
}

/**
 * Tapscript structure (simplified for now)
 */
export interface TapScript {
  /** Script bytes */
  script: Uint8Array
  /** Leaf version (0xc0 for BIP-341) */
  leafVersion: number
}

/**
 * Bitcoin network types for address encoding
 */
export type BitcoinNetwork = 'mainnet' | 'testnet' | 'regtest'

/**
 * Bech32m character set
 */
const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'

/**
 * Bech32m generator values
 */
const BECH32_GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]

/**
 * Tagged hash for Schnorr signatures and Taproot
 * Implements BIP-340 tagged hash: SHA256(SHA256(tag) || SHA256(tag) || data)
 */
function taggedHash(tag: string, data: Uint8Array): Uint8Array {
  const tagHash = sha256(new TextEncoder().encode(tag))
  const taggedData = new Uint8Array(tagHash.length * 2 + data.length)
  taggedData.set(tagHash, 0)
  taggedData.set(tagHash, tagHash.length)
  taggedData.set(data, tagHash.length * 2)
  return sha256(taggedData)
}

/**
 * Sign a message using BIP-340 Schnorr signatures
 *
 * @param message - 32-byte message to sign
 * @param privateKey - 32-byte private key
 * @param auxRand - Optional 32-byte auxiliary random data (for deterministic signatures if omitted)
 * @returns 64-byte Schnorr signature
 * @throws {ValidationError} If inputs are invalid
 */
export function schnorrSign(
  message: Uint8Array,
  privateKey: Uint8Array,
  auxRand?: Uint8Array,
): Uint8Array {
  // Validate inputs
  if (message.length !== 32) {
    throw new ValidationError('message must be 32 bytes', 'message')
  }

  if (privateKey.length !== 32) {
    throw new ValidationError('privateKey must be 32 bytes', 'privateKey')
  }

  if (auxRand && auxRand.length !== 32) {
    throw new ValidationError('auxRand must be 32 bytes if provided', 'auxRand')
  }

  // Use @noble/curves schnorr implementation
  // It follows BIP-340 exactly
  return schnorr.sign(message, privateKey, auxRand)
}

/**
 * Verify a BIP-340 Schnorr signature
 *
 * @param signature - 64-byte Schnorr signature
 * @param message - 32-byte message that was signed
 * @param publicKey - 32-byte x-only public key
 * @returns true if signature is valid
 * @throws {ValidationError} If inputs are invalid
 */
export function schnorrVerify(
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array,
): boolean {
  // Validate inputs
  if (signature.length !== 64) {
    throw new ValidationError('signature must be 64 bytes', 'signature')
  }

  if (message.length !== 32) {
    throw new ValidationError('message must be 32 bytes', 'message')
  }

  if (publicKey.length !== 32) {
    throw new ValidationError('publicKey must be 32 bytes (x-only)', 'publicKey')
  }

  try {
    // Use @noble/curves schnorr verification
    return schnorr.verify(signature, message, publicKey)
  } catch {
    return false
  }
}

/**
 * Get x-only public key from a private key
 * Returns the 32-byte x coordinate with even y coordinate
 *
 * @param privateKey - 32-byte private key
 * @returns 32-byte x-only public key
 */
export function getXOnlyPublicKey(privateKey: Uint8Array): Uint8Array {
  if (privateKey.length !== 32) {
    throw new ValidationError('privateKey must be 32 bytes', 'privateKey')
  }

  // Get the full public key point
  const publicKey = secp256k1.getPublicKey(privateKey, false)

  // x-only pubkey is just the x coordinate (first 32 bytes after prefix)
  // @noble/curves returns uncompressed: [0x04, x(32), y(32)]
  return publicKey.slice(1, 33)
}

/**
 * Compute tweaked public key for Taproot
 * Implements BIP-341: P' = P + hash_TapTweak(P || merkle_root) * G
 *
 * @param internalKey - 32-byte x-only internal public key
 * @param merkleRoot - Optional 32-byte merkle root of tapscript tree
 * @returns Tweaked x-only public key and parity
 */
export function computeTweakedKey(
  internalKey: Uint8Array,
  merkleRoot?: Uint8Array,
): { tweakedKey: Uint8Array; parity: number } {
  // Validate inputs
  if (internalKey.length !== 32) {
    throw new ValidationError('internalKey must be 32 bytes (x-only)', 'internalKey')
  }

  if (merkleRoot && merkleRoot.length !== 32) {
    throw new ValidationError('merkleRoot must be 32 bytes if provided', 'merkleRoot')
  }

  // Compute tweak: t = hash_TapTweak(P || merkle_root)
  const tweakData = merkleRoot
    ? new Uint8Array([...internalKey, ...merkleRoot])
    : internalKey
  const tweak = taggedHash('TapTweak', tweakData)

  // Convert tweak to scalar
  const tweakScalar = BigInt('0x' + bytesToHex(tweak)) % secp256k1.CURVE.n

  // Lift x-only key to full point (assume even y)
  // For x-only keys, we assume y is even (parity = 0)
  const internalPoint = secp256k1.ProjectivePoint.fromHex(
    '02' + bytesToHex(internalKey),
  )

  // Compute tweaked point: P' = P + t*G
  const tweakPoint = secp256k1.ProjectivePoint.BASE.multiply(tweakScalar)
  const tweakedPoint = internalPoint.add(tweakPoint)

  // Get x-only representation
  const tweakedKeyBytes = tweakedPoint.toRawBytes(false)
  const xOnly = tweakedKeyBytes.slice(1, 33)

  // Determine parity (whether y coordinate is even or odd)
  const yCoord = tweakedKeyBytes.slice(33, 65)
  const yBigInt = BigInt('0x' + bytesToHex(yCoord))
  const parity = Number(yBigInt & 1n)

  return {
    tweakedKey: xOnly,
    parity,
  }
}

/**
 * Create a Taproot output
 * Implements BIP-341 output construction
 *
 * @param internalKey - Internal public key (32 bytes, x-only)
 * @param scripts - Optional tapscripts for the tree
 * @returns Taproot output structure
 */
export function createTaprootOutput(
  internalKey: Uint8Array,
  scripts?: TapScript[],
): TaprootOutput {
  if (internalKey.length !== 32) {
    throw new ValidationError('internalKey must be 32 bytes (x-only)', 'internalKey')
  }

  // If no scripts, merkle_root is empty
  let merkleRoot: Uint8Array | undefined

  if (scripts && scripts.length > 0) {
    // For now, we implement simple single-leaf case
    // Full merkle tree construction would be more complex
    if (scripts.length === 1) {
      // Single script: merkle_root = hash_TapLeaf(script)
      const script = scripts[0]
      const leafData = new Uint8Array([
        script.leafVersion,
        script.script.length,
        ...script.script,
      ])
      merkleRoot = taggedHash('TapLeaf', leafData)
    } else {
      // Multiple scripts require merkle tree construction
      // This is a simplified implementation - full BIP-341 would sort and hash pairs
      throw new ValidationError(
        'Multiple tapscripts not yet implemented - use single script or no scripts',
        'scripts',
      )
    }
  }

  // Compute tweaked key
  const { tweakedKey, parity } = computeTweakedKey(internalKey, merkleRoot)

  return {
    tweakedKey: `0x${bytesToHex(tweakedKey)}` as HexString,
    internalKey: `0x${bytesToHex(internalKey)}` as HexString,
    merkleRoot: merkleRoot ? (`0x${bytesToHex(merkleRoot)}` as HexString) : undefined,
    parity,
  }
}

/**
 * Bech32m polymod for checksum computation
 */
function bech32Polymod(values: number[]): number {
  let chk = 1
  for (const value of values) {
    const top = chk >> 25
    chk = ((chk & 0x1ffffff) << 5) ^ value
    for (let i = 0; i < 5; i++) {
      if ((top >> i) & 1) {
        chk ^= BECH32_GENERATOR[i]
      }
    }
  }
  return chk
}

/**
 * Expand HRP for bech32m checksum
 */
function bech32HrpExpand(hrp: string): number[] {
  const result: number[] = []
  for (let i = 0; i < hrp.length; i++) {
    result.push(hrp.charCodeAt(i) >> 5)
  }
  result.push(0)
  for (let i = 0; i < hrp.length; i++) {
    result.push(hrp.charCodeAt(i) & 31)
  }
  return result
}

/**
 * Verify bech32m checksum
 */
function bech32VerifyChecksum(hrp: string, data: number[]): boolean {
  return bech32Polymod([...bech32HrpExpand(hrp), ...data]) === 0x2bc830a3
}

/**
 * Create bech32m checksum
 */
function bech32CreateChecksum(hrp: string, data: number[]): number[] {
  const values = [...bech32HrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0]
  const polymod = bech32Polymod(values) ^ 0x2bc830a3
  const checksum: number[] = []
  for (let i = 0; i < 6; i++) {
    checksum.push((polymod >> (5 * (5 - i))) & 31)
  }
  return checksum
}

/**
 * Convert 8-bit bytes to 5-bit groups for bech32
 */
function convertBits(
  data: Uint8Array,
  fromBits: number,
  toBits: number,
  pad: boolean,
): number[] | null {
  let acc = 0
  let bits = 0
  const result: number[] = []
  const maxv = (1 << toBits) - 1

  for (const value of data) {
    if (value < 0 || value >> fromBits !== 0) {
      return null
    }
    acc = (acc << fromBits) | value
    bits += fromBits
    while (bits >= toBits) {
      bits -= toBits
      result.push((acc >> bits) & maxv)
    }
  }

  if (pad) {
    if (bits > 0) {
      result.push((acc << (toBits - bits)) & maxv)
    }
  } else if (bits >= fromBits || (acc << (toBits - bits)) & maxv) {
    return null
  }

  return result
}

/**
 * Encode Taproot address using Bech32m (BIP-350)
 *
 * @param tweakedKey - 32-byte tweaked x-only public key
 * @param network - Bitcoin network (mainnet, testnet, regtest)
 * @returns Bech32m encoded Taproot address (bc1p... for mainnet)
 */
export function taprootAddress(
  tweakedKey: Uint8Array,
  network: BitcoinNetwork = 'mainnet',
): string {
  if (tweakedKey.length !== 32) {
    throw new ValidationError('tweakedKey must be 32 bytes', 'tweakedKey')
  }

  // Get HRP (Human Readable Part) based on network
  const hrp = network === 'mainnet' ? 'bc' : network === 'testnet' ? 'tb' : 'bcrt'

  // Witness version 1 (Taproot)
  const version = 1

  // Convert to 5-bit groups
  const words = convertBits(tweakedKey, 8, 5, true)
  if (!words) {
    throw new ValidationError('Failed to convert tweaked key to bech32 format', 'tweakedKey')
  }

  // Prepend version
  const data = [version, ...words]

  // Create checksum
  const checksum = bech32CreateChecksum(hrp, data)

  // Encode
  const combined = [...data, ...checksum]
  let result = hrp + '1'
  for (const value of combined) {
    result += BECH32_CHARSET[value]
  }

  return result
}

/**
 * Decode a Taproot address
 *
 * @param address - Bech32m encoded address (bc1p... or tb1p...)
 * @returns Decoded tweaked key and network
 * @throws {ValidationError} If address is invalid
 */
export function decodeTaprootAddress(address: string): {
  tweakedKey: Uint8Array
  network: BitcoinNetwork
} {
  // Validate format
  if (typeof address !== 'string' || address.length < 14 || address.length > 90) {
    throw new ValidationError('Invalid Taproot address format', 'address')
  }

  const addressLower = address.toLowerCase()

  // Find separator
  const sepIndex = addressLower.lastIndexOf('1')
  if (sepIndex === -1 || sepIndex + 7 > addressLower.length) {
    throw new ValidationError('Invalid Taproot address: no separator', 'address')
  }

  // Extract HRP and data
  const hrp = addressLower.slice(0, sepIndex)
  const dataStr = addressLower.slice(sepIndex + 1)

  // Determine network
  let network: BitcoinNetwork
  if (hrp === 'bc') {
    network = 'mainnet'
  } else if (hrp === 'tb') {
    network = 'testnet'
  } else if (hrp === 'bcrt') {
    network = 'regtest'
  } else {
    throw new ValidationError(`Unknown HRP: ${hrp}`, 'address')
  }

  // Decode data
  const data: number[] = []
  for (const char of dataStr) {
    const index = BECH32_CHARSET.indexOf(char)
    if (index === -1) {
      throw new ValidationError(`Invalid bech32 character: ${char}`, 'address')
    }
    data.push(index)
  }

  // Verify checksum
  if (!bech32VerifyChecksum(hrp, data)) {
    throw new ValidationError('Invalid Taproot address checksum', 'address')
  }

  // Extract witness version and program
  const version = data[0]
  if (version !== 1) {
    throw new ValidationError(`Expected witness version 1 (Taproot), got ${version}`, 'address')
  }

  // Convert from 5-bit to 8-bit
  const program = convertBits(new Uint8Array(data.slice(1, -6)), 5, 8, false)
  if (!program || program.length !== 32) {
    throw new ValidationError('Invalid Taproot program length', 'address')
  }

  return {
    tweakedKey: new Uint8Array(program),
    network,
  }
}

/**
 * Create a Taproot key-spend-only output (no scripts)
 * This is the most common case for Silent Payments
 *
 * @param privateKey - 32-byte private key (will be used as internal key)
 * @returns Taproot output and address
 */
export function createKeySpendOnlyOutput(
  privateKey: HexString,
  network: BitcoinNetwork = 'mainnet',
): {
  output: TaprootOutput
  address: string
  internalPrivateKey: HexString
} {
  if (!isValidPrivateKey(privateKey)) {
    throw new ValidationError('privateKey must be a valid 32-byte hex string', 'privateKey')
  }

  const privKeyBytes = hexToBytes(privateKey.slice(2))

  // Get x-only public key
  const internalKey = getXOnlyPublicKey(privKeyBytes)

  // Create taproot output (no scripts)
  const output = createTaprootOutput(internalKey)

  // Generate address
  const tweakedKeyBytes = hexToBytes(output.tweakedKey.slice(2))
  const address = taprootAddress(tweakedKeyBytes, network)

  return {
    output,
    address,
    internalPrivateKey: privateKey,
  }
}

/**
 * Validate a Taproot address format
 *
 * @param address - Address to validate
 * @returns true if valid Taproot address
 */
export function isValidTaprootAddress(address: string): boolean {
  try {
    decodeTaprootAddress(address)
    return true
  } catch {
    return false
  }
}

/**
 * Sign a message with Schnorr signature using hex inputs
 * Convenience wrapper for schnorrSign
 *
 * @param message - 32-byte message as hex string
 * @param privateKey - 32-byte private key as hex string
 * @param auxRand - Optional 32-byte auxiliary random data as hex string
 * @returns 64-byte signature as hex string
 */
export function schnorrSignHex(
  message: HexString,
  privateKey: HexString,
  auxRand?: HexString,
): HexString {
  if (!isValidHex(message)) {
    throw new ValidationError('message must be a hex string', 'message')
  }

  if (!isValidPrivateKey(privateKey)) {
    throw new ValidationError('privateKey must be a valid 32-byte hex string', 'privateKey')
  }

  if (auxRand && !isValidHex(auxRand)) {
    throw new ValidationError('auxRand must be a hex string', 'auxRand')
  }

  const messageBytes = hexToBytes(message.slice(2))
  const privateKeyBytes = hexToBytes(privateKey.slice(2))
  const auxRandBytes = auxRand ? hexToBytes(auxRand.slice(2)) : undefined

  const signature = schnorrSign(messageBytes, privateKeyBytes, auxRandBytes)

  return `0x${bytesToHex(signature)}` as HexString
}

/**
 * Verify a Schnorr signature using hex inputs
 * Convenience wrapper for schnorrVerify
 *
 * @param signature - 64-byte signature as hex string
 * @param message - 32-byte message as hex string
 * @param publicKey - 32-byte x-only public key as hex string
 * @returns true if signature is valid
 */
export function schnorrVerifyHex(
  signature: HexString,
  message: HexString,
  publicKey: HexString,
): boolean {
  if (!isValidHex(signature)) {
    throw new ValidationError('signature must be a hex string', 'signature')
  }

  if (!isValidHex(message)) {
    throw new ValidationError('message must be a hex string', 'message')
  }

  if (!isValidHex(publicKey)) {
    throw new ValidationError('publicKey must be a hex string', 'publicKey')
  }

  const signatureBytes = hexToBytes(signature.slice(2))
  const messageBytes = hexToBytes(message.slice(2))
  const publicKeyBytes = hexToBytes(publicKey.slice(2))

  return schnorrVerify(signatureBytes, messageBytes, publicKeyBytes)
}
