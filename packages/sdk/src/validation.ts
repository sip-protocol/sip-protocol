/**
 * Input validation utilities for SIP Protocol SDK
 *
 * Provides comprehensive validation for all public API inputs.
 */

import type {
  PrivacyLevel,
  ChainId,
  Asset,
  IntentInput,
  IntentOutput,
  CreateIntentParams,
  HexString,
} from '@sip-protocol/types'
import { ValidationError } from './errors'

// ─── Chain IDs ─────────────────────────────────────────────────────────────────

/**
 * Valid chain identifiers
 */
const VALID_CHAIN_IDS: readonly ChainId[] = [
  'solana',
  'ethereum',
  'near',
  'zcash',
  'polygon',
  'arbitrum',
  'optimism',
  'base',
  'bitcoin',
  'aptos',
  'sui',
  'cosmos',
  'osmosis',
  'injective',
  'celestia',
  'sei',
  'dydx',
] as const

/**
 * Check if a string is a valid chain ID
 */
export function isValidChainId(chain: string): chain is ChainId {
  return VALID_CHAIN_IDS.includes(chain as ChainId)
}

// ─── Privacy Levels ────────────────────────────────────────────────────────────

/**
 * Valid privacy levels
 */
const VALID_PRIVACY_LEVELS: readonly PrivacyLevel[] = [
  'transparent',
  'shielded',
  'compliant',
] as unknown as readonly PrivacyLevel[]

/**
 * Check if a value is a valid privacy level
 */
export function isValidPrivacyLevel(level: unknown): level is PrivacyLevel {
  if (typeof level !== 'string') return false
  return ['transparent', 'shielded', 'compliant'].includes(level)
}

// ─── Hex Strings ───────────────────────────────────────────────────────────────

/**
 * Check if a string is valid hex format (with 0x prefix)
 */
export function isValidHex(value: string): value is HexString {
  if (typeof value !== 'string') return false
  if (!value.startsWith('0x')) return false
  const hex = value.slice(2)
  if (hex.length === 0) return false
  return /^[0-9a-fA-F]+$/.test(hex)
}

/**
 * Check if a hex string has a specific byte length
 */
export function isValidHexLength(value: string, byteLength: number): boolean {
  if (!isValidHex(value)) return false
  const hex = value.slice(2)
  return hex.length === byteLength * 2
}

// ─── Amount Validation ─────────────────────────────────────────────────────────

/**
 * Check if an amount is valid (positive bigint)
 */
export function isValidAmount(value: unknown): value is bigint {
  return typeof value === 'bigint' && value > 0n
}

/**
 * Check if an amount is non-negative
 */
export function isNonNegativeAmount(value: unknown): value is bigint {
  return typeof value === 'bigint' && value >= 0n
}

// ─── Slippage Validation ───────────────────────────────────────────────────────

/**
 * Check if slippage is in valid range (0 to 1, exclusive of 1)
 */
export function isValidSlippage(value: number): boolean {
  return typeof value === 'number' && !isNaN(value) && value >= 0 && value < 1
}

// ─── Stealth Address Validation ────────────────────────────────────────────────

/**
 * SIP stealth meta-address format:
 * sip:<chain>:<spendingKey>:<viewingKey>
 * Keys can be:
 * - secp256k1: 33 bytes compressed (66 hex chars with 0x prefix)
 * - ed25519: 32 bytes (64 hex chars with 0x prefix)
 */
const STEALTH_META_ADDRESS_REGEX = /^sip:[a-z]+:0x[0-9a-fA-F]{64,66}:0x[0-9a-fA-F]{64,66}$/

/**
 * Check if a string is a valid stealth meta-address
 */
export function isValidStealthMetaAddress(addr: string): boolean {
  if (typeof addr !== 'string') return false
  return STEALTH_META_ADDRESS_REGEX.test(addr)
}

/**
 * Check if a public key is valid (compressed secp256k1: 33 bytes)
 */
export function isValidCompressedPublicKey(key: string): boolean {
  if (!isValidHexLength(key, 33)) return false
  // Compressed keys start with 02 or 03
  const prefix = key.slice(2, 4)
  return prefix === '02' || prefix === '03'
}

