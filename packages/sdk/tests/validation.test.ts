/**
 * Validation utilities unit tests
 */

import { describe, it, expect } from 'vitest'
import {
  isValidChainId,
  isValidPrivacyLevel,
  isValidHex,
  isValidHexLength,
  isValidAmount,
  isNonNegativeAmount,
  isValidSlippage,
  isValidStealthMetaAddress,
  isValidCompressedPublicKey,
  isValidPrivateKey,
  validateAsset,
  validateIntentInput,
  validateIntentOutput,
  validateCreateIntentParams,
  validateViewingKey,
  isValidScalar,
  validateScalar,
  validateTimestamp,
  validateAll,
} from '../src/validation'
import { ValidationError } from '../src/errors'

// ─── Chain ID Validation ──────────────────────────────────────────────────────

describe('isValidChainId', () => {
  it('should accept valid chain IDs', () => {
    const validChains = [
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
      'cosmos',
      'osmosis',
      'injective',
      'celestia',
      'sei',
      'dydx',
    ]
    for (const chain of validChains) {
      expect(isValidChainId(chain)).toBe(true)
    }
  })

  it('should reject invalid chain IDs', () => {
    expect(isValidChainId('invalidchain')).toBe(false)
    expect(isValidChainId('polkadot')).toBe(false)
    expect(isValidChainId('')).toBe(false)
    expect(isValidChainId('ETHEREUM')).toBe(false) // case sensitive
  })
})

// ─── Privacy Level Validation ─────────────────────────────────────────────────

describe('isValidPrivacyLevel', () => {
  it('should accept valid privacy levels', () => {
    expect(isValidPrivacyLevel('transparent')).toBe(true)
    expect(isValidPrivacyLevel('shielded')).toBe(true)
    expect(isValidPrivacyLevel('compliant')).toBe(true)
  })

  it('should reject invalid privacy levels', () => {
    expect(isValidPrivacyLevel('private')).toBe(false)
    expect(isValidPrivacyLevel('public')).toBe(false)
    expect(isValidPrivacyLevel('')).toBe(false)
    expect(isValidPrivacyLevel(123)).toBe(false)
    expect(isValidPrivacyLevel(null)).toBe(false)
    expect(isValidPrivacyLevel(undefined)).toBe(false)
    expect(isValidPrivacyLevel({ level: 'shielded' })).toBe(false)
  })
})

// ─── Hex String Validation ────────────────────────────────────────────────────

describe('isValidHex', () => {
  it('should accept valid hex strings', () => {
    expect(isValidHex('0x1234')).toBe(true)
    expect(isValidHex('0xabcdef')).toBe(true)
    expect(isValidHex('0xABCDEF')).toBe(true)
    expect(isValidHex('0x0')).toBe(true)
    expect(isValidHex('0x' + 'a'.repeat(64))).toBe(true)
  })

  it('should reject invalid hex strings', () => {
    expect(isValidHex('1234')).toBe(false) // no prefix
    expect(isValidHex('0x')).toBe(false) // empty
    expect(isValidHex('0xghij')).toBe(false) // invalid chars
    expect(isValidHex('')).toBe(false)
    expect(isValidHex('0X1234')).toBe(false) // uppercase prefix
    // @ts-expect-error - testing invalid type
    expect(isValidHex(123)).toBe(false)
  })
})

describe('isValidHexLength', () => {
  it('should validate correct byte lengths', () => {
    expect(isValidHexLength('0x1234', 2)).toBe(true) // 2 bytes = 4 hex chars
    expect(isValidHexLength('0x' + 'ab'.repeat(32), 32)).toBe(true) // 32 bytes = 64 hex
    expect(isValidHexLength('0x' + 'cd'.repeat(33), 33)).toBe(true) // 33 bytes = 66 hex
  })

  it('should reject incorrect byte lengths', () => {
    expect(isValidHexLength('0x1234', 1)).toBe(false)
    expect(isValidHexLength('0x1234', 3)).toBe(false)
    expect(isValidHexLength('0x12', 2)).toBe(false) // only 1 byte
    expect(isValidHexLength('invalid', 2)).toBe(false)
  })
})

// ─── Amount Validation ────────────────────────────────────────────────────────

describe('isValidAmount', () => {
  it('should accept positive bigints', () => {
    expect(isValidAmount(1n)).toBe(true)
    expect(isValidAmount(100n)).toBe(true)
    expect(isValidAmount(BigInt(Number.MAX_SAFE_INTEGER) * 2n)).toBe(true)
  })

  it('should reject non-positive or non-bigint values', () => {
    expect(isValidAmount(0n)).toBe(false)
    expect(isValidAmount(-1n)).toBe(false)
    expect(isValidAmount(100)).toBe(false) // number, not bigint
    expect(isValidAmount('100')).toBe(false)
    expect(isValidAmount(null)).toBe(false)
  })
})

