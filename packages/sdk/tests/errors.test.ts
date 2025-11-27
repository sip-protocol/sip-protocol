/**
 * Error classes and utilities unit tests
 */

import { describe, it, expect } from 'vitest'
import {
  ErrorCode,
  SIPError,
  ValidationError,
  CryptoError,
  ProofError,
  IntentError,
  NetworkError,
  ProofNotImplementedError,
  EncryptionNotImplementedError,
  isSIPError,
  hasErrorCode,
  wrapError,
  getErrorMessage,
} from '../src/errors'

// ─── ErrorCode Enum ───────────────────────────────────────────────────────────

describe('ErrorCode', () => {
  it('should have general error codes (1xxx)', () => {
    expect(ErrorCode.UNKNOWN).toBe('SIP_1000')
    expect(ErrorCode.INTERNAL).toBe('SIP_1001')
    expect(ErrorCode.NOT_IMPLEMENTED).toBe('SIP_1002')
  })

  it('should have validation error codes (2xxx)', () => {
    expect(ErrorCode.VALIDATION_FAILED).toBe('SIP_2000')
    expect(ErrorCode.INVALID_INPUT).toBe('SIP_2001')
    expect(ErrorCode.INVALID_CHAIN).toBe('SIP_2002')
    expect(ErrorCode.INVALID_PRIVACY_LEVEL).toBe('SIP_2003')
    expect(ErrorCode.INVALID_AMOUNT).toBe('SIP_2004')
    expect(ErrorCode.INVALID_HEX).toBe('SIP_2005')
    expect(ErrorCode.INVALID_KEY).toBe('SIP_2006')
    expect(ErrorCode.INVALID_ADDRESS).toBe('SIP_2007')
    expect(ErrorCode.MISSING_REQUIRED).toBe('SIP_2008')
    expect(ErrorCode.OUT_OF_RANGE).toBe('SIP_2009')
  })

  it('should have crypto error codes (3xxx)', () => {
    expect(ErrorCode.CRYPTO_FAILED).toBe('SIP_3000')
    expect(ErrorCode.ENCRYPTION_FAILED).toBe('SIP_3001')
    expect(ErrorCode.DECRYPTION_FAILED).toBe('SIP_3002')
    expect(ErrorCode.KEY_DERIVATION_FAILED).toBe('SIP_3003')
    expect(ErrorCode.COMMITMENT_FAILED).toBe('SIP_3004')
    expect(ErrorCode.SIGNATURE_FAILED).toBe('SIP_3005')
    expect(ErrorCode.INVALID_CURVE_POINT).toBe('SIP_3006')
    expect(ErrorCode.INVALID_SCALAR).toBe('SIP_3007')
  })

  it('should have proof error codes (4xxx)', () => {
    expect(ErrorCode.PROOF_FAILED).toBe('SIP_4000')
    expect(ErrorCode.PROOF_GENERATION_FAILED).toBe('SIP_4001')
    expect(ErrorCode.PROOF_VERIFICATION_FAILED).toBe('SIP_4002')
    expect(ErrorCode.PROOF_NOT_IMPLEMENTED).toBe('SIP_4003')
    expect(ErrorCode.PROOF_PROVIDER_NOT_READY).toBe('SIP_4004')
    expect(ErrorCode.INVALID_PROOF_PARAMS).toBe('SIP_4005')
  })

  it('should have intent error codes (5xxx)', () => {
    expect(ErrorCode.INTENT_FAILED).toBe('SIP_5000')
    expect(ErrorCode.INTENT_EXPIRED).toBe('SIP_5001')
    expect(ErrorCode.INTENT_CANCELLED).toBe('SIP_5002')
    expect(ErrorCode.INTENT_NOT_FOUND).toBe('SIP_5003')
    expect(ErrorCode.INTENT_INVALID_STATE).toBe('SIP_5004')
    expect(ErrorCode.PROOFS_REQUIRED).toBe('SIP_5005')
    expect(ErrorCode.QUOTE_EXPIRED).toBe('SIP_5006')
  })

  it('should have network error codes (6xxx)', () => {
    expect(ErrorCode.NETWORK_FAILED).toBe('SIP_6000')
    expect(ErrorCode.NETWORK_TIMEOUT).toBe('SIP_6001')
    expect(ErrorCode.NETWORK_UNAVAILABLE).toBe('SIP_6002')
    expect(ErrorCode.RPC_ERROR).toBe('SIP_6003')
    expect(ErrorCode.API_ERROR).toBe('SIP_6004')
    expect(ErrorCode.RATE_LIMITED).toBe('SIP_6005')
  })
})