/**
 * Check if a public key is valid ed25519 (32 bytes)
 */
export function isValidEd25519PublicKey(key: string): boolean {
  return isValidHexLength(key, 32)
}

/**
 * Check if a private key is valid (32 bytes)
 */
export function isValidPrivateKey(key: string): boolean {
  return isValidHexLength(key, 32)
}

// ─── Asset Validation ──────────────────────────────────────────────────────────

/**
 * Validate an asset object
 */
export function validateAsset(asset: unknown, field: string): asserts asset is Asset {
  if (!asset || typeof asset !== 'object') {
    throw new ValidationError('must be an object', field)
  }

  const a = asset as Partial<Asset>

  if (!a.chain || !isValidChainId(a.chain)) {
    throw new ValidationError(
      `invalid chain '${a.chain}', must be one of: ${VALID_CHAIN_IDS.join(', ')}`,
      `${field}.chain`
    )
  }

  if (typeof a.symbol !== 'string' || a.symbol.length === 0) {
    throw new ValidationError('symbol must be a non-empty string', `${field}.symbol`)
  }

  if (a.address !== null && !isValidHex(a.address as string)) {
    throw new ValidationError('address must be null or valid hex string', `${field}.address`)
  }

  if (typeof a.decimals !== 'number' || !Number.isInteger(a.decimals) || a.decimals < 0) {
    throw new ValidationError('decimals must be a non-negative integer', `${field}.decimals`)
  }
}

// ─── Intent Input Validation ───────────────────────────────────────────────────

/**
 * Validate intent input
 */
export function validateIntentInput(input: unknown, field: string = 'input'): asserts input is IntentInput {
  if (!input || typeof input !== 'object') {
    throw new ValidationError('must be an object', field)
  }

  const i = input as Partial<IntentInput>

  // Validate asset
  validateAsset(i.asset, `${field}.asset`)

  // Validate amount
  if (!isValidAmount(i.amount)) {
    throw new ValidationError(
      'amount must be a positive bigint',
      `${field}.amount`,
      { received: typeof i.amount, value: String(i.amount) }
    )
  }
}

// ─── Intent Output Validation ──────────────────────────────────────────────────

/**
 * Validate intent output
 */
export function validateIntentOutput(output: unknown, field: string = 'output'): asserts output is IntentOutput {
  if (!output || typeof output !== 'object') {
    throw new ValidationError('must be an object', field)
  }

  const o = output as Partial<IntentOutput>

  // Validate asset
  validateAsset(o.asset, `${field}.asset`)

  // Validate minAmount
  if (!isNonNegativeAmount(o.minAmount)) {
    throw new ValidationError(
      'minAmount must be a non-negative bigint',
      `${field}.minAmount`,
      { received: typeof o.minAmount, value: String(o.minAmount) }
    )
  }

  // Validate maxSlippage
  if (!isValidSlippage(o.maxSlippage as number)) {
    throw new ValidationError(
      'maxSlippage must be a number between 0 and 1 (exclusive)',
      `${field}.maxSlippage`,
      { received: o.maxSlippage }
    )
  }
}

// ─── Create Intent Params Validation ───────────────────────────────────────────

/**
 * Validate CreateIntentParams
 */