describe('isNonNegativeAmount', () => {
  it('should accept non-negative bigints', () => {
    expect(isNonNegativeAmount(0n)).toBe(true)
    expect(isNonNegativeAmount(1n)).toBe(true)
    expect(isNonNegativeAmount(BigInt(Number.MAX_SAFE_INTEGER))).toBe(true)
  })

  it('should reject negative or non-bigint values', () => {
    expect(isNonNegativeAmount(-1n)).toBe(false)
    expect(isNonNegativeAmount(-100n)).toBe(false)
    expect(isNonNegativeAmount(0)).toBe(false) // number
    expect(isNonNegativeAmount(null)).toBe(false)
  })
})

// ─── Slippage Validation ──────────────────────────────────────────────────────

describe('isValidSlippage', () => {
  it('should accept valid slippage values', () => {
    expect(isValidSlippage(0)).toBe(true)
    expect(isValidSlippage(0.01)).toBe(true)
    expect(isValidSlippage(0.5)).toBe(true)
    expect(isValidSlippage(0.99)).toBe(true)
    expect(isValidSlippage(0.999999)).toBe(true)
  })

  it('should reject invalid slippage values', () => {
    expect(isValidSlippage(1)).toBe(false) // exclusive
    expect(isValidSlippage(1.5)).toBe(false)
    expect(isValidSlippage(-0.1)).toBe(false)
    expect(isValidSlippage(NaN)).toBe(false)
    expect(isValidSlippage(Infinity)).toBe(false)
    // @ts-expect-error - testing invalid type
    expect(isValidSlippage('0.1')).toBe(false)
  })
})

// ─── Stealth Address Validation ───────────────────────────────────────────────

describe('isValidStealthMetaAddress', () => {
  // New format: sip:<chain>:<spendingKey>:<viewingKey>
  // Each key is 66 hex chars (33 bytes with 0x prefix)
  const validAddr = 'sip:ethereum:0x' + 'a'.repeat(66) + ':0x' + 'b'.repeat(66)

  it('should accept valid stealth meta-addresses', () => {
    expect(isValidStealthMetaAddress(validAddr)).toBe(true)
    expect(isValidStealthMetaAddress('sip:solana:0x' + 'b'.repeat(66) + ':0x' + 'c'.repeat(66))).toBe(true)
  })

  it('should reject invalid stealth meta-addresses', () => {
    // No sip: prefix
    expect(isValidStealthMetaAddress('0x' + 'a'.repeat(66) + ':0x' + 'b'.repeat(66))).toBe(false)
    // No 0x on keys
    expect(isValidStealthMetaAddress('sip:ethereum:' + 'a'.repeat(66) + ':' + 'b'.repeat(66))).toBe(false)
    // Wrong key length
    expect(isValidStealthMetaAddress('sip:ethereum:0x' + 'a'.repeat(50) + ':0x' + 'b'.repeat(66))).toBe(false)
    // Uppercase chain
    expect(isValidStealthMetaAddress('sip:ETH:0x' + 'a'.repeat(66) + ':0x' + 'b'.repeat(66))).toBe(false)
    // Old st: format no longer valid
    expect(isValidStealthMetaAddress('st:ethereum:0x' + 'a'.repeat(132))).toBe(false)
    expect(isValidStealthMetaAddress('')).toBe(false)
    // @ts-expect-error - testing invalid type
    expect(isValidStealthMetaAddress(123)).toBe(false)
  })
})

describe('isValidCompressedPublicKey', () => {
  it('should accept valid compressed public keys', () => {
    expect(isValidCompressedPublicKey('0x02' + 'a'.repeat(64))).toBe(true) // even y
    expect(isValidCompressedPublicKey('0x03' + 'b'.repeat(64))).toBe(true) // odd y
  })

  it('should reject invalid compressed public keys', () => {
    expect(isValidCompressedPublicKey('0x04' + 'a'.repeat(128))).toBe(false) // uncompressed
    expect(isValidCompressedPublicKey('0x01' + 'a'.repeat(64))).toBe(false) // wrong prefix
    expect(isValidCompressedPublicKey('0x02' + 'a'.repeat(62))).toBe(false) // too short
    expect(isValidCompressedPublicKey('0x02' + 'a'.repeat(66))).toBe(false) // too long
    expect(isValidCompressedPublicKey('')).toBe(false)
  })
})

