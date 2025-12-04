/**
 * Bitcoin Silent Payments (BIP-352) Implementation
 *
 * Implements Silent Payments for Bitcoin - a protocol for reusable payment codes
 * that eliminate address reuse without requiring sender-receiver interaction.
 *
 * Spec: https://github.com/bitcoin/bips/blob/master/bip-0352.mediawiki
 *
 * Key features:
 * - Reusable payment addresses (sp1q... for mainnet)
 * - No on-chain overhead or sender-receiver interaction
 * - Supports labels for payment categorization
 * - Separates scanning (online) from spending (offline) responsibilities
 *
 * @module bitcoin/silent-payments
 */

import { secp256k1 } from '@noble/curves/secp256k1'
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import type { HexString } from '@sip-protocol/types'
import { ValidationError } from '../errors'
import { isValidHex, isValidPrivateKey } from '../validation'
import type { BitcoinNetwork } from './taproot'

/**
 * Silent Payment address structure (BIP-352)
 */
export interface SilentPaymentAddress {
  /** Full bech32m-encoded address (sp1q... or sp1t...) */
  address: string
  /** 33-byte compressed scan public key */
  scanPubKey: HexString
  /** 33-byte compressed spend public key */
  spendPubKey: HexString
  /** Network the address is for */
  network: BitcoinNetwork
  /** Optional label (m) for payment categorization */
  label?: number
}

/**
 * Parsed silent payment address (decoded from string)
 */
export interface ParsedSilentPaymentAddress {
  /** 33-byte compressed scan public key */
  scanPubKey: Uint8Array
  /** 33-byte compressed spend public key */
  spendPubKey: Uint8Array
  /** Network the address is for */
  network: BitcoinNetwork
  /** Version (currently must be 0) */
  version: number
}

/**
 * Sender's input for creating a silent payment
 */
export interface SenderInput {
  /** Transaction ID of the UTXO being spent */
  txid: string
  /** Output index */
  vout: number
  /** Script pubkey of the UTXO */
  scriptPubKey: Uint8Array
  /** Private key for signing (32 bytes) */
  privateKey: Uint8Array
  /** Whether this is a taproot keypath spend */
  isTaprootKeyPath?: boolean
  /** Taproot internal key if isTaprootKeyPath is true */
  taprootInternalKey?: Uint8Array
}

/**
 * Silent payment output created by sender
 */
export interface SilentPaymentOutput {
  /** P2TR scriptPubKey (OP_1 + 32-byte tweaked pubkey) */
  scriptPubKey: Uint8Array
  /** Amount in satoshis */
  amount: bigint
  /** Tweaked public key (32 bytes x-only) */
  tweakedPubKey: Uint8Array
}

/**
 * Output to scan by recipient
 */
export interface OutputToScan {
  /** Output index in transaction */
  outputIndex: number
  /** P2TR scriptPubKey to check */
  scriptPubKey: Uint8Array
  /** Amount in satoshis */
  amount: bigint
}

/**
 * Payment received by recipient (after scanning)
 */
export interface ReceivedPayment {
  /** Output index in the transaction */
  outputIndex: number
  /** Amount received in satoshis */
  amount: bigint
  /** Tweak data used to derive the private key */
  tweakData: Uint8Array
  /** Tweaked public key */
  tweakedPubKey: Uint8Array
}

// ═══════════════════════════════════════════════════════════════════════════════
// BECH32M ENCODING (BIP-350)
// ═══════════════════════════════════════════════════════════════════════════════

/** Bech32m character set */
const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'

/** Bech32m generator values */
const BECH32_GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]

/** Bech32m constant (different from bech32) */
const BECH32M_CONST = 0x2bc830a3

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
  return bech32Polymod([...bech32HrpExpand(hrp), ...data]) === BECH32M_CONST
}

/**
 * Create bech32m checksum
 */