export function validateCreateIntentParams(params: unknown): asserts params is CreateIntentParams {
  if (!params || typeof params !== 'object') {
    throw new ValidationError('params must be an object')
  }

  const p = params as Partial<CreateIntentParams>

  // Required: input
  if (!p.input) {
    throw new ValidationError('input is required', 'input')
  }
  validateIntentInput(p.input, 'input')

  // Required: output
  if (!p.output) {
    throw new ValidationError('output is required', 'output')
  }
  validateIntentOutput(p.output, 'output')

  // Required: privacy
  if (!p.privacy) {
    throw new ValidationError('privacy is required', 'privacy')
  }
  if (!isValidPrivacyLevel(p.privacy)) {
    throw new ValidationError(
      `invalid privacy level '${p.privacy}', must be one of: transparent, shielded, compliant`,
      'privacy'
    )
  }

  // Conditional: recipientMetaAddress for shielded modes
  if ((p.privacy === 'shielded' || p.privacy === 'compliant') && p.recipientMetaAddress) {
    if (!isValidStealthMetaAddress(p.recipientMetaAddress)) {
      throw new ValidationError(
        'invalid stealth meta-address format, expected: sip:<chain>:<spendingKey>:<viewingKey>',
        'recipientMetaAddress'
      )
    }
  }

  // Conditional: viewingKey for compliant mode
  if (p.privacy === 'compliant' && !p.viewingKey) {
    throw new ValidationError(
      'viewingKey is required for compliant mode',
      'viewingKey'
    )
  }

  if (p.viewingKey && !isValidHex(p.viewingKey)) {
    throw new ValidationError(
      'viewingKey must be a valid hex string',
      'viewingKey'
    )
  }

  // Optional: ttl
  if (p.ttl !== undefined) {
    if (typeof p.ttl !== 'number' || !Number.isInteger(p.ttl) || p.ttl <= 0) {
      throw new ValidationError(
        'ttl must be a positive integer (seconds)',
        'ttl',
        { received: p.ttl }
      )
    }
  }
}

// ─── Viewing Key Validation ────────────────────────────────────────────────────

/**
 * Validate a viewing key (32-byte hex string)
 */
export function validateViewingKey(key: unknown, field: string = 'viewingKey'): void {
  if (!key || typeof key !== 'string') {
    throw new ValidationError('must be a string', field)
  }

  if (!isValidHex(key)) {
    throw new ValidationError('must be a valid hex string with 0x prefix', field)
  }

  if (!isValidHexLength(key, 32)) {
    throw new ValidationError('must be 32 bytes (64 hex characters)', field)
  }
}

// ─── Scalar/Point Validation for Cryptographic Operations ──────────────────────

/**
 * secp256k1 curve order (n)
 */
const SECP256K1_ORDER = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n

/**
 * Check if a bigint is a valid scalar (1 <= x < n)
 */
export function isValidScalar(value: bigint): boolean {
  return value > 0n && value < SECP256K1_ORDER
}

/**
 * Validate a scalar value
 */
export function validateScalar(value: unknown, field: string): asserts value is bigint {
  if (typeof value !== 'bigint') {
    throw new ValidationError('must be a bigint', field)
  }

  if (!isValidScalar(value)) {
    throw new ValidationError(
      'must be in range (0, curve order)',
      field,
      { curveOrder: SECP256K1_ORDER.toString(16) }
    )
  }
}

// ─── Timestamp Validation ──────────────────────────────────────────────────────

/**
 * Validate a timestamp (positive integer, not in the past)
 */
export function validateTimestamp(
  value: unknown,
  field: string,
  options: { allowPast?: boolean } = {}
): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new ValidationError('must be a non-negative integer', field)
  }

  if (!options.allowPast && value < Date.now()) {
    throw new ValidationError('must not be in the past', field)
  }
}

// ─── Address Format Validation ──────────────────────────────────────────────────

/**
 * Check if an address is a valid EVM address (0x + 40 hex chars)
 */
export function isValidEvmAddress(address: string): boolean {
  if (typeof address !== 'string') return false
  return /^0x[0-9a-fA-F]{40}$/.test(address)
}

/**
 * Check if an address is a valid Solana address (base58, 32-44 chars)
 */
export function isValidSolanaAddressFormat(address: string): boolean {
  if (typeof address !== 'string') return false
  // Solana addresses are base58-encoded 32-byte public keys
  // Typically 32-44 characters, using base58 alphabet (no 0, O, I, l)
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
}

/**
 * Check if an address is a valid NEAR account ID (named or implicit)
 */
export function isValidNearAddressFormat(address: string): boolean {
  if (typeof address !== 'string') return false

  // Implicit account: 64 hex characters
  if (/^[0-9a-f]{64}$/.test(address)) return true

  // Named account: 2-64 chars, lowercase alphanumeric with . _ -
  if (address.length < 2 || address.length > 64) return false
  if (!/^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/.test(address)) return false
  if (address.includes('..')) return false

  return true
}

/**
 * Check if an address is a valid Cosmos bech32 address
 */