describe('isValidPrivateKey', () => {
  it('should accept valid private keys', () => {
    expect(isValidPrivateKey('0x' + 'a'.repeat(64))).toBe(true) // 32 bytes
  })

  it('should reject invalid private keys', () => {
    expect(isValidPrivateKey('0x' + 'a'.repeat(62))).toBe(false) // too short
    expect(isValidPrivateKey('0x' + 'a'.repeat(66))).toBe(false) // too long
    expect(isValidPrivateKey('a'.repeat(64))).toBe(false) // no 0x
    expect(isValidPrivateKey('')).toBe(false)
  })
})

// ─── Asset Validation ─────────────────────────────────────────────────────────

describe('validateAsset', () => {
  const validAsset = {
    chain: 'ethereum',
    symbol: 'ETH',
    address: null,
    decimals: 18,
  }

  it('should accept valid assets', () => {
    expect(() => validateAsset(validAsset, 'asset')).not.toThrow()
    expect(() => validateAsset({
      ...validAsset,
      address: '0x' + 'a'.repeat(40),
    }, 'asset')).not.toThrow()
  })

  it('should reject non-object assets', () => {
    expect(() => validateAsset(null, 'asset')).toThrow(ValidationError)
    expect(() => validateAsset('asset', 'asset')).toThrow(ValidationError)
    expect(() => validateAsset(undefined, 'asset')).toThrow(ValidationError)
  })

  it('should reject invalid chain', () => {
    expect(() => validateAsset({ ...validAsset, chain: 'polkadot' }, 'asset'))
      .toThrow(/invalid chain/)
  })

  it('should reject empty symbol', () => {
    expect(() => validateAsset({ ...validAsset, symbol: '' }, 'asset'))
      .toThrow(/symbol must be a non-empty string/)
    expect(() => validateAsset({ ...validAsset, symbol: 123 }, 'asset'))
      .toThrow(/symbol must be a non-empty string/)
  })

  it('should reject invalid address', () => {
    expect(() => validateAsset({ ...validAsset, address: 'invalid' }, 'asset'))
      .toThrow(/address must be null or valid hex string/)
  })

  it('should reject invalid decimals', () => {
    expect(() => validateAsset({ ...validAsset, decimals: -1 }, 'asset'))
      .toThrow(/decimals must be a non-negative integer/)
    expect(() => validateAsset({ ...validAsset, decimals: 1.5 }, 'asset'))
      .toThrow(/decimals must be a non-negative integer/)
    expect(() => validateAsset({ ...validAsset, decimals: 'eighteen' }, 'asset'))
      .toThrow(/decimals must be a non-negative integer/)
  })
})

// ─── Intent Input Validation ──────────────────────────────────────────────────

describe('validateIntentInput', () => {
  const validInput = {
    asset: {
      chain: 'ethereum',
      symbol: 'ETH',
      address: null,
      decimals: 18,
    },
    amount: 1000000000000000000n, // 1 ETH
  }

  it('should accept valid intent input', () => {
    expect(() => validateIntentInput(validInput)).not.toThrow()
  })

  it('should reject non-object input', () => {
    expect(() => validateIntentInput(null)).toThrow(ValidationError)
    expect(() => validateIntentInput('input')).toThrow(ValidationError)
  })

  it('should reject invalid amount', () => {
    expect(() => validateIntentInput({ ...validInput, amount: 0n }))
      .toThrow(/amount must be a positive bigint/)
    expect(() => validateIntentInput({ ...validInput, amount: -1n }))
      .toThrow(/amount must be a positive bigint/)
    expect(() => validateIntentInput({ ...validInput, amount: 100 }))
      .toThrow(/amount must be a positive bigint/)
  })

  it('should reject invalid asset in input', () => {
    expect(() => validateIntentInput({ ...validInput, asset: null }))
      .toThrow(ValidationError)
  })
})

// ─── Intent Output Validation ─────────────────────────────────────────────────