function bech32CreateChecksum(hrp: string, data: number[]): number[] {
  const values = [...bech32HrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0]
  const polymod = bech32Polymod(values) ^ BECH32M_CONST
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
 * Encode data to bech32m string
 */
function encodeBech32m(hrp: string, version: number, data: Uint8Array): string {
  // Convert to 5-bit groups
  const words = convertBits(data, 8, 5, true)
  if (!words) {
    throw new ValidationError('Failed to convert data to bech32m format', 'data')
  }

  // Prepend version
  const dataWithVersion = [version, ...words]

  // Create checksum
  const checksum = bech32CreateChecksum(hrp, dataWithVersion)

  // Encode
  const combined = [...dataWithVersion, ...checksum]
  let result = hrp + '1'
  for (const value of combined) {
    result += BECH32_CHARSET[value]
  }

  return result
}

/**
 * Decode bech32m string
 */
function decodeBech32m(address: string): {
  hrp: string
  version: number
  data: Uint8Array
} {
  // Validate format
  if (typeof address !== 'string' || address.length < 8 || address.length > 120) {
    throw new ValidationError('Invalid bech32m address format', 'address')
  }

  const addressLower = address.toLowerCase()

  // Find separator
  const sepIndex = addressLower.lastIndexOf('1')
  if (sepIndex === -1 || sepIndex + 7 > addressLower.length) {
    throw new ValidationError('Invalid bech32m address: no separator', 'address')
  }

  // Extract HRP and data
  const hrp = addressLower.slice(0, sepIndex)
  const dataStr = addressLower.slice(sepIndex + 1)

  // Decode data
  const data: number[] = []
  for (const char of dataStr) {
    const index = BECH32_CHARSET.indexOf(char)
    if (index === -1) {
      throw new ValidationError(`Invalid bech32m character: ${char}`, 'address')
    }
    data.push(index)
  }

  // Verify checksum
  if (!bech32VerifyChecksum(hrp, data)) {
    throw new ValidationError('Invalid bech32m checksum', 'address')
  }

  // Extract version and program
  const version = data[0]

  // Convert from 5-bit to 8-bit
  const program = convertBits(new Uint8Array(data.slice(1, -6)), 5, 8, false)
  if (!program) {
    throw new ValidationError('Invalid bech32m program', 'address')
  }

  return {
    hrp,
    version,
    data: new Uint8Array(program),
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BIP-352 TAGGED HASHES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Tagged hash for BIP-352 Silent Payments
 * Format: SHA256(SHA256(tag) || SHA256(tag) || data)
 */
function taggedHash(tag: string, data: Uint8Array): Uint8Array {
  const tagHash = sha256(new TextEncoder().encode(tag))
  const taggedData = new Uint8Array(tagHash.length * 2 + data.length)
  taggedData.set(tagHash, 0)
  taggedData.set(tagHash, tagHash.length)
  taggedData.set(data, tagHash.length * 2)
  return sha256(taggedData)
}

// ═══════════════════════════════════════════════════════════════════════════════
// SILENT PAYMENT ADDRESS GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a Silent Payment address (BIP-352)
 *
 * Creates a reusable payment address from scan and spend keys.
 *
 * @param scanKey - Scan private key (32 bytes)
 * @param spendKey - Spend private key (32 bytes)
 * @param network - Bitcoin network (mainnet, testnet, regtest)
 * @param label - Optional label for payment categorization (0-2^31-1)
 * @returns Silent Payment address structure
 *
 * @example
 * ```typescript
 * const scanKey = randomBytes(32)
 * const spendKey = randomBytes(32)
 * const address = generateSilentPaymentAddress(scanKey, spendKey, 'mainnet')
 * console.log(address.address) // sp1q...
 * ```
 */
export function generateSilentPaymentAddress(
  scanKey: Uint8Array,
  spendKey: Uint8Array,
  network: BitcoinNetwork = 'mainnet',
  label?: number,
): SilentPaymentAddress {
  // Validate inputs
  if (scanKey.length !== 32) {
    throw new ValidationError('scanKey must be 32 bytes', 'scanKey')
  }

  if (spendKey.length !== 32) {
    throw new ValidationError('spendKey must be 32 bytes', 'spendKey')
  }

  if (label !== undefined && (label < 0 || label > 2 ** 31 - 1 || !Number.isInteger(label))) {
    throw new ValidationError('label must be an integer between 0 and 2^31-1', 'label')
  }

  // Derive public keys (compressed)
  const scanPubKey = secp256k1.getPublicKey(scanKey, true)
  let spendPubKey = secp256k1.getPublicKey(spendKey, true)

  // If label is provided, tweak spend pubkey: B_m = B_spend + hash(b_scan || m)*G
  if (label !== undefined) {
    // Prepare label data: ser256(b_scan) || ser32(m)
    const labelData = new Uint8Array(36)
    labelData.set(scanKey, 0)
    // Write label as big-endian 32-bit integer
    const labelView = new DataView(labelData.buffer, 32, 4)
    labelView.setUint32(0, label, false)

    // Compute tweak: hash_BIP0352/Label(ser256(b_scan) || ser32(m))
    const tweak = taggedHash('BIP0352/Label', labelData)
    const tweakScalar = BigInt('0x' + bytesToHex(tweak)) % secp256k1.CURVE.n

    // Tweak spend pubkey: B_m = B_spend + tweak*G
    const spendPoint = secp256k1.ProjectivePoint.fromHex(spendPubKey)
    const tweakPoint = secp256k1.ProjectivePoint.BASE.multiply(tweakScalar)
    const tweakedPoint = spendPoint.add(tweakPoint)
    spendPubKey = tweakedPoint.toRawBytes(true)
  }

  // Encode as bech32m
  // Data: scanPubKey (33 bytes) || spendPubKey (33 bytes) = 66 bytes
  const addressData = new Uint8Array(66)
  addressData.set(scanPubKey, 0)
  addressData.set(spendPubKey, 33)

  // HRP based on network
  const hrp = network === 'mainnet' ? 'sp' : 'tsp'

  // Version 0
  const version = 0

  const address = encodeBech32m(hrp, version, addressData)

  return {
    address,
    scanPubKey: `0x${bytesToHex(scanPubKey)}` as HexString,
    spendPubKey: `0x${bytesToHex(spendPubKey)}` as HexString,
    network,
    label,
  }
}

/**
 * Parse a Silent Payment address
 *
 * Decodes a bech32m-encoded Silent Payment address (sp1q... or tsp1q...).
 *
 * @param address - Silent Payment address string
 * @returns Parsed address components
 *
 * @example
 * ```typescript
 * const parsed = parseSilentPaymentAddress('sp1q...')
 * console.log(parsed.scanPubKey) // 33-byte scan public key
 * console.log(parsed.spendPubKey) // 33-byte spend public key
 * ```
 */
export function parseSilentPaymentAddress(address: string): ParsedSilentPaymentAddress {
  // Decode bech32m
  const { hrp, version, data } = decodeBech32m(address)

  // Validate HRP
  let network: BitcoinNetwork
  if (hrp === 'sp') {
    network = 'mainnet'
  } else if (hrp === 'tsp') {
    network = 'testnet'
  } else {
    throw new ValidationError(`Unknown HRP for Silent Payment address: ${hrp}`, 'address')
  }

  // Version must be 0 for now
  if (version !== 0) {
    throw new ValidationError(`Unsupported Silent Payment version: ${version}`, 'address')
  }

  // Data must be exactly 66 bytes (33 for scan + 33 for spend)
  if (data.length !== 66) {
    throw new ValidationError(
      `Invalid Silent Payment address data length: expected 66 bytes, got ${data.length}`,
      'address',
    )
  }

  // Extract keys
  const scanPubKey = data.slice(0, 33)
  const spendPubKey = data.slice(33, 66)

  // Validate keys are valid compressed secp256k1 points
  try {
    secp256k1.ProjectivePoint.fromHex(scanPubKey)
    secp256k1.ProjectivePoint.fromHex(spendPubKey)
  } catch (err) {
    throw new ValidationError('Invalid public keys in Silent Payment address', 'address')
  }

  return {
    scanPubKey,
    spendPubKey,
    network,
    version,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SENDER: CREATE SILENT PAYMENT OUTPUT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a Silent Payment output (sender side)
 *
 * Generates a unique P2TR output for the recipient without requiring interaction.
 *
 * Algorithm (BIP-352):
 * 1. Sum input private keys: a = sum(a_i)
 * 2. Compute input_hash = hash(outpoint_L || A) where A = a*G
 * 3. Compute shared secret: ecdh_shared_secret = input_hash * a * B_scan
 * 4. Derive tweak: t_k = hash(ecdh_shared_secret || ser32(k))
 * 5. Create output: P_k = B_spend + t_k*G
 *
 * @param recipientAddress - Recipient's Silent Payment address (sp1q...)
 * @param senderInputs - UTXOs being spent by sender
 * @param amount - Amount in satoshis
 * @param outputIndex - Output index (k) for this recipient (default 0)
 * @returns Silent Payment output (P2TR scriptPubKey)
 *
 * @example
 * ```typescript
 * const output = createSilentPaymentOutput(
 *   'sp1q...',
 *   [{ txid: '...', vout: 0, scriptPubKey, privateKey }],
 *   100000n,
 *   0
 * )
 * ```
 */
export function createSilentPaymentOutput(
  recipientAddress: string,
  senderInputs: SenderInput[],
  amount: bigint,
  outputIndex: number = 0,
): SilentPaymentOutput {
  // Validate inputs
  if (senderInputs.length === 0) {
    throw new ValidationError('At least one sender input is required', 'senderInputs')
  }

  if (amount <= 0n) {
    throw new ValidationError('Amount must be greater than zero', 'amount')
  }

  if (outputIndex < 0 || !Number.isInteger(outputIndex)) {
    throw new ValidationError('outputIndex must be a non-negative integer', 'outputIndex')
  }

  // Parse recipient address
  const parsed = parseSilentPaymentAddress(recipientAddress)

  // Step 1: Sum input private keys and compute aggregate public key
  let aggregateScalar = 0n
  const inputPublicKeys: Uint8Array[] = []

  for (const input of senderInputs) {
    if (input.privateKey.length !== 32) {
      throw new ValidationError('privateKey must be 32 bytes', 'input.privateKey')
    }

    // Get scalar from private key
    const scalar = BigInt('0x' + bytesToHex(input.privateKey)) % secp256k1.CURVE.n

    // For taproot keypath spends, negate if Y coordinate is odd
    let adjustedScalar = scalar
    if (input.isTaprootKeyPath && input.taprootInternalKey) {
      // Get Y coordinate from public key
      const pubKey = secp256k1.getPublicKey(input.privateKey, false)
      const yCoord = pubKey.slice(33, 65)
      const yBigInt = BigInt('0x' + bytesToHex(yCoord))
      const isOddY = (yBigInt & 1n) === 1n

      if (isOddY) {
        // Negate the private key
        adjustedScalar = secp256k1.CURVE.n - scalar
      }
    }

    aggregateScalar = (aggregateScalar + adjustedScalar) % secp256k1.CURVE.n
    const pubKey = secp256k1.getPublicKey(input.privateKey, true)
    inputPublicKeys.push(pubKey)
  }

  if (aggregateScalar === 0n) {
    throw new ValidationError('Aggregate private key cannot be zero', 'senderInputs')
  }

  // Compute aggregate public key
  const aggregatePubKey = secp256k1.ProjectivePoint.BASE.multiply(aggregateScalar).toRawBytes(true)

  // Step 2: Compute input_hash
  // Find smallest outpoint lexicographically
  const outpoints = senderInputs.map((input) => {
    // Reverse txid for little-endian (Bitcoin convention)
    const txidBytes = hexToBytes(input.txid.replace(/^0x/, ''))
    const txidLE = new Uint8Array(txidBytes).reverse()
    const voutBytes = new Uint8Array(4)
    new DataView(voutBytes.buffer).setUint32(0, input.vout, true) // little-endian
    return { txid: txidLE, vout: voutBytes }
  })

  // Sort lexicographically
  outpoints.sort((a, b) => {
    for (let i = 0; i < 32; i++) {
      if (a.txid[i] !== b.txid[i]) {
        return a.txid[i] - b.txid[i]
      }
    }
    for (let i = 0; i < 4; i++) {
      if (a.vout[i] !== b.vout[i]) {
        return a.vout[i] - b.vout[i]
      }
    }
    return 0
  })

  const smallestOutpoint = new Uint8Array(36)
  smallestOutpoint.set(outpoints[0].txid, 0)
  smallestOutpoint.set(outpoints[0].vout, 32)

  // input_hash = hash_BIP0352/Inputs(outpoint_L || A)
  const inputHashData = new Uint8Array(36 + 33)
  inputHashData.set(smallestOutpoint, 0)
  inputHashData.set(aggregatePubKey, 36)
  const inputHash = taggedHash('BIP0352/Inputs', inputHashData)

  // Step 3: Compute shared secret
  // ecdh_shared_secret = input_hash * a * B_scan
  const inputHashScalar = BigInt('0x' + bytesToHex(inputHash)) % secp256k1.CURVE.n
  const sharedSecretScalar = (inputHashScalar * aggregateScalar) % secp256k1.CURVE.n
  const scanPubKeyPoint = secp256k1.ProjectivePoint.fromHex(parsed.scanPubKey)
  const sharedSecretPoint = scanPubKeyPoint.multiply(sharedSecretScalar)
  const sharedSecret = sharedSecretPoint.toRawBytes(true)

  // Step 4: Derive tweak for output k
  // t_k = hash_BIP0352/SharedSecret(ecdh_shared_secret || ser32(k))
  const tweakData = new Uint8Array(33 + 4)
  tweakData.set(sharedSecret, 0)
  new DataView(tweakData.buffer, 33, 4).setUint32(0, outputIndex, false) // big-endian
  const tweak = taggedHash('BIP0352/SharedSecret', tweakData)
  const tweakScalar = BigInt('0x' + bytesToHex(tweak)) % secp256k1.CURVE.n

  // Step 5: Create output public key
  // P_k = B_spend + t_k*G
  const spendPubKeyPoint = secp256k1.ProjectivePoint.fromHex(parsed.spendPubKey)
  const tweakPoint = secp256k1.ProjectivePoint.BASE.multiply(tweakScalar)
  const outputPubKeyPoint = spendPubKeyPoint.add(tweakPoint)
  const outputPubKey = outputPubKeyPoint.toRawBytes(false) // uncompressed

  // Extract x-only public key (32 bytes, for P2TR)
  const xOnlyPubKey = outputPubKey.slice(1, 33)

  // Create P2TR scriptPubKey: OP_1 (0x51) + 32-byte x-only pubkey
  const scriptPubKey = new Uint8Array(34)
  scriptPubKey[0] = 0x51 // OP_1
  scriptPubKey[1] = 0x20 // 32 bytes
  scriptPubKey.set(xOnlyPubKey, 2)

  return {
    scriptPubKey,
    amount,
    tweakedPubKey: xOnlyPubKey,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECIPIENT: SCAN FOR PAYMENTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Scan for Silent Payments (recipient side)
 *
 * Scans transaction outputs to find payments to the recipient's Silent Payment address.
 *
 * Algorithm (BIP-352):
 * 1. Extract input public keys from transaction
 * 2. Compute input_hash = hash(outpoint_L || A) where A = sum(A_i)
 * 3. Compute shared secret: ecdh_shared_secret = input_hash * b_scan * A
 * 4. For each output index k, compute: P_k = B_spend + hash(ecdh_shared_secret || k)*G
 * 5. Check if computed P_k matches any transaction output
 *
 * @param scanPrivateKey - Recipient's scan private key (32 bytes)
 * @param spendPublicKey - Recipient's spend public key (33 bytes compressed)
 * @param inputPubKeys - Public keys from transaction inputs
 * @param outpoints - Transaction outpoints (for input_hash)
 * @param outputs - Transaction outputs to scan
 * @returns Array of received payments
 *
 * @example
 * ```typescript
 * const received = scanForPayments(
 *   scanPrivKey,
 *   spendPubKey,
 *   [inputPubKey1, inputPubKey2],
 *   [{ txid: '...', vout: 0 }],
 *   [{ outputIndex: 0, scriptPubKey, amount: 100000n }]
 * )
 * ```
 */
export function scanForPayments(
  scanPrivateKey: Uint8Array,
  spendPublicKey: Uint8Array,
  inputPubKeys: Uint8Array[],
  outpoints: Array<{ txid: string; vout: number }>,
  outputs: OutputToScan[],
): ReceivedPayment[] {
  // Validate inputs
  if (scanPrivateKey.length !== 32) {
    throw new ValidationError('scanPrivateKey must be 32 bytes', 'scanPrivateKey')
  }

  if (spendPublicKey.length !== 33) {
    throw new ValidationError('spendPublicKey must be 33 bytes (compressed)', 'spendPublicKey')
  }

  if (inputPubKeys.length === 0) {
    throw new ValidationError('At least one input public key is required', 'inputPubKeys')
  }

  if (outpoints.length === 0) {
    throw new ValidationError('At least one outpoint is required', 'outpoints')
  }

  // Step 1: Aggregate input public keys
  let aggregatePoint = secp256k1.ProjectivePoint.ZERO
  for (const pubKey of inputPubKeys) {
    if (pubKey.length !== 33) {
      throw new ValidationError('Input public key must be 33 bytes (compressed)', 'inputPubKeys')
    }
    const point = secp256k1.ProjectivePoint.fromHex(pubKey)
    aggregatePoint = aggregatePoint.add(point)
  }

  const aggregatePubKey = aggregatePoint.toRawBytes(true)

  // Step 2: Compute input_hash
  // Find smallest outpoint
  const sortedOutpoints = [...outpoints].sort((a, b) => {
    const aTxid = hexToBytes(a.txid.replace(/^0x/, ''))
    const bTxid = hexToBytes(b.txid.replace(/^0x/, ''))
    for (let i = 0; i < 32; i++) {
      if (aTxid[i] !== bTxid[i]) return aTxid[i] - bTxid[i]
    }
    return a.vout - b.vout
  })

  const smallestOutpoint = new Uint8Array(36)
  const txidBytes = hexToBytes(sortedOutpoints[0].txid.replace(/^0x/, ''))
  smallestOutpoint.set(new Uint8Array(txidBytes).reverse(), 0) // little-endian
  new DataView(smallestOutpoint.buffer, 32, 4).setUint32(
    0,
    sortedOutpoints[0].vout,
    true,
  ) // little-endian

  const inputHashData = new Uint8Array(36 + 33)
  inputHashData.set(smallestOutpoint, 0)
  inputHashData.set(aggregatePubKey, 36)
  const inputHash = taggedHash('BIP0352/Inputs', inputHashData)

  // Step 3: Compute shared secret
  const inputHashScalar = BigInt('0x' + bytesToHex(inputHash)) % secp256k1.CURVE.n
  const scanScalar = BigInt('0x' + bytesToHex(scanPrivateKey)) % secp256k1.CURVE.n
  const sharedSecretScalar = (inputHashScalar * scanScalar) % secp256k1.CURVE.n
  const aggregatePointFromPubKey = secp256k1.ProjectivePoint.fromHex(aggregatePubKey)
  const sharedSecretPoint = aggregatePointFromPubKey.multiply(sharedSecretScalar)
  const sharedSecret = sharedSecretPoint.toRawBytes(true)

  // Step 4: Scan outputs
  const receivedPayments: ReceivedPayment[] = []
  const spendPubKeyPoint = secp256k1.ProjectivePoint.fromHex(spendPublicKey)

  for (let k = 0; k < outputs.length; k++) {
    const output = outputs[k]

    // Only scan P2TR outputs (OP_1 + 32 bytes)
    if (output.scriptPubKey.length !== 34) continue
    if (output.scriptPubKey[0] !== 0x51 || output.scriptPubKey[1] !== 0x20) continue

    const outputXOnly = output.scriptPubKey.slice(2, 34)

    // Compute expected output for index k
    const tweakData = new Uint8Array(33 + 4)
    tweakData.set(sharedSecret, 0)
    new DataView(tweakData.buffer, 33, 4).setUint32(0, k, false) // big-endian
    const tweak = taggedHash('BIP0352/SharedSecret', tweakData)
    const tweakScalar = BigInt('0x' + bytesToHex(tweak)) % secp256k1.CURVE.n

    const tweakPoint = secp256k1.ProjectivePoint.BASE.multiply(tweakScalar)
    const expectedPoint = spendPubKeyPoint.add(tweakPoint)
    const expectedPubKey = expectedPoint.toRawBytes(false) // uncompressed
    const expectedXOnly = expectedPubKey.slice(1, 33)

    // Check if matches
    if (bytesToHex(expectedXOnly) === bytesToHex(outputXOnly)) {
      receivedPayments.push({
        outputIndex: output.outputIndex,
        amount: output.amount,
        tweakData: tweak,
        tweakedPubKey: expectedXOnly,
      })
    }
  }

  return receivedPayments
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECIPIENT: DERIVE SPENDING KEY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Derive spending key for a received Silent Payment (recipient side)
 *
 * Allows recipient to compute the private key needed to spend a received output.
 *
 * Algorithm (BIP-352):
 * - Spending key: p_k = (b_spend + t_k) mod n
 * - Where t_k is the tweak from scanning
 *
 * @param payment - Received payment from scanForPayments()
 * @param spendPrivateKey - Recipient's spend private key (32 bytes)
 * @returns Private key for spending the output (32 bytes)
 *
 * @example
 * ```typescript
 * const payments = scanForPayments(...)
 * for (const payment of payments) {
 *   const privKey = deriveSpendingKey(payment, spendPrivKey)
 *   // Use privKey to sign transaction spending this output
 * }
 * ```
 */
export function deriveSpendingKey(
  payment: ReceivedPayment,
  spendPrivateKey: Uint8Array,
): Uint8Array {
  // Validate inputs
  if (spendPrivateKey.length !== 32) {
    throw new ValidationError('spendPrivateKey must be 32 bytes', 'spendPrivateKey')
  }

  if (payment.tweakData.length !== 32) {
    throw new ValidationError('payment.tweakData must be 32 bytes', 'payment.tweakData')
  }

  // Compute spending key: p_k = (b_spend + t_k) mod n
  const spendScalar = BigInt('0x' + bytesToHex(spendPrivateKey)) % secp256k1.CURVE.n
  const tweakScalar = BigInt('0x' + bytesToHex(payment.tweakData)) % secp256k1.CURVE.n
  let spendingScalar = (spendScalar + tweakScalar) % secp256k1.CURVE.n

  // Convert to bytes (big-endian)
  const spendingKey = new Uint8Array(32)
  for (let i = 31; i >= 0; i--) {
    spendingKey[i] = Number(spendingScalar & 0xffn)
    spendingScalar >>= 8n
  }

  return spendingKey
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate a Silent Payment address format
 *
 * @param address - Address to validate
 * @returns true if valid
 */
export function isValidSilentPaymentAddress(address: string): boolean {
  try {
    parseSilentPaymentAddress(address)
    return true
  } catch {
    return false
  }
}

/**
 * Convert HexString private key to Uint8Array
 */
export function hexToPrivateKey(key: HexString): Uint8Array {
  if (!isValidPrivateKey(key)) {
    throw new ValidationError('Invalid private key format', 'key')
  }
  return hexToBytes(key.slice(2))
}

/**
 * Convert HexString public key to Uint8Array
 */
export function hexToPublicKey(key: HexString): Uint8Array {
  if (!isValidHex(key)) {
    throw new ValidationError('Invalid public key format', 'key')
  }
  return hexToBytes(key.slice(2))
}