export function isValidCosmosAddressFormat(address: string): boolean {
  if (typeof address !== 'string') return false

  // Bech32 addresses follow pattern: prefix1[alphanumeric]
  // Typical length: 39-90 characters
  if (address.length < 39 || address.length > 90) return false

  // Check for valid bech32 format: prefix + '1' + data
  const bech32Pattern = /^[a-z]+1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{38,}$/
  return bech32Pattern.test(address)
}

/**
 * Get the expected address format for a chain
 */
export function getChainAddressType(chain: ChainId): 'evm' | 'solana' | 'near' | 'zcash' | 'cosmos' | 'unknown' {
  switch (chain) {
    case 'ethereum':
    case 'polygon':
    case 'arbitrum':
    case 'optimism':
    case 'base':
      return 'evm'
    case 'solana':
      return 'solana'
    case 'near':
      return 'near'
    case 'zcash':
      return 'zcash'
    case 'cosmos':
    case 'osmosis':
    case 'injective':
    case 'celestia':
    case 'sei':
    case 'dydx':
      return 'cosmos'
    default:
      return 'unknown'
  }
}

/**
 * Validate that an address matches the expected chain format
 *
 * @param address - The address to validate
 * @param chain - The chain the address should be valid for
 * @param field - Field name for error messages
 * @throws {ValidationError} If address format doesn't match chain
 */
export function validateAddressForChain(address: string, chain: ChainId, field: string = 'address'): void {
  const addressType = getChainAddressType(chain)

  switch (addressType) {
    case 'evm':
      if (!isValidEvmAddress(address)) {
        throw new ValidationError(
          `Invalid address format for ${chain}. Expected EVM address (0x + 40 hex chars), got: ${address.slice(0, 20)}...`,
          field,
          { chain, expectedFormat: '0x...', receivedFormat: address.startsWith('0x') ? 'hex but wrong length' : 'not hex' }
        )
      }
      break
    case 'solana':
      if (!isValidSolanaAddressFormat(address)) {
        throw new ValidationError(
          `Invalid address format for ${chain}. Expected Solana address (base58, 32-44 chars), got: ${address.slice(0, 20)}...`,
          field,
          { chain, expectedFormat: 'base58', receivedFormat: address.startsWith('0x') ? 'looks like EVM' : 'unknown' }
        )
      }
      break
    case 'near':
      if (!isValidNearAddressFormat(address)) {
        throw new ValidationError(
          `Invalid address format for ${chain}. Expected NEAR account ID (named or implicit), got: ${address.slice(0, 20)}...`,
          field,
          { chain, expectedFormat: 'alice.near or 64 hex chars' }
        )
      }
      break
    case 'zcash':
      // Zcash has multiple formats (t-addr, z-addr, u-addr) - accept any non-empty string for now
      if (!address || address.length === 0) {
        throw new ValidationError(
          `Invalid address format for ${chain}. Expected Zcash address.`,
          field,
          { chain }
        )
      }
      break
    case 'cosmos':
      // Cosmos chains use bech32 encoding - validate basic format
      if (!isValidCosmosAddressFormat(address)) {
        throw new ValidationError(
          `Invalid address format for ${chain}. Expected Cosmos bech32 address, got: ${address.slice(0, 20)}...`,
          field,
          { chain, expectedFormat: 'bech32' }
        )
      }
      break
    default:
      // Unknown chain - skip validation
      break
  }
}

/**
 * Check if an address format matches a chain (non-throwing version)
 */
export function isAddressValidForChain(address: string, chain: ChainId): boolean {
  try {
    validateAddressForChain(address, chain)
    return true
  } catch {
    return false
  }
}

// ─── Composite Validators ──────────────────────────────────────────────────────

/**
 * Validate multiple conditions and collect all errors
 */
export function validateAll(validators: Array<() => void>): void {
  const errors: ValidationError[] = []

  for (const validator of validators) {
    try {
      validator()
    } catch (e) {
      if (e instanceof ValidationError) {
        errors.push(e)
      } else {
        throw e
      }
    }
  }

  if (errors.length === 1) {
    throw errors[0]
  }

  if (errors.length > 1) {
    const messages = errors.map(e => e.message).join('; ')
    throw new ValidationError(`Multiple validation errors: ${messages}`)
  }
}