describe('validateIntentOutput', () => {
  const validOutput = {
    asset: {
      chain: 'solana',
      symbol: 'SOL',
      address: null,
      decimals: 9,
    },
    minAmount: 5000000000n, // 5 SOL
    maxSlippage: 0.01,
  }

  it('should accept valid intent output', () => {
    expect(() => validateIntentOutput(validOutput)).not.toThrow()
  })

  it('should accept zero minAmount', () => {
    expect(() => validateIntentOutput({ ...validOutput, minAmount: 0n })).not.toThrow()
  })

  it('should reject non-object output', () => {
    expect(() => validateIntentOutput(null)).toThrow(ValidationError)
  })

  it('should reject invalid minAmount', () => {
    expect(() => validateIntentOutput({ ...validOutput, minAmount: -1n }))
      .toThrow(/minAmount must be a non-negative bigint/)
    expect(() => validateIntentOutput({ ...validOutput, minAmount: 100 }))
      .toThrow(/minAmount must be a non-negative bigint/)
  })

  it('should reject invalid maxSlippage', () => {
    expect(() => validateIntentOutput({ ...validOutput, maxSlippage: 1 }))
      .toThrow(/maxSlippage must be a number between 0 and 1/)
    expect(() => validateIntentOutput({ ...validOutput, maxSlippage: -0.01 }))
      .toThrow(/maxSlippage must be a number between 0 and 1/)
  })
})

// ─── Create Intent Params Validation ──────────────────────────────────────────

describe('validateCreateIntentParams', () => {
  const validParams = {
    input: {
      asset: { chain: 'ethereum', symbol: 'ETH', address: null, decimals: 18 },
      amount: 1000000000000000000n,
    },
    output: {
      asset: { chain: 'solana', symbol: 'SOL', address: null, decimals: 9 },
      minAmount: 5000000000n,
      maxSlippage: 0.01,
    },
    privacy: 'transparent',
  }

  it('should accept valid transparent params', () => {
    expect(() => validateCreateIntentParams(validParams)).not.toThrow()
  })

  it('should accept valid shielded params with meta-address', () => {
    // New format: sip:<chain>:<spendingKey>:<viewingKey>
    // Each key is 66 hex chars (33 bytes with 0x prefix)
    const shieldedParams = {
      ...validParams,
      privacy: 'shielded',
      recipientMetaAddress: 'sip:solana:0x' + 'a'.repeat(66) + ':0x' + 'b'.repeat(66),
    }
    expect(() => validateCreateIntentParams(shieldedParams)).not.toThrow()
  })

  it('should accept valid compliant params', () => {
    const compliantParams = {
      ...validParams,
      privacy: 'compliant',
      viewingKey: '0x' + 'a'.repeat(64),
    }
    expect(() => validateCreateIntentParams(compliantParams)).not.toThrow()
  })

  it('should reject non-object params', () => {
    expect(() => validateCreateIntentParams(null)).toThrow(/params must be an object/)
    expect(() => validateCreateIntentParams('params')).toThrow(/params must be an object/)
  })

  it('should reject missing input', () => {
    const { input: _, ...noInput } = validParams
    expect(() => validateCreateIntentParams(noInput)).toThrow(/input is required/)
  })

  it('should reject missing output', () => {
    const { output: _, ...noOutput } = validParams
    expect(() => validateCreateIntentParams(noOutput)).toThrow(/output is required/)
  })

  it('should reject missing privacy', () => {
    const { privacy: _, ...noPrivacy } = validParams
    expect(() => validateCreateIntentParams(noPrivacy)).toThrow(/privacy is required/)
  })

  it('should reject invalid privacy level', () => {
    expect(() => validateCreateIntentParams({ ...validParams, privacy: 'private' }))
      .toThrow(/invalid privacy level/)
  })

  it('should reject invalid stealth meta-address', () => {
    const shieldedParams = {
      ...validParams,
      privacy: 'shielded',
      recipientMetaAddress: 'invalid-address',
    }
    expect(() => validateCreateIntentParams(shieldedParams))
      .toThrow(/invalid stealth meta-address format/)
  })

  it('should require viewingKey for compliant mode', () => {
    const compliantParams = { ...validParams, privacy: 'compliant' }
    expect(() => validateCreateIntentParams(compliantParams))
      .toThrow(/viewingKey is required for compliant mode/)
  })

  it('should reject invalid viewingKey format', () => {
    const compliantParams = {
      ...validParams,
      privacy: 'compliant',
      viewingKey: 'invalid-key',
    }
    expect(() => validateCreateIntentParams(compliantParams))
      .toThrow(/viewingKey must be a valid hex string/)
  })

  it('should reject invalid ttl', () => {
    expect(() => validateCreateIntentParams({ ...validParams, ttl: 0 }))
      .toThrow(/ttl must be a positive integer/)
    expect(() => validateCreateIntentParams({ ...validParams, ttl: -100 }))
      .toThrow(/ttl must be a positive integer/)
    expect(() => validateCreateIntentParams({ ...validParams, ttl: 1.5 }))
      .toThrow(/ttl must be a positive integer/)
  })

  it('should accept valid ttl', () => {
    expect(() => validateCreateIntentParams({ ...validParams, ttl: 3600 })).not.toThrow()
  })
})