// ─── SIPError Base Class ──────────────────────────────────────────────────────

describe('SIPError', () => {
  it('should create error with message and code', () => {
    const error = new SIPError('test error', ErrorCode.UNKNOWN)
    expect(error.message).toBe('test error')
    expect(error.code).toBe(ErrorCode.UNKNOWN)
    expect(error.name).toBe('SIPError')
    expect(error instanceof Error).toBe(true)
  })

  it('should create error with context', () => {
    const error = new SIPError('test', ErrorCode.UNKNOWN, { context: { foo: 'bar' } })
    expect(error.context).toEqual({ foo: 'bar' })
  })

  it('should create error with cause', () => {
    const cause = new Error('original error')
    const error = new SIPError('wrapped', ErrorCode.UNKNOWN, { cause })
    expect(error.cause).toBe(cause)
  })

  it('should have timestamp', () => {
    const before = new Date()
    const error = new SIPError('test', ErrorCode.UNKNOWN)
    const after = new Date()
    expect(error.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(error.timestamp.getTime()).toBeLessThanOrEqual(after.getTime())
  })

  it('should serialize to JSON', () => {
    const cause = new Error('cause')
    const error = new SIPError('test', ErrorCode.UNKNOWN, {
      cause,
      context: { key: 'value' },
    })

    const json = error.toJSON()
    expect(json.name).toBe('SIPError')
    expect(json.message).toBe('test')
    expect(json.code).toBe(ErrorCode.UNKNOWN)
    expect(json.context).toEqual({ key: 'value' })
    expect(json.cause).toBe('cause')
    expect(json.timestamp).toBeDefined()
    expect(json.stack).toBeDefined()
  })

  it('should have custom toString', () => {
    const error = new SIPError('test error', ErrorCode.UNKNOWN)
    expect(error.toString()).toContain('SIPError')
    expect(error.toString()).toContain('SIP_1000')
    expect(error.toString()).toContain('test error')
  })
})

// ─── ValidationError ──────────────────────────────────────────────────────────

describe('ValidationError', () => {
  it('should create with message and field', () => {
    const error = new ValidationError('is required', 'username')
    expect(error.message).toBe("Validation failed for 'username': is required")
    expect(error.field).toBe('username')
    expect(error.code).toBe(ErrorCode.VALIDATION_FAILED)
    expect(error.name).toBe('ValidationError')
  })

  it('should create without field', () => {
    const error = new ValidationError('validation failed')
    expect(error.message).toBe('Validation failed: validation failed')
    expect(error.field).toBeUndefined()
  })

  it('should include details in context', () => {
    const error = new ValidationError('invalid', 'email', { format: 'expected @' })
    expect(error.context).toEqual({ format: 'expected @' })
  })

  it('should accept custom error code', () => {
    const error = new ValidationError('missing', 'field', undefined, ErrorCode.MISSING_REQUIRED)
    expect(error.code).toBe(ErrorCode.MISSING_REQUIRED)
  })

  it('should serialize correctly', () => {
    const error = new ValidationError('invalid', 'email')
    const json = error.toJSON()
    expect(json.name).toBe('ValidationError')
    // ValidationError adds field directly to JSON, not in context
    expect((json as { field?: string }).field).toBe('email')
  })
})

// ─── CryptoError ──────────────────────────────────────────────────────────────

describe('CryptoError', () => {
  it('should create with default code', () => {
    const error = new CryptoError('crypto failed')
    expect(error.message).toBe('crypto failed')
    expect(error.code).toBe(ErrorCode.CRYPTO_FAILED)
    expect(error.name).toBe('CryptoError')
  })

  it('should create with custom code', () => {
    const error = new CryptoError('decrypt failed', ErrorCode.DECRYPTION_FAILED)
    expect(error.code).toBe(ErrorCode.DECRYPTION_FAILED)
  })

  it('should include operation as property', () => {
    const error = new CryptoError('failed', ErrorCode.CRYPTO_FAILED, {
      operation: 'encrypt',
    })
    // operation is stored as a class property, not in context
    expect(error.operation).toBe('encrypt')
  })

  it('should support cause chain', () => {
    const cause = new Error('underlying')
    const error = new CryptoError('crypto', ErrorCode.CRYPTO_FAILED, { cause })
    expect(error.cause).toBe(cause)
  })
})

// ─── ProofError ───────────────────────────────────────────────────────────────

describe('ProofError', () => {
  it('should create with default code', () => {
    const error = new ProofError('proof failed')
    expect(error.message).toBe('proof failed')
    expect(error.code).toBe(ErrorCode.PROOF_FAILED)
    expect(error.name).toBe('ProofError')
  })

  it('should create with custom code', () => {
    const error = new ProofError('generation failed', ErrorCode.PROOF_GENERATION_FAILED)
    expect(error.code).toBe(ErrorCode.PROOF_GENERATION_FAILED)
  })

  it('should include context', () => {
    const error = new ProofError('failed', ErrorCode.PROOF_FAILED, {
      context: { proofType: 'funding' },
    })
    expect(error.context?.proofType).toBe('funding')
  })
})

// ─── IntentError ──────────────────────────────────────────────────────────────

describe('IntentError', () => {
  it('should create with default code', () => {
    const error = new IntentError('intent failed')
    expect(error.message).toBe('intent failed')
    expect(error.code).toBe(ErrorCode.INTENT_FAILED)
    expect(error.name).toBe('IntentError')
  })

  it('should create with custom code', () => {
    const error = new IntentError('not found', ErrorCode.INTENT_NOT_FOUND)
    expect(error.code).toBe(ErrorCode.INTENT_NOT_FOUND)
  })

  it('should include intentId as property', () => {
    const error = new IntentError('expired', ErrorCode.INTENT_EXPIRED, {
      intentId: 'sip-abc123',
      context: { status: 'expired' },
    })
    expect(error.intentId).toBe('sip-abc123')
    expect(error.context?.status).toBe('expired')
  })
})

// ─── NetworkError ─────────────────────────────────────────────────────────────

describe('NetworkError', () => {
  it('should create with default code', () => {
    const error = new NetworkError('network failed')
    expect(error.message).toBe('network failed')
    expect(error.code).toBe(ErrorCode.NETWORK_FAILED)
    expect(error.name).toBe('NetworkError')
  })

  it('should create with custom code', () => {
    const error = new NetworkError('timeout', ErrorCode.NETWORK_TIMEOUT)
    expect(error.code).toBe(ErrorCode.NETWORK_TIMEOUT)
  })

  it('should include HTTP details as properties', () => {
    const error = new NetworkError('API error', ErrorCode.API_ERROR, {
      statusCode: 500,
      endpoint: 'https://api.example.com',
      context: { responseBody: 'Internal Server Error' },
    })
    expect(error.statusCode).toBe(500)
    expect(error.endpoint).toBe('https://api.example.com')
    expect(error.context?.responseBody).toBe('Internal Server Error')
  })
})

// ─── Legacy Error Classes ─────────────────────────────────────────────────────

describe('ProofNotImplementedError', () => {
  it('should extend ProofError', () => {
    const error = new ProofNotImplementedError('funding', 'docs/specs/FUNDING-PROOF.md')
    expect(error instanceof ProofError).toBe(true)
    expect(error instanceof SIPError).toBe(true)
    expect(error.name).toBe('ProofNotImplementedError')
    expect(error.code).toBe(ErrorCode.PROOF_NOT_IMPLEMENTED)
  })

  it('should include proof type in message', () => {
    const error = new ProofNotImplementedError('validity', 'docs/specs/VALIDITY-PROOF.md')
    expect(error.message).toContain('Validity')
    expect(error.message).toContain('not implemented')
    expect(error.context?.specReference).toBe('docs/specs/VALIDITY-PROOF.md')
  })
})

describe('EncryptionNotImplementedError', () => {
  it('should extend CryptoError', () => {
    const error = new EncryptionNotImplementedError('encrypt', 'docs/specs/ENCRYPTION.md')
    expect(error instanceof CryptoError).toBe(true)
    expect(error instanceof SIPError).toBe(true)
    expect(error.name).toBe('EncryptionNotImplementedError')
    expect(error.code).toBe(ErrorCode.NOT_IMPLEMENTED)
  })

  it('should include operation in context', () => {
    const error = new EncryptionNotImplementedError('decrypt', 'docs/specs/ENCRYPTION.md')
    expect(error.context?.operation).toBe('decrypt')
    expect(error.context?.specReference).toBe('docs/specs/ENCRYPTION.md')
  })
})

// ─── Utility Functions ────────────────────────────────────────────────────────

describe('isSIPError', () => {
  it('should return true for SIPError instances', () => {
    expect(isSIPError(new SIPError('test', ErrorCode.UNKNOWN))).toBe(true)
    expect(isSIPError(new ValidationError('test'))).toBe(true)
    expect(isSIPError(new CryptoError('test'))).toBe(true)
    expect(isSIPError(new ProofError('test'))).toBe(true)
    expect(isSIPError(new IntentError('test'))).toBe(true)
    expect(isSIPError(new NetworkError('test'))).toBe(true)
  })

  it('should return false for non-SIPError', () => {
    expect(isSIPError(new Error('test'))).toBe(false)
    expect(isSIPError(null)).toBe(false)
    expect(isSIPError(undefined)).toBe(false)
    expect(isSIPError('error')).toBe(false)
    expect(isSIPError({ message: 'test', code: 'SIP_1000' })).toBe(false)
  })
})

describe('hasErrorCode', () => {
  it('should return true when error has matching code', () => {
    const error = new ValidationError('test', 'field', undefined, ErrorCode.MISSING_REQUIRED)
    expect(hasErrorCode(error, ErrorCode.MISSING_REQUIRED)).toBe(true)
  })

  it('should return false when code does not match', () => {
    const error = new ValidationError('test')
    expect(hasErrorCode(error, ErrorCode.MISSING_REQUIRED)).toBe(false)
  })

  it('should return false for non-SIPError', () => {
    expect(hasErrorCode(new Error('test'), ErrorCode.UNKNOWN)).toBe(false)
    expect(hasErrorCode(null, ErrorCode.UNKNOWN)).toBe(false)
  })
})

describe('wrapError', () => {
  it('should wrap generic Error in SIPError', () => {
    const original = new Error('original message')
    const wrapped = wrapError(original, 'Wrapped message')

    expect(wrapped instanceof SIPError).toBe(true)
    expect(wrapped.message).toBe('Wrapped message')
    expect(wrapped.cause).toBe(original)
  })

  it('should return SIPError unchanged', () => {
    const original = new ValidationError('validation failed', 'field')
    const wrapped = wrapError(original, 'Should not wrap')

    expect(wrapped).toBe(original)
    expect(wrapped.message).toBe("Validation failed for 'field': validation failed")
  })

  it('should wrap non-Error values', () => {
    const wrapped = wrapError('string error', 'Wrapped message')
    expect(wrapped instanceof SIPError).toBe(true)
    expect(wrapped.message).toBe('Wrapped message')
    // The original value is wrapped in Error as cause
    expect(wrapped.cause).toBeInstanceOf(Error)
  })

  it('should handle null/undefined', () => {
    const wrapped = wrapError(null, 'Wrapped null')
    expect(wrapped instanceof SIPError).toBe(true)
    expect(wrapped.message).toBe('Wrapped null')
  })
})

describe('getErrorMessage', () => {
  it('should extract message from SIPError', () => {
    const error = new ValidationError('is invalid', 'email')
    expect(getErrorMessage(error)).toBe("Validation failed for 'email': is invalid")
  })

  it('should extract message from Error', () => {
    const error = new Error('standard error')
    expect(getErrorMessage(error)).toBe('standard error')
  })

  it('should convert string to message', () => {
    expect(getErrorMessage('string error')).toBe('string error')
  })

  it('should stringify other values', () => {
    expect(getErrorMessage(123)).toBe('123')
    expect(getErrorMessage(null)).toBe('null')
    expect(getErrorMessage(undefined)).toBe('undefined')
    expect(getErrorMessage({ key: 'value' })).toBe('[object Object]')
  })
})