// ─── Viewing Key Validation ───────────────────────────────────────────────────

describe('validateViewingKey', () => {
  it('should accept valid viewing keys', () => {
    expect(() => validateViewingKey('0x' + 'a'.repeat(64))).not.toThrow()
  })

  it('should reject non-string keys', () => {
    expect(() => validateViewingKey(null)).toThrow(/must be a string/)
    expect(() => validateViewingKey(123)).toThrow(/must be a string/)
  })

  it('should reject invalid hex format', () => {
    expect(() => validateViewingKey('not-hex')).toThrow(/must be a valid hex string/)
    expect(() => validateViewingKey('a'.repeat(64))).toThrow(/must be a valid hex string/)
  })

  it('should reject wrong length', () => {
    expect(() => validateViewingKey('0x' + 'a'.repeat(62))).toThrow(/must be 32 bytes/)
    expect(() => validateViewingKey('0x' + 'a'.repeat(66))).toThrow(/must be 32 bytes/)
  })
})

// ─── Scalar Validation ────────────────────────────────────────────────────────

describe('isValidScalar', () => {
  const CURVE_ORDER = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n

  it('should accept valid scalars', () => {
    expect(isValidScalar(1n)).toBe(true)
    expect(isValidScalar(CURVE_ORDER - 1n)).toBe(true)
    expect(isValidScalar(12345678901234567890n)).toBe(true)
  })

  it('should reject invalid scalars', () => {
    expect(isValidScalar(0n)).toBe(false) // must be > 0
    expect(isValidScalar(-1n)).toBe(false)
    expect(isValidScalar(CURVE_ORDER)).toBe(false) // must be < n
    expect(isValidScalar(CURVE_ORDER + 1n)).toBe(false)
  })
})

describe('validateScalar', () => {
  it('should accept valid scalars', () => {
    expect(() => validateScalar(1n, 'scalar')).not.toThrow()
  })

  it('should reject non-bigint', () => {
    expect(() => validateScalar(100, 'scalar')).toThrow(/must be a bigint/)
    expect(() => validateScalar('100', 'scalar')).toThrow(/must be a bigint/)
  })

  it('should reject out of range', () => {
    expect(() => validateScalar(0n, 'scalar')).toThrow(/must be in range/)
  })
})

// ─── Timestamp Validation ─────────────────────────────────────────────────────

describe('validateTimestamp', () => {
  it('should accept valid future timestamps', () => {
    const future = Date.now() + 60000 // 1 minute in future
    expect(() => validateTimestamp(future, 'expiry')).not.toThrow()
  })

  it('should accept past timestamps when allowPast is true', () => {
    const past = Date.now() - 60000 // 1 minute ago
    expect(() => validateTimestamp(past, 'timestamp', { allowPast: true })).not.toThrow()
  })

  it('should reject past timestamps by default', () => {
    const past = Date.now() - 60000
    expect(() => validateTimestamp(past, 'expiry')).toThrow(/must not be in the past/)
  })

  it('should reject non-integer timestamps', () => {
    expect(() => validateTimestamp(1.5, 'ts')).toThrow(/must be a non-negative integer/)
    expect(() => validateTimestamp('now', 'ts')).toThrow(/must be a non-negative integer/)
  })

  it('should reject negative timestamps', () => {
    expect(() => validateTimestamp(-1, 'ts')).toThrow(/must be a non-negative integer/)
  })
})

// ─── Composite Validators ─────────────────────────────────────────────────────

describe('validateAll', () => {
  it('should pass when all validators pass', () => {
    expect(() => validateAll([
      () => {},
      () => {},
      () => {},
    ])).not.toThrow()
  })

  it('should throw single error when one fails', () => {
    expect(() => validateAll([
      () => {},
      () => { throw new ValidationError('error1', 'field1') },
      () => {},
    ])).toThrow('error1')
  })

  it('should collect multiple validation errors', () => {
    expect(() => validateAll([
      () => { throw new ValidationError('error1', 'field1') },
      () => { throw new ValidationError('error2', 'field2') },
    ])).toThrow(/Multiple validation errors/)
  })

  it('should re-throw non-ValidationError immediately', () => {
    expect(() => validateAll([
      () => { throw new Error('not a validation error') },
    ])).toThrow('not a validation error')
  })
})
